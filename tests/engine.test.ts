import { describe, expect, it } from 'vitest';
import {
  createGame,
  execute,
  resolveDice,
  type Environment,
} from '../packages/game-engine/index.ts';
import { FORMATS, type GameState, type Command } from '../packages/game-model/index.ts';
import { THEMES, zoneLayout } from '../packages/game-ui/index.ts';
import { deserialize, serialize, LocalGameStorage } from '../packages/game-storage/index.ts';

function environment(values = [0.1, 0.9, 0.4, 0.6]): Environment {
  let id = 0,
    index = 0;
  return {
    id: () => `id-${++id}`,
    now: () => '2026-09-30T10:00:00.000Z',
    random: () => values[index++ % values.length],
  };
}
function setup(n = 2) {
  const env = environment();
  const initial = createGame(
    { players: Array.from({ length: n }, (_, i) => ({ theme: THEMES[i] })), format: FORMATS[1] },
    env,
  );
  return { env, initial, game: execute(initial, { type: 'dismiss' }, null, env) };
}
describe('local game engine', () => {
  it.each([2, 3, 4])('creates %i clockwise seats with an initial resolution', (n) => {
    const { initial } = setup(n);
    expect(initial.players).toHaveLength(n);
    expect(initial.history[0].type).toBe('initial');
    expect(initial.turnOrder[0]).toBe(initial.startingPlayerId);
    expect(new Set(initial.turnOrder).size).toBe(n);
  });
  it('blocks every mutation while a resolution is visible', () => {
    const { initial, env } = setup();
    const p = initial.players[0].id;
    const commands: Command[] = [
      { type: 'counter', playerId: p, counter: 'life', delta: 1 },
      { type: 'monarch', playerId: p },
      { type: 'roll', kind: 'coin', all: true },
      { type: 'finish' },
      { type: 'view', playerId: p, counter: 'poison' },
    ];
    for (const c of commands) expect(() => execute(initial, c, p, env)).toThrow('Cierra');
  });
  it('allows negative life and leaves the source immutable', () => {
    const { game, env } = setup();
    const p = game.players[0].id;
    const next = execute(
      game,
      { type: 'counter', playerId: p, counter: 'life', delta: -50 },
      p,
      env,
    );
    expect(next.players[0].life).toBe(-10);
    expect(game.players[0].life).toBe(40);
    expect(next.status).toBe('active');
  });
  it('updates poison and commander independently and rejects negative counters', () => {
    let { game, env } = setup();
    const [p, q] = game.players;
    game = execute(
      game,
      { type: 'counter', playerId: p.id, counter: 'poison', delta: 2 },
      p.id,
      env,
    );
    game = execute(
      game,
      { type: 'counter', playerId: p.id, counter: `commander:${q.id}`, delta: 5 },
      q.id,
      env,
    );
    expect(game.players[0].life).toBe(40);
    expect(game.players[0].poison).toBe(2);
    expect(game.players[0].commanderDamageByOpponent[q.id]).toBe(5);
    expect(() =>
      execute(game, { type: 'counter', playerId: p.id, counter: 'poison', delta: -3 }, p.id, env),
    ).toThrow();
  });
  it('undo compensates the chosen event without losing later changes', () => {
    let { game, env } = setup();
    const p = game.players[0].id;
    game = execute(game, { type: 'counter', playerId: p, counter: 'life', delta: -5 }, p, env);
    const target = game.history.at(-1)!.id;
    game = execute(game, { type: 'counter', playerId: p, counter: 'life', delta: 2 }, p, env);
    game = execute(game, { type: 'undo', eventId: target }, p, env);
    expect(game.players[0].life).toBe(42);
    expect(game.history.find((e) => e.id === target)?.revertedByEventId).toBe(
      game.history.at(-1)?.id,
    );
    expect(() => execute(game, { type: 'undo', eventId: target }, p, env)).toThrow();
  });
  it('undo cannot make poison negative', () => {
    let { game, env } = setup();
    const p = game.players[0].id;
    game = execute(game, { type: 'counter', playerId: p, counter: 'poison', delta: 1 }, p, env);
    const target = game.history.at(-1)!.id;
    game = execute(game, { type: 'counter', playerId: p, counter: 'poison', delta: -1 }, p, env);
    expect(() => execute(game, { type: 'undo', eventId: target }, p, env)).toThrow();
  });
  it('transfers the unique monarch and undoes transfers in dependency order', () => {
    let { game, env } = setup();
    const [p, q] = game.players;
    game = execute(game, { type: 'monarch', playerId: p.id }, p.id, env);
    const first = game.history.at(-1)!.id;
    game = execute(game, { type: 'monarch', playerId: q.id }, q.id, env);
    const second = game.history.at(-1)!.id;
    expect(game.monarchPlayerId).toBe(q.id);
    expect(() => execute(game, { type: 'undo', eventId: first }, p.id, env)).toThrow();
    game = execute(game, { type: 'undo', eventId: second }, q.id, env);
    expect(game.monarchPlayerId).toBe(p.id);
    game = execute(game, { type: 'undo', eventId: first }, p.id, env);
    expect(game.monarchPlayerId).toBeNull();
  });
  it('rerolls only tied leaders until a unique winner', () => {
    const rolls = [0.95, 0.95, 0.1, 0.5, 0.8];
    let draws = 0;
    const env = environment();
    env.random = () => rolls[draws++];
    const result = resolveDice(['a', 'b', 'c'], 20, env);
    expect(draws).toBe(5);
    expect(result.winnerId).toBe('b');
    expect(result.results.find((r) => r.playerId === 'b')?.value).toBe(17);
  });
  it('guards against a defective random source that never resolves ties', () => {
    expect(() => resolveDice(['a', 'b'], 20, environment([0.5]))).toThrow('empate');
  });
  it.each([6, 8, 10, 12, 20])(
    'rolls d%i for everyone and persists the blocking result',
    (sides) => {
      const { game, env } = setup(4);
      const next = execute(
        game,
        { type: 'roll', kind: 'dice', sides, all: true },
        game.players[0].id,
        env,
      );
      expect(next.resolution?.results).toHaveLength(4);
      expect(
        next.resolution?.results.every(
          (r) => typeof r.value === 'number' && r.value >= 1 && r.value <= sides,
        ),
      ).toBe(true);
      expect(deserialize(serialize(next))).toEqual(next);
    },
  );
  it('global coins have no winner; individual rolls affect one result', () => {
    const { game, env } = setup();
    const next = execute(game, { type: 'roll', kind: 'coin', all: true }, game.players[0].id, env);
    expect(next.resolution?.winnerId).toBeUndefined();
    expect(next.resolution?.results).toHaveLength(2);
    expect(
      execute(game, { type: 'roll', kind: 'dice', sides: 6, all: false }, game.players[0].id, env)
        .resolution?.results,
    ).toHaveLength(1);
  });
  it('finishes, blocks editing, exports the summary and reopens without a winner', () => {
    const { game, env } = setup();
    const done = execute(game, { type: 'finish' }, game.players[0].id, env);
    expect(deserialize(serialize(done))).toEqual(done);
    expect(done.summary?.players).toHaveLength(2);
    expect(() =>
      execute(done, { type: 'monarch', playerId: game.players[0].id }, null, env),
    ).toThrow('finalizada');
    const reopened = execute(done, { type: 'reopen' }, game.players[0].id, env);
    expect(reopened.status).toBe('active');
    expect(reopened.summary).toBeUndefined();
  });
  it('restores future remote ownership as local with an audit event', () => {
    const { game, env } = setup();
    game.mode = 'online';
    game.players[0].isLocalControlled = false;
    game.players[0].controlOwner = { kind: 'remote', participantId: 'remote' };
    const restored = execute(deserialize(serialize(game)), { type: 'restore' }, null, env);
    expect(restored.mode).toBe('local');
    expect(
      restored.players.every((p) => p.isLocalControlled && p.controlOwner.kind === 'local'),
    ).toBe(true);
    expect(restored.history.at(-1)?.type).toBe('restore');
  });
});
describe('backups and storage', () => {
  it('roundtrips active counters, history, themes and layout', () => {
    const { game, env } = setup(3);
    const next = execute(
      game,
      { type: 'view', playerId: game.players[0].id, counter: 'poison' },
      game.players[0].id,
      env,
    );
    expect(deserialize(serialize(next))).toEqual(next);
  });
  it.each(['version', 'duplicate', 'opponent', 'turns', 'view', 'actor', 'undo', 'theme'])(
    'rejects corrupt %s',
    (kind) => {
      const { game } = setup();
      const s = JSON.parse(serialize(game));
      if (kind === 'version') s.schemaVersion = 2;
      if (kind === 'duplicate') s.game.players[1].id = s.game.players[0].id;
      if (kind === 'opponent') s.game.players[0].commanderDamageByOpponent = {};
      if (kind === 'turns') s.game.turnOrder = [];
      if (kind === 'view') s.game.activeViewByPlayer[game.players[0].id] = 'commander:missing';
      if (kind === 'actor') s.game.history[0].actorPlayerId = 'missing';
      if (kind === 'undo') s.game.history[0].revertedByEventId = 'missing';
      if (kind === 'theme') s.game.players[0].theme.primary = 'invalid';
      expect(() => deserialize(JSON.stringify(s))).toThrow();
    },
  );
  it('serializes concurrent writes and can recover after a failed save', async () => {
    const { game } = setup();
    const written: string[] = [];
    let calls = 0;
    const storage = new LocalGameStorage({
      getItem: async () => written.at(-1) ?? null,
      setItem: async (_, v) => {
        if (++calls === 1) throw new Error('disk full');
        await Promise.resolve();
        written.push(v);
      },
    });
    await expect(storage.save(game)).rejects.toThrow('disk full');
    const second = { ...game, stripMode: 'minimal' as const };
    await Promise.all([storage.save(game), storage.save(second)]);
    expect(await storage.load()).toEqual(second);
  });
});
describe('table positions', () => {
  it.each(['left', 'right'] as const)(
    'keeps clockwise turn order with the third player on the %s',
    (side) => {
      const env = environment([0.1, 0.9, 0.4]);
      const game = createGame(
        {
          players: THEMES.slice(0, 3).map((theme) => ({ theme })),
          format: FORMATS[1],
          thirdPlayerSide: side,
        },
        env,
      );
      const [a, b, c] = game.players.map((player) => player.id);
      expect(game.startingPlayerId).toBe(b);
      expect(game.turnOrder).toEqual(side === 'right' ? [b, a, c] : [b, c, a]);
    },
  );
  it('places player three at either side', () => {
    expect(zoneLayout(3, 2, 'right').rotation).toBe(270);
    expect(zoneLayout(3, 2, 'left').rotation).toBe(90);
    expect(zoneLayout(4, 2, 'right').top).toBe(50);
  });
  it('provides all sixteen replaceable themes', () => expect(THEMES).toHaveLength(16));
});

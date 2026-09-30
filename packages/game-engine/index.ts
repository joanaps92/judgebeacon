import type {
  Command,
  Counter,
  GameEvent,
  GameFormat,
  GameState,
  PlayerTheme,
  Resolution,
} from '../game-model/index.ts';
export interface Environment {
  id(): string;
  now(): string;
  random(): number;
}
export interface NewGame {
  players: { name?: string; theme: PlayerTheme }[];
  format: GameFormat;
  thirdPlayerSide?: 'left' | 'right';
  stripMode?: 'minimal' | 'full';
}
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function event(
  g: GameState,
  env: Environment,
  type: string,
  actor: string | null,
  payload: Record<string, unknown>,
  reversible = false,
): GameEvent {
  const e = { id: env.id(), type, timestamp: env.now(), actorPlayerId: actor, payload, reversible };
  g.history.push(e);
  g.updatedAt = e.timestamp;
  return e;
}
function die(env: Environment, sides: number) {
  const r = env.random();
  check(r >= 0 && r < 1, 'Aleatoriedad inválida');
  return Math.floor(r * sides) + 1;
}
export function resolveDice(
  ids: string[],
  sides: number,
  env: Environment,
): { results: { playerId: string; value: number }[]; winnerId: string } {
  check(ids.length > 0 && new Set(ids).size === ids.length, 'Participantes inválidos');
  check([6, 8, 10, 12, 20].includes(sides), 'Dado inválido');
  let contenders = [...ids];
  const scores: Record<string, number> = {};
  for (let round = 0; round < 1000; round++) {
    for (const id of contenders) scores[id] = die(env, sides);
    const max = Math.max(...contenders.map((id) => scores[id]));
    const winners = contenders.filter((id) => scores[id] === max);
    if (winners.length === 1)
      return {
        results: contenders.map((playerId) => ({ playerId, value: scores[playerId] })),
        winnerId: winners[0],
      };
    contenders = winners;
  }
  throw new Error('No se ha podido resolver el empate. Vuelve a lanzar.');
}
export function createGame(config: NewGame, env: Environment): GameState {
  check([2, 3, 4].includes(config.players.length), 'Se necesitan 2, 3 o 4 jugadores');
  check(
    Number.isSafeInteger(config.format.startingLife) && config.format.startingLife > 0,
    'Vidas iniciales inválidas',
  );
  const ids = config.players.map(() => env.id());
  const now = env.now();
  const initial = resolveDice(ids, 20, env);
  const clockwise =
    ids.length === 3 && config.thirdPlayerSide !== 'left' ? [ids[0], ids[2], ids[1]] : ids;
  const start = clockwise.indexOf(initial.winnerId);
  const g: GameState = {
    id: env.id(),
    mode: 'local',
    status: 'active',
    format: copy(config.format),
    players: config.players.map((p, i) => ({
      id: ids[i],
      name: p.name?.trim() || `Jugador ${i + 1}`,
      theme: copy(p.theme),
      life: config.format.startingLife,
      poison: 0,
      commanderDamageByOpponent: Object.fromEntries(
        ids.filter((id) => id !== ids[i]).map((id) => [id, 0]),
      ),
      position: i,
      isLocalControlled: true,
      controlOwner: { kind: 'local' },
    })),
    activeViewByPlayer: Object.fromEntries(ids.map((id) => [id, 'life'])),
    monarchPlayerId: null,
    history: [],
    createdAt: now,
    updatedAt: now,
    startingPlayerId: initial.winnerId,
    turnOrder: [...clockwise.slice(start), ...clockwise.slice(0, start)],
    thirdPlayerSide: config.thirdPlayerSide ?? 'right',
    stripMode: config.stripMode ?? 'full',
    resolution: { kind: 'initial', sides: 20, ...initial, actorPlayerId: null },
  };
  event(g, env, 'initial', null, { ...initial, sides: 20 });
  return g;
}
export function counterValue(g: GameState, playerId: string, counter: Counter): number {
  const p = g.players.find((p) => p.id === playerId);
  check(p, 'Jugador desconocido');
  if (counter === 'life') return p.life;
  if (counter === 'poison') {
    check(g.format.poisonEnabled, 'Veneno desactivado');
    return p.poison;
  }
  check(g.format.commanderEnabled, 'Comandante desactivado');
  const rival = counter.slice(10);
  check(Object.hasOwn(p.commanderDamageByOpponent, rival), 'Rival inválido');
  return p.commanderDamageByOpponent[rival];
}
function setCounter(g: GameState, id: string, counter: Counter, value: number) {
  check(Number.isSafeInteger(value), 'Contador fuera de rango');
  check(counter === 'life' || value >= 0, 'El contador no puede ser negativo');
  const p = g.players.find((p) => p.id === id)!;
  if (counter === 'life') p.life = value;
  else if (counter === 'poison') p.poison = value;
  else p.commanderDamageByOpponent[counter.slice(10)] = value;
}
export function execute(
  state: GameState,
  command: Command,
  actor: string | null,
  env: Environment,
): GameState {
  check(actor === null || state.players.some((p) => p.id === actor), 'Autor desconocido');
  check(
    !state.resolution || command.type === 'dismiss' || command.type === 'restore',
    'Cierra la tirada antes de continuar',
  );
  check(
    state.status === 'active' || ['reopen', 'restore', 'dismiss'].includes(command.type),
    'La partida está finalizada',
  );
  const g = copy(state);
  switch (command.type) {
    case 'counter': {
      check(Number.isSafeInteger(command.delta) && command.delta !== 0, 'Cambio inválido');
      const before = counterValue(g, command.playerId, command.counter);
      const after = before + command.delta;
      setCounter(g, command.playerId, command.counter, after);
      event(g, env, 'counter', actor, { ...command, before, after }, true);
      break;
    }
    case 'view':
      counterValue(g, command.playerId, command.counter);
      g.activeViewByPlayer[command.playerId] = command.counter;
      event(g, env, 'view', actor, { ...command });
      break;
    case 'monarch': {
      check(
        g.players.some((p) => p.id === command.playerId),
        'Jugador desconocido',
      );
      const before = g.monarchPlayerId;
      g.monarchPlayerId = command.playerId;
      event(g, env, 'monarch', actor, { before, after: command.playerId }, true);
      break;
    }
    case 'strip':
      g.stripMode = command.mode;
      event(g, env, 'strip', actor, { mode: command.mode });
      break;
    case 'roll': {
      check(actor, 'Selecciona un jugador');
      const ids = command.all ? g.players.map((p) => p.id) : [actor];
      let resolution: Resolution;
      if (command.kind === 'dice') {
        check([6, 8, 10, 12, 20].includes(command.sides ?? 0), 'Dado inválido');
        resolution = {
          kind: 'dice',
          sides: command.sides,
          ...resolveDice(ids, command.sides!, env),
          actorPlayerId: actor,
        };
      } else
        resolution = {
          kind: 'coin',
          results: ids.map((playerId) => ({
            playerId,
            value: die(env, 2) === 1 ? 'cara' : 'cruz',
          })),
          actorPlayerId: actor,
        };
      g.resolution = resolution;
      event(g, env, command.kind, actor, { ...resolution });
      break;
    }
    case 'dismiss':
      check(g.resolution, 'No hay una tirada abierta');
      g.resolution = null;
      event(g, env, 'dismiss', actor, {});
      break;
    case 'undo': {
      const target = g.history.find((e) => e.id === command.eventId);
      check(target?.reversible && !target.revertedByEventId, 'Evento no reversible');
      if (target.type === 'counter') {
        const p = target.payload;
        const id = p.playerId as string,
          c = p.counter as Counter;
        setCounter(g, id, c, counterValue(g, id, c) - ((p.after as number) - (p.before as number)));
      } else if (target.type === 'monarch') {
        check(
          !g.history
            .slice(g.history.indexOf(target) + 1)
            .some((e) => e.type === 'monarch' && !e.revertedByEventId),
          'Deshaz primero las transferencias posteriores',
        );
        g.monarchPlayerId = target.payload.before as string | null;
      } else throw new Error('Evento no reversible');
      target.revertedByEventId = event(g, env, 'undo', actor, { eventId: target.id }).id;
      break;
    }
    case 'finish':
      g.status = 'finished';
      g.summary = {
        durationMs: Math.max(0, Date.parse(env.now()) - Date.parse(g.createdAt)),
        finishedAt: env.now(),
        players: g.players.map(({ id, name, life }) => ({ id, name, life })),
      };
      event(g, env, 'finish', actor, { summary: g.summary });
      break;
    case 'reopen':
      check(g.status === 'finished', 'La partida ya está abierta');
      g.status = 'active';
      delete g.summary;
      event(g, env, 'reopen', actor, {});
      break;
    case 'restore':
      g.mode = 'local';
      for (const p of g.players) {
        p.isLocalControlled = true;
        p.controlOwner = { kind: 'local' };
      }
      event(g, env, 'restore', actor, {});
      break;
  }
  return g;
}

import type { GameSnapshot, GameState } from '../game-model/index.ts';
import { z } from 'zod';

const id = z
  .string()
  .min(1)
  .max(200)
  .refine((v) => !['__proto__', 'constructor', 'prototype'].includes(v));
const integer = z.number().int().safe();
const timestamp = z.string().datetime();
const theme = z.object({
  id,
  primary: z.string().regex(/^#[0-9a-f]{6}$/i),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  manaIdentity: z.array(z.string()).max(2),
});
const resolution = z.object({
  kind: z.enum(['initial', 'dice', 'coin']),
  sides: z.number().optional(),
  results: z
    .array(z.object({ playerId: id, value: z.union([integer, z.enum(['cara', 'cruz'])]) }))
    .min(1)
    .max(4),
  winnerId: id.optional(),
  actorPlayerId: id.nullable(),
});
const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: timestamp,
  game: z.object({
    id,
    status: z.enum(['active', 'finished']),
    mode: z.enum(['local', 'online', 'hybrid']),
    format: z.object({
      id,
      label: z.string().min(1).max(80),
      startingLife: integer.positive(),
      commanderEnabled: z.boolean(),
      poisonEnabled: z.boolean(),
    }),
    players: z
      .array(
        z.object({
          id,
          name: z.string().min(1).max(80),
          theme,
          life: integer,
          poison: integer.nonnegative(),
          commanderDamageByOpponent: z.record(id, integer.nonnegative()),
          position: integer,
          isLocalControlled: z.boolean(),
          controlOwner: z.discriminatedUnion('kind', [
            z.object({ kind: z.literal('local') }),
            z.object({ kind: z.literal('remote'), participantId: id }),
          ]),
        }),
      )
      .min(2)
      .max(4),
    activeViewByPlayer: z.record(id, z.string()),
    monarchPlayerId: id.nullable(),
    history: z
      .array(
        z.object({
          id,
          type: z.enum([
            'initial',
            'counter',
            'view',
            'monarch',
            'dice',
            'coin',
            'dismiss',
            'undo',
            'finish',
            'reopen',
            'restore',
            'strip',
          ]),
          timestamp,
          actorPlayerId: id.nullable(),
          payload: z.record(z.string(), z.unknown()),
          reversible: z.boolean(),
          revertedByEventId: id.optional(),
        }),
      )
      .min(1),
    createdAt: timestamp,
    updatedAt: timestamp,
    startingPlayerId: id,
    turnOrder: z.array(id),
    thirdPlayerSide: z.enum(['left', 'right']),
    stripMode: z.enum(['minimal', 'full']),
    resolution: resolution.nullable(),
    summary: z
      .object({
        durationMs: integer.nonnegative(),
        players: z.array(z.object({ id, name: z.string(), life: integer })),
        finishedAt: timestamp,
      })
      .optional(),
  }),
});
function requireValid(ok: unknown): asserts ok {
  if (!ok) throw new Error('El respaldo contiene referencias o valores incoherentes');
}
export function deserialize(json: string): GameState {
  if (json.length > 20_000_000) throw new Error('El respaldo supera los 20 MB');
  const parsed = snapshotSchema.safeParse(JSON.parse(json));
  if (!parsed.success) throw new Error('Respaldo inválido o versión de esquema no compatible');
  const g = parsed.data.game;
  const ids = g.players.map((p) => p.id);
  const member = (v: unknown) => typeof v === 'string' && ids.includes(v);
  requireValid(new Set(ids).size === ids.length && g.players.every((p, i) => p.position === i));
  requireValid(
    g.turnOrder.length === ids.length &&
      new Set(g.turnOrder).size === ids.length &&
      g.turnOrder.every(member) &&
      g.turnOrder[0] === g.startingPlayerId,
  );
  requireValid(g.monarchPlayerId === null || member(g.monarchPlayerId));
  const validCounter = (playerId: string, c: unknown) =>
    c === 'life' ||
    (c === 'poison' && g.format.poisonEnabled) ||
    (typeof c === 'string' &&
      c.startsWith('commander:') &&
      g.format.commanderEnabled &&
      member(c.slice(10)) &&
      c.slice(10) !== playerId);
  requireValid(Object.keys(g.activeViewByPlayer).length === ids.length);
  for (const p of g.players) {
    requireValid(validCounter(p.id, g.activeViewByPlayer[p.id]));
    requireValid(
      Object.keys(p.commanderDamageByOpponent).length === ids.length - 1 &&
        ids.filter((x) => x !== p.id).every((x) => Object.hasOwn(p.commanderDamageByOpponent, x)),
    );
  }
  const eventIds = new Set(g.history.map((e) => e.id));
  requireValid(eventIds.size === g.history.length);
  const validRoll = (value: unknown) => {
    const parsedRoll = resolution.safeParse(value);
    requireValid(parsedRoll.success);
    const r = parsedRoll.data;
    requireValid(r.actorPlayerId === null || member(r.actorPlayerId));
    requireValid(
      new Set(r.results.map((x) => x.playerId)).size === r.results.length &&
        r.results.every((x) => member(x.playerId)),
    );
    if (r.kind === 'coin')
      requireValid(!r.winnerId && r.results.every((x) => x.value === 'cara' || x.value === 'cruz'));
    else {
      requireValid(
        [6, 8, 10, 12, 20].includes(r.sides ?? 0) &&
          r.results.some((x) => x.playerId === r.winnerId) &&
          r.results.every(
            (x) => typeof x.value === 'number' && x.value >= 1 && x.value <= r.sides!,
          ),
      );
      const scores = r.results.map((x) => x.value as number);
      const max = Math.max(...scores);
      requireValid(
        scores.filter((v) => v === max).length === 1 &&
          r.results.find((x) => x.playerId === r.winnerId)?.value === max,
      );
    }
  };
  for (const e of g.history) {
    requireValid(e.actorPlayerId === null || member(e.actorPlayerId));
    requireValid(!e.reversible || ['counter', 'monarch'].includes(e.type));
    if (e.revertedByEventId)
      requireValid(
        g.history.some(
          (u) => u.id === e.revertedByEventId && u.type === 'undo' && u.payload.eventId === e.id,
        ),
      );
    if (e.type === 'counter') {
      const p = e.payload;
      requireValid(
        member(p.playerId) &&
          validCounter(p.playerId as string, p.counter) &&
          Number.isSafeInteger(p.before) &&
          Number.isSafeInteger(p.after),
      );
    }
    if (e.type === 'monarch')
      requireValid(
        (e.payload.before === null || member(e.payload.before)) && member(e.payload.after),
      );
    if (e.type === 'undo') requireValid(eventIds.has(e.payload.eventId as string));
    if (['initial', 'dice', 'coin'].includes(e.type))
      validRoll({ ...e.payload, kind: e.type, actorPlayerId: e.actorPlayerId });
    if (e.type === 'view')
      requireValid(
        member(e.payload.playerId) && validCounter(e.payload.playerId as string, e.payload.counter),
      );
    if (e.type === 'strip') requireValid(['full', 'minimal'].includes(e.payload.mode as string));
  }
  if (g.resolution) {
    validRoll(g.resolution);
  }
  requireValid(g.status !== 'finished' || g.summary);
  return g as GameState;
}
export function serialize(game: GameState, exportedAt = new Date().toISOString()): string {
  const snapshot: GameSnapshot = { schemaVersion: 1, exportedAt, game };
  return JSON.stringify(snapshot, null, 2);
}
export interface GameStorage {
  load(): Promise<GameState | null>;
  save(game: GameState): Promise<void>;
}
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
/** A single atomic value; rejected writes never poison the queue for later saves. */
export class LocalGameStorage implements GameStorage {
  private queue: Promise<void> = Promise.resolve();
  constructor(
    private readonly backend: KeyValueStorage,
    private readonly key = 'judgebeacon.active.v1',
  ) {}
  async load() {
    await this.queue;
    const value = await this.backend.getItem(this.key);
    return value === null ? null : deserialize(value);
  }
  save(game: GameState) {
    const json = serialize(game);
    const write = this.queue.then(() => this.backend.setItem(this.key, json));
    this.queue = write.catch(() => {});
    return write;
  }
}

import { beforeEach, expect, test, vi } from 'vitest';

const native = vi.hoisted(() => ({
  saved: null as string | null,
  getItem: vi.fn<() => Promise<string | null>>(),
  setItem: vi.fn<(key: string, value: string) => Promise<void>>(),
  lock: vi.fn(async (_orientation: number) => {}),
}));
vi.mock('expo-sqlite/kv-store', () => ({ default: native }));
vi.mock('expo-screen-orientation', () => ({
  OrientationLock: { PORTRAIT_UP: 1, LANDSCAPE: 2 },
  lockAsync: native.lock,
  unlockAsync: async () => {},
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => crypto.randomUUID(),
  getRandomValues: (array: Uint32Array<ArrayBuffer>) => crypto.getRandomValues(array),
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: async () => ({ canceled: true }) }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: async () => {} }));
vi.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: 'cache' } }));
import { GameService } from './game.service';
import { FORMATS } from '../../../../packages/game-model/index.ts';
import { THEMES } from '../../../../packages/game-ui/index.ts';

beforeEach(() => {
  native.saved = null;
  native.getItem.mockReset().mockImplementation(async () => native.saved);
  native.setItem.mockReset().mockImplementation(async (_, value) => {
    native.saved = value;
  });
  native.lock.mockClear();
});
const config = { players: [{ theme: THEMES[0] }, { theme: THEMES[1] }], format: FORMATS[1] };

test('does not publish a state when saving fails and recovers on the next command', async () => {
  const service = new GameService();
  await service.create(config);
  await service.dispatch({ type: 'dismiss' }, null);
  const before = service.game();
  const id = before!.players[0].id;
  native.setItem.mockRejectedValueOnce(new Error('Disco lleno'));
  await service.dispatch({ type: 'counter', playerId: id, counter: 'life', delta: -1 }, id);
  expect(service.game()).toBe(before);
  expect(service.error()).toBe('Disco lleno');
  expect(service.busy()).toBe(false);
  await service.dispatch({ type: 'counter', playerId: id, counter: 'life', delta: -1 }, id);
  expect(service.game()!.players[0].life).toBe(39);
  expect(service.error()).toBe('');
});

test('a new service restores the complete saved result and remains locked', async () => {
  const first = new GameService();
  await first.create(config);
  const restarted = new GameService();
  await restarted.init();
  expect(restarted.ready()).toBe(true);
  expect(restarted.game()).toEqual(first.game());
  const id = restarted.game()!.players[0].id;
  await restarted.dispatch({ type: 'counter', playerId: id, counter: 'life', delta: 1 }, id);
  expect(restarted.error()).toContain('Cierra la tirada');
  expect(restarted.game()).toEqual(first.game());
});

test.each([2, 3, 4])('requests the correct orientation for %i players', async (count) => {
  const service = new GameService();
  await service.create({
    ...config,
    players: Array.from({ length: count }, () => ({ theme: THEMES[0] })),
  });
  expect(native.lock).toHaveBeenLastCalledWith(count === 2 ? 1 : 2);
});

test('invalid stored data is reported and never overwritten during startup', async () => {
  native.saved = '{invalid';
  const service = new GameService();
  await service.init();
  expect(service.ready()).toBe(true);
  expect(service.game()).toBeNull();
  expect(service.error()).not.toBe('');
  expect(native.setItem).not.toHaveBeenCalled();
});

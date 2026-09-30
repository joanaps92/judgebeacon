import { render, screen, userEvent, cleanup } from '@ng-native/testing';
import { afterEach, expect, test, vi } from 'vitest';
vi.mock('expo-sqlite/kv-store', () => ({
  default: { getItem: async () => null, setItem: async () => {} },
}));
vi.mock('expo-screen-orientation', () => ({
  OrientationLock: { PORTRAIT_UP: 1, LANDSCAPE: 2 },
  lockAsync: async () => {},
  unlockAsync: async () => {},
}));
vi.mock('expo-crypto', () => ({
  randomUUID: () => crypto.randomUUID(),
  getRandomValues: (array: Uint32Array<ArrayBuffer>) => crypto.getRandomValues(array),
}));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: async () => ({ canceled: true }) }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: async () => {} }));
vi.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: 'cache' } }));
import { App } from './app.ts';
afterEach(() => cleanup());
test('opens local room configuration without a backend', async () => {
  await render(App);
  const user = userEvent.setup();
  await user.press(await screen.findByRole('button', { name: 'Empezar una nueva' }));
  expect(screen.getByText('Preparar la mesa')).toBeTruthy();
  await user.press(screen.getByRole('button', { name: '3 jugadores' }));
  expect(screen.getByText('Jugador 3')).toBeTruthy();
  expect(screen.getByText('Lateral derecho ✓')).toBeTruthy();
});
test('creates a game and blocks counters until the initial result closes', async () => {
  const { fixture } = await render(App);
  const user = userEvent.setup();
  await user.press(await screen.findByRole('button', { name: 'Empezar una nueva' }));
  await user.press(screen.getByRole('button', { name: 'Comenzar partida' }));
  expect(fixture.componentInstance.store.game()?.players).toHaveLength(2);
  expect(fixture.componentInstance.store.game()?.resolution?.kind).toBe('initial');
  fixture.componentInstance.animating.set(false);
  await fixture.detectChanges();
  await user.press(screen.getByRole('button', { name: 'Continuar' }));
  await user.press(screen.getByRole('button', { name: 'Sumar Vidas a Jugador 1' }));
  expect(fixture.componentInstance.store.game()?.players[0].life).toBe(41);
  await user.press(screen.getByRole('button', { name: 'Menú de Jugador 1' }));
  await user.press(screen.getByRole('button', { name: 'Finalizar partida' }));
  expect(fixture.componentInstance.store.game()?.status).toBe('finished');
  await user.press(screen.getByRole('button', { name: 'Menú de Jugador 1' }));
  await user.press(screen.getByRole('button', { name: 'Reabrir partida' }));
  expect(fixture.componentInstance.store.game()?.status).toBe('active');
});

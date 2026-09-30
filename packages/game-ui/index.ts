import type { Counter, GameState, PlayerTheme } from '../game-model/index.ts';
const base = [
  ['white', '#514c37', '#f5e4aa', 'W'],
  ['blue', '#153b67', '#71c9ff', 'U'],
  ['black', '#29213d', '#c2a3ed', 'B'],
  ['red', '#6b252d', '#ff9b7b', 'R'],
  ['green', '#174b3c', '#9ee3a6', 'G'],
  ['colorless', '#39414b', '#ced6df', 'C'],
];
export const THEMES: PlayerTheme[] = base.map(([id, primary, accent, mana]) => ({
  id,
  primary,
  accent,
  manaIdentity: [mana],
}));
for (let i = 0; i < 5; i++)
  for (let j = i + 1; j < 5; j++)
    THEMES.push({
      id: `${base[i][0]}-${base[j][0]}`,
      primary: base[i][1],
      accent: base[j][2],
      manaIdentity: [base[i][3], base[j][3]],
    });
export function counters(game: GameState, playerId: string): Counter[] {
  return [
    'life',
    ...(game.format.poisonEnabled ? ['poison' as const] : []),
    ...(game.format.commanderEnabled
      ? game.players.filter((p) => p.id !== playerId).map((p) => `commander:${p.id}` as Counter)
      : []),
  ];
}
export function counterLabel(game: GameState, c: Counter) {
  return c === 'life'
    ? 'Vidas'
    : c === 'poison'
      ? 'Veneno'
      : `Com. ${game.players.find((p) => p.id === c.slice(10))?.name ?? ''}`;
}
/** Positions are clockwise, including the optional side seat. */
export function zoneLayout(count: number, index: number, side: 'left' | 'right') {
  if (count === 2)
    return { left: 0, top: index * 50, width: 100, height: 50, rotation: index === 0 ? 180 : 0 };
  if (count === 4)
    return [
      { left: 0, top: 0, width: 50, height: 50, rotation: 180 },
      { left: 50, top: 0, width: 50, height: 50, rotation: 180 },
      { left: 50, top: 50, width: 50, height: 50, rotation: 0 },
      { left: 0, top: 50, width: 50, height: 50, rotation: 0 },
    ][index];
  const lateral = 2;
  if (index === lateral)
    return {
      left: side === 'right' ? 66.666 : 0,
      top: 0,
      width: 33.334,
      height: 100,
      rotation: side === 'right' ? 270 : 90,
    };
  return {
    left: side === 'right' ? 0 : 33.334,
    top: index === 0 ? 0 : 50,
    width: 66.666,
    height: 50,
    rotation: index === 0 ? 180 : 0,
  };
}

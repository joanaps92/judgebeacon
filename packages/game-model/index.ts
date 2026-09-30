export type Counter = 'life' | 'poison' | `commander:${string}`;
export type ControlOwner = { kind: 'local' } | { kind: 'remote'; participantId: string };
export interface PlayerTheme {
  id: string;
  primary: string;
  accent: string;
  manaIdentity: string[];
}
export interface GameFormat {
  id: string;
  label: string;
  startingLife: number;
  commanderEnabled: boolean;
  poisonEnabled: boolean;
}
export interface PlayerState {
  id: string;
  name: string;
  theme: PlayerTheme;
  life: number;
  poison: number;
  commanderDamageByOpponent: Record<string, number>;
  position: number;
  isLocalControlled: boolean;
  controlOwner: ControlOwner;
}
export interface GameEvent {
  id: string;
  type: string;
  timestamp: string;
  actorPlayerId: string | null;
  payload: Record<string, unknown>;
  reversible: boolean;
  revertedByEventId?: string;
}
export interface RollResult {
  playerId: string;
  value: number | 'cara' | 'cruz';
}
export interface Resolution {
  kind: 'initial' | 'dice' | 'coin';
  sides?: number;
  results: RollResult[];
  winnerId?: string;
  actorPlayerId: string | null;
}
export interface GameState {
  id: string;
  status: 'active' | 'finished';
  mode: 'local' | 'online' | 'hybrid';
  format: GameFormat;
  players: PlayerState[];
  activeViewByPlayer: Record<string, Counter>;
  monarchPlayerId: string | null;
  history: GameEvent[];
  createdAt: string;
  updatedAt: string;
  startingPlayerId: string;
  turnOrder: string[];
  thirdPlayerSide: 'left' | 'right';
  stripMode: 'minimal' | 'full';
  resolution: Resolution | null;
  summary?: {
    durationMs: number;
    players: { id: string; name: string; life: number }[];
    finishedAt: string;
  };
}
export interface GameSnapshot {
  schemaVersion: 1;
  exportedAt: string;
  game: GameState;
}
export type Command =
  | { type: 'counter'; playerId: string; counter: Counter; delta: number }
  | { type: 'view'; playerId: string; counter: Counter }
  | { type: 'monarch'; playerId: string }
  | { type: 'roll'; kind: 'dice' | 'coin'; sides?: number; all: boolean }
  | { type: 'dismiss' }
  | { type: 'undo'; eventId: string }
  | { type: 'finish' }
  | { type: 'reopen' }
  | { type: 'restore' }
  | { type: 'strip'; mode: 'minimal' | 'full' };
export const FORMATS: GameFormat[] = [
  {
    id: 'standard',
    label: 'Construido',
    startingLife: 20,
    commanderEnabled: false,
    poisonEnabled: true,
  },
  {
    id: 'commander',
    label: 'Commander',
    startingLife: 40,
    commanderEnabled: true,
    poisonEnabled: true,
  },
  { id: 'brawl', label: 'Brawl', startingLife: 25, commanderEnabled: true, poisonEnabled: true },
];

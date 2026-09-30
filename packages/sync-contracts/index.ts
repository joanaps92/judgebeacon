import type { Command, GameEvent, GameState } from '../game-model/index.ts';
/** Future boundary only. Phase 1 has no network implementation. */
export interface SyncAdapter {
  connect(gameId: string): Promise<void>;
  publish(event: GameEvent): Promise<void>;
  disconnect(): Promise<void>;
}
export interface CommandAuthorization {
  mayExecute(state: GameState, command: Command, participantId: string): boolean;
}

import { Injectable, signal } from '@angular/core';
import Storage from 'expo-sqlite/kv-store';
import * as Orientation from 'expo-screen-orientation';
import * as Crypto from 'expo-crypto';
import * as Picker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import {
  createGame,
  execute,
  type NewGame,
  type Environment,
} from '../../../../packages/game-engine/index.ts';
import {
  deserialize,
  LocalGameStorage,
  serialize,
} from '../../../../packages/game-storage/index.ts';
import type { Command, GameState } from '../../../../packages/game-model/index.ts';

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly game = signal<GameState | null>(null);
  readonly busy = signal(false);
  readonly ready = signal(false);
  readonly error = signal('');
  private readonly storage = new LocalGameStorage(Storage);
  private readonly env: Environment = {
    id: () => Crypto.randomUUID(),
    now: () => new Date().toISOString(),
    random: () => Crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296,
  };
  private async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo completar la operación');
    } finally {
      this.busy.set(false);
    }
  }
  async init() {
    await this.run(async () => {
      this.game.set(await this.storage.load());
    });
    this.ready.set(true);
  }
  private async orient(game: GameState) {
    await Orientation.lockAsync(
      game.players.length === 2
        ? Orientation.OrientationLock.PORTRAIT_UP
        : Orientation.OrientationLock.LANDSCAPE,
    );
  }
  async resume() {
    await this.run(async () => {
      if (this.game()) await this.orient(this.game()!);
    });
  }
  async create(config: NewGame) {
    await this.run(async () => {
      const g = createGame(config, this.env);
      await this.orient(g);
      await this.storage.save(g);
      this.game.set(g);
    });
  }
  async dispatch(command: Command, actor: string | null) {
    await this.run(async () => {
      if (!this.game()) return;
      const g = execute(this.game()!, command, actor, this.env);
      await this.storage.save(g);
      this.game.set(g);
    });
  }
  async importGame() {
    await this.run(async () => {
      const selected = await Picker.getDocumentAsync({
        type: ['application/json', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (selected.canceled) return;
      const file = new File(selected.assets[0].uri);
      if (file.size > 20_000_000) throw new Error('El respaldo supera los 20 MB');
      const game = execute(deserialize(await file.text()), { type: 'restore' }, null, this.env);
      await this.orient(game);
      await this.storage.save(game);
      this.game.set(game);
    });
  }
  async exportGame() {
    await this.run(async () => {
      const g = this.game();
      if (!g) return;
      if (!(await Sharing.isAvailableAsync()))
        throw new Error('El dispositivo no permite compartir archivos');
      const file = new File(Paths.cache, `JudgeBeacon-${g.id}.json`);
      file.write(serialize(g));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
        dialogTitle: 'Guardar respaldo de JudgeBeacon',
      });
    });
  }
  async unlock() {
    await this.run(() => Orientation.unlockAsync());
  }
}

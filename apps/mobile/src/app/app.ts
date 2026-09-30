import { Component, computed, inject, signal, OnDestroy } from '@angular/core';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  VirtualList,
  VirtualListRow,
} from '@ng-native/components';
import { GameService } from './game.service';
import { PlayerZone } from './player-zone';
import {
  FORMATS,
  type Command,
  type GameEvent,
  type GameFormat,
} from '../../../../packages/game-model/index.ts';
import { THEMES, zoneLayout } from '../../../../packages/game-ui/index.ts';

@Component({
  selector: 'app-root',
  imports: [
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    View,
    VirtualList,
    VirtualListRow,
    PlayerZone,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  readonly store = inject(GameService);
  readonly formats = FORMATS;
  readonly themes = THEMES;
  readonly page = signal<'home' | 'setup' | 'game'>('home');
  readonly count = signal(2);
  readonly format = signal<GameFormat>(FORMATS[1]);
  readonly customLife = signal('20');
  readonly names = signal(['', '', '', '']);
  readonly themeIds = signal(['blue', 'red', 'green', 'black']);
  readonly side = signal<'left' | 'right'>('right');
  readonly seats = computed(() => Array.from({ length: this.count() }, (_, i) => i));
  readonly menuPlayer = signal<string | null>(null);
  readonly panel = signal<'menu' | 'dice' | 'coin' | 'history'>('menu');
  readonly sides = signal(20);
  readonly confirmImport = signal(false);
  readonly animating = signal(false);
  readonly dimensions = signal({ width: 0, height: 0 });
  readonly orientations: ('portrait' | 'landscape')[] = ['portrait', 'landscape'];
  private timer?: ReturnType<typeof setTimeout>;
  constructor() {
    void this.store.init();
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }
  setName(i: number, value: string) {
    this.names.update((v) => v.map((x, j) => (j === i ? value : x)));
  }
  setTheme(i: number, value: string) {
    this.themeIds.update((v) => v.map((x, j) => (j === i ? value : x)));
  }
  custom() {
    this.format.set({
      id: 'custom',
      label: 'Personalizado',
      startingLife: 20,
      commanderEnabled: true,
      poisonEnabled: true,
    });
  }
  toggleCommander() {
    this.format.update((f) => ({ ...f, commanderEnabled: !f.commanderEnabled }));
  }
  togglePoison() {
    this.format.update((f) => ({ ...f, poisonEnabled: !f.poisonEnabled }));
  }
  async start() {
    await this.store.create({
      players: this.seats().map((i) => ({
        name: this.names()[i],
        theme: THEMES.find((t) => t.id === this.themeIds()[i])!,
      })),
      format: {
        ...this.format(),
        startingLife:
          this.format().id === 'custom' ? Number(this.customLife()) : this.format().startingLife,
      },
      thirdPlayerSide: this.side(),
    });
    if (!this.store.error()) {
      this.page.set('game');
      this.animate();
    }
  }
  async resume() {
    await this.store.resume();
    if (!this.store.error()) this.page.set('game');
  }
  async importBackup() {
    const previous = this.store.game();
    await this.store.importGame();
    if (!this.store.error() && this.store.game() !== previous) {
      this.confirmImport.set(false);
      this.page.set('game');
    }
  }
  send(c: Command, actor: string) {
    void this.store.dispatch(c, actor);
  }
  openMenu(id: string) {
    if (this.store.game()?.resolution || this.store.busy()) return;
    this.menuPlayer.set(id);
    this.panel.set('menu');
  }
  closeMenu() {
    this.menuPlayer.set(null);
  }
  async roll(all: boolean) {
    const actor = this.menuPlayer();
    const kind = this.panel() === 'coin' ? 'coin' : 'dice';
    this.closeMenu();
    await this.store.dispatch({ type: 'roll', kind, all, sides: this.sides() }, actor);
    if (!this.store.error()) this.animate();
  }
  animate() {
    clearTimeout(this.timer);
    this.animating.set(true);
    this.timer = setTimeout(() => this.animating.set(false), 850);
  }
  dismissRoll() {
    if (!this.animating()) void this.store.dispatch({ type: 'dismiss' }, null);
  }
  undo(eventId: string) {
    const actor = this.menuPlayer();
    this.closeMenu();
    void this.store.dispatch({ type: 'undo', eventId }, actor);
  }
  strip() {
    const actor = this.menuPlayer();
    this.closeMenu();
    void this.store.dispatch(
      { type: 'strip', mode: this.store.game()!.stripMode === 'full' ? 'minimal' : 'full' },
      actor,
    );
  }
  finishOrReopen() {
    const actor = this.menuPlayer();
    this.closeMenu();
    void this.store.dispatch(
      { type: this.store.game()!.status === 'active' ? 'finish' : 'reopen' },
      actor,
    );
  }
  exportFromMenu() {
    this.closeMenu();
    void this.store.exportGame();
  }
  async home() {
    this.closeMenu();
    await this.store.unlock();
    this.page.set('home');
  }
  playerName(id: string) {
    return this.store.game()?.players.find((p) => p.id === id)?.name ?? 'Sistema';
  }
  overlayColor() {
    const g = this.store.game()!;
    return g.players.find((p) => p.id === g.resolution?.actorPlayerId)?.theme.primary ?? '#242037';
  }
  eventTime(e: GameEvent) {
    return new Date(e.timestamp).toLocaleString('es-ES');
  }
  eventText(e: GameEvent) {
    const p = e.payload;
    switch (e.type) {
      case 'counter':
        return `${this.playerName(p.playerId as string)} · ${p.counter === 'life' ? 'Vidas' : p.counter === 'poison' ? 'Veneno' : 'Comandante de ' + this.playerName(String(p.counter).slice(10))}: ${p.before} → ${p.after}`;
      case 'monarch':
        return `Monarca: ${p.before ? this.playerName(p.before as string) : 'nadie'} → ${this.playerName(p.after as string)}`;
      case 'initial':
      case 'dice':
      case 'coin':
        return `${e.type === 'initial' ? 'Tirada inicial' : e.type === 'dice' ? 'Dado d' + p.sides : 'Monedas'}: ${((p.results as { playerId: string; value: unknown }[]) ?? []).map((r) => this.playerName(r.playerId) + ': ' + r.value).join(' · ')}${p.winnerId ? ' · ' + this.playerName(p.winnerId as string) + ' gana' : ''}`;
      default:
        return (
          (
            {
              undo: 'Evento deshecho',
              finish: 'Partida finalizada',
              reopen: 'Partida reabierta',
              restore: 'Partida importada como local',
              view: 'Contador seleccionado',
              dismiss: 'Resultado cerrado',
              strip: 'Modo de franja cambiado',
            } as Record<string, string>
          )[e.type] ?? e.type
        );
    }
  }
  duration() {
    return Math.round((this.store.game()?.summary?.durationMs ?? 0) / 60000);
  }
  finalLives() {
    return this.store
      .game()
      ?.summary?.players.map((p) => `${p.name}: ${p.life}`)
      .join(' · ');
  }
  measure(e: { nativeEvent: { layout: { width: number; height: number } } }) {
    this.dimensions.set(e.nativeEvent.layout);
  }
  zoneFrame(i: number) {
    const g = this.store.game()!,
      z = zoneLayout(g.players.length, i, g.thirdPlayerSide);
    return {
      position: 'absolute' as const,
      left: `${z.left}%` as const,
      top: `${z.top}%` as const,
      width: `${z.width}%` as const,
      height: `${z.height}%` as const,
      padding: 4,
      overflow: 'hidden' as const,
    };
  }
  zoneInner(i: number) {
    const g = this.store.game()!,
      z = zoneLayout(g.players.length, i, g.thirdPlayerSide),
      d = this.dimensions();
    const w = (d.width * z.width) / 100 - 8,
      h = (d.height * z.height) / 100 - 8;
    if (z.rotation === 90 || z.rotation === 270)
      return {
        position: 'absolute' as const,
        width: Math.max(0, h),
        height: Math.max(0, w),
        left: (w - h) / 2 + 4,
        top: (h - w) / 2 + 4,
        transform: [{ rotate: `${z.rotation}deg` }],
      };
    return { flex: 1, transform: [{ rotate: `${z.rotation}deg` }] };
  }
  menuTransform() {
    const g = this.store.game()!,
      i = g.players.findIndex((p) => p.id === this.menuPlayer()),
      z = zoneLayout(g.players.length, i, g.thirdPlayerSide);
    if (z.rotation === 90 || z.rotation === 270)
      return {
        width: Math.max(220, this.dimensions().height - 32),
        maxHeight: this.dimensions().width - 32,
        transform: [{ rotate: `${z.rotation}deg` }],
      };
    return { transform: [{ rotate: `${z.rotation}deg` }] };
  }
}

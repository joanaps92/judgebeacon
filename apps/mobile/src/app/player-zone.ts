import { Component, computed, input, output, signal } from '@angular/core';
import { Pressable, ScrollView, Text, View } from '@ng-native/components';
import type {
  Command,
  GameState,
  PlayerState,
  Counter,
} from '../../../../packages/game-model/index.ts';
import { counterValue } from '../../../../packages/game-engine/index.ts';
import { counterLabel, counters } from '../../../../packages/game-ui/index.ts';
@Component({
  selector: 'player-zone',
  imports: [View, Text, Pressable, ScrollView],
  template: `
    <view
      class="zone"
      [style]="{ backgroundColor: player().theme.primary }"
      (layout)="height.set($event.nativeEvent.layout.height)"
    >
      <view class="heading">
        <text class="name">{{ player().name }}</text>
        <pressable
          accessibilityRole="button"
          accessibilityLabel="Reclamar Monarca"
          [disabled]="blocked() || game().status === 'finished'"
          (press)="command.emit({ type: 'monarch', playerId: player().id })"
          ><text class="crown">{{
            game().monarchPlayerId === player().id ? '♛' : '♔'
          }}</text></pressable
        >
        <pressable
          accessibilityRole="button"
          [accessibilityLabel]="'Menú de ' + player().name"
          [disabled]="blocked()"
          (press)="menu.emit(player().id)"
          ><text class="dots">•••</text></pressable
        >
      </view>
      <view class="counter">
        <view class="touches">
          <pressable
            class="half"
            accessibilityRole="button"
            [accessibilityLabel]="'Restar ' + label() + ' a ' + player().name"
            [disabled]="blocked() || game().status === 'finished'"
            (press)="adjust(-1)"
          />
          <pressable
            class="half"
            accessibilityRole="button"
            [accessibilityLabel]="'Sumar ' + label() + ' a ' + player().name"
            [disabled]="blocked() || game().status === 'finished'"
            (press)="adjust(1)"
          />
        </view>
        <view class="readout" pointerEvents="none"
          ><text
            class="number"
            [style]="{ fontSize: fontSize() }"
            [adjustsFontSizeToFit]="true"
            [numberOfLines]="1"
            >{{ value() }}</text
          ><text class="caption">{{ label() }}</text></view
        >
      </view>
      <scroll-view class="strip" [horizontal]="true">
        @for (c of options(); track c) {
          <pressable
            class="chip"
            accessibilityRole="button"
            [style]="{ backgroundColor: c === active() ? player().theme.accent : '#ffffff18' }"
            [disabled]="blocked() || game().status === 'finished'"
            (press)="command.emit({ type: 'view', playerId: player().id, counter: c })"
            ><text [style]="{ color: c === active() ? '#14151b' : '#ffffff', fontSize: 12 }">{{
              counterName(c)
            }}</text></pressable
          >
        }
      </scroll-view>
    </view>
  `,
  styles: `
    :host {
      flex: 1;
    }
    .zone {
      flex: 1;
      padding: 10px;
      border-radius: 18px;
      overflow: hidden;
    }
    .heading {
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }
    .name {
      flex: 1;
      color: #ffffff;
      font-size: 15px;
      font-weight: 600;
    }
    .crown {
      color: #f6d78d;
      font-size: 28px;
      min-width: 40px;
      text-align: center;
    }
    .dots {
      color: #ffffff;
      font-size: 22px;
      min-width: 44px;
      text-align: center;
    }
    .counter {
      flex: 1;
      min-height: 60px;
    }
    .touches {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      flex-direction: row;
    }
    .half {
      flex: 1;
    }
    .readout {
      flex: 1;
      align-items: center;
      justify-content: center;
    }
    .number {
      color: #ffffff;
      font-size: 94px;
      font-weight: 700;
    }
    .caption {
      color: #ffffffbb;
      font-size: 13px;
    }
    .strip {
      max-height: 38px;
      flex-grow: 0;
    }
    .chip {
      padding: 9px;
      border-radius: 10px;
      min-height: 36px;
      justify-content: center;
      margin-right: 5px;
    }
  `,
})
export class PlayerZone {
  readonly height = signal(240);
  readonly fontSize = computed(() => Math.max(30, Math.min(110, (this.height() - 105) * 0.8)));
  readonly game = input.required<GameState>();
  readonly player = input.required<PlayerState>();
  readonly blocked = input(false);
  readonly command = output<Command>();
  readonly menu = output<string>();
  readonly active = computed(() => this.game().activeViewByPlayer[this.player().id]);
  readonly value = computed(() => counterValue(this.game(), this.player().id, this.active()));
  readonly label = computed(() => counterLabel(this.game(), this.active()));
  readonly options = computed(() =>
    counters(this.game(), this.player().id).filter(
      (c) => this.game().stripMode === 'full' || c !== this.active(),
    ),
  );
  counterName(c: Counter) {
    return counterLabel(this.game(), c);
  }
  adjust(delta: number) {
    this.command.emit({
      type: 'counter',
      playerId: this.player().id,
      counter: this.active(),
      delta,
    });
  }
}

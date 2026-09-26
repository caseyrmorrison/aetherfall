/** Settings: audio, gameplay, accessibility, display and key rebinding. */
import { audio } from '../audio';
import type { Scene } from '../engine/app';
import { drawText } from '../engine/font';
import { ACTION_LABELS, DEFAULT_KEYS, keyLabel, REBINDABLE, type Action } from '../engine/input';
import { DIFFICULTY, MAX_TORMENT } from '../game/balance';
import { hasFlag } from '../game/state';
import type { Game } from '../game/game';
import type { Settings, TextSpeed } from '../game/settings';
import type { Difficulty } from '../game/types';
import { drawBar, drawHints, drawPanel, drawTooltip, ListView, UI } from '../ui/widgets';

type Row =
  | { kind: 'header'; label: string }
  | { kind: 'slider'; label: string; key: 'master' | 'music' | 'sfx' | 'screenShake'; help: string }
  | {
      kind: 'toggle';
      label: string;
      key:
        | 'tips'
        | 'autoAdvance'
        | 'damageNumbers'
        | 'enemyHealthBars'
        | 'autoLoot'
        | 'showFps'
        | 'reduceFlashing'
        | 'aimAssist';
      help: string;
    }
  | { kind: 'choice'; label: string; get: () => string; cycle: (dir: number) => void; help: string }
  | { kind: 'action'; label: string; run: () => void; help: string }
  | { kind: 'bind'; action: Action };

const SPEEDS: TextSpeed[] = ['slow', 'normal', 'fast', 'instant'];
const DIFFS: Difficulty[] = ['story', 'normal', 'hard', 'nightmare'];

export class SettingsScene implements Scene {
  readonly opaque = false;
  private list: ListView<Row>;
  private capturing: Action | null = null;

  constructor(private game: Game) {
    const s = (): Settings => game.settings;
    const rows: Row[] = [
      { kind: 'header', label: 'Audio' },
      { kind: 'slider', label: 'Master Volume', key: 'master', help: 'Overall volume.' },
      { kind: 'slider', label: 'Music', key: 'music', help: 'Music volume.' },
      { kind: 'slider', label: 'Sound Effects', key: 'sfx', help: 'Sound effect volume.' },
      { kind: 'header', label: 'Gameplay' },
      {
        kind: 'choice',
        label: 'Difficulty',
        get: () => (game.hasSave ? game.difficulty.label : DIFFICULTY[s().difficulty].label),
        cycle: (d) => {
          // after the story, Nightmare continues into Torment I-VI
          const torment = game.hasSave && hasFlag(game.save, 'game_clear') ? MAX_TORMENT : 0;
          const n = DIFFS.length + torment;
          const cur = game.hasSave ? game.save.difficulty : s().difficulty;
          const curIdx = DIFFS.indexOf(cur) + (game.hasSave && cur === 'nightmare' ? game.save.torment : 0);
          const idx = (curIdx + d + n) % n;
          const next = DIFFS[Math.min(idx, DIFFS.length - 1)];
          if (game.hasSave) {
            game.save.difficulty = next;
            game.save.torment = Math.max(0, idx - (DIFFS.length - 1));
            game.invalidateStats();
          }
          s().difficulty = next;
        },
        help: 'Change any time. Harder difficulties drop better loot. Beat the story to unlock Torment.',
      },
      {
        kind: 'choice',
        label: 'Text Speed',
        get: () => s().textSpeed[0].toUpperCase() + s().textSpeed.slice(1),
        cycle: (d) =>
          (s().textSpeed = SPEEDS[(SPEEDS.indexOf(s().textSpeed) + d + SPEEDS.length) % SPEEDS.length]),
        help: 'How fast dialogue text appears.',
      },
      {
        kind: 'toggle',
        label: 'Auto-advance Dialogue',
        key: 'autoAdvance',
        help: 'Dialogue continues by itself after a short pause.',
      },
      {
        kind: 'toggle',
        label: 'Auto-loot Items',
        key: 'autoLoot',
        help: 'Walk over items to pick them up automatically.',
      },
      {
        kind: 'toggle',
        label: 'Aim Assist',
        key: 'aimAssist',
        help: 'Attacks and skills snap toward nearby enemies (keyboard/gamepad).',
      },
      {
        kind: 'toggle',
        label: 'Gameplay Tips',
        key: 'tips',
        help: 'Show one-time hints about mechanics as you play.',
      },
      {
        kind: 'toggle',
        label: 'Damage Numbers',
        key: 'damageNumbers',
        help: 'Show floating damage numbers.',
      },
      {
        kind: 'toggle',
        label: 'Enemy Health Bars',
        key: 'enemyHealthBars',
        help: 'Show health bars above damaged enemies.',
      },
      { kind: 'header', label: 'Accessibility & Display' },
      {
        kind: 'slider',
        label: 'Screen Shake',
        key: 'screenShake',
        help: 'Camera shake intensity. 0 disables it.',
      },
      {
        kind: 'toggle',
        label: 'Reduce Flashing',
        key: 'reduceFlashing',
        help: 'Disables full-screen flashes.',
      },
      {
        kind: 'choice',
        label: 'Touch Controls',
        get: () => s().touchControls[0].toUpperCase() + s().touchControls.slice(1),
        cycle: (d) => {
          const o: Settings['touchControls'][] = ['auto', 'on', 'off'];
          s().touchControls = o[(o.indexOf(s().touchControls) + d + 3) % 3];
        },
        help: 'On-screen joystick and buttons. Auto shows them on touch devices.',
      },
      { kind: 'toggle', label: 'Show FPS', key: 'showFps', help: 'Display the frame rate.' },
      {
        kind: 'action',
        label: 'Toggle Fullscreen',
        run: () => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen?.().catch(() => undefined);
        },
        help: 'Also available with F11 in most browsers.',
      },
      { kind: 'header', label: 'Keyboard Controls' },
      ...REBINDABLE.map((a) => ({ kind: 'bind' as const, action: a })),
      {
        kind: 'action',
        label: 'Reset Controls to Default',
        run: () => {
          s().keys = {};
          game.persistSettings();
          game.toast('Controls reset.', 'ui_check');
        },
        help: 'Restore the default key bindings.',
      },
    ];
    this.list = new ListView(rows, 12, 16, false);
    this.list.index = 1;
  }

  private save(): void {
    this.game.persistSettings();
  }

  update(): void {
    const input = this.game.app.input;
    if (this.capturing) return;
    const row = this.list.selected;
    const r = this.list.update(input, { enabled: (x) => x.kind !== 'header' });
    // skip headers
    if (this.list.selected?.kind === 'header' && r === 'move') {
      const dir = input.repeat('up') ? -1 : 1;
      this.list.index = (this.list.index + dir + this.list.items.length) % this.list.items.length;
    }
    if (r === 'cancel') {
      this.save();
      this.game.app.remove(this);
      return;
    }
    if (!row) return;
    const s = this.game.settings;
    const left = input.repeat('left');
    const right = input.repeat('right');
    switch (row.kind) {
      case 'slider': {
        if (left || right) {
          s[row.key] = Math.round(Math.max(0, Math.min(1, s[row.key] + (right ? 0.1 : -0.1))) * 10) / 10;
          this.save();
          audio.playSfx('ui_move');
        }
        break;
      }
      case 'toggle':
        if (r === 'confirm' || left || right) {
          s[row.key] = !s[row.key];
          this.save();
        }
        break;
      case 'choice':
        if (r === 'confirm' || left || right) {
          row.cycle(left ? -1 : 1);
          this.save();
          audio.playSfx('ui_move');
        }
        break;
      case 'action':
        if (r === 'confirm') row.run();
        break;
      case 'bind':
        if (r === 'confirm') {
          this.capturing = row.action;
          input.captureNext((code) => {
            const a = this.capturing!;
            this.capturing = null;
            if (code === 'Escape') return;
            const keys = { ...DEFAULT_KEYS, ...s.keys };
            // remove this code from other gameplay actions to avoid conflicts
            for (const other of REBINDABLE)
              if (other !== a) keys[other] = keys[other].filter((k) => k !== code);
            keys[a] = [code, ...keys[a].filter((k) => k !== code)].slice(0, 2);
            s.keys = Object.fromEntries(REBINDABLE.map((x) => [x, keys[x]]));
            this.save();
            audio.playSfx('ui_select');
          });
        }
        if (input.pressed('menuAlt')) {
          const keys = { ...DEFAULT_KEYS, ...s.keys };
          keys[row.action] = DEFAULT_KEYS[row.action];
          s.keys = Object.fromEntries(REBINDABLE.map((x) => [x, keys[x]]));
          this.save();
        }
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    ctx.fillStyle = 'rgba(11,10,18,0.75)';
    ctx.fillRect(0, 0, W, H);
    const w = Math.min(W - 16, 440);
    const h = H - 36;
    const x = Math.round((W - w) / 2);
    const y = 14;
    drawPanel(ctx, x, y, w, h, { title: 'Settings' });
    const listW = Math.min(250, w - 20);
    this.list.visibleRows = Math.floor((h - 40) / 12);
    const s = this.game.settings;
    const keys = { ...DEFAULT_KEYS, ...s.keys };
    this.list.draw(ctx, x + 6, y + 18, listW, (row, rx, ry, sel) => {
      const vx = rx + listW - 12;
      switch (row.kind) {
        case 'header':
          drawText(ctx, row.label.toUpperCase(), rx - 2, ry, { color: UI.cyan });
          break;
        case 'slider':
          drawText(ctx, row.label, rx, ry, { color: sel ? UI.accent : '#ffffff' });
          drawBar(ctx, vx - 70, ry + 2, 50, 4, s[row.key], UI.accent);
          drawText(ctx, `${Math.round(s[row.key] * 100)}%`, vx, ry, { align: 'right' });
          break;
        case 'toggle':
          drawText(ctx, row.label, rx, ry, { color: sel ? UI.accent : '#ffffff' });
          drawText(ctx, s[row.key] ? 'ON' : 'OFF', vx, ry, {
            align: 'right',
            color: s[row.key] ? UI.good : UI.dim,
          });
          break;
        case 'choice':
          drawText(ctx, row.label, rx, ry, { color: sel ? UI.accent : '#ffffff' });
          drawText(ctx, `← ${row.get()} →`, vx, ry, { align: 'right' });
          break;
        case 'action':
          drawText(ctx, row.label, rx, ry, { color: sel ? UI.accent : '#c0cbdc' });
          break;
        case 'bind': {
          drawText(ctx, ACTION_LABELS[row.action], rx, ry, { color: sel ? UI.accent : '#ffffff' });
          const label =
            this.capturing === row.action
              ? '{gold}Press a key…{/}'
              : keys[row.action].map(keyLabel).join(' / ');
          drawText(ctx, label, vx, ry, { align: 'right' });
          break;
        }
      }
    });
    const row = this.list.selected;
    const help =
      row?.kind === 'bind'
        ? `Press confirm, then the new key (Esc cancels). Gamepads use fixed standard bindings. ${this.game.app.input.label('menuAlt')} resets this key.`
        : row && 'help' in row
          ? row.help
          : '';
    if (help && w - listW > 120) drawTooltip(ctx, [help], x + listW + 16, y + 18, w - listW - 22);
    drawHints(
      ctx,
      this.game.app.input,
      [
        ['confirm', 'Change'],
        ['left', '←→ Adjust'],
        ['cancel', 'Back'],
      ],
      x + w - 6,
      y + h - 13,
    );
  }
}

/** Title screen and new-game setup (slot → difficulty → name). */
import { drawIllustration } from '../art/anime';
import { audio } from '../audio';
import type { Scene } from '../engine/app';
import { drawText, wrapText } from '../engine/font';
import { DIFFICULTY } from '../game/balance';
import type { Game } from '../game/game';
import type { Difficulty } from '../game/types';
import { drawHints, drawPanel, ListView, UI } from '../ui/widgets';
import { continueGame, startNewGame } from './flow';
import { LoadScene } from './load';
import { SettingsScene } from './settings';

type Opt = 'continue' | 'new' | 'load' | 'settings';

export class TitleScene implements Scene {
  readonly opaque = true;
  private t = 0;
  private pressed = false;
  private list: ListView<Opt>;

  constructor(private game: Game) {
    game.setSave(null);
    const opts: Opt[] = [];
    if (game.saves.mostRecent() >= 0) opts.push('continue');
    opts.push('new', 'load', 'settings');
    this.list = new ListView(opts, 13, opts.length, true);
    this.pressed = audio.unlocked;
  }

  enter(): void {
    if (audio.unlocked) audio.playMusic('title', { fade: 1.5 });
  }

  resume(): void {
    // refresh options (a save may have been deleted/imported)
    const opts: Opt[] = [];
    if (this.game.saves.mostRecent() >= 0) opts.push('continue');
    opts.push('new', 'load', 'settings');
    this.list.setItems(opts);
    this.list.visibleRows = opts.length;
  }

  update(dt: number): void {
    this.t += dt;
    const input = this.game.app.input;
    if (!this.pressed) {
      if (input.anyPressed() && this.t > 0.3) {
        this.pressed = true;
        audio.unlock();
        audio.playMusic('title', { fade: 1 });
        audio.playSfx('ui_select');
      }
      return;
    }
    const r = this.list.update(input, { noCancel: true });
    if (r !== 'confirm') return;
    switch (this.list.selected) {
      case 'continue': {
        const slot = this.game.saves.mostRecent();
        const data = slot >= 0 ? this.game.saves.load(slot) : null;
        if (data) continueGame(this.game, data);
        break;
      }
      case 'new':
        this.game.app.push(new NewGameScene(this.game));
        break;
      case 'load':
        this.game.app.push(new LoadScene(this.game, 'load'));
        break;
      case 'settings':
        this.game.app.push(new SettingsScene(this.game));
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    drawIllustration(ctx, 'title', this.t, W, H);
    // logo
    const ly = Math.round(H * 0.16);
    const glow = 0.5 + Math.sin(this.t * 2) * 0.2;
    ctx.globalAlpha = glow * 0.4;
    drawText(ctx, 'AETHERFALL', W / 2 + 1, ly + 1, {
      align: 'center',
      scale: 4,
      color: '#2ce8f5',
      shadow: false,
    });
    ctx.globalAlpha = 1;
    drawText(ctx, 'AETHERFALL', W / 2, ly, {
      align: 'center',
      scale: 4,
      color: '#ffffff',
      outline: '#124e89',
    });
    drawText(ctx, 'Echoes of the Shattered Sky', W / 2, ly + 34, {
      align: 'center',
      color: '#fee761',
      outline: '#181425',
    });

    if (!this.pressed) {
      if (Math.floor(this.t * 2) % 2 === 0)
        drawText(ctx, 'Press any key to begin', W / 2, H * 0.72, {
          align: 'center',
          color: '#ffffff',
          outline: '#181425',
        });
    } else {
      const w = 130;
      const h = this.list.items.length * 13 + 10;
      const x = Math.round(W / 2 - w / 2);
      const y = Math.round(H * 0.62);
      drawPanel(ctx, x, y, w, h, { alpha: 0.75 });
      const labels: Record<Opt, string> = {
        continue: 'Continue',
        new: 'New Game',
        load: 'Load Game',
        settings: 'Settings',
      };
      this.list.draw(ctx, x + 4, y + 5, w - 8, (o, rx, ry, sel) =>
        drawText(ctx, labels[o], rx + (w - 8) / 2 - 4, ry, {
          align: 'center',
          color: sel ? UI.accent : '#ffffff',
        }),
      );
    }
    drawText(ctx, 'v1.0  •  All art, music & code procedurally generated', 4, H - 11, {
      color: UI.dim,
      alpha: 0.8,
    });
  }
}

type Step = 'difficulty' | 'name';

export class NewGameScene implements Scene {
  readonly opaque = false;
  private step: Step = 'difficulty';
  private slot = -1;
  private diff: ListView<Difficulty>;
  private inputEl: HTMLInputElement | null = null;

  constructor(private game: Game) {
    const d: Difficulty[] = ['story', 'normal', 'hard', 'nightmare'];
    this.diff = new ListView(d, 13, 4, true);
    this.diff.index = d.indexOf(game.settings.difficulty);
  }

  enter(): void {
    const empty = this.game.saves.firstEmpty();
    if (empty >= 0) this.slot = empty;
    else
      this.game.app.push(
        new LoadScene(this.game, 'pick', (slot) => {
          this.slot = slot;
        }),
      );
  }

  resume(): void {
    if (this.slot < 0) this.game.app.remove(this);
  }

  exit(): void {
    this.inputEl?.remove();
  }

  update(): void {
    const input = this.game.app.input;
    if (this.step === 'difficulty') {
      const r = this.diff.update(input);
      if (r === 'cancel') this.game.app.remove(this);
      if (r === 'confirm') {
        this.step = 'name';
        this.showNameInput();
      }
    } else if (input.pressed('cancel') && document.activeElement !== this.inputEl) {
      this.inputEl?.remove();
      this.inputEl = null;
      this.step = 'difficulty';
    }
  }

  private showNameInput(): void {
    const el = document.createElement('input');
    el.type = 'text';
    el.className = 'name-entry';
    el.maxLength = 12;
    el.value = 'Kai';
    el.setAttribute('aria-label', 'Hero name');
    el.autocomplete = 'off';
    el.spellcheck = false;
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this.begin(el.value);
      if (e.key === 'Escape') {
        el.remove();
        this.inputEl = null;
        this.step = 'difficulty';
      }
    });
    this.inputEl = el;
  }

  private begin(raw: string): void {
    const name =
      raw
        .replace(/[^\w \-'.]/g, '')
        .trim()
        .slice(0, 12) || 'Kai';
    this.inputEl?.remove();
    this.inputEl = null;
    const diff = this.diff.selected!;
    this.game.settings.difficulty = diff;
    this.game.persistSettings();
    audio.playSfx('ui_select');
    void startNewGame(this.game, this.slot, name, diff);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    ctx.fillStyle = 'rgba(11,10,18,0.75)';
    ctx.fillRect(0, 0, W, H);
    const w = Math.min(W - 20, 320);
    const x = Math.round((W - w) / 2);
    if (this.step === 'difficulty') {
      const h = 150;
      const y = Math.round((H - h) / 2);
      drawPanel(ctx, x, y, w, h, { title: 'Choose Difficulty' });
      this.diff.draw(ctx, x + 6, y + 18, 110, (d, rx, ry, sel) =>
        drawText(ctx, DIFFICULTY[d].label, rx + 2, ry, { color: sel ? UI.accent : '#ffffff' }),
      );
      const d = DIFFICULTY[this.diff.selected!];
      wrapText(d.desc, w - 136).forEach((l, i) =>
        drawText(ctx, l, x + 126, y + 20 + i * 10, { color: '#c0cbdc' }),
      );
      drawText(ctx, 'You can change difficulty any time in Settings.', x + 8, y + h - 26, { color: UI.dim });
      drawHints(
        ctx,
        this.game.app.input,
        [
          ['confirm', 'Choose'],
          ['cancel', 'Back'],
        ],
        x + w - 4,
        y + h + 4,
      );
    } else {
      drawText(ctx, 'Name your hero', W / 2, H / 2 - 40, { align: 'center', color: UI.accent, scale: 2 });
      drawText(ctx, 'Type a name and press Enter', W / 2, H / 2 + 26, { align: 'center', color: UI.dim });
    }
  }
}

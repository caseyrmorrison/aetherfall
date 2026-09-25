/** Dialogue overlay: typewriter text, anime portraits, choices, fast-forward and auto mode. */
import { drawPortrait } from '../art/anime';
import { audio } from '../audio';
import type { Scene } from '../engine/app';
import { drawLines, drawText, visibleLength, wrapText } from '../engine/font';
import { isChoice, isLine, type Choice, type Line, type Step } from '../game/dialogue';
import type { Game } from '../game/game';
import { TEXT_SPEED_CPS } from '../game/settings';
import { drawPanel, ListView, UI } from '../ui/widgets';
import { BacklogScene } from './backlog';

export class DialogueScene implements Scene {
  readonly opaque = false;
  private queue: Step[];
  private line: Line | null = null;
  private wrapped: string[] = [];
  private shown = 0;
  private total = 0;
  private t = 0;
  private doneT = 0;
  private blipAcc = 0;
  private choices: ListView<Choice> | null = null;
  private resolve: (() => void) | null = null;
  readonly finished: Promise<void>;
  private holdT = 0;

  constructor(
    private game: Game,
    steps: Step[],
    private defaultSpeaker?: { who: string; portrait?: Line['portrait'] },
  ) {
    this.queue = [...steps];
    this.finished = new Promise((r) => (this.resolve = r));
  }

  enter(): void {
    this.next();
  }

  private boxRect(): { x: number; y: number; w: number; h: number } {
    const W = this.game.app.width;
    const H = this.game.app.height;
    const w = Math.min(W - 12, 440);
    const h = 58;
    return { x: Math.round((W - w) / 2), y: H - h - 8, w, h };
  }

  private next(): void {
    this.line = null;
    this.choices = null;
    while (this.queue.length) {
      const s = this.queue.shift()!;
      if (isLine(s)) {
        this.line = {
          ...s,
          who: s.who ?? this.defaultSpeaker?.who,
          portrait: s.portrait ?? (s.who ? undefined : this.defaultSpeaker?.portrait),
        };
        const box = this.boxRect();
        const textX = this.line.portrait ? 84 : 10;
        this.wrapped = wrapText(this.line.text, box.w - textX - 10);
        this.total = this.wrapped.reduce((n, l) => n + visibleLength(l), 0);
        this.shown = 0;
        this.t = 0;
        this.doneT = 0;
        if (this.game.settings.textSpeed === 'instant') this.shown = this.total;
        this.game.logLine(this.line.who, this.line.text);
        return;
      }
      if (isChoice(s)) {
        this.choices = new ListView(s.choices, 12, s.choices.length, true);
        return;
      }
      s.run();
    }
    this.close();
  }

  private close(): void {
    this.game.app.remove(this);
    this.resolve?.();
  }

  update(dt: number): void {
    const input = this.game.app.input;
    this.t += dt;
    if (this.choices) {
      const r = this.choices.update(input, { noCancel: true });
      if (r === 'confirm') {
        const c = this.choices.selected!;
        c.action?.();
        if (c.then) this.queue.unshift(...c.then);
        this.next();
      }
      return;
    }
    if (!this.line) return;
    if (input.pressed('menuAlt2')) {
      this.game.app.push(new BacklogScene(this.game));
      return;
    }
    const typing = this.shown < this.total;
    if (typing) {
      const cps = TEXT_SPEED_CPS[this.game.settings.textSpeed];
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.total, this.shown + cps * dt);
      this.blipAcc += Math.floor(this.shown) - before;
      if (this.blipAcc >= 3) {
        this.blipAcc = 0;
        audio.playSfx('text_blip', { volume: 0.35 });
      }
    } else this.doneT += dt;

    // hold cancel to fast-forward
    if (input.isDown('cancel')) this.holdT += dt;
    else this.holdT = 0;
    const ff = this.holdT > 0.3;

    const advance = input.pressed('confirm') || input.pressed('interact') || input.mouse.clicked || ff;
    if (advance) {
      if (typing) this.shown = this.total;
      else {
        audio.playSfx('ui_move', { volume: 0.5 });
        this.next();
      }
    } else if (!typing && this.game.settings.autoAdvance && this.doneT > 1.2 + this.total / 60) {
      this.next();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const box = this.boxRect();
    if (this.line) {
      const talking = this.shown < this.total && Math.floor(this.t * 8) % 2 === 0;
      if (this.line.portrait) {
        drawPortrait(ctx, this.line.portrait, this.line.expr ?? 'neutral', box.x + 2, box.y - 30, 76, 86, {
          talking,
          blink: Math.floor(this.t * 10) % 37 === 0,
        });
      }
      drawPanel(
        ctx,
        box.x + (this.line.portrait ? 72 : 0),
        box.y,
        box.w - (this.line.portrait ? 72 : 0),
        box.h,
        { alpha: 0.95 },
      );
      const textX = box.x + (this.line.portrait ? 84 : 10);
      if (this.line.who) {
        const nx = textX - 4;
        drawPanel(ctx, nx, box.y - 12, Math.max(40, this.line.who.length * 5 + 12), 13, {
          fill: UI.bg2,
          border: UI.accent,
        });
        drawText(ctx, this.line.who, nx + 6, box.y - 9, { color: UI.accent });
      }
      drawLines(ctx, this.wrapped, textX, box.y + 8, { maxChars: Math.floor(this.shown), lineHeight: 11 });
      if (this.shown >= this.total && Math.floor(this.t * 3) % 2 === 0) {
        drawText(ctx, '▼', box.x + box.w - 10, box.y + box.h - 11, { color: UI.accent });
      }
    }
    if (this.choices) {
      const items = this.choices.items;
      const w = Math.max(...items.map((c) => c.label.length * 5 + 24), 90);
      const h = items.length * 12 + 8;
      const x = box.x + box.w - w - 4;
      const y = (this.line ? box.y : box.y + box.h) - h - 4;
      drawPanel(ctx, x, y, w, h);
      this.choices.draw(ctx, x + 3, y + 4, w - 8, (c, cx, cy, sel) => {
        drawText(ctx, c.label, cx + 4, cy, { color: sel ? UI.accent : '#ffffff' });
      });
    }
  }
}

/** Convenience: show dialogue on top of the current scene and await completion. */
export function showDialogue(
  game: Game,
  steps: Step[],
  speaker?: { who: string; portrait?: Line['portrait'] },
): Promise<void> {
  const d = new DialogueScene(game, steps, speaker);
  game.app.push(d);
  return d.finished;
}

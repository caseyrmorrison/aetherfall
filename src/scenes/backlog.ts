/** Dialogue backlog: scroll back through recent lines (a staple of visual novels). */
import { audio } from '../audio';
import type { Scene } from '../engine/app';
import { drawText, LINE_HEIGHT, wrapText } from '../engine/font';
import type { Game } from '../game/game';
import { drawHints, drawPanel, UI } from '../ui/widgets';

export class BacklogScene implements Scene {
  readonly opaque = false;
  private lines: string[] = [];
  private scroll = 0;
  private rows = 10;

  constructor(private game: Game) {}

  enter(): void {
    audio.playSfx('ui_open');
    const w = Math.min(this.game.app.width - 24, 420) - 16;
    for (const e of this.game.backlog) {
      const text = e.who ? `{gold}${e.who}:{/} ${e.text}` : `{gray}${e.text}{/}`;
      this.lines.push(...wrapText(text, w), '');
    }
    this.rows = Math.floor((this.game.app.height - 60) / LINE_HEIGHT);
    this.scroll = Math.max(0, this.lines.length - this.rows);
  }

  update(): void {
    const input = this.game.app.input;
    const max = Math.max(0, this.lines.length - this.rows);
    if (input.repeat('up')) this.scroll = Math.max(0, this.scroll - 1);
    if (input.repeat('down')) this.scroll = Math.min(max, this.scroll + 1);
    if (input.mouse.wheel) this.scroll = Math.max(0, Math.min(max, this.scroll + input.mouse.wheel * 2));
    if (
      input.pressed('cancel') ||
      input.pressed('menuAlt2') ||
      input.pressed('confirm') ||
      input.mouse.rightClicked
    ) {
      audio.playSfx('ui_close');
      this.game.app.remove(this);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    ctx.fillStyle = 'rgba(11,10,18,0.8)';
    ctx.fillRect(0, 0, W, H);
    const w = Math.min(W - 24, 420);
    const x = Math.round((W - w) / 2);
    drawPanel(ctx, x, 12, w, H - 36, { title: 'Backlog' });
    if (!this.lines.length) drawText(ctx, 'Nothing yet.', x + 8, 32, { color: UI.dim });
    for (let i = 0; i < this.rows; i++) {
      const l = this.lines[this.scroll + i];
      if (l) drawText(ctx, l, x + 8, 30 + i * LINE_HEIGHT);
    }
    drawHints(
      ctx,
      this.game.app.input,
      [
        ['up', '↑↓ Scroll'],
        ['cancel', 'Close'],
      ],
      x + w - 4,
      H - 20,
    );
  }
}

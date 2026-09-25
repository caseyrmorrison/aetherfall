/** Generic yes/no modal. */
import type { Scene } from '../engine/app';
import { drawText, LINE_HEIGHT, wrapText } from '../engine/font';
import type { Game } from '../game/game';
import { drawPanel, ListView, UI } from '../ui/widgets';

export class ConfirmScene implements Scene {
  readonly opaque = false;
  private list: ListView<string>;
  private lines: string[];

  constructor(
    private game: Game,
    text: string,
    private onYes: () => void,
    private onNo?: () => void,
    labels: [string, string] = ['Yes', 'No'],
  ) {
    this.list = new ListView(labels, 12, 2, true);
    this.lines = wrapText(text, 220);
  }

  update(): void {
    const r = this.list.update(this.game.app.input);
    if (r === 'confirm') {
      this.game.app.remove(this);
      if (this.list.index === 0) this.onYes();
      else this.onNo?.();
    } else if (r === 'cancel') {
      this.game.app.remove(this);
      this.onNo?.();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    ctx.fillStyle = 'rgba(11,10,18,0.5)';
    ctx.fillRect(0, 0, W, H);
    const w = 240;
    const h = this.lines.length * LINE_HEIGHT + 44;
    const x = Math.round((W - w) / 2);
    const y = Math.round((H - h) / 2);
    drawPanel(ctx, x, y, w, h);
    this.lines.forEach((l, i) => drawText(ctx, l, x + 10, y + 8 + i * LINE_HEIGHT));
    this.list.draw(ctx, x + 8, y + h - 30, w - 16, (label, cx, cy, sel) => {
      drawText(ctx, label, cx + 4, cy, { color: sel ? UI.accent : '#ffffff' });
    });
  }
}

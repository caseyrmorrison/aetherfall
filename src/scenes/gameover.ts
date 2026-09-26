/** Death screen with forgiving options. */
import { audio } from '../audio';
import type { Scene } from '../engine/app';
import { drawText } from '../engine/font';
import type { Game } from '../game/game';
import { ListView, UI } from '../ui/widgets';
import type { WorldScene } from './world-scene';

type Opt = 'respawn' | 'load' | 'title';

export class GameOverScene implements Scene {
  readonly opaque = false;
  private t = 0;
  private list = new ListView<Opt>(['respawn', 'load', 'title'], 13, 3, true);

  constructor(
    private game: Game,
    private ws: WorldScene,
  ) {}

  enter(): void {
    audio.playMusic('gameover', { fade: 1 });
  }

  update(dt: number): void {
    this.t += dt;
    if (this.t < 1.2) return;
    const r = this.list.update(this.game.app.input, { noCancel: true });
    if (r !== 'confirm') return;
    this.game.app.remove(this);
    switch (this.list.selected) {
      case 'respawn':
        this.ws.respawn();
        break;
      case 'load': {
        const slot = this.game.save.slot;
        const data = this.game.saves.load(slot);
        if (data) {
          this.game.setSave(data);
          this.ws.travelTo(data.location.map, { x: data.location.x, y: data.location.y });
        } else this.ws.respawn();
        break;
      }
      case 'title':
        void import('./title').then(({ TitleScene }) =>
          this.game.app.transition(() => this.game.app.reset(new TitleScene(this.game))),
        );
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    const a = Math.min(1, this.t / 1.2);
    ctx.fillStyle = `rgba(40,4,12,${0.7 * a})`;
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'YOU HAVE FALLEN', W / 2, H * 0.3, {
      align: 'center',
      color: '#e43b44',
      outline: '#181425',
      scale: 3,
      alpha: a,
    });
    const loss = this.game.difficulty.goldLossOnDeath;
    drawText(
      ctx,
      loss > 0
        ? `You will drop ${Math.round(loss * 100)}% of your gold. Reclaim it where you fell.`
        : 'No gold is lost on Story difficulty.',
      W / 2,
      H * 0.3 + 32,
      { align: 'center', color: UI.dim, alpha: a },
    );
    if (this.t < 1.2) return;
    const labels: Record<Opt, string> = {
      respawn: 'Rise at the last Aether Crystal',
      load: 'Load last save',
      title: 'Return to title',
    };
    this.list.draw(ctx, W / 2 - 90, H * 0.55, 180, (o, x, y, sel) => {
      drawText(ctx, labels[o], x + 4, y, { color: sel ? UI.accent : '#ffffff' });
    });
    drawText(
      ctx,
      'Tip: Stuck? Grind a few levels, upgrade gear at Brom’s, or lower the difficulty in Settings.',
      W / 2,
      H - 24,
      { align: 'center', color: UI.dim },
    );
  }
}

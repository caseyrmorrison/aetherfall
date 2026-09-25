/** Scrolling end credits over the ending illustration. */
import { drawIllustration } from '../art/anime';
import type { Scene } from '../engine/app';
import { drawText } from '../engine/font';
import type { Game } from '../game/game';
import { UI } from '../ui/widgets';

const LINES = [
  '{cyan}AETHERFALL{/}',
  '',
  'A pixel-art action RPG',
  '',
  '',
  '{gold}Design, Code, Art & Music{/}',
  'Procedurally crafted with care',
  '',
  '{gold}Starring{/}',
  '{hero} — the Shardbearer',
  'Lyra — Mage of the Order of Stars',
  'Elder Maren — Keeper of Havenbrook',
  'Brom — Blacksmith',
  'Mira — Merchant',
  'Seraphine — The Frost Queen',
  'Malachar — The Hollow King',
  '',
  '{gold}Special Thanks{/}',
  'Everyone who rolled through',
  'an attack at the last possible moment.',
  '',
  '',
  '{gold}Post-game unlocked{/}',
  'Enter the portal in Havenbrook to',
  'descend into {purple}The Abyss{/}.',
  'Start {gold}New Game+{/} from the System menu.',
  '',
  '',
  'Thank you for playing!',
];

export class CreditsScene implements Scene {
  readonly opaque = true;
  private t = 0;

  constructor(
    private game: Game,
    private onDone: () => void,
  ) {}

  update(dt: number): void {
    this.t += dt;
    const input = this.game.app.input;
    const speed = input.isDown('confirm') ? 4 : 1;
    this.t += dt * (speed - 1);
    const endT = (LINES.length * 14 + this.game.app.height) / 18 + 2;
    if (this.t > endT || input.pressed('cancel')) {
      this.game.app.remove(this);
      this.onDone();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    drawIllustration(ctx, 'ending_dawn', this.t + 10, W, H);
    ctx.fillStyle = 'rgba(11,10,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    const hero = this.game.hasSave ? this.game.save.hero.name : 'Kai';
    const y0 = H - this.t * 18;
    LINES.forEach((l, i) => {
      const y = y0 + i * 14;
      if (y < -10 || y > H) return;
      drawText(ctx, l.replace('{hero}', hero), W / 2, y, {
        align: 'center',
        color: '#ffffff',
        outline: '#181425',
        scale: i === 0 ? 2 : 1,
      });
    });
    drawText(ctx, 'Hold confirm to speed up', W - 6, H - 12, { align: 'right', color: UI.dim });
  }
}

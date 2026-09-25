/** One-time contextual tips (onboarding). Each tip shows once per save, non-blocking. */
import type { Action } from '../engine/input';
import { drawText, wrapText } from '../engine/font';
import { hasFlag, setFlag } from '../game/state';
import type { World } from '../world/world';
import { drawPanel, UI } from './widgets';

const TIPS: Record<string, string> = {
  windup:
    'Enemies flash red and show a warning before they strike. Roll through the attack with [dodge] — you are invulnerable mid-roll!',
  loot: 'Loot! Walk over it to pick it up, then open the menu with [menu] to compare and equip gear.',
  level: 'Level up! Spend skill points on Skills and Talents in the menu [menu].',
  elite: 'Elite monsters glow with colored auras. They hit hard, but always drop rare loot.',
  flask:
    'Low on health? Drink a Health Flask with [potionHp]. Flasks refill whenever you rest at an Aether Crystal.',
  surge: 'Aether Surge is fully charged! Unleash it with [ultimate] for massive damage.',
  crystal:
    'Aether Crystals heal you, refill flasks, save your game and let you fast travel. Resting also revives monsters.',
  skills: 'New skill unlocked! Use skills with [skill1]–[skill4]. Assign and rank them up in the menu.',
  perfect:
    'Rolling at the very last moment triggers a Perfect Dodge: time slows and your Surge charges faster.',
};

export class Tips {
  private current: { id: string; text: string; t: number } | null = null;
  private queue: string[] = [];

  constructor(private world: World) {}

  private get save() {
    return this.world.game.save;
  }

  /** Request a tip (ignored if already seen). */
  show(id: string): void {
    if (!TIPS[id] || hasFlag(this.save, `tip_${id}`) || this.queue.includes(id) || this.current?.id === id)
      return;
    setFlag(this.save, `tip_${id}`);
    this.queue.push(id);
  }

  update(dt: number): void {
    const w = this.world;
    const p = w.player;
    // triggers
    if (w.enemies.some((e) => e.state === 'windup' && !e.isBoss && Math.hypot(e.x - p.x, e.y - p.y) < 140))
      this.show('windup');
    if (w.pickups.some((k) => k.kind === 'item')) this.show('loot');
    if (w.enemies.some((e) => e.elite && e.aggro && !e.dead)) this.show('elite');
    if (p.hp < p.maxHp * 0.5 && p.state !== 'dead') this.show('flask');
    if (this.save.hero.surgeUnlocked && this.save.hero.surge >= 100) this.show('surge');
    if (w.interactTarget && 'obj' in w.interactTarget && w.interactTarget.obj.kind === 'crystal')
      this.show('crystal');
    if (this.save.hero.level >= 2) this.show('level');
    if (this.save.hero.level >= 3) this.show('skills');
    if (this.save.stats.kills >= 15) this.show('perfect');

    if (this.current) {
      this.current.t += dt;
      if (this.current.t > 7) this.current = null;
    } else if (this.queue.length) {
      const id = this.queue.shift()!;
      this.current = { id, text: TIPS[id], t: 0 };
    }
  }

  dismiss(): void {
    this.current = null;
  }

  render(ctx: CanvasRenderingContext2D, W: number): void {
    const c = this.current;
    if (!c) return;
    const input = this.world.input;
    const text = c.text.replace(/\[(\w+)\]/g, (_, a: string) => `{gold}[${input.label(a as Action)}]{/}`);
    const w = Math.min(260, W - 150);
    const lines = wrapText(text, w - 14);
    const h = lines.length * 10 + 16;
    const a = Math.min(1, c.t * 4, (7 - c.t) * 2);
    const x = Math.round(W / 2 - w / 2);
    const y = 6 + Math.round((1 - Math.min(1, c.t * 5)) * -12);
    ctx.globalAlpha = a;
    drawPanel(ctx, x, y, w, h, { border: UI.cyan, alpha: 0.9 });
    drawText(ctx, 'TIP', x + 6, y + 4, { color: UI.cyan });
    lines.forEach((l, i) => drawText(ctx, l, x + 7, y + 13 + i * 10, { alpha: a }));
    ctx.globalAlpha = 1;
  }
}

/** Skills tab: rank up active skills and assign them to the 4 hotbar slots. */
import { audio } from '../../audio';
import { QUESTS } from '../../data/quests';
import { SKILLS, SKILL_ORDER, skillCooldown, type SkillId } from '../../data/skills';
import { drawText } from '../../engine/font';
import { pointInRect, type Rect } from '../../engine/math';
import { drawIcon, drawTooltip, ListView, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

/** How a locked skill is unlocked. */
function unlockText(id: SkillId): string {
  const def = SKILLS[id];
  if (!def.challenge) return `Unlocks at level ${def.unlockLevel}.`;
  const q = QUESTS[def.challenge];
  return `Unlock: ${q.name.replace('Challenge: ', 'the ')} challenge (${q.objectives[0].text.toLowerCase()}).`;
}

export class SkillsTab implements TabView {
  readonly label = 'Skills';
  private list = new ListView<SkillId>([...SKILL_ORDER], 20, 8, false);
  private slotRects: Rect[] = [];

  constructor(private menu: MenuScene) {}

  badge(): boolean {
    return this.menu.game.save.hero.skillPoints > 0;
  }

  update(): 'close' | void {
    const g = this.menu.game;
    const input = g.app.input;
    const hero = g.save.hero;
    const r = this.list.update(input);
    if (r === 'cancel') return 'close';
    const id = this.list.selected!;
    const rank = hero.skills[id] ?? 0;
    if (r === 'confirm') {
      if (rank <= 0) {
        audio.playSfx('ui_error');
        g.toast(unlockText(id), 'ui_lock', 0, UI.bad);
      } else if (rank >= SKILLS[id].maxRank) {
        audio.playSfx('ui_error');
      } else if (hero.skillPoints <= 0) {
        audio.playSfx('ui_error');
        g.toast('No skill points. Level up to earn more.', 'ui_star', 0, UI.bad);
      } else {
        hero.skillPoints--;
        hero.skills[id] = rank + 1;
        audio.playSfx('upgrade_success');
      }
    }
    // assign to slots with the skill keys (1-4 / LB RB LT RT) or by clicking a slot
    for (let i = 0; i < 4; i++) {
      const pressedSlot =
        input.pressed(`skill${i + 1}` as 'skill1') ||
        (input.mouse.clicked &&
          this.slotRects[i] &&
          pointInRect(input.mouse.x, input.mouse.y, this.slotRects[i]));
      if (!pressedSlot) continue;
      if (rank <= 0) {
        audio.playSfx('ui_error');
        continue;
      }
      const prev = hero.slots.indexOf(id);
      if (prev >= 0) hero.slots[prev] = hero.slots[i];
      hero.slots[i] = id;
      audio.playSfx('equip');
    }
  }

  hints(): [string, string][] {
    return [
      ['confirm', 'Rank up'],
      ['skill1', 'Assign slot 1-4'],
    ];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const g = this.menu.game;
    const hero = g.save.hero;
    const input = g.app.input;
    drawText(ctx, `Skill points: {cyan}${hero.skillPoints}{/}`, r.x + 2, r.y + 2);
    // hotbar
    this.slotRects = [];
    drawText(ctx, 'Hotbar', r.x + 2, r.y + 16, { color: UI.dim });
    for (let i = 0; i < 4; i++) {
      const x = r.x + 40 + i * 26;
      const y = r.y + 12;
      ctx.fillStyle = UI.bg2;
      ctx.fillRect(x, y, 20, 20);
      ctx.strokeStyle = UI.border;
      ctx.strokeRect(x + 0.5, y + 0.5, 19, 19);
      const id = hero.slots[i];
      if (id) drawIcon(ctx, SKILLS[id].icon, x + 2, y + 2);
      drawText(ctx, input.label(`skill${i + 1}` as 'skill1'), x + 10, y + 22, {
        align: 'center',
        color: UI.dim,
      });
      this.slotRects.push({ x, y, w: 20, h: 20 });
    }
    const listW = Math.min(210, r.w / 2);
    this.list.visibleRows = Math.floor((r.h - 60) / 20);
    this.list.draw(ctx, r.x, r.y + 46, listW, (id, x, y) => {
      const def = SKILLS[id];
      const rank = hero.skills[id] ?? 0;
      drawIcon(ctx, def.icon, x, y - 4, 0, rank > 0 ? 1 : 0.3);
      drawText(ctx, def.name, x + 20, y - 3, { color: rank > 0 ? '#ffffff' : UI.dim });
      if (rank > 0) {
        for (let k = 0; k < def.maxRank; k++) {
          ctx.fillStyle = k < rank ? UI.accent : UI.bg2;
          ctx.fillRect(x + 20 + k * 6, y + 7, 4, 3);
        }
        const slot = hero.slots.indexOf(id);
        if (slot >= 0) drawText(ctx, `[${slot + 1}]`, x + listW - 10, y, { align: 'right', color: UI.good });
      } else
        drawText(ctx, def.challenge ? 'Challenge' : `Lv ${def.unlockLevel}`, x + listW - 10, y, {
          align: 'right',
          color: def.challenge ? UI.cyan : UI.dim,
        });
    });
    const id = this.list.selected;
    if (id) {
      const def = SKILLS[id];
      const rank = Math.max(1, hero.skills[id] ?? 0);
      const unlocked = (hero.skills[id] ?? 0) > 0;
      const st = g.stats();
      const lines = [
        `{gold}${def.name}{/}`,
        unlocked ? `Rank ${rank}/${def.maxRank}` : `{red}${unlockText(id)}{/}`,
        `{blue}${def.hpCost ? `${Math.round(def.hpCost * 100)}% HP` : `${def.mp} MP`}{/}  •  ${(skillCooldown(def, rank) * (1 - st.cdr)).toFixed(1)}s cooldown`,
        '',
        def.desc(rank),
      ];
      if (unlocked && rank < def.maxRank) lines.push('', `{cyan}Next rank:{/} ${def.desc(rank + 1)}`);
      drawTooltip(ctx, lines, r.x + listW + 12, r.y + 12, r.w - listW - 12);
    }
  }
}

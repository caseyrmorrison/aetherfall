/**
 * Stats tab: a detailed character sheet in the spirit of Diablo III / Path of Exile —
 * headline Damage / Toughness / Recovery numbers plus every stat, grouped and explained.
 */
import { drawPortrait } from '../../art/anime';
import { LEGENDARIES, WEAPON_LABEL } from '../../data/items';
import { drawText } from '../../engine/font';
import type { Rect } from '../../engine/math';
import { MAX_LEVEL, xpToNext } from '../../game/balance';
import { paragonXpToNext } from '../../game/paragon';
import { activeCharms } from '../../game/items';
import { deriveStats, powerRating } from '../../game/stats';
import { CHARM_LIMIT, EQUIP_SLOTS } from '../../game/types';
import { drawBar, drawIcon, drawPanel, drawTooltip, ListView, UI } from '../../ui/widgets';
import type { MenuScene, TabView } from './menu';

type Row =
  | { kind: 'header'; label: string }
  | { kind: 'stat'; label: string; value: string; desc: string; color?: string };

const pct = (v: number, signed = false): string => {
  const n = Math.round(v * 1000) / 10;
  const s = Number.isInteger(n) ? `${n}` : n.toFixed(1);
  return `${signed && v > 0 ? '+' : ''}${s}%`;
};
const num = (v: number): string => (v >= 10000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);

export class StatsTab implements TabView {
  readonly label = 'Stats';
  private list = new ListView<Row>([], 11, 16, false);
  private t = 0;

  constructor(private menu: MenuScene) {}

  private rows(): Row[] {
    const g = this.menu.game;
    const s = g.save;
    const st = g.stats();
    const kind = s.equipment.weapon?.kind ?? 'sword';
    const d = deriveStats(s.hero.level, st, kind);
    const main = d.scaling === 'mag' ? 'Magic' : 'Attack';
    const rows: Row[] = [];
    const h = (label: string): void => void rows.push({ kind: 'header', label });
    const r = (label: string, value: string, desc: string, color?: string): void =>
      void rows.push({ kind: 'stat', label, value, desc, color });

    h('Attributes');
    r(
      'Attack',
      num(st.atk),
      'Raises the damage of melee weapons and Attack skills (Aether Slash, Whirlwind, Spectral Blades).',
    );
    r(
      'Magic',
      num(st.mag),
      'Raises the damage of staves and spells (Fireball, Frost Nova, Chain Lightning, Meteor).',
    );
    r(
      'Defense',
      num(st.def),
      'Reduces the damage of every hit you take. Defense is less effective against higher-level foes.',
    );
    r('Max Health', num(st.maxHp), 'When this reaches zero, you fall.');
    r('Max Mana', num(st.maxMp), 'Spent to use skills.');

    h('Offense');
    r(
      'Damage per Second',
      num(d.dps),
      `Expected basic-attack damage per second, including critical hits and bonuses (before enemy Defense). Scales with ${main}.`,
      UI.bad,
    );
    r(
      'Damage per Hit',
      `${num(d.hitMin)}–${num(d.hitMax)}`,
      'The range of a basic-attack hit, averaged over your 3-hit combo (the third hit deals 50% more).',
    );
    r(
      'Attacks per Second',
      d.attacksPerSec.toFixed(2),
      `How fast your ${WEAPON_LABEL[kind].toLowerCase()} combo flows. Raised by Attack Speed.`,
    );
    r('Attack Speed', pct(st.atkSpeed, true), 'Shortens wind-up and recovery of your weapon swings.');
    r('Critical Hit Chance', pct(st.crit), 'Chance for any hit to be a critical hit. Capped at 75%.');
    r('Critical Hit Damage', pct(st.critDmg, true), 'Extra damage dealt by critical hits.');
    r(
      'Average Crit Multiplier',
      `×${d.critMultiplier.toFixed(2)}`,
      'How much critical hits raise your damage on average.',
    );
    r(
      'Damage Bonus',
      pct(st.dmgBonus, true),
      'Increases all damage you deal (Tonic of Might, The Hollow Crown, charms…).',
    );
    r('Skill Damage', pct(st.skillDmg, true), 'Increases the damage of your active skills.');
    r('Burn Chance', pct(st.burnChance), 'Chance on hit to set enemies ablaze for damage over time.');
    r('Cooldown Reduction', pct(st.cdr), 'Shortens skill cooldowns. Capped at 50%.');
    r(
      'Weapon',
      `${WEAPON_LABEL[kind]} (${main})`,
      'Swords are balanced, greatswords slow but wide, daggers fast with high crit, staves fire bolts that scale with Magic.',
    );

    h('Defense');
    r(
      'Damage Reduction',
      pct(d.damageReduction),
      `Damage blocked by your Defense against an enemy of your level (Lv ${s.hero.level}). Capped at 75%.`,
      UI.good,
    );
    r(
      'Toughness',
      num(d.toughness),
      'Raw damage needed to defeat you from full health, after Defense and damage-taken modifiers.',
      UI.good,
    );
    r(
      'Damage Taken',
      pct(st.damageTaken),
      'Multiplier on all incoming damage (Tonic of Guarding lowers it).',
    );
    r(
      'Dodge Roll Cost',
      `${Math.round(d.rollCost)} stamina`,
      'Stamina spent per roll. You regain stamina quickly after a short pause.',
    );
    r(
      'Roll Invulnerability',
      '0.26 s',
      'You cannot be hurt during most of a dodge roll. Roll just as an attack lands for a Perfect Dodge.',
    );

    h('Life & Resource');
    r(
      'Health Regeneration',
      `${st.hpRegen.toFixed(1)}/s`,
      'Health restored every second. Tripled while out of combat.',
    );
    r('Life Steal', pct(st.lifesteal), 'Percentage of damage dealt returned as health. Capped at 20%.');
    r(
      'Recovery',
      `${num(d.recovery)}/s`,
      'Health per second from regeneration plus life steal at full damage output.',
      UI.cyan,
    );
    r(
      'Health Flask',
      `${num(d.flaskHeal)} HP`,
      `Each Health Flask heals this much. Charges: ${s.hero.flaskHp}/${st.flaskHpMax}.`,
    );
    r(
      'Mana Regeneration',
      `${st.mpRegen.toFixed(1)}/s`,
      'Mana restored every second. Tripled while out of combat.',
    );
    r(
      'Mana Flask',
      `${num(st.maxMp * 0.6 * st.flaskPotency)} MP`,
      `Each Mana Flask restores this much. Charges: ${s.hero.flaskMp}/${st.flaskMpMax}.`,
    );

    h('Adventure');
    r(
      'Movement Speed',
      `${Math.round(d.moveSpeed)} (${pct(st.moveSpeed, true)})`,
      'Walking speed in pixels per second.',
    );
    r('Gold Find', pct(st.goldFind, true), 'More gold from monsters and chests.');
    r('Magic Find', pct(st.magicFind, true), 'Better odds of rare, epic and legendary drops.');
    r('Experience Bonus', pct(st.xpBonus, true), 'Extra experience from every source.');
    const charmCount = s.inventory.filter((i) => i.slot === 'charm').length;
    r(
      'Active Charms',
      `${activeCharms(s).length}/${CHARM_LIMIT}`,
      `Charms work from your bag; the first ${CHARM_LIMIT} are active. You carry ${charmCount}. Sort your bag to put the best ones first.`,
    );

    const powers: Row[] = [];
    for (const slot of EQUIP_SLOTS) {
      const it = s.equipment[slot];
      const def = it?.legendary ? LEGENDARIES.find((l) => l.id === it.legendary) : undefined;
      if (def) powers.push({ kind: 'stat', label: def.name, value: '★', desc: def.power, color: UI.accent });
    }
    const p = st.passives;
    if (p.executioner)
      powers.push({
        kind: 'stat',
        label: 'Executioner',
        value: '+35%',
        desc: 'Deal 35% more damage to enemies below 30% health.',
      });
    if (p.overload)
      powers.push({
        kind: 'stat',
        label: 'Overload',
        value: '+15%',
        desc: 'Skills gain 15% crit chance; critical skills refund mana.',
      });
    if (p.lastStand)
      powers.push({
        kind: 'stat',
        label: 'Last Stand',
        value: '90s',
        desc: 'Survive a fatal blow with 1 HP and become invulnerable for 2 seconds (90s cooldown).',
      });
    if (g.buffs.might > 0)
      powers.push({
        kind: 'stat',
        label: 'Tonic of Might',
        value: `${Math.ceil(g.buffs.might)}s`,
        desc: '+20% damage.',
      });
    if (g.buffs.guard > 0)
      powers.push({
        kind: 'stat',
        label: 'Tonic of Guarding',
        value: `${Math.ceil(g.buffs.guard)}s`,
        desc: 'Take 20% less damage.',
      });
    if (powers.length) {
      h('Special Powers');
      rows.push(...powers);
    }
    return rows;
  }

  update(dt: number): 'close' | void {
    this.t += dt;
    const prev = this.list.index;
    this.list.setItems(this.rows());
    const r = this.list.update(this.menu.game.app.input, { enabled: (row) => row.kind === 'stat' });
    // never rest on a category header: keep moving in the same direction (or down at the start)
    const n = this.list.items.length;
    const dir = this.list.index < prev ? -1 : 1;
    for (let guard = 0; guard < n && this.list.selected?.kind === 'header'; guard++) {
      this.list.index = (this.list.index + dir + n) % n;
    }
    if (r === 'cancel') return 'close';
  }

  hints(): [string, string][] {
    return [];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const g = this.menu.game;
    const s = g.save;
    const st = g.stats();
    const d = deriveStats(s.hero.level, st, s.equipment.weapon?.kind ?? 'sword');
    // ---- left: identity & headline numbers
    const lw = 128;
    drawPortrait(ctx, 'kai', 'determined', r.x, r.y, 44, 50, { blink: Math.floor(this.t * 10) % 43 === 0 });
    drawText(ctx, s.hero.name, r.x + 48, r.y + 4, { color: UI.accent });
    drawText(ctx, 'Shardbearer', r.x + 48, r.y + 14, { color: UI.dim });
    const para = s.hero.paragon;
    const maxed = s.hero.level >= MAX_LEVEL;
    drawText(
      ctx,
      maxed ? `Level ${s.hero.level} {cyan}P${para.level}{/}` : `Level ${s.hero.level}`,
      r.x + 48,
      r.y + 24,
    );
    const xp = maxed ? para.xp : s.hero.xp;
    const need = maxed ? paragonXpToNext(para.level) : xpToNext(s.hero.level);
    drawBar(ctx, r.x + 48, r.y + 36, lw - 50, 3, xp / need, maxed ? '#2ce8f5' : '#b55088');
    drawText(ctx, `${xp}/${need} ${maxed ? 'Paragon XP' : 'XP'}`, r.x + 48, r.y + 41, { color: UI.dim });

    const box = (
      y: number,
      icon: 'ui_sword' | 'ui_shield' | 'ui_heart',
      title: string,
      value: string,
      color: string,
    ): void => {
      drawPanel(ctx, r.x, y, lw, 30, { fill: '#1d1a2e', border: color });
      drawIcon(ctx, icon, r.x + 5, y + 7);
      drawText(ctx, title, r.x + 25, y + 5, { color: UI.dim });
      drawText(ctx, value, r.x + 25, y + 15, { color, scale: 1 });
    };
    box(r.y + 56, 'ui_sword', 'DAMAGE', `${num(d.dps)} DPS`, '#e43b44');
    box(r.y + 90, 'ui_shield', 'TOUGHNESS', num(d.toughness), '#63c74d');
    box(r.y + 124, 'ui_heart', 'RECOVERY', `${num(d.recovery)} /s`, '#2ce8f5');
    drawText(ctx, `Power Rating {gold}${powerRating(st)}{/}`, r.x + 2, r.y + 160);
    drawText(ctx, `Skill Points {cyan}${s.hero.skillPoints}{/}`, r.x + 2, r.y + 172);

    // ---- right: detailed list + description
    const lx = r.x + lw + 10;
    const listW = Math.min(200, r.w - lw - 20);
    this.list.visibleRows = Math.floor((r.h - 4) / 11);
    this.list.draw(ctx, lx, r.y, listW, (row, x, y, sel) => {
      if (row.kind === 'header') {
        drawText(ctx, row.label.toUpperCase(), x - 2, y, { color: UI.cyan });
        return;
      }
      drawText(ctx, row.label, x, y, { color: sel ? UI.accent : '#c0cbdc' });
      drawText(ctx, row.value, x + listW - 10, y, { align: 'right', color: row.color ?? '#ffffff' });
    });
    const row = this.list.selected;
    const dx = lx + listW + 10;
    const dw = r.x + r.w - dx;
    if (row?.kind === 'stat' && dw > 80) {
      drawTooltip(ctx, [`{gold}${row.label}{/}`, `{white}${row.value}{/}`, '', row.desc], dx, r.y, dw);
    }
  }
}

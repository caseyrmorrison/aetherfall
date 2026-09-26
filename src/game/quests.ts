/** Quest & bounty progression. Listens to world events and grants rewards via Game. */
import { audio } from '../audio';
import { ENEMIES } from '../data/enemies';
import { MATERIALS } from '../data/items';
import {
  AUTO_QUESTS,
  QUESTS,
  SIDE_QUESTS,
  type Objective,
  type QuestDef,
  type QuestReward,
} from '../data/quests';
import { NPCS } from '../data/npcs';
import { SKILLS } from '../data/skills';
import { ZONES, ZONE_ORDER } from '../data/zones';
import { rng } from '../engine/rng';
import { MAX_FLASK_UPGRADES } from './balance';
import type { Game } from './game';
import { addConsumable, addMaterial, hasFlag, setFlag, type Bounty, type QuestState } from './state';

export interface QuestTalk {
  lines: string[];
  /** Offer: accepting starts the quest. */
  offer?: QuestDef;
  /** A cutscene to play instead of dialogue. */
  cutscene?: string;
}

export class QuestSystem {
  constructor(private game: Game) {
    game.events.on('enemyKilled', (e) => this.onKill(e.id));
    game.events.on('materialsChanged', () => this.checkCollect());
  }

  private get save() {
    return this.game.save;
  }

  state(id: string): QuestState | undefined {
    return this.save.quests[id];
  }

  isActive(id: string): boolean {
    const q = this.state(id);
    return !!q && !q.done;
  }

  isDone(id: string): boolean {
    return !!this.state(id)?.done;
  }

  active(): QuestState[] {
    return Object.values(this.save.quests).filter((q) => !q.done);
  }

  objective(q: QuestState): Objective | undefined {
    return QUESTS[q.id]?.objectives[q.stage];
  }

  start(id: string, silent = false): void {
    if (this.save.quests[id]) return;
    const def = QUESTS[id];
    if (!def) return;
    // track the newest quest if it's the main quest or nothing else is tracked
    const tracked = def.main || !Object.values(this.save.quests).some((q) => q.tracked && !q.done);
    if (tracked) for (const q of Object.values(this.save.quests)) q.tracked = false;
    this.save.quests[id] = { id, stage: 0, progress: 0, done: false, tracked };
    if (this.alreadySatisfied(def.objectives[0])) this.advance(this.save.quests[id]);
    if (!silent) {
      audio.playSfx('quest_accept');
      this.game.toast(`New quest: {gold}${def.name}{/}`, 'ui_quest');
    }
    this.checkCollect();
    this.game.events.emit('questChanged', { id });
  }

  setTracked(id: string): void {
    for (const q of Object.values(this.save.quests)) q.tracked = q.id === id;
    this.game.events.emit('questChanged', { id });
  }

  tracked(): QuestState | undefined {
    const act = this.active();
    return act.find((q) => q.tracked) ?? act.find((q) => QUESTS[q.id]?.main) ?? act[0];
  }

  /** Progress display like "3/8". */
  progressText(q: QuestState): string {
    const o = this.objective(q);
    if (!o) return '';
    if (o.type === 'kill') return `${Math.min(q.progress, o.count)}/${o.count}`;
    if (o.type === 'collect') return `${Math.min(this.save.materials[o.material] ?? 0, o.count)}/${o.count}`;
    if (o.type === 'counter') return `best ${Math.min(this.save.flags[o.counter] ?? 0, o.count)}/${o.count}`;
    return '';
  }

  private advance(q: QuestState): void {
    const def = QUESTS[q.id];
    for (const f of def.stageFlags?.[q.stage] ?? []) setFlag(this.save, f);
    q.stage++;
    q.progress = 0;
    if (q.stage >= def.objectives.length) {
      this.complete(q);
      return;
    }
    if (this.alreadySatisfied(def.objectives[q.stage])) {
      this.advance(q);
      return;
    }
    audio.playSfx('ui_select');
    this.game.toast(`${def.name}: ${def.objectives[q.stage].text}`, 'ui_quest');
    this.checkCollect();
    this.game.events.emit('questChanged', { id: q.id });
  }

  /** Objectives completed before the quest reached them (e.g. a boss killed early). */
  private alreadySatisfied(o: Objective): boolean {
    if (o.type === 'boss') return hasFlag(this.save, `boss_${o.boss}`);
    if (o.type === 'flag') return hasFlag(this.save, o.flag);
    if (o.type === 'counter') return (this.save.flags[o.counter] ?? 0) >= o.count;
    return false;
  }

  private complete(q: QuestState): void {
    const def = QUESTS[q.id];
    q.done = true;
    q.tracked = false;
    audio.playSfx('quest_complete');
    this.game.banner = { title: 'QUEST COMPLETE', sub: def.name, t: 0, color: '#63c74d' };
    this.grant(def.reward);
    if (def.next) this.start(def.next);
    this.game.events.emit('questChanged', { id: q.id });
  }

  grant(r: QuestReward): void {
    const g = this.game;
    const s = this.save;
    if (r.gold) g.giveGold(r.gold);
    if (r.dust) {
      addMaterial(s, 'dust', r.dust);
      g.toast(`+${r.dust} Aether Dust`, 'icon_dust');
    }
    if (r.skillPoints) {
      s.hero.skillPoints += r.skillPoints;
      g.toast(`+${r.skillPoints} Skill Point${r.skillPoints > 1 ? 's' : ''}`, 'ui_star');
    }
    if (r.elixirs) {
      addConsumable(s, 'elixir', r.elixirs);
      g.toast(`+${r.elixirs} Elixir`, 'icon_elixir');
    }
    if (r.flaskUpgrade && s.hero.flaskUpgrades < MAX_FLASK_UPGRADES) {
      s.hero.flaskUpgrades++;
      g.invalidateStats();
      g.toast('Flask belt upgraded!', 'icon_potion_hp');
    }
    if (r.item) {
      const ilvl = Math.max(r.item.ilvl, s.hero.level > r.item.ilvl + 4 ? s.hero.level - 2 : r.item.ilvl);
      g.giveItem(
        g.rollItem(ilvl, { rarity: r.item.rarity, slot: r.item.legendary ? undefined : r.item.slot }),
      );
    }
    for (const f of r.flags ?? []) setFlag(s, f);
    if (r.skill && !s.hero.skills[r.skill]) {
      s.hero.skills[r.skill] = 1;
      const free = s.hero.slots.indexOf(null);
      if (free >= 0) s.hero.slots[free] = r.skill;
      audio.playSfx('stinger_legendary');
      g.toast(`New skill learned: {gold}${SKILLS[r.skill].name}{/}`, SKILLS[r.skill].icon);
    }
    if (r.xp) g.giveXp(r.xp);
  }

  // ------------------------------------------------------------ triggers ----
  onKill(enemyId: string): void {
    for (const q of this.active()) {
      const o = this.objective(q);
      if (o?.type === 'kill' && o.enemy === enemyId) {
        q.progress++;
        if (q.progress >= o.count) this.advance(q);
        else this.game.events.emit('questChanged', { id: q.id });
      }
    }
    for (const b of [...this.save.bounties]) {
      if (b.enemy !== enemyId || b.progress >= b.count) continue;
      b.progress++;
      if (b.progress >= b.count) this.completeBounty(b);
    }
  }

  onBoss(bossId: string): void {
    setFlag(this.save, `boss_${bossId}`);
    for (const q of this.active()) {
      const o = this.objective(q);
      if (o?.type === 'boss' && o.boss === bossId) this.advance(q);
    }
  }

  onReach(map: string, markerId: string): void {
    for (const q of this.active()) {
      const o = this.objective(q);
      if (o?.type === 'reach' && o.map === map && o.marker === markerId) this.advance(q);
    }
  }

  onFlag(flag: string): void {
    for (const q of this.active()) {
      const o = this.objective(q);
      if (o?.type === 'flag' && o.flag === flag) this.advance(q);
    }
  }

  /** Counter objectives (streaks, records) complete once the number is reached. */
  checkCounters(): void {
    for (const q of this.active()) {
      const o = this.objective(q);
      if (o?.type === 'counter' && (this.save.flags[o.counter] ?? 0) >= o.count) this.advance(q);
    }
  }

  /** Start any challenge (or self-starting story quest) whose requirement has been met. */
  checkChallenges(): void {
    for (const def of AUTO_QUESTS) {
      if (this.save.quests[def.id] || (def.requires && !hasFlag(this.save, def.requires))) continue;
      if (def.autoStart) {
        this.start(def.id);
        continue;
      }
      this.start(def.id, true);
      audio.playSfx('quest_accept');
      this.game.toast(`New challenge: {gold}${def.name.replace('Challenge: ', '')}{/}`, 'ui_skull');
    }
  }

  /** Collect objectives complete as soon as you hold enough materials. */
  checkCollect(): void {
    for (const q of this.active()) {
      const o = this.objective(q);
      if (o?.type === 'collect' && (this.save.materials[o.material] ?? 0) >= o.count) this.advance(q);
    }
  }

  /** Quest content when talking to an NPC (turn-ins first, then offers). */
  talk(npc: string): QuestTalk | null {
    for (const q of this.active()) {
      const def = QUESTS[q.id];
      const o = this.objective(q);
      if (o?.type !== 'talk' || o.npc !== npc) continue;
      // turn in collected materials
      const prev = def.objectives[q.stage - 1];
      if (prev?.type === 'collect') {
        const have = this.save.materials[prev.material] ?? 0;
        if (have < prev.count) {
          q.stage--;
          return { lines: [`You still need ${prev.count - have} more ${MATERIALS[prev.material].name}.`] };
        }
        addMaterial(this.save, prev.material, -prev.count);
      }
      const last = q.stage === def.objectives.length - 1;
      const lines = def.talkLines?.[q.stage] ?? (last ? (def.complete ?? []) : []);
      const cutscene = def.talkCutscene?.[q.stage];
      this.advance(q);
      return { lines, cutscene };
    }
    for (const def of SIDE_QUESTS) {
      if (def.giver !== npc || this.save.quests[def.id]) continue;
      if (def.requires && !hasFlag(this.save, def.requires)) continue;
      return { lines: def.offer ?? [def.summary], offer: def };
    }
    return null;
  }

  /** Is there something new for this NPC? (for the "!" marker above their head) */
  hasNews(npc: string): 'turnin' | 'offer' | null {
    for (const q of this.active()) {
      const o = this.objective(q);
      if (o?.type === 'talk' && o.npc === npc) return 'turnin';
    }
    for (const def of SIDE_QUESTS) {
      if (
        def.giver === npc &&
        !this.save.quests[def.id] &&
        (!def.requires || hasFlag(this.save, def.requires))
      )
        return 'offer';
    }
    return null;
  }

  // ------------------------------------------------------------- bounties ----
  unlockedZones(): string[] {
    return ZONE_ORDER.filter((z) => !ZONES[z].unlockFlag || hasFlag(this.save, ZONES[z].unlockFlag!));
  }

  /** Three bounty offers generated from unlocked zones (stable until accepted). */
  bountyOffers(): Bounty[] {
    const zones = this.unlockedZones();
    const out: Bounty[] = [];
    const seed = (this.save.flags['bounty_seed'] ?? 1) | 0;
    for (let i = 0; i < 3; i++) {
      const zone = zones[(seed + i * 7) % zones.length];
      const def = ZONES[zone];
      const enemy = def.enemies[(seed * 3 + i * 5) % def.enemies.length][0];
      const e = ENEMIES[enemy];
      const count = 8 + ((seed + i * 3) % 3) * 3;
      const lvl = Math.round((def.levels[0] + def.levels[1]) / 2);
      out.push({
        id: `b_${seed}_${i}`,
        enemy,
        count,
        progress: 0,
        zone,
        gold: Math.round(count * e.gold * (1 + 0.3 * (lvl - 1)) * 2.5),
        xp: Math.round(count * e.xp * (1 + 0.45 * (lvl - 1)) * 1.2),
        dust: Math.round(count * (1 + lvl / 6)),
      });
    }
    return out;
  }

  acceptBounty(b: Bounty): boolean {
    if (this.save.bounties.length >= 3 || this.save.bounties.some((x) => x.enemy === b.enemy)) return false;
    this.save.bounties.push({ ...b, progress: 0 });
    this.save.flags['bounty_seed'] = ((this.save.flags['bounty_seed'] ?? 1) * 7 + 3 + rng.int(0, 5)) % 9973;
    audio.playSfx('quest_accept');
    return true;
  }

  private completeBounty(b: Bounty): void {
    this.save.bounties = this.save.bounties.filter((x) => x !== b);
    audio.playSfx('quest_complete');
    this.game.toast(`Bounty complete: ${ENEMIES[b.enemy].name}`, 'ui_skull');
    this.game.giveGold(b.gold);
    addMaterial(this.save, 'dust', b.dust);
    this.game.giveXp(b.xp);
    this.save.flags['bounties_done'] = (this.save.flags['bounties_done'] ?? 0) + 1;
  }

  /** Where the tracked quest wants you to go (for markers). */
  target(): { map: string; objectId?: string; npc?: string; marker?: string } | null {
    const q = this.tracked();
    if (!q) return null;
    const o = this.objective(q);
    if (!o) return null;
    switch (o.type) {
      case 'talk':
        return { map: NPCS[o.npc]?.home ?? 'town', npc: o.npc };
      case 'boss':
        return { map: o.map, objectId: `${o.map}_gate` };
      case 'reach':
        return { map: o.map, marker: o.marker };
      case 'kill':
      case 'collect':
        return { map: o.zone };
      case 'flag':
        return o.map ? { map: o.map, objectId: o.objectId } : null;
      case 'counter':
        return null;
    }
  }
}

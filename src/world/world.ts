/**
 * The live game world for one map: entities, combat resolution, loot, AI support
 * (flow field, attack tokens), interactions, effects and rendering.
 */
import { drawCutIn, cutInDuration, drawSpeedLines, type CutInId } from '../art/anime';
import { getSprite, silhouette, spriteInfo } from '../art/pixel';
import type { FxId } from '../art/pixel/types';
import { audio } from '../audio';
import { ELITE_MODS, enemyDef, type AttackDef, type ProjectileSpec, type StatusSpec } from '../data/enemies';
import type { SkillId } from '../data/skills';
import { NPCS, type Service } from '../data/npcs';
import { drawText } from '../engine/font';
import type { Input } from '../engine/input';
import { angleTo, circleHitsLine, circleInSector, clamp, dist, dist2, normalize, TAU } from '../engine/math';
import { rng } from '../engine/rng';
import {
  ABYSS_SOCKET_CHANCE,
  ABYSSAL_CHANCE,
  ABYSSAL_MAX_CHANCE,
  computeDamage,
  GEM_DROPS,
  goldDrop,
  xpReward,
  type AbyssLootSource,
} from '../game/balance';
import { addGem, gemIcon, gemLabel, rollGemDrop } from '../game/gems';
import { addSocket, generateAbyssal, generateCharm, RARITY_INDEX } from '../game/items';
import type { Game } from '../game/game';
import type { QuestSystem } from '../game/quests';
import {
  addConsumable,
  addMaterial,
  bossCleared,
  decodeBits,
  encodeBits,
  hasFlag,
  setFlag,
} from '../game/state';
import type { Item, Rarity } from '../game/types';
import { Camera } from './camera';
import type { Entity } from './entities/actor';
import { Enemy } from './entities/enemy';
import { Hazard, type HazardSpec } from './entities/hazard';
import { Npc } from './entities/npc';
import { WorldObject } from './entities/objects';
import { Pickup } from './entities/pickup';
import { Player } from './entities/player';
import { Projectile } from './entities/projectile';
import { abyssLevel } from './abyss';
import { getMap } from './maps';
import { CELL, TILE, TOWN_PORTAL_ID, type MapData, type MapObject } from './mapdata';
import { Particles } from './particles';
import { BG_COLOR, MapRenderer, type Drawable, type Light } from './render';
import { fireCannon } from './skills';
import { TrialRun } from './trial';
import { ASC_POINTS_PER_TRIAL } from '../data/ascendancy';
import { applyImpactFrame, impactStyleAt, zoomPunch } from '../ui/fx';
import { TileMap } from './tilemap';

export interface WorldHooks {
  warp(to: string, spawn: string): void;
  death(): void;
  talk(npc: Npc): void;
  service(kind: Service): void;
  sign(text: string): void;
  crystal(id: string): void;
  bossIntro(e: Enemy): void;
  bossDefeated(e: Enemy): void;
  enterArena(o: Extract<MapObject, { kind: 'bossGate' }>): void;
  message(text: string): void;
  portal(to: string, spawn: string): void;
  trial(): void;
  stash(): void;
  /** `choose` = the first trial was just won, so pick an Ascendancy. */
  trialComplete(choose: boolean): void;
}

/** Seconds to channel a town portal. */
export const TOWN_PORTAL_CAST = 1.2;

/** What's kept of an area left by town portal: its monsters, loot on the ground and objects. */
interface PortalStash {
  mapId: string;
  enemies: Enemy[];
  pickups: Pickup[];
  objects: WorldObject[];
  boss: Enemy | null;
  bossIntroDone: boolean;
  abyssCleared: boolean;
}

interface Effect {
  t: number;
  dur: number;
  top: boolean;
  draw: (ctx: CanvasRenderingContext2D, camX: number, camY: number, k: number) => void;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
  dur: number;
  big: boolean;
  small: boolean;
}

export interface PlayerHitOpts {
  power: 'atk' | 'mag' | 'custom';
  customPower?: number;
  mult: number;
  knock?: number;
  dir?: number;
  isSkill?: boolean;
  heavy?: boolean;
  status?: StatusSpec;
  forceCrit?: boolean;
  noShake?: boolean;
  noSurge?: boolean;
}

const SHARD_BOSSES = ['thornmaw', 'crystal_golem', 'ignis', 'seraphine', 'malachar_true'];

export class World {
  data!: MapData;
  map!: TileMap;
  renderer!: MapRenderer;
  readonly cam = new Camera();
  readonly particles = new Particles();
  readonly player = new Player();
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  hazards: Hazard[] = [];
  pickups: Pickup[] = [];
  npcs: Npc[] = [];
  objects: WorldObject[] = [];
  private effects: Effect[] = [];
  private texts: FloatText[] = [];
  labels: { x: number; y: number; text: string }[] = [];
  boss: Enemy | null = null;
  /** Set before loading an arena to fight its (already defeated) guardian again. */
  rematch = false;
  /** Camera focus override (boss intros). */
  focus: Entity | null = null;
  time = 0;
  private hitstopT = 0;
  private slowT = 0;
  private flashT = 0;
  private flashDur = 0;
  private flashColor = '#fff';
  private tokens = 2;
  private maxTokens = 2;
  inputBlocked = false;
  inCombat = false;
  cutin: { id: CutInId; t: number } | null = null;
  /** The Aether Cannon beam (ultimate), while it fires. */
  cannon: { t: number; dur: number; angle: number; tick: number; mult: number; hits: number } | null = null;
  /** A boss powering up at a phase change (freezes the fight briefly, DBZ-style). */
  powerUp: { e: Enemy; t: number; dur: number; peaked: boolean } | null = null;
  private impactT = 0;
  private impactDur = 0;
  private zoomFx: { scale: number; t: number; dur: number; x: number; y: number } | null = null;
  interactTarget: WorldObject | Npc | null = null;
  private flow: Int16Array = new Int16Array(0);
  private reachMask: Uint8Array = new Uint8Array(0);
  private reachFrom = -1;
  /** Town portal being channelled (seconds elapsed), or null. */
  portalCast: { t: number } | null = null;
  /** The area left through a town portal, kept in memory so returning finds it as it was. */
  private portalStash: PortalStash | null = null;
  /** Set by the scene just before loading the map a town portal returns to. */
  restoreFromPortal = false;
  /** What happened during the current guardian fight (for challenges). */
  private bossFight = { hit: false, flask: false };
  /** The Trial of Ascension being fought on this map, if any. */
  trial: TrialRun | null = null;
  private flowT = 0;
  private flowCenter = -1;
  explored!: Uint8Array;
  private exploreT = 0;
  private warpCooldown = 0.6;
  private blockedWarpId: string | null = null;
  private deathT = -1;
  /** The game-over screen has been requested for the current death. */
  private deathHandled = false;
  private bossIntroDone = false;
  private shoutText: { text: string; t: number } | null = null;
  dustColor = '#8b9bb4';
  hooks!: WorldHooks;
  abyssFloor = 0;
  private abyssCleared = false;
  private heartT = 0;

  constructor(
    readonly game: Game,
    readonly quests: QuestSystem,
    readonly input: Input,
  ) {}

  // ----------------------------------------------------------------- load ----
  load(mapId: string, spawn: string | { x: number; y: number }): void {
    this.data = getMap(mapId);
    this.map = new TileMap(this.data);
    this.renderer = new MapRenderer(this.data);
    this.enemies = [];
    this.projectiles = [];
    this.hazards = [];
    this.pickups = [];
    this.effects = [];
    this.texts = [];
    this.npcs = [];
    this.objects = [];
    this.boss = null;
    this.bossIntroDone = false;
    this.particles.clear();
    this.deathT = -1;
    this.deathHandled = false;
    this.cutin = null;
    this.abyssCleared = false;
    this.abyssFloor = mapId.startsWith('abyss') ? Number(mapId.split('_')[1]) : 0;
    const trialTier = mapId.startsWith('trial_') ? Number(mapId.split('_')[1]) : 0;
    const save = this.game.save;
    this.dustColor = {
      town: '#b86f50',
      forest: '#733e39',
      cave: '#5a6988',
      volcano: '#3e2731',
      tundra: '#ffffff',
      citadel: '#8b9bb4',
      abyss: '#68386c',
    }[this.data.theme];
    this.maxTokens = this.game.difficulty.tokens;
    this.tokens = this.maxTokens;

    // spawn position
    let sp = typeof spawn === 'string' ? this.data.spawnPoints[spawn] : spawn;
    if (!sp) sp = this.data.spawnPoints['entry'] ?? Object.values(this.data.spawnPoints)[0];
    this.player.x = sp.x;
    this.player.y = sp.y;
    this.player.state = 'free';
    this.player.dead = false;
    this.player.kx = this.player.ky = 0;
    this.player.vx = this.player.vy = 0;
    this.player.phoenixUsed = false;
    this.player.syncFromSave(this);
    this.player.locked = false;
    save.location = { map: mapId, x: sp.x, y: sp.y };

    // objects & npcs
    for (const o of this.data.objects) {
      if (o.kind === 'warp') continue;
      if (o.kind === 'npc') {
        const def = NPCS[o.id];
        if (def && (!def.visible || def.visible(save))) this.npcs.push(new Npc(def, o.x, o.y));
        continue;
      }
      this.objects.push(new WorldObject(o));
    }
    this.spawnEnemies();
    this.portalCast = null;
    this.trial = trialTier
      ? new TrialRun(trialTier, save.hero.level, save.ascendancy.trials < trialTier)
      : null;
    if (this.restoreFromPortal && this.portalStash?.mapId === mapId) {
      // back through a town portal: everything is where you left it
      const st = this.portalStash;
      this.enemies = st.enemies;
      this.pickups = st.pickups;
      this.objects = st.objects;
      this.boss = st.boss;
      this.bossIntroDone = st.bossIntroDone;
      this.abyssCleared = st.abyssCleared;
    }
    if (this.restoreFromPortal) this.portalStash = null;
    this.restoreFromPortal = false;
    const tp = save.townPortal;
    if (mapId === 'town' && tp)
      this.objects.push(
        new WorldObject({
          kind: 'portal',
          id: TOWN_PORTAL_ID,
          ...(this.data.spawnPoints['town_portal_gate'] ?? this.data.spawnPoints['town_crystal']),
          to: tp.map,
          spawn: TOWN_PORTAL_ID,
        }),
      );

    // fog of war
    this.explored = decodeBits(save.explored[mapId], this.data.w * this.data.h);
    // dropped gold from a previous death
    if (save.droppedGold && save.droppedGold.map === mapId) {
      const pk = new Pickup(save.droppedGold.x, save.droppedGold.y, 'soul', save.droppedGold.amount);
      pk.vx = pk.vy = pk.vz = 0;
      pk.z = 0;
      this.pickups.push(pk);
    }
    this.cam.follow(
      this.player.x,
      this.player.y,
      1,
      this.game.app.width,
      this.game.app.height,
      this.map.pxW,
      this.map.pxH,
      true,
    );
    this.warpCooldown = 0.6;
    this.flowCenter = -1;
    this.reachFrom = -1;
    audio.playMusic(this.data.music);
    audio.setIntensity(0);
  }

  /** (Re)spawn all regular enemies of the map. */
  spawnEnemies(): void {
    this.enemies = this.enemies.filter((e) => e.isBoss);
    const diff = this.game.difficulty;
    const ng = this.game.save.ngPlus * 30;
    for (const s of this.data.spawns) {
      const def = enemyDef(s.enemy);
      const elite = s.elite || rng.chance(diff.eliteChance) ? rng.pick(ELITE_MODS) : null;
      this.enemies.push(
        new Enemy(def, s.level + ng, s.x, s.y, diff, {
          elite,
          group: s.group,
        }),
      );
    }
    const b = this.data.boss;
    // defeated story bosses only return when the player asks for a rematch at the gate
    const cleared = b && !this.abyssFloor && bossCleared(this.game.save, b.enemy);
    const wantBoss = b && (!cleared || this.rematch);
    this.rematch = false;
    if (b && wantBoss && !this.boss) {
      const lvl = (this.abyssFloor ? abyssLevel(this.abyssFloor) : Math.max(this.data.levels[1], 1)) + ng;
      this.spawnBoss(b.enemy, lvl, b.x, b.y);
    }
  }

  spawnBoss(id: string, level: number, x: number, y: number): Enemy {
    const diff = this.game.difficulty;
    const e = new Enemy(enemyDef(id), level, x, y, diff);
    this.enemies.push(e);
    this.boss = e;
    this.bossIntroDone = false;
    return e;
  }

  // ------------------------------------------------------------- helpers ----
  get isArena(): boolean {
    return !!this.data.arena || this.abyssFloor > 0;
  }

  shardCount(): number {
    return SHARD_BOSSES.filter((b) => hasFlag(this.game.save, `boss_${b}`)).length;
  }

  /** Chests in temporary maps (Abyss floors) are tracked here instead of in the save. */
  private transientChests = new Set<string>();

  isChestOpen(id: string): boolean {
    return this.transientChests.has(id) || hasFlag(this.game.save, `chest_${id}`);
  }

  markerActive(id: string): boolean {
    for (const q of this.quests.active()) {
      const o = this.quests.objective(q);
      if (o?.type === 'reach' && o.marker === id && o.map === this.data.id) return true;
    }
    return false;
  }

  enemiesNear(x: number, y: number, r: number): Enemy[] {
    const r2 = r * r;
    return this.enemies.filter((e) => e.targetable && dist2(x, y, e.x, e.y) <= r2);
  }

  inSector(e: Enemy, sx: number, sy: number, r: number, facing: number, half: number): boolean {
    return circleInSector(e.x, e.y - 4 * e.scale, e.radius, sx, sy, r, facing, half);
  }

  playerInSector(sx: number, sy: number, r: number, facing: number, half: number): boolean {
    const p = this.player;
    return circleInSector(p.x, p.y, p.radius, sx, sy, r, facing, half);
  }

  playerOnLine(ax: number, ay: number, bx: number, by: number, hw: number): boolean {
    const p = this.player;
    return circleHitsLine(p.x, p.y, p.radius, ax, ay, bx, by, hw);
  }

  countSummons(owner: Enemy): number {
    return this.enemies.filter((e) => e.summoned && !e.dead && e !== owner).length;
  }

  takeToken(): boolean {
    if (this.tokens <= 0) return false;
    this.tokens--;
    return true;
  }

  tokenAvailable(): boolean {
    return this.tokens > 0;
  }

  returnToken(): void {
    this.tokens = Math.min(this.maxTokens, this.tokens + 1);
  }

  alertGroup(e: Enemy): void {
    if (e.group < 0) return;
    for (const o of this.enemies)
      if (o.group === e.group && !o.aggro && dist(o.x, o.y, e.x, e.y) < 140) o.aggro = true;
  }

  /** Move an actor with tile + prop collision. Nudges around corners for the player. */
  moveActor(a: Entity, dx: number, dy: number, flying = false, nudge = false): void {
    const r = a.radius;
    const bw = r * 2;
    const bh = Math.max(4, r * 1.2);
    const box = (x: number, y: number): boolean => this.map.boxBlocked(x - r, y - bh, bw, bh, flying);
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const sx = dx / steps;
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      if (sx !== 0) {
        if (!box(a.x + sx, a.y)) a.x += sx;
        else if (nudge && sy === 0) {
          for (const n of [1, -1, 2, -2, 3, -3, 4, -4]) {
            if (!box(a.x, a.y + n) && !box(a.x + sx, a.y + n)) {
              a.y += Math.sign(n) * 0.8;
              break;
            }
          }
        }
      }
      if (sy !== 0) {
        if (!box(a.x, a.y + sy)) a.y += sy;
        else if (nudge && sx === 0) {
          for (const n of [1, -1, 2, -2, 3, -3, 4, -4]) {
            if (!box(a.x + n, a.y) && !box(a.x + n, a.y + sy)) {
              a.x += Math.sign(n) * 0.8;
              break;
            }
          }
        }
      }
    }
    if (a instanceof Enemy && (sx !== 0 || sy !== 0)) {
      // for charges: if we didn't move, zero velocity so the AI knows it hit a wall
      if (box(a.x + Math.sign(dx) * 2, a.y) && box(a.x, a.y + Math.sign(dy) * 2)) {
        a.vx = 0;
        a.vy = 0;
      }
    }
  }

  /** Tiles the hero can walk to from where they stand (recomputed when they change tile). */
  private reachable(): Uint8Array {
    const w = this.data.w;
    const h = this.data.h;
    const tx = Math.max(0, Math.min(w - 1, Math.floor(this.player.x / TILE)));
    const ty = Math.max(0, Math.min(h - 1, Math.floor(this.player.y / TILE)));
    const start = ty * w + tx;
    if (start === this.reachFrom && this.reachMask.length === w * h) return this.reachMask;
    this.reachFrom = start;
    const seen = new Uint8Array(w * h);
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % w;
      const y = (k / w) | 0;
      const next = [x > 0 ? k - 1 : -1, x < w - 1 ? k + 1 : -1, y > 0 ? k - w : -1, y < h - 1 ? k + w : -1];
      for (const n of next) {
        if (n < 0 || seen[n]) continue;
        const c = this.data.cells[n];
        if (c !== CELL.Floor && c !== CELL.Bridge) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    this.reachMask = seen;
    return seen;
  }

  /**
   * The nearest point the hero can walk to. Used to rescue loot (and place rewards) that
   * would otherwise land in a void pool, a wall or a sealed-off pocket.
   */
  safeSpot(x: number, y: number): { x: number; y: number } {
    const w = this.data.w;
    const h = this.data.h;
    const reach = this.reachable();
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx >= 0 && ty >= 0 && tx < w && ty < h && reach[ty * w + tx]) return { x, y };
    let best = -1;
    let bestD = Infinity;
    const R = 24;
    for (let yy = Math.max(0, ty - R); yy <= Math.min(h - 1, ty + R); yy++) {
      for (let xx = Math.max(0, tx - R); xx <= Math.min(w - 1, tx + R); xx++) {
        const k = yy * w + xx;
        if (!reach[k]) continue;
        let d = (xx * TILE + TILE / 2 - x) ** 2 + (yy * TILE + TILE / 2 - y) ** 2;
        // prefer open floor above too, so loot doesn't look like it's still sitting in a pool's edge
        if (yy > 0 && !reach[k - w]) d += (TILE * 1.5) ** 2;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
    }
    if (best < 0) return { x: this.player.x, y: this.player.y };
    // anchor low in the tile: pickups draw upward from their feet
    return { x: (best % w) * TILE + TILE / 2, y: Math.floor(best / w) * TILE + TILE - 3 };
  }

  /** Direction toward a target, using the flow field when there is no line of sight. */
  steer(e: Enemy, tx: number, ty: number, los: boolean): { x: number; y: number } {
    if (los || e.flying || this.flow.length === 0) return normalize(tx - e.x, ty - e.y);
    const cx = Math.floor(e.x / TILE);
    const cy = Math.floor(e.y / TILE);
    const w = this.data.w;
    const here = this.flow[cy * w + cx];
    let best = here < 0 ? 32767 : here;
    let bx = 0;
    let by = 0;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oy) continue;
        const nx = cx + ox;
        const ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= this.data.h) continue;
        const v = this.flow[ny * w + nx];
        if (
          v >= 0 &&
          v < best &&
          (!ox || !oy || (this.flow[cy * w + nx] >= 0 && this.flow[ny * w + cx] >= 0))
        ) {
          best = v;
          bx = ox;
          by = oy;
        }
      }
    }
    if (bx === 0 && by === 0) return normalize(tx - e.x, ty - e.y);
    return normalize(cx * TILE + 8 + bx * TILE - e.x, cy * TILE + 8 + by * TILE - e.y);
  }

  private updateFlow(dt: number): void {
    this.flowT -= dt;
    const w = this.data.w;
    const h = this.data.h;
    const pc = Math.floor(this.player.y / TILE) * w + Math.floor(this.player.x / TILE);
    if (this.flowT > 0 && pc === this.flowCenter) return;
    this.flowT = 0.35;
    this.flowCenter = pc;
    if (this.flow.length !== w * h) this.flow = new Int16Array(w * h);
    this.flow.fill(-1);
    const q = new Int32Array(w * h);
    let head = 0;
    let tail = 0;
    q[tail++] = pc;
    this.flow[pc] = 0;
    while (head < tail) {
      const i = q[head++];
      const d = this.flow[i];
      if (d > 40) continue;
      const x = i % w;
      const y = (i / w) | 0;
      const n = [i - 1, i + 1, i - w, i + w];
      const ok = [x > 0, x < w - 1, y > 0, y < h - 1];
      for (let k = 0; k < 4; k++) {
        if (!ok[k]) continue;
        const j = n[k];
        if (this.flow[j] >= 0) continue;
        const c = this.data.cells[j];
        if (c !== CELL.Floor && c !== CELL.Bridge) continue;
        this.flow[j] = d + 1;
        q[tail++] = j;
      }
    }
  }

  // --------------------------------------------------------------- update ----
  update(dt: number): void {
    const realDt = dt;
    this.time += dt;
    this.labels = [];
    this.flashT = Math.max(0, this.flashT - dt);
    this.game.tick(dt);

    this.impactT = Math.max(0, this.impactT - dt);
    if (this.zoomFx) {
      this.zoomFx.t += dt;
      if (this.zoomFx.t >= this.zoomFx.dur) this.zoomFx = null;
    }

    // ultimate cut-in freezes the action
    if (this.cutin) {
      this.cutin.t += dt;
      if (this.cutin.t >= cutInDuration(this.cutin.id)) {
        this.cutin = null;
        fireCannon(this, this.player);
      }
      return;
    }

    // boss power-up: everything holds while the aura erupts
    if (this.powerUp) {
      this.updatePowerUp(dt);
      return;
    }
    if (this.cannon) this.updateCannon(dt);

    this.cam.shakeScale = this.game.settings.screenShake;
    this.cam.follow(
      ...this.camTarget(),
      dt,
      this.game.app.width,
      this.game.app.height,
      this.map.pxW,
      this.map.pxH,
    );
    this.particles.update(dt);
    this.updateEffects(dt);

    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
      return;
    }

    // perfect-dodge slow motion affects everything except the hero
    let enemyDt = dt;
    if (this.slowT > 0) {
      this.slowT -= realDt;
      enemyDt = dt * 0.3;
    }

    this.updateFlow(dt);
    this.player.update(dt, this);
    if (this.portalCast) this.updateTownPortal(dt);
    if (this.trial) this.trial.update(dt, this);
    for (const e of this.enemies) e.update(enemyDt, this);
    this.separateEnemies();
    for (const pr of this.projectiles) pr.update(enemyDt, this);
    for (const h of this.hazards) h.update(enemyDt, this);
    for (const pk of this.pickups) pk.update(dt, this);
    for (const n of this.npcs) n.update(dt, this);
    for (const o of this.objects) o.update(dt, this);
    this.pushOutOfNpcs();

    this.enemies = this.enemies.filter((e) => !e.removed);
    this.projectiles = this.projectiles.filter((p) => !p.removed);
    this.hazards = this.hazards.filter((h) => !h.removed);
    this.pickups = this.pickups.filter((p) => !p.removed);

    // combat state → music intensity
    const wasCombat = this.inCombat;
    this.inCombat = this.enemies.some(
      (e) =>
        e.aggro &&
        !e.dead &&
        (e.state === 'chase' || e.state === 'windup' || e.state === 'attack' || e.state === 'recover') &&
        dist(e.x, e.y, this.player.x, this.player.y) < 260,
    );
    if (wasCombat !== this.inCombat) audio.setIntensity(this.inCombat ? 1 : 0);

    // exploration
    this.exploreT -= dt;
    if (this.exploreT <= 0) {
      this.exploreT = 0.25;
      this.markExplored();
    }

    this.updateInteraction();
    this.checkWarps(dt);
    this.updateAmbient(dt);
    this.updateTexts(dt);

    // boss intro trigger
    if (this.boss && !this.bossIntroDone && !this.boss.dead) {
      this.bossIntroDone = true;
      this.bossFight = { hit: false, flask: false };
      this.hooks.bossIntro(this.boss);
    }
    // abyss floor clear
    if (this.abyssFloor > 0 && !this.abyssCleared && this.enemies.every((e) => e.dead || e.removed)) {
      this.abyssCleared = true;
      this.onAbyssCleared();
    }

    // death
    if (this.player.state === 'dead') {
      this.deathT = Math.max(0, this.deathT) + realDt;
      if (this.deathT > 1.6 && !this.deathHandled) {
        this.deathHandled = true;
        this.hooks.death();
      }
    }
    if (this.shoutText) {
      this.shoutText.t += dt;
      if (this.shoutText.t > 2.6) this.shoutText = null;
    }
    // heartbeat when in danger
    this.heartT -= realDt;
    if (this.player.state !== 'dead' && this.player.hp < this.player.maxHp * 0.25 && this.heartT <= 0) {
      this.heartT = 0.9;
      audio.playSfx('low_hp');
    }
    // sync hero state
    const h = this.game.save.hero;
    h.hp = Math.round(this.player.hp);
    h.mp = Math.round(this.player.mp);
    if (this.player.state !== 'dead') {
      const loc = this.game.save.location;
      loc.map = this.data.id;
      loc.x = Math.round(this.player.x);
      loc.y = Math.round(this.player.y);
    }
  }

  private camTarget(): [number, number] {
    const p = this.player;
    if (this.focus) return [this.focus.x, this.focus.y - 16];
    if (this.boss && !this.boss.dead && this.boss.targetable && this.bossIntroDone) {
      // keep both fighters framed when they're reasonably close
      const d = dist(p.x, p.y, this.boss.x, this.boss.y);
      const k = d < this.game.app.height * 0.9 ? 0.5 : 0.3;
      return [p.x + (this.boss.x - p.x) * k, p.y - 8 + (this.boss.y - p.y) * k];
    }
    const look = this.input.mouseAimActive() ? 0 : 10;
    return [p.x + Math.cos(p.aim) * look, p.y - 8 + Math.sin(p.aim) * look * 0.6];
  }

  private separateEnemies(): void {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead || a.airborne) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.dead || b.airborne) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const r = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = (r - d) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        const wa = a.isBoss ? 0 : b.isBoss ? 1 : 0.5;
        this.moveActor(a, -nx * push * wa * 2, -ny * push * wa * 2, a.flying);
        this.moveActor(b, nx * push * (1 - wa) * 2, ny * push * (1 - wa) * 2, b.flying);
      }
    }
    // enemies vs player (soft, never pushes the player through walls)
    const p = this.player;
    if (p.state === 'roll' || p.state === 'dash' || p.state === 'dead') return;
    for (const e of es) {
      if (e.dead || e.airborne || e.flying) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const r = e.radius + p.radius - 2;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const push = r - d;
      this.moveActor(p, (dx / d) * push * 0.6, (dy / d) * push * 0.6);
    }
  }

  private pushOutOfNpcs(): void {
    const p = this.player;
    for (const n of this.npcs) {
      const dx = p.x - n.x;
      const dy = p.y - n.y;
      const r = n.radius + p.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r * r || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      this.moveActor(p, (dx / d) * (r - d), (dy / d) * (r - d));
    }
  }

  private markExplored(): void {
    const w = this.data.w;
    const cx = Math.floor(this.player.x / TILE);
    const cy = Math.floor(this.player.y / TILE);
    const R = 9;
    let changed = false;
    for (let y = cy - R; y <= cy + R; y++) {
      for (let x = cx - R; x <= cx + R; x++) {
        if (x < 0 || y < 0 || x >= w || y >= this.data.h) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
        const i = y * w + x;
        if (!this.explored[i]) {
          this.explored[i] = 1;
          changed = true;
        }
      }
    }
    if (changed) this.game.save.explored[this.data.id] = encodeBits(this.explored);
  }

  // -------------------------------------------------------- interaction ----
  private updateInteraction(): void {
    const p = this.player;
    this.interactTarget = null;
    if (p.state === 'dead' || this.inputBlocked) return;
    let best = Infinity;
    for (const n of this.npcs) {
      const d = dist(p.x, p.y, n.x, n.y);
      if (d < 22 && d < best) {
        best = d;
        this.interactTarget = n;
      }
    }
    for (const o of this.objects) {
      const d = dist(p.x, p.y, o.x, o.y);
      if (d < o.reach && d < best && o.prompt(this)) {
        best = d;
        this.interactTarget = o;
      }
    }
    if (this.interactTarget && this.input.pressed('interact')) this.interact(this.interactTarget);
  }

  private interact(t: WorldObject | Npc): void {
    if (t instanceof Npc) {
      audio.playSfx('ui_select');
      this.hooks.talk(t);
      return;
    }
    const o = t.obj;
    switch (o.kind) {
      case 'chest':
        this.openChest(o);
        break;
      case 'crystal':
        this.hooks.crystal(o.id);
        break;
      case 'sign':
        this.hooks.sign(o.text);
        break;
      case 'door': {
        const svc: Record<string, Service | null> = {
          inn: 'inn',
          shop: 'shop',
          smithy: 'smith',
          elder: null,
          house: null,
        };
        const s = svc[o.building];
        if (s) {
          audio.playSfx('door');
          this.hooks.service(s);
        } else if (o.building === 'elder') {
          const maren = this.npcs.find((n) => n.def.id === 'maren');
          if (maren) this.hooks.talk(maren);
        } else this.hooks.sign('The door is locked. Someone inside is snoring loudly.');
        break;
      }
      case 'bossGate':
        this.hooks.enterArena(o);
        break;
      case 'portal':
        if (t.portalOpen(this)) {
          audio.playSfx('teleport');
          this.hooks.portal(o.to, o.spawn);
        }
        break;
      case 'board':
        this.hooks.service('board');
        break;
      case 'trial':
        audio.playSfx('ui_select');
        this.hooks.trial();
        break;
      case 'stash':
        audio.playSfx('chest_open');
        this.hooks.stash();
        break;
      case 'marker':
        audio.playSfx('pickup_rare');
        this.quests.onReach(this.data.id, o.id);
        this.popText(o.x, o.y - 18, 'Found it!', '#fee761');
        break;
    }
  }

  private checkWarps(dt: number): void {
    this.warpCooldown -= dt;
    if (this.warpCooldown > 0 || this.player.state === 'dead') return;
    const p = this.player;
    for (const o of this.data.objects) {
      if (o.kind !== 'warp') continue;
      if (p.x < o.x || p.x > o.x + o.w || p.y < o.y - 4 || p.y > o.y + o.h + 4) continue;
      if (o.requires && !hasFlag(this.game.save, o.requires.flag)) {
        if (this.blockedWarpId !== o.id) {
          this.blockedWarpId = o.id;
          if (this.isArena) {
            this.popText(p.x, p.y - 24, 'The way is sealed!', '#b55088');
            audio.playSfx('ui_error');
          } else this.hooks.message(o.requires.message);
        }
        // push back out of the warp strip
        const cx = o.x + o.w / 2;
        const cy = o.y + o.h / 2;
        const n = normalize(this.map.pxW / 2 - cx, this.map.pxH / 2 - cy);
        this.moveActor(p, n.x * 6, n.y * 6);
        return;
      }
      if (this.inCombat && this.isArena && this.boss && !this.boss.dead) return;
      this.warpCooldown = 99;
      this.hooks.warp(o.to, o.spawn);
      return;
    }
    // only reached when the player is not standing in any warp
    this.blockedWarpId = null;
  }

  // ----------------------------------------------------------- town portal ----

  /** Why a town portal can't be opened here, or null if it can. */
  townPortalBlocked(): string | null {
    if (this.data.id === 'town') return 'You are already in town.';
    if (this.trial && !this.trial.done) return 'The trial seals you in. Walk out to forfeit.';
    if (this.player.state === 'dead') return 'You are dead.';
    if (this.boss && !this.boss.dead && this.bossIntroDone) return 'The guardian won’t let you leave!';
    return null;
  }

  /** Start channelling a town portal (hold still; taking damage interrupts it). */
  startTownPortal(): void {
    if (this.portalCast) return;
    const why = this.townPortalBlocked();
    if (why) {
      audio.playSfx('ui_error');
      this.popText(this.player.x, this.player.y - 24, why, '#8b9bb4', { small: true });
      return;
    }
    this.portalCast = { t: 0 };
    audio.playSfx('charge_up', { volume: 0.7 });
  }

  cancelTownPortal(reason?: string): void {
    if (!this.portalCast) return;
    this.portalCast = null;
    if (reason) this.popText(this.player.x, this.player.y - 24, reason, '#8b9bb4', { small: true });
  }

  private updateTownPortal(dt: number): void {
    const p = this.player;
    const cast = this.portalCast!;
    // moving, rolling, attacking or casting breaks the channel
    if (p.moving || p.state !== 'free' || this.townPortalBlocked()) {
      this.cancelTownPortal(p.state === 'dead' ? undefined : 'Portal cancelled');
      return;
    }
    cast.t += dt;
    if (Math.random() < dt * 30) {
      const a = Math.random() * TAU;
      this.particles.emit(p.x + Math.cos(a) * 14, p.y + Math.sin(a) * 6, {
        count: 1,
        color: ['#2ce8f5', '#0099db', '#ffffff'],
        speed: [2, 8],
        vz: [20, 50],
        gravity: -20,
        life: [0.4, 0.8],
        emissive: true,
        shape: 'glow',
      });
    }
    if (cast.t < TOWN_PORTAL_CAST) return;
    this.portalCast = null;
    const save = this.game.save;
    save.townPortal = { map: this.data.id, x: Math.round(p.x), y: Math.round(p.y) };
    this.stashForPortal();
    audio.playSfx('teleport');
    this.flashScreen('#2ce8f5', 0.2);
    this.hooks.warp('town', 'town_portal');
  }

  /** Remember this area so returning through the portal finds it unchanged. */
  private stashForPortal(): void {
    for (const e of this.enemies) {
      e.releaseToken(this);
      e.aggro = false;
      if (e.state === 'windup' || e.state === 'attack' || e.state === 'recover' || e.state === 'chase')
        e.state = 'idle';
    }
    this.portalStash = {
      mapId: this.data.id,
      enemies: this.enemies.filter((e) => !e.dead && !e.removed),
      pickups: this.pickups.filter((pk) => !pk.removed && pk.kind !== 'orb_hp' && pk.kind !== 'orb_mp'),
      objects: this.objects,
      boss: this.boss && !this.boss.dead ? this.boss : null,
      bossIntroDone: this.bossIntroDone,
      abyssCleared: this.abyssCleared,
    };
  }

  // ---------------------------------------------------------------- combat ----
  playerHit(e: Enemy, o: PlayerHitOpts): void {
    if (!e.targetable) return;
    const st = this.game.stats();
    const hero = this.game.save.hero;
    const pv = st.passives;
    const asc = st.asc;
    const p = this.player;
    const power = o.power === 'atk' ? st.atk : o.power === 'mag' ? st.mag : (o.customPower ?? st.atk);
    let bonus = st.dmgBonus + (o.isSkill ? st.skillDmg : pv.basicDmg);
    if (o.heavy) bonus += pv.finisher;
    const hpFrac = e.hp / e.maxHp;
    if (pv.executioner && hpFrac < 0.3) bonus += 0.35;
    if (asc.has('sb_assassin') && hpFrac < 0.35) bonus += 0.5;
    if (asc.has('am_mastery') && (hasStatus(e, 'burn') || hasStatus(e, 'freeze'))) bonus += 0.25;
    if (pv.unyielding && p.hp < p.maxHp * 0.4) bonus += 0.2;
    let forceCrit = !!o.forceCrit;
    // Riposte: guaranteed crits after a perfect dodge
    if (!o.isSkill && p.guaranteedCrits > 0) {
      forceCrit = true;
      p.guaranteedCrits--;
    }
    // Shadow Veil: the first hit after a roll
    if (p.veilT > 0 && asc.has('sb_veil')) {
      forceCrit = true;
      bonus += 0.5;
      p.veilT = 0;
    }
    const critChance = forceCrit ? 1 : st.crit + (o.isSkill ? (pv.overload ? 0.15 : 0) + pv.skillCrit : 0);
    const res = computeDamage({
      power,
      mult: o.mult,
      attackerLevel: hero.level,
      defenderLevel: e.level,
      defenderDef: e.defense * (1 - Math.min(0.6, pv.sunder)),
      critChance,
      critDmg: st.critDmg + (o.isSkill ? pv.skillCritDmg : 0),
      bonus,
      rollCrit: rng.next(),
      rollVar: rng.next(),
    });
    let dmg = res.amount;
    const dir = o.dir ?? angleTo(this.player.x, this.player.y, e.x, e.y);
    // shields
    if (e.guards(dir) && !o.isSkill) {
      dmg = Math.max(1, Math.round(dmg * (1 - (e.def.guard ?? 0))));
      audio.playSfx('block');
      this.popText(e.x, e.y - 20, 'Block', '#8b9bb4', { small: true });
      this.particles.emit(e.x, e.y - 8, {
        count: 6,
        color: ['#ffffff', '#c0cbdc'],
        speed: [40, 90],
        life: [0.1, 0.25],
        shape: 'line',
      });
    }
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, dmg);
      e.shield -= absorbed;
      dmg -= absorbed;
      if (dmg <= 0) {
        this.popText(e.x, e.y - 20, 'Warded', '#2ce8f5', { small: true });
        e.onHurt(dir, (o.knock ?? 60) * 0.3);
        return;
      }
    }
    this.dealToEnemy(e, dmg, res.crit, dir, o.knock ?? 60, o.heavy || res.crit);
    if (!o.isSkill) {
      // Thousand Cuts: basic hits shorten every skill cooldown
      if (asc.has('bm_thousand'))
        for (const k of Object.keys(p.cooldowns) as SkillId[])
          p.cooldowns[k] = Math.max(0, (p.cooldowns[k] ?? 0) - 0.25);
      if (asc.has('am_archon')) p.mp = Math.min(p.maxMp, p.mp + 1);
    }
    if (e.dead) {
      if (o.isSkill && pv.skillExplode) this.skillExplosion(e);
      return;
    }
    // on-hit effects
    const immune = e.def.immune ?? [];
    if (o.status) e.applyStatus(this.tuneStatus(o.status), power, immune);
    if (st.burnChance > 0 && rng.chance(st.burnChance))
      e.applyStatus(this.tuneStatus({ kind: 'burn', duration: 3 }), power * 0.3, immune);
    if (!o.isSkill && (st.legendaries.has('thornfang') || asc.has('sb_venom')))
      e.applyStatus({ kind: 'poison', duration: 3 }, (power * 0.4 * 0.33) / 0.2, immune);
    if (st.lifesteal > 0) this.healPlayer(dmg * st.lifesteal, false);
    if (!o.noSurge && hero.surgeUnlocked)
      hero.surge = Math.min(100, hero.surge + (res.crit ? 2.2 : 1.2) * (o.isSkill ? 0.7 : 1));
    if (o.isSkill && res.crit && st.passives.overload)
      this.player.mp = Math.min(this.player.maxMp, this.player.mp + 4);
    if (!o.noShake) this.shake(res.crit || o.heavy ? 2.5 : 1.2, 0.12);
  }

  /** Talents/notables that lengthen the statuses you inflict. */
  private tuneStatus(spec: StatusSpec): StatusSpec {
    const st = this.game.stats();
    let k = 1;
    if (spec.kind === 'freeze' || spec.kind === 'slow') k += st.passives.freezeDur;
    if (spec.kind === 'burn' && st.asc.has('am_mastery')) k += 0.5;
    return k === 1 ? spec : { ...spec, duration: spec.duration * k };
  }

  /** Elemental Overflow: an enemy slain by a skill bursts, hurting those around it. */
  private skillExplosion(e: Enemy): void {
    this.novaEffect(e.x, e.y - 4, 36, 'arcane');
    for (const o of this.enemiesNear(e.x, e.y, 50)) {
      if (o === e || dist(o.x, o.y, e.x, e.y) > 36 + o.radius) continue;
      this.playerHit(o, {
        power: 'mag',
        mult: 0.5,
        knock: 60,
        dir: angleTo(e.x, e.y, o.x, o.y),
        noShake: true,
      });
    }
  }

  private dealToEnemy(
    e: Enemy,
    dmg: number,
    crit: boolean,
    dir: number,
    knock: number,
    heavy?: boolean,
  ): void {
    e.hp -= dmg;
    this.game.save.stats.damageDealt += dmg;
    e.onHurt(dir, knock * (heavy ? 1.4 : 1));
    this.popText(e.x + rng.range(-4, 4), e.y - 14 * e.scale - 6, `${dmg}`, crit ? '#fee761' : '#ffffff', {
      big: crit,
    });
    audio.playSfx(crit ? 'crit' : heavy ? 'hit_heavy' : 'hit', { pan: this.pan(e.x) });
    this.particles.emit(e.x, e.y - 6 * e.scale, {
      count: crit ? 10 : 5,
      angle: dir,
      spread: 1.6,
      color: crit ? ['#fee761', '#ffffff', '#feae34'] : ['#ffffff', '#c0cbdc'],
      speed: [50, 120],
      life: [0.1, 0.3],
      shape: 'line',
      emissive: true,
    });
    this.fx('fx_hit', e.x + Math.cos(dir) * 4, e.y - 8 * e.scale);
    this.hitStop(crit || heavy ? 0.07 : 0.035);
    if (e.hp <= 0) this.killEnemy(e, true);
    else if (e.isBoss) this.checkBossPhase(e);
  }

  enemyDot(e: Enemy, dmg: number): void {
    e.hp -= dmg;
    e.hpBarT = 3;
    const col = e.statuses.poison ? '#63c74d' : '#f77622';
    this.popText(e.x + rng.range(-5, 5), e.y - 14 * e.scale, `${dmg}`, col, { small: true });
    if (e.hp <= 0) this.killEnemy(e, true);
    else if (e.isBoss) this.checkBossPhase(e);
  }

  /** Brief two-tone manga impact frame. */
  impact(dur: number): void {
    if (this.game.settings.reduceFlashing) return;
    this.impactT = this.impactDur = dur;
  }

  /** Quick camera punch-in toward a world point. */
  zoomAt(x: number, y: number, scale: number, dur: number): void {
    this.zoomFx = { scale, t: 0, dur, x, y };
  }

  /** Aura palette that matches an enemy's element. */
  auraFor(e: Enemy): 'aether' | 'void' | 'ice' | 'fire' {
    const el = e.def.element;
    return el === 'fire' ? 'fire' : el === 'ice' ? 'ice' : el === 'earth' ? 'aether' : 'void';
  }

  private updatePowerUp(dt: number): void {
    const pu = this.powerUp!;
    pu.t += dt;
    const e = pu.e;
    this.cam.shakeScale = this.game.settings.screenShake;
    this.cam.follow(e.x, e.y - 16, dt, this.game.app.width, this.game.app.height, this.map.pxW, this.map.pxH);
    this.particles.update(dt);
    this.updateEffects(dt);
    this.updateTexts(dt);
    e.animT += dt;
    // debris and energy rising around the boss
    if (Math.random() < dt * 40) {
      const a = Math.random() * TAU;
      const r = e.radius + 6 + Math.random() * 30;
      const col = {
        fire: ['#feae34', '#f77622'],
        ice: ['#2ce8f5', '#ffffff'],
        void: ['#b55088', '#ff0044'],
        aether: ['#2ce8f5', '#fee761'],
      }[this.auraFor(e)];
      this.particles.emit(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.5, {
        count: 1,
        color: [...col, '#8b9bb4'],
        angle: -Math.PI / 2,
        spread: 0.3,
        speed: [30, 70],
        life: [0.4, 0.9],
        size: [1, 3],
        emissive: true,
        drag: 0.5,
      });
    }
    if (!pu.peaked && pu.t > 0.75) {
      pu.peaked = true;
      audio.playSfx('roar');
      audio.playSfx('explosion', { volume: 0.7 });
      this.impact(0.18);
      this.zoomAt(e.x, e.y - 16, 1.3, 0.35);
      this.shake(9, 0.6);
      this.novaEffect(
        e.x,
        e.y - 4,
        90,
        e.def.element === 'fire' ? 'fire' : e.def.element === 'ice' ? 'ice' : 'void',
      );
      this.novaEffect(e.x, e.y - 4, 60, 'arcane');
    }
    if (pu.t >= pu.dur) {
      this.powerUp = null;
      const next = e.def.boss?.phases[e.phase];
      if (next?.summon) this.summon(e, next.summon.enemy, next.summon.count);
    }
  }

  private cannonEnd(): { x: number; y: number; ex: number; ey: number; width: number } {
    const c = this.cannon!;
    const p = this.player;
    const len = 330;
    const k = c.t / c.dur;
    const grow = Math.min(1, c.t / 0.12);
    const fade = k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
    const width = 24 * grow * fade * (1 + Math.sin(c.t * 45) * 0.1);
    const x = p.x + Math.cos(c.angle) * 16;
    const y = p.y - 9 + Math.sin(c.angle) * 12;
    const reach = len * Math.min(1, c.t / 0.18);
    return { x, y, ex: x + Math.cos(c.angle) * reach, ey: y + Math.sin(c.angle) * reach, width };
  }

  private updateCannon(dt: number): void {
    const c = this.cannon!;
    c.t += dt;
    c.tick -= dt;
    const b = this.cannonEnd();
    if (c.tick <= 0) {
      c.tick = 0.1;
      for (const e of this.enemiesNear((b.x + b.ex) / 2, (b.y + b.ey) / 2, 200)) {
        if (!circleHitsLine(e.x, e.y - 6 * e.scale, e.radius, b.x, b.y, b.ex, b.ey, b.width / 2 + 4))
          continue;
        const st = this.game.stats();
        this.playerHit(e, {
          power: 'custom',
          customPower: (st.atk + st.mag) / 2,
          mult: c.mult,
          knock: 50,
          dir: c.angle,
          isSkill: true,
          forceCrit: c.hits === 0,
          noShake: true,
          noSurge: true,
        });
      }
      c.hits++;
    }
    // sparks peeling off the beam
    for (let i = 0; i < 3; i++) {
      const k = Math.random();
      this.particles.emit(b.x + (b.ex - b.x) * k, b.y + (b.ey - b.y) * k, {
        count: 1,
        color: ['#2ce8f5', '#ffffff', '#fee761'],
        angle: c.angle + (Math.random() < 0.5 ? 1 : -1) * 1.4,
        spread: 0.8,
        speed: [30, 90],
        life: [0.15, 0.35],
        size: [1, 2],
        emissive: true,
        shape: 'line',
      });
    }
    if (c.t >= c.dur) this.cannon = null;
  }

  /** A swirling blue ring under the hero and a fill bar while a town portal channels. */
  private renderPortalCast(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const p = this.player;
    const k = Math.min(1, this.portalCast!.t / TOWN_PORTAL_CAST);
    const x = Math.round(p.x - camX);
    const y = Math.round(p.y - camY);
    ctx.save();
    ctx.globalAlpha = 0.5 + k * 0.4;
    ctx.strokeStyle = '#2ce8f5';
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const r = 10 + i * 4 + Math.sin(this.time * 8 + i) * 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.4, 0, this.time * 4 + i, this.time * 4 + i + Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.restore();
    const w = 24;
    ctx.fillStyle = '#181425';
    ctx.fillRect(x - w / 2 - 1, y - 30, w + 2, 4);
    ctx.fillStyle = '#2ce8f5';
    ctx.fillRect(x - w / 2, y - 29, Math.round(w * k), 2);
  }

  private renderCannon(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const b = this.cannonEnd();
    if (b.width < 0.5) return;
    const x = b.x - camX;
    const y = b.y - camY;
    const ex = b.ex - camX;
    const ey = b.ey - camY;
    ctx.save();
    ctx.lineCap = 'round';
    const layers: [string, number, number][] = [
      ['#0099db', b.width + 12, 0.35],
      ['#2ce8f5', b.width + 4, 0.8],
      ['#9ff6ff', b.width * 0.7, 1],
      ['#ffffff', b.width * 0.38, 1],
    ];
    for (const [col, w, a] of layers) {
      ctx.globalAlpha = a;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1, w);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    // muzzle ball and impact burst
    for (const [px, py, r] of [
      [x, y, b.width * 0.42],
      [ex, ey, b.width * 0.95],
    ] as const) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#2ce8f5';
      ctx.beginPath();
      ctx.arc(px, py, r + 4, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1, r * 0.6), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  private checkBossPhase(e: Enemy): void {
    const phases = e.def.boss?.phases ?? [];
    const next = phases[e.phase + 1];
    if (next && e.hp / e.maxHp <= next.at) {
      e.phase++;
      audio.playSfx('charge_up');
      this.powerUp = { e, t: 0, dur: 1.7, peaked: false };
      this.shake(3, 1.2);
      if (next.shout) this.bossShout(next.shout);
      if (next.summon) this.summon(e, next.summon.enemy, next.summon.count);
    }
  }

  killEnemy(e: Enemy, byPlayer: boolean): void {
    if (e.dead) return;
    e.hp = 0;
    e.killedByPlayer = byPlayer;
    e.die();
    e.releaseToken(this);
    audio.playSfx('enemy_die', { pan: this.pan(e.x) });
    this.fx('fx_poof', e.x, e.y - 6 * e.scale);
    this.particles.emit(e.x, e.y - 6, {
      count: 14,
      color: ['#ffffff', '#c0cbdc', '#8b9bb4'],
      speed: [20, 70],
      life: [0.3, 0.6],
      vz: [10, 40],
      gravity: 60,
    });
    const save = this.game.save;
    const def = e.def;
    if (def.onDeath?.explode) {
      const ex = def.onDeath.explode;
      this.enemyHazard(e, {
        shape: 'circle',
        x: e.x,
        y: e.y,
        radius: ex.radius,
        delay: 0.45,
        duration: 0,
        mult: ex.dmg,
        status: ex.status,
        color: '#f77622',
        visual: 'fire',
      });
    }
    if (def.onDeath?.split && byPlayer) {
      for (let i = 0; i < def.onDeath.split.count; i++) {
        const s = new Enemy(
          enemyDef(def.onDeath.split.enemy),
          e.level,
          e.x + rng.range(-8, 8),
          e.y + rng.range(-8, 8),
          this.game.difficulty,
          { group: e.group },
        );
        s.aggro = true;
        this.enemies.push(s);
      }
    }
    if (!byPlayer) return;
    this.onKillEffects(e);
    this.bumpCounter('streak_nohit', 'streak_nohit_best');
    save.stats.kills++;
    save.bestiary[def.id] = (save.bestiary[def.id] ?? 0) + 1;
    if (e.elite) this.game.count('elites');
    if (e.isBoss && save.difficulty === 'nightmare') this.game.count('nightmare_boss');
    const st = this.game.stats();
    if (st.legendaries.has('vampire_kiss')) this.healPlayer(this.player.maxHp * 0.03, false);
    const xp = xpReward(e.xp, e.level, save.hero.level) * this.game.difficulty.xpMult;
    this.game.giveXp(xp);
    this.popText(e.x, e.y - 24 * e.scale, `+${Math.round(xp * (1 + st.xpBonus))} XP`, '#b55088', {
      small: true,
    });
    this.dropLoot(e);
    this.game.events.emit('enemyKilled', { id: def.id, map: this.data.id, elite: !!e.elite, boss: e.isBoss });
    if (e.isBoss) this.onBossKilled(e);
  }

  /** Talents and notables that trigger when the hero kills something. */
  private onKillEffects(e: Enemy): void {
    const st = this.game.stats();
    const p = this.player;
    const pv = st.passives;
    if (pv.killHeal > 0) {
      this.healPlayer(p.maxHp * pv.killHeal, false);
      p.stamina = Math.min(100, p.stamina + pv.killHeal * 500);
    }
    if (st.asc.has('bm_saint')) p.cooldowns.slash = 0;
    if (st.asc.has('bm_tempest')) this.slashGale(p, p.aim, 0.9);
    if (st.asc.has('sb_deathmark')) {
      p.stamina = Math.min(100, p.stamina + 20);
      p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.05);
    }
    if (st.asc.has('sb_bloom') && hasStatus(e, 'poison')) {
      this.novaEffect(e.x, e.y - 4, 40, 'nature');
      for (const o of this.enemiesNear(e.x, e.y, 56)) {
        if (o === e || o.dead || dist(o.x, o.y, e.x, e.y) > 40 + o.radius) continue;
        o.applyStatus({ kind: 'poison', duration: 4 }, (st.atk * 0.6) / 0.2 / 4, o.def.immune ?? []);
      }
    }
  }

  private dropLoot(e: Enemy): void {
    const st = this.game.stats();
    const diff = this.game.difficulty;
    const gold = goldDrop(e.gold, e.level, rng.next()) * (1 + st.goldFind) * diff.goldMult;
    const coins = Math.min(8, Math.max(1, Math.round(gold / 6)));
    for (let i = 0; i < coins; i++)
      this.pickups.push(new Pickup(e.x, e.y - 4, 'gold', Math.max(1, Math.round(gold / coins))));
    const ilvl = e.level;
    const drop = (rarityMin: Rarity | undefined, bonus: number): void => {
      const item = this.game.rollItem(ilvl, {
        rarityRoll: { min: rarityMin, bonus: bonus + diff.lootBonus + st.magicFind },
      });
      this.abyssTouch(item);
      this.pickups.push(new Pickup(e.x, e.y - 4, 'item', 1, item));
    };
    if (e.isBoss) {
      const firstKill = !hasFlag(this.game.save, `boss_${e.def.id}`);
      drop('epic', 1);
      drop('rare', 0.8);
      drop('rare', 0.5);
      if (firstKill || rng.chance(0.2)) {
        const item = this.game.rollItem(ilvl, {
          rarity: firstKill && rng.chance(0.5) ? 'legendary' : 'epic',
        });
        this.abyssTouch(item);
        this.pickups.push(new Pickup(e.x, e.y - 4, 'item', 1, item));
      }
    } else if (e.elite) {
      drop('rare', 0.6);
      if (rng.chance(0.35)) drop('uncommon', 0.3);
      this.pickups.push(new Pickup(e.x, e.y, 'orb_hp', 1));
    } else if (rng.chance(0.1 + st.magicFind * 0.03)) {
      drop(undefined, 0);
    }
    // charms: rare from regular monsters, common from elites and guardians
    const charmChance = e.isBoss ? 0.6 : e.elite ? 0.2 : 0.012 + st.magicFind * 0.004;
    if (rng.chance(charmChance))
      this.pickups.push(new Pickup(e.x, e.y - 4, 'item', 1, generateCharm(rng, ilvl)));
    for (const d of e.def.drops ?? []) {
      if (rng.chance(d.chance * (e.elite ? 2 : 1)))
        this.pickups.push(new Pickup(e.x, e.y - 4, 'material', 1, undefined, d.material));
    }
    if (!e.isBoss && !e.elite) {
      if (rng.chance(0.07)) this.pickups.push(new Pickup(e.x, e.y, 'orb_hp', 1));
      else if (rng.chance(0.06)) this.pickups.push(new Pickup(e.x, e.y, 'orb_mp', 1));
    }
    if (this.abyssFloor > 0) {
      const tier = e.isBoss ? 'boss' : e.elite ? 'elite' : 'normal';
      this.abyssLoot(e.x, e.y - 4, ilvl, tier);
    }
  }

  // ------------------------------------------------------------ abyss loot ----

  /** Chance-scaling for Abyss loot: deeper floors, magic find and difficulty all help. */
  private abyssLuck(): number {
    const st = this.game.stats();
    return (1 + this.abyssFloor * 0.04) * (1 + st.magicFind * 0.5 + this.game.difficulty.lootBonus);
  }

  /** Gear found in the Abyss (rare or better) sometimes comes with a gem socket. */
  private abyssTouch(item: Item): void {
    if (this.abyssFloor > 0 && RARITY_INDEX[item.rarity] >= 2 && rng.chance(ABYSS_SOCKET_CHANCE))
      addSocket(item);
  }

  /** Abyss-only rewards: gems and, rarely, an Abyssal item. */
  private abyssLoot(x: number, y: number, ilvl: number, source: AbyssLootSource): void {
    const f = this.abyssFloor;
    if (rng.chance(Math.min(ABYSSAL_MAX_CHANCE, ABYSSAL_CHANCE[source] * this.abyssLuck()))) {
      const item = generateAbyssal(rng, ilvl);
      const pk = new Pickup(x, y, 'item', 1, item);
      pk.vz = 140;
      this.pickups.push(pk);
      audio.playSfx('void_pulse');
      this.shake(3, 0.3);
      this.flashScreen('#ff0044', 0.18);
    }
    const [n, chance] = GEM_DROPS[source];
    for (let i = 0; i < n; i++) {
      if (!rng.chance(chance)) continue;
      // Torment tiers count as extra depth for gem quality
      const g = rollGemDrop(rng, f + this.game.save.torment * 5, source !== 'normal');
      this.pickups.push(new Pickup(x, y, 'gem', 1, undefined, undefined, g));
    }
  }

  /** Increase a streak kept in save flags, remembering the best run. */
  private bumpCounter(key: string, bestKey: string): void {
    const f = this.game.save.flags;
    f[key] = (f[key] ?? 0) + 1;
    if (f[key] > (f[bestKey] ?? 0)) {
      f[bestKey] = f[key];
      this.quests.checkCounters();
    }
  }

  // ------------------------------------------------------------- trials ----

  /** Up to `n` random open spots the hero can reach, at least `minDist` away from them. */
  openSpots(n: number, minDist: number): { x: number; y: number }[] {
    const reach = this.reachable();
    const w = this.data.w;
    const cand: number[] = [];
    for (let k = 0; k < reach.length; k++) {
      if (!reach[k]) continue;
      const x = (k % w) * TILE + TILE / 2;
      const y = Math.floor(k / w) * TILE + TILE / 2;
      if (dist(x, y, this.player.x, this.player.y) >= minDist) cand.push(k);
    }
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < n && cand.length; i++) {
      const k = cand.splice(rng.int(0, cand.length - 1), 1)[0];
      out.push({ x: (k % w) * TILE + TILE / 2, y: Math.floor(k / w) * TILE + TILE - 3 });
    }
    return out;
  }

  randomEliteMod(champion: boolean): (typeof ELITE_MODS)[number] {
    return champion
      ? (ELITE_MODS.find((m) => m.id === 'giant') ?? rng.pick(ELITE_MODS))
      : rng.pick(ELITE_MODS);
  }

  enemyDefById(id: string): ReturnType<typeof enemyDef> {
    return enemyDef(id);
  }

  /** The purple burst used when enemies are summoned in. */
  summonEffect(x: number, y: number): void {
    this.particles.emit(x, y, {
      count: 12,
      color: ['#b55088', '#68386c', '#ffffff'],
      speed: [10, 40],
      vz: [10, 40],
      gravity: 20,
      life: [0.4, 0.8],
      emissive: true,
    });
  }

  /** All waves cleared: award Ascendancy points (first clear) and open the way home. */
  onTrialComplete(run: TrialRun): void {
    const save = this.game.save;
    audio.playSfx('stinger_victory');
    this.flashScreen('#feae34', 0.3);
    this.game.banner = { title: 'TRIAL COMPLETE', sub: run.def.name, t: 0, color: '#feae34' };
    if (run.firstClear) {
      save.ascendancy.trials = Math.max(save.ascendancy.trials, run.def.tier);
      this.game.toast(`+${ASC_POINTS_PER_TRIAL} Ascendancy points`, 'ui_trial');
    }
    this.game.giveGold(Math.round(200 + run.level * 30), true);
    const item = this.game.rollItem(run.level, { rarityRoll: { min: 'rare', bonus: 1 } });
    const at = this.data.spawnPoints['center'] ?? { x: this.player.x, y: this.player.y - 30 };
    this.pickups.push(new Pickup(at.x, at.y, 'item', 1, item));
    this.objects.push(
      new WorldObject({
        kind: 'portal',
        id: 'trial_home',
        x: at.x,
        y: at.y + 40,
        to: 'town',
        spawn: 'town_crystal',
      }),
    );
    this.hooks.trialComplete(run.firstClear && run.def.tier === 1);
  }

  /** A drink from a flask (breaks the no-flask challenge). */
  noteFlask(): void {
    this.bossFight.flask = true;
  }

  /** Guardian challenges: flawless and flask-free kills against a worthy foe. */
  private checkBossChallenges(e: Enemy): void {
    const save = this.game.save;
    if (e.level < save.hero.level - 3) return;
    const flag = (f: string): void => {
      if (hasFlag(save, f)) return;
      setFlag(save, f);
      this.quests.onFlag(f);
    };
    if (!this.bossFight.hit) flag('ch_flawless_done');
    if (!this.bossFight.flask && (save.difficulty === 'hard' || save.difficulty === 'nightmare'))
      flag('ch_unbowed_done');
  }

  private onBossKilled(e: Enemy): void {
    this.checkBossChallenges(e);
    if (this.game.save.difficulty === 'nightmare' && this.game.save.torment >= 6)
      setFlag(this.game.save, 'torment6_boss');
    this.slowT = 1.2;
    this.shake(8, 0.8);
    this.flashScreen('#ffffff', 0.3);
    audio.playSfx('explosion');
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        this.fx('fx_explosion', e.x + rng.range(-20, 20), e.y - rng.range(0, 30));
        audio.playSfx('explosion', { volume: 0.6 });
      }, i * 150);
    }
    this.game.save.stats.bosses++;
    this.enemies.filter((o) => o.summoned && !o.dead).forEach((o) => this.killEnemy(o, false));
    this.boss = null;
    audio.stopMusic(0.8);
    setTimeout(() => {
      audio.playSfx('stinger_victory');
      this.hooks.bossDefeated(e);
    }, 1400);
  }

  /** Enemy hits the player (melee, contact, nova...). */
  hitPlayerFrom(e: Enemy, mult: number, dir: number, knock: number, status?: StatusSpec): void {
    const p = this.player;
    if (p.state === 'dead') return;
    if (p.invulnerable) {
      if (p.inPerfectWindow) this.perfectDodge();
      return;
    }
    if (this.evaded()) return;
    const st = this.game.stats();
    const res = computeDamage({
      power: e.atk,
      mult,
      attackerLevel: e.level,
      defenderLevel: this.game.save.hero.level,
      defenderDef: st.def,
      critChance: 0,
      critDmg: 0,
      rollCrit: 1,
      rollVar: rng.next(),
    });
    const dmg = Math.max(1, Math.round(res.amount * st.damageTaken));
    this.hurtPlayer(dmg, dir, knock);
    if (status && (!status.chance || rng.chance(status.chance))) p.applyStatus(status, e.atk);
    if (e.elite?.id === 'vampiric') e.hp = Math.min(e.maxHp, e.hp + dmg * 0.5);
    const reflect = (st.legendaries.has('mountain_heart') ? 0.25 : 0) + st.passives.thorns;
    if (st.asc.has('wb_retaliate') && p.retaliateCd <= 0 && p.hp > 0) {
      p.retaliateCd = 1.5;
      this.shockwave(p.x, p.y, 48, 1);
    }
    if (reflect > 0 && !e.dead && dist(e.x, e.y, p.x, p.y) < 60) {
      const refl = Math.max(1, Math.round(dmg * reflect));
      e.hp -= refl;
      this.popText(e.x, e.y - 18, `${refl}`, '#c0cbdc', { small: true });
      if (e.hp <= 0) this.killEnemy(e, true);
    }
  }

  private hurtPlayer(dmg: number, dir: number, knock: number): void {
    const p = this.player;
    const hero = this.game.save.hero;
    const st0 = this.game.stats();
    this.cancelTownPortal('Interrupted!');
    this.bossFight.hit = true;
    this.game.save.flags['streak_nohit'] = 0;
    if (st0.passives.unyielding && p.hp < p.maxHp * 0.4) dmg = Math.max(1, Math.round(dmg * 0.75));
    // Mana Shield: a quarter of the hit is paid in MP
    if (st0.asc.has('am_manashield') && p.mp > 0) {
      const absorbed = Math.min(p.mp, Math.round(dmg * 0.25));
      p.mp -= absorbed;
      dmg -= absorbed;
    }
    if (st0.asc.has('wb_bulwark')) knock = 0;
    p.hp -= dmg;
    p.onHurt(dmg, dir, knock);
    audio.playSfx('hurt');
    this.popText(p.x, p.y - 22, `${dmg}`, '#e43b44', { big: dmg > p.maxHp * 0.2 });
    this.shake(4, 0.2);
    this.hitStop(0.05);
    this.flashScreen('#e43b44', 0.12);
    if (hero.surgeUnlocked) hero.surge = Math.min(100, hero.surge + 3);
    this.particles.emit(p.x, p.y - 8, {
      count: 8,
      color: ['#e43b44', '#a22633'],
      speed: [30, 70],
      life: [0.2, 0.4],
      vz: [10, 30],
      gravity: 80,
    });
    const st = this.game.stats();
    if (st.legendaries.has('seraphs_tear') && p.seraphCd <= 0) {
      p.seraphCd = 8;
      audio.playSfx('frost_nova');
      this.novaEffect(p.x, p.y - 4, 56, 'ice');
      for (const e of this.enemiesNear(p.x, p.y, 70))
        this.playerHit(e, {
          power: 'mag',
          mult: 1.2,
          knock: 80,
          isSkill: true,
          status: { kind: 'freeze', duration: 1.5 },
        });
    }
    this.checkPlayerDeath();
  }

  /** Evasion talent: a chance to shrug off an attack entirely. */
  private evaded(): boolean {
    const ev = this.game.stats().passives.evade;
    if (ev <= 0 || !rng.chance(ev)) return false;
    this.popText(this.player.x, this.player.y - 22, 'Evaded', '#c0cbdc', { small: true });
    return true;
  }

  /** Damage without source (DoTs, environmental). */
  hurtPlayerRaw(dmg: number, dot: boolean): void {
    const p = this.player;
    if (p.state === 'dead' || (p.invulnerable && !dot)) return;
    p.hp -= dmg;
    if (dot)
      this.popText(p.x + rng.range(-4, 4), p.y - 20, `${dmg}`, p.statuses.poison ? '#63c74d' : '#f77622', {
        small: true,
      });
    this.checkPlayerDeath();
  }

  private checkPlayerDeath(): void {
    const p = this.player;
    if (p.hp > 0) return;
    const save = this.game.save;
    const st = this.game.stats();
    if (st.legendaries.has('phoenix_band') && !p.phoenixUsed) {
      p.phoenixUsed = true;
      this.revive(0.4, 'Phoenix Band!');
      return;
    }
    if ((save.consumables.phoenix ?? 0) > 0) {
      addConsumable(save, 'phoenix', -1);
      this.revive(0.5, 'Phoenix Feather!');
      return;
    }
    if (st.passives.lastStand && p.lastStandCd <= 0) {
      p.lastStandCd = 90;
      p.hp = 1;
      p.invuln = 2;
      this.popText(p.x, p.y - 28, 'Last Stand!', '#feae34');
      audio.playSfx('charge_up');
      return;
    }
    p.hp = 0;
    p.state = 'dead';
    save.flags['abyss_streak'] = 0;
    p.stateT = 0;
    p.clearStatuses();
    audio.playSfx('death');
    audio.stopMusic(1.5);
    this.slowT = 1;
    save.stats.deaths++;
  }

  private revive(frac: number, label: string): void {
    const p = this.player;
    p.hp = Math.round(p.maxHp * frac);
    p.invuln = 2.5;
    p.state = 'free';
    audio.playSfx('heal');
    this.flashScreen('#feae34', 0.4);
    this.popText(p.x, p.y - 28, label, '#feae34');
    this.particles.emit(p.x, p.y - 8, {
      count: 40,
      color: ['#feae34', '#f77622', '#fee761'],
      speed: [30, 90],
      vz: [30, 80],
      gravity: 40,
      life: [0.5, 1],
      emissive: true,
    });
  }

  healPlayer(amount: number, show = true): void {
    const p = this.player;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    const gained = Math.round(p.hp - before);
    if (show && gained > 0) this.popText(p.x, p.y - 20, `+${gained}`, '#63c74d');
  }

  private perfectDodge(): void {
    const p = this.player;
    p.perfectUsed = true;
    this.game.count('perfects');
    this.slowT = 0.9;
    const hero = this.game.save.hero;
    if (hero.surgeUnlocked) hero.surge = Math.min(100, hero.surge + 15);
    p.stamina = Math.min(100, p.stamina + 20);
    this.popText(p.x, p.y - 28, 'PERFECT!', '#2ce8f5', { big: true });
    if (this.game.stats().asc.has('bm_riposte')) {
      p.guaranteedCrits = 3;
      this.popText(p.x, p.y - 38, 'Riposte!', '#e43b44', { small: true });
    }
    audio.playSfx('dash_slash', { pitch: 1.4, volume: 0.6 });
    this.flashScreen('#2ce8f5', 0.15);
    this.particles.emit(p.x, p.y - 8, {
      count: 20,
      color: ['#2ce8f5', '#ffffff'],
      speed: [40, 100],
      life: [0.2, 0.5],
      shape: 'line',
      emissive: true,
    });
  }

  projectileHitsPlayer(pr: Projectile): void {
    const p = this.player;
    if (p.state === 'dead') return;
    if (p.invulnerable) {
      if (p.inPerfectWindow) this.perfectDodge();
      return;
    }
    if (this.evaded()) {
      pr.expire(this);
      return;
    }
    const src = pr.owner.source instanceof Enemy ? pr.owner.source : null;
    const st = this.game.stats();
    const res = computeDamage({
      power: pr.owner.power,
      mult: pr.mult,
      attackerLevel: pr.owner.level,
      defenderLevel: this.game.save.hero.level,
      defenderDef: st.def,
      critChance: 0,
      critDmg: 0,
      rollCrit: 1,
      rollVar: rng.next(),
    });
    this.hurtPlayer(Math.max(1, Math.round(res.amount * st.damageTaken)), pr.angle, 70);
    if (pr.spec.status && (!pr.spec.status.chance || rng.chance(pr.spec.status.chance)))
      p.applyStatus(pr.spec.status, pr.owner.power);
    if (src?.elite?.id === 'vampiric') src.hp = Math.min(src.maxHp, src.hp + res.amount * 0.5);
    pr.expire(this);
  }

  projectileHitsEnemy(pr: Projectile, e: Enemy): void {
    pr.hit.add(e);
    if (pr.spec.explode) {
      pr.expire(this);
      return;
    }
    this.playerHit(e, {
      power: pr.owner.stat ?? 'mag',
      mult: pr.mult,
      knock: 50,
      dir: pr.angle,
      isSkill: pr.owner.isSkill,
      status: pr.spec.status,
    });
    if (pr.chain > 0) {
      // Stormcaller: arc to nearby enemies
      const pts = [{ x: e.x, y: e.y - 6 }];
      let from = e;
      const hit = new Set([e]);
      for (let i = 0; i < pr.chain; i++) {
        const next = this.enemiesNear(from.x, from.y, 70).find((o) => !hit.has(o));
        if (!next) break;
        hit.add(next);
        pts.push({ x: next.x, y: next.y - 6 });
        this.playerHit(next, { power: 'mag', mult: pr.mult * 0.6, knock: 20, noShake: true });
        from = next;
      }
      if (pts.length > 1) this.addLightning(pts);
    }
    if (pr.pierce > 0) pr.pierce--;
    else pr.expire(this);
  }

  projectileExpired(pr: Projectile): void {
    const s = pr.spec;
    if (s.explode) {
      this.fx('fx_explosion', pr.x, pr.y);
      audio.playSfx('explosion', { volume: 0.7, pan: this.pan(pr.x) });
      this.shake(2.5, 0.2);
      const ex = s.explode;
      if (pr.faction === 'player') {
        for (const e of this.enemiesNear(pr.x, pr.y + 6, ex.radius + 16)) {
          if (dist(pr.x, pr.y + 6, e.x, e.y) > ex.radius + e.radius) continue;
          this.playerHit(e, {
            power: pr.owner.stat ?? 'mag',
            mult: ex.dmg,
            knock: 90,
            dir: angleTo(pr.x, pr.y, e.x, e.y),
            isSkill: pr.owner.isSkill,
            status: ex.status,
          });
        }
      } else if (dist(pr.x, pr.y + 6, this.player.x, this.player.y) < ex.radius + this.player.radius) {
        const src = pr.owner.source;
        if (src instanceof Enemy)
          this.hitPlayerFrom(src, ex.dmg, angleTo(pr.x, pr.y, this.player.x, this.player.y), 120, ex.status);
      }
    } else {
      this.particles.emit(pr.x, pr.y, {
        count: 4,
        color: ['#ffffff', '#c0cbdc'],
        speed: [10, 40],
        life: [0.1, 0.25],
      });
    }
    if (s.puddle && pr.faction === 'enemy' && pr.owner.source instanceof Enemy) {
      this.enemyHazard(pr.owner.source, {
        shape: 'circle',
        x: pr.x,
        y: pr.y + 6,
        radius: s.puddle.radius,
        delay: 0.1,
        duration: s.puddle.duration,
        mult: s.puddle.dmg,
        status: s.puddle.status,
        color: '#f77622',
        visual: 'fire',
        tick: 0.5,
      });
    }
  }

  hazardHitsPlayer(h: Hazard): void {
    const p = this.player;
    if (p.invulnerable) {
      if (p.inPerfectWindow) this.perfectDodge();
      return;
    }
    if (this.evaded()) return;
    const src = h.owner.source;
    const st = this.game.stats();
    const res = computeDamage({
      power: h.owner.power,
      mult: h.spec.mult,
      attackerLevel: h.owner.level,
      defenderLevel: this.game.save.hero.level,
      defenderDef: st.def,
      critChance: 0,
      critDmg: 0,
      rollCrit: 1,
      rollVar: rng.next(),
    });
    this.hurtPlayer(
      Math.max(1, Math.round(res.amount * st.damageTaken)),
      src ? angleTo(src.x, src.y, p.x, p.y) : 0,
      h.spec.duration > 0 ? 20 : 110,
    );
    if (h.spec.status) p.applyStatus(h.spec.status, h.owner.power);
  }

  hazardHitsEnemy(h: Hazard, e: Enemy): void {
    this.playerHit(e, {
      power: h.owner.stat ?? 'mag',
      mult: h.spec.mult,
      knock: h.spec.duration > 0 ? 10 : 110,
      dir: angleTo(h.spec.x, h.spec.y, e.x, e.y),
      isSkill: h.owner.isSkill,
      status: h.spec.status,
      noShake: h.spec.duration > 0,
    });
  }

  hazardTriggered(h: Hazard): void {
    const s = h.spec;
    if (s.duration > 0 && s.delay < 0.3) return;
    if (s.visual === 'meteor') {
      this.fx('fx_explosion', s.x, s.y - 6);
      this.shake(6, 0.35);
      audio.playSfx('explosion');
      const hz = new Hazard(
        {
          shape: 'circle',
          x: s.x,
          y: s.y,
          radius: s.radius * 0.7,
          delay: 0.05,
          duration: 3,
          tick: 0.5,
          mult: s.mult * 0.12,
          color: '#f77622',
          visual: 'fire',
          status: s.status,
        },
        h.owner,
      );
      this.hazards.push(hz);
      return;
    }
    const colors: Record<string, string[]> = {
      fire: ['#feae34', '#f77622', '#e43b44'],
      ice: ['#2ce8f5', '#ffffff', '#0099db'],
      void: ['#b55088', '#68386c', '#ff0044'],
      earth: ['#8b9bb4', '#5a6988', '#c0cbdc'],
      nature: ['#63c74d', '#3e8948', '#fee761'],
    };
    const col = colors[s.visual ?? ''] ?? [s.color, '#ffffff'];
    const r = s.shape === 'circle' ? s.radius : 20;
    this.particles.emit(s.x, s.y, {
      count: Math.min(30, 8 + r / 2),
      color: col,
      speed: [20, r * 2.5],
      vz: [20, 60],
      gravity: 120,
      life: [0.3, 0.6],
      size: [1, 3],
      emissive: s.visual !== 'earth',
    });
    if (s.shape === 'circle') this.novaEffect(s.x, s.y, s.radius, s.visual ?? 'void');
    audio.playSfx(s.visual === 'ice' ? 'ice_shard' : s.visual === 'fire' ? 'explosion' : 'slam', {
      volume: 0.5,
      pan: this.pan(s.x),
    });
    if (s.radius > 20) this.shake(2, 0.15);
  }

  // ------------------------------------------------------------- spawning ----
  enemyProjectile(e: Enemy, spec: ProjectileSpec, x: number, y: number, angle: number, mult: number): void {
    this.projectiles.push(
      new Projectile(
        x,
        y,
        angle,
        spec,
        { power: e.atk, level: e.level, faction: 'enemy', source: e },
        mult * spec.dmg,
      ),
    );
  }

  spawnPlayerProjectile(
    spec: ProjectileSpec,
    x: number,
    y: number,
    angle: number,
    mult: number,
    stat: 'atk' | 'mag',
  ): Projectile {
    const pr = new Projectile(
      x,
      y,
      angle,
      spec,
      { power: 0, level: this.game.save.hero.level, faction: 'player', stat, isSkill: true },
      mult,
    );
    this.projectiles.push(pr);
    return pr;
  }

  spawnPlayerBolt(x: number, y: number, angle: number, mult: number): void {
    const spec: ProjectileSpec = { sprite: 'proj_bolt', speed: 260, radius: 3, dmg: 0, life: 0.6 };
    const pr = new Projectile(
      x,
      y,
      angle,
      spec,
      { power: 0, level: this.game.save.hero.level, faction: 'player', stat: 'mag' },
      mult,
    );
    const st = this.game.stats();
    pr.chain = (st.legendaries.has('stormcaller') ? 2 : 0) + (st.asc.has('am_archon') ? 2 : 0);
    this.projectiles.push(pr);
  }

  enemyHazard(e: Enemy, spec: HazardSpec): void {
    this.hazards.push(new Hazard(spec, { faction: 'enemy', power: e.atk, level: e.level, source: e }));
  }

  playerHazard(spec: HazardSpec, stat: 'atk' | 'mag'): void {
    this.hazards.push(
      new Hazard(spec, {
        faction: 'player',
        power: 0,
        level: this.game.save.hero.level,
        stat,
        isSkill: true,
      }),
    );
  }

  spawnAoe(e: Enemy, a: Extract<AttackDef, { type: 'aoe' }>): void {
    const p = this.player;
    const visual: HazardSpec['visual'] =
      e.def.element === 'fire'
        ? 'fire'
        : e.def.element === 'ice'
          ? 'ice'
          : e.def.element === 'earth'
            ? 'earth'
            : e.def.element === 'nature'
              ? 'nature'
              : 'void';
    const color = visual === 'ice' ? '#2ce8f5' : visual === 'fire' ? '#f77622' : '#ff0044';
    const mk = (x: number, y: number, delayExtra: number): void => {
      if (!this.map.walkableAt(x, y, true)) return;
      this.enemyHazard(e, {
        shape: 'circle',
        x,
        y,
        radius: a.radius,
        delay: a.delay + delayExtra,
        duration: a.persist ?? 0,
        tick: 0.5,
        mult: a.dmg,
        status: a.status,
        color,
        visual,
      });
    };
    const st = a.stagger ?? 0;
    switch (a.at) {
      case 'player':
        for (let i = 0; i < a.count; i++) {
          const ang = rng.range(0, TAU);
          const r = i === 0 ? 0 : rng.range(a.radius, a.spread);
          mk(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r, i * st);
        }
        break;
      case 'around':
        for (let i = 0; i < a.count; i++) {
          const ang = (i / a.count) * TAU + rng.range(-0.2, 0.2);
          mk(e.x + Math.cos(ang) * a.spread, e.y + Math.sin(ang) * a.spread, i * st);
        }
        mk(p.x, p.y, a.count * st);
        break;
      case 'line': {
        const ang = angleTo(e.x, e.y, p.x, p.y);
        for (let i = 1; i <= a.count; i++)
          mk(e.x + Math.cos(ang) * a.spread * i, e.y + Math.sin(ang) * a.spread * i, i * st);
        break;
      }
      case 'cross':
        for (let k = 0; k < 4; k++) {
          const ang = (k * Math.PI) / 2 + (e.phase > 0 ? Math.PI / 4 : 0);
          for (let i = 1; i <= a.count; i++)
            mk(e.x + Math.cos(ang) * a.spread * i, e.y + Math.sin(ang) * a.spread * i, i * st);
        }
        break;
    }
  }

  summon(owner: Enemy, id: string, count: number): void {
    audio.playSfx('summon');
    const diff = this.game.difficulty;
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const a = rng.range(0, TAU);
        const r = rng.range(24, 56);
        const x = owner.x + Math.cos(a) * r;
        const y = owner.y + Math.sin(a) * r;
        if (!this.map.walkableAt(x, y)) continue;
        const e = new Enemy(enemyDef(id), Math.max(1, owner.level - 2), x, y, diff, { summoned: true });
        e.aggro = true;
        this.enemies.push(e);
        this.particles.emit(x, y, {
          count: 12,
          color: ['#b55088', '#68386c', '#ffffff'],
          speed: [10, 40],
          vz: [10, 40],
          life: [0.4, 0.8],
          emissive: true,
        });
        break;
      }
    }
  }

  teleportEnemy(e: Enemy, near: 'player' | 'random'): void {
    const p = this.player;
    this.particles.emit(e.x, e.y - 8, {
      count: 16,
      color: ['#b55088', '#2ce8f5', '#ffffff'],
      speed: [20, 60],
      life: [0.3, 0.6],
      emissive: true,
    });
    for (let tries = 0; tries < 20; tries++) {
      const a = rng.range(0, TAU);
      const r = near === 'player' ? rng.range(40, 70) : rng.range(50, 110);
      const cx = near === 'player' ? p.x : e.x;
      const cy = near === 'player' ? p.y : e.y;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (
        !this.map.walkableAt(x, y, e.flying) ||
        this.map.boxBlocked(x - e.radius, y - e.radius, e.radius * 2, e.radius, e.flying)
      )
        continue;
      e.x = x;
      e.y = y;
      break;
    }
    this.particles.emit(e.x, e.y - 8, {
      count: 16,
      color: ['#b55088', '#2ce8f5', '#ffffff'],
      speed: [20, 60],
      life: [0.3, 0.6],
      emissive: true,
    });
  }

  // --------------------------------------------------------------- pickups ----
  collect(pk: Pickup): void {
    const save = this.game.save;
    switch (pk.kind) {
      case 'gold':
        this.game.giveGold(pk.amount, true);
        audio.playSfx('coin', { volume: 0.5 });
        this.popText(this.player.x, this.player.y - 18, `+${pk.amount}g`, '#feae34', { small: true });
        break;
      case 'soul':
        this.game.giveGold(pk.amount, true);
        save.droppedGold = null;
        audio.playSfx('pickup_rare');
        this.popText(this.player.x, this.player.y - 22, `Recovered ${pk.amount}g`, '#feae34');
        break;
      case 'orb_hp':
        this.healPlayer(this.player.maxHp * 0.12);
        audio.playSfx('heal', { volume: 0.5 });
        break;
      case 'orb_mp':
        this.player.mp = Math.min(this.player.maxMp, this.player.mp + this.player.maxMp * 0.2);
        audio.playSfx('pickup', { volume: 0.5 });
        break;
      case 'material':
        if (pk.material) {
          addMaterial(save, pk.material, 1);
          this.game.events.emit('materialsChanged', undefined);
          audio.playSfx('pickup');
          this.game.toast(`+1 ${pk.label}`, undefined);
        }
        break;
      case 'gem':
        if (pk.gem) {
          addGem(save, pk.gem);
          audio.playSfx(pk.gem.q >= 3 ? 'pickup_rare' : 'pickup');
          this.game.toast(`+1 ${gemLabel(pk.gem)}`, gemIcon(pk.gem));
          this.game.events.emit('materialsChanged', undefined);
        }
        break;
      case 'item':
        if (pk.item) {
          if (!this.game.giveItem(pk.item)) {
            pk.magnet = false;
            pk.t = -3; // wait before retrying
            return;
          }
          audio.playSfx(
            pk.item.rarity === 'common' || pk.item.rarity === 'uncommon' ? 'pickup' : 'pickup_rare',
          );
        }
        break;
    }
    pk.removed = true;
  }

  /** Manual loot pickup (when auto-loot is off). */
  pickupNearby(): boolean {
    const p = this.player;
    const pk = this.pickups.find((k) => k.kind === 'item' && dist(k.x, k.y, p.x, p.y) < 20);
    if (!pk) return false;
    pk.magnet = true;
    return true;
  }

  private openChest(o: Extract<MapObject, { kind: 'chest' }>): void {
    const save = this.game.save;
    if (this.abyssFloor > 0) this.transientChests.add(o.id);
    else setFlag(save, `chest_${o.id}`);
    audio.playSfx('chest_open');
    const ilvl = Math.max(o.ilvl, 1) + save.ngPlus * 30;
    const n = o.rare ? rng.int(2, 3) : 1;
    for (let i = 0; i < n; i++) {
      const item = this.game.rollItem(ilvl, {
        rarityRoll: { min: o.rare ? 'rare' : 'uncommon', bonus: o.rare ? 0.8 : 0.2 },
      });
      this.abyssTouch(item);
      const pk = new Pickup(o.x, o.y - 6, 'item', 1, item);
      pk.vy = 30 + rng.range(0, 20);
      this.pickups.push(pk);
    }
    const gold = Math.round((10 + ilvl * 6) * (o.rare ? 4 : 1) * (0.8 + rng.next() * 0.4));
    for (let i = 0; i < 5; i++) this.pickups.push(new Pickup(o.x, o.y - 6, 'gold', Math.round(gold / 5)));
    if (o.rare && rng.chance(0.3))
      this.pickups.push(new Pickup(o.x, o.y - 6, 'material', 1, undefined, 'dust'));
    if (rng.chance(o.rare ? 0.4 : 0.15))
      this.pickups.push(
        new Pickup(
          o.x,
          o.y - 6,
          'item',
          1,
          generateCharm(rng, ilvl, { size: o.rare && rng.chance(0.4) ? 'grand' : undefined }),
        ),
      );
    if (this.abyssFloor > 0) this.abyssLoot(o.x, o.y - 6, ilvl, o.rare ? 'rareChest' : 'chest');
    this.particles.emit(o.x, o.y - 8, {
      count: 24,
      color: ['#fee761', '#feae34', '#ffffff'],
      speed: [20, 60],
      vz: [40, 90],
      gravity: 120,
      life: [0.5, 1],
      emissive: true,
    });
  }

  discoverCrystal(id: string, name: string): void {
    const save = this.game.save;
    if (save.discovered.includes(id)) return;
    save.discovered.push(id);
    audio.playSfx('waypoint_activate');
    this.game.toast(`Waypoint discovered: {cyan}${name}{/}`, 'ui_waypoint');
  }

  /** Rest at an Aether Crystal: heal, refill flasks, set respawn, respawn enemies, save. */
  restAt(crystalId: string): void {
    const save = this.game.save;
    const st = this.game.stats();
    const o = this.data.objects.find((x) => x.id === crystalId);
    this.player.hp = st.maxHp;
    this.player.mp = st.maxMp;
    this.player.clearStatuses();
    save.hero.flaskHp = st.flaskHpMax;
    save.hero.flaskMp = st.flaskMpMax;
    if (o) save.respawn = { map: this.data.id, x: o.x, y: o.y + 14 };
    this.spawnEnemies();
    audio.playSfx('save');
    this.particles.emit(this.player.x, this.player.y - 8, {
      count: 30,
      color: ['#2ce8f5', '#ffffff', '#0099db'],
      speed: [10, 40],
      vz: [20, 60],
      gravity: -10,
      life: [0.6, 1.2],
      emissive: true,
      shape: 'glow',
      jitter: 10,
    });
  }

  tryUltimate(): void {
    const hero = this.game.save.hero;
    const p = this.player;
    if (!hero.surgeUnlocked) return;
    if (hero.surge < 100) {
      this.popText(p.x, p.y - 24, 'Surge not charged', '#8b9bb4', { small: true });
      audio.playSfx('ui_error', { volume: 0.5 });
      return;
    }
    if (p.state === 'dead') return;
    hero.surge = 0;
    this.game.count('surges');
    this.cutin = { id: 'kai_cannon', t: 0 };
    audio.playSfx('surge_cutin');
    audio.duckMusic(0.5, 1.5);
  }

  // --------------------------------------------------------------- effects ----
  fx(id: FxId, x: number, y: number): void {
    const info = spriteInfo(id);
    const anim = info.anims.fly ?? { frames: 1, fps: 10 };
    const dur = anim.frames / anim.fps;
    this.effects.push({
      t: 0,
      dur,
      top: true,
      draw: (ctx, cx, cy, k) => {
        const f = Math.min(anim.frames - 1, Math.floor(k * anim.frames));
        ctx.drawImage(
          getSprite(id, 'fly', f, 'right'),
          Math.round(x - info.anchorX - cx),
          Math.round(y - info.anchorY - cy),
        );
      },
    });
  }

  addSlash(src: Entity, aim: number, arc: number, range: number, combo: number, kind: string): void {
    const heavy = kind === 'greatsword' || combo === 3;
    const flip = combo === 2 ? -1 : 1;
    const color = combo === 4 ? '#2ce8f5' : heavy ? '#fee761' : '#ffffff';
    this.effects.push({
      t: 0,
      dur: 0.16,
      top: true,
      draw: (ctx, cx, cy, k) => {
        const x = src.x - cx;
        const y = src.y - 6 - cy;
        const sweep = Math.min(1, k * 1.6);
        const a0 = aim - (arc / 2) * flip;
        const a1 = a0 + arc * flip * sweep;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = color;
        for (let i = 0; i < 3; i++) {
          ctx.lineWidth = heavy ? 3 - i : 2 - i * 0.6;
          if (ctx.lineWidth <= 0) break;
          ctx.globalAlpha = (1 - k) * (1 - i * 0.3);
          ctx.beginPath();
          const r = range - i * 3;
          ctx.arc(Math.round(x), Math.round(y), Math.max(4, r), Math.min(a0, a1), Math.max(a0, a1));
          ctx.stroke();
        }
        ctx.restore();
      },
    });
  }

  enemySlash(e: Enemy, aim: number, arc: number, reach: number): void {
    this.effects.push({
      t: 0,
      dur: 0.18,
      top: true,
      draw: (ctx, cx, cy, k) => {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#ff0044';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          Math.round(e.x - cx),
          Math.round(e.y - 6 - cy),
          reach,
          aim - arc / 2,
          aim - arc / 2 + arc * Math.min(1, k * 2),
        );
        ctx.stroke();
        ctx.restore();
      },
    });
  }

  echoSlash(p: Player, aim: number, arc: number, range: number, mult: number, knock: number): void {
    setTimeout(() => {
      if (p.state === 'dead') return;
      this.addSlash(p, aim, arc, range * 1.1, 4, 'sword');
      for (const e of this.enemiesNear(p.x, p.y - 4, range + 20)) {
        if (this.inSector(e, p.x, p.y - 4, range * 1.1, aim, arc / 2))
          this.playerHit(e, { power: 'atk', mult, knock, dir: aim, noShake: true });
      }
    }, 250);
  }

  fireWave(p: Player, aim: number): void {
    const spec: ProjectileSpec = {
      sprite: 'proj_fireball',
      speed: 200,
      radius: 7,
      dmg: 0,
      life: 0.5,
      scale: 1.4,
      status: { kind: 'burn', duration: 3, power: 0.3 },
    };
    const pr = this.spawnPlayerProjectile(spec, p.x, p.y - 6, aim, 1.2, 'atk');
    pr.pierce = 99;
  }

  gust(p: Player, angle: number): void {
    const len = 70;
    this.playerHazard(
      {
        shape: 'line',
        x: p.x,
        y: p.y,
        radius: 0,
        angle,
        length: len,
        width: 20,
        delay: 0.1,
        duration: 0,
        mult: 0.8,
        color: '#c0cbdc',
        visual: 'wind',
      },
      'atk',
    );
  }

  /** A slashing gale that flies forward (Blade Storm, Blade Tempest). */
  slashGale(p: Player, angle: number, mult: number): void {
    this.playerHazard(
      {
        shape: 'line',
        x: p.x,
        y: p.y,
        radius: 0,
        angle,
        length: 90,
        width: 22,
        delay: 0.08,
        duration: 0,
        mult,
        color: '#ff0044',
        visual: 'wind',
      },
      'atk',
    );
    this.addSlash(p, angle, 1.4, 40, 4, 'sword');
  }

  /** A ground shockwave hitting everything around a point (Earthshaker, Retaliation). */
  shockwave(x: number, y: number, radius: number, mult: number): void {
    this.novaEffect(x, y - 2, radius, 'earth');
    this.shake(3, 0.15);
    for (const e of this.enemiesNear(x, y, radius + 20)) {
      if (dist(x, y, e.x, e.y) > radius + e.radius) continue;
      this.playerHit(e, { power: 'atk', mult, knock: 120, dir: angleTo(x, y, e.x, e.y), noShake: true });
    }
  }

  novaEffect(x: number, y: number, radius: number, element?: string): void {
    const color =
      element === 'ice'
        ? '#2ce8f5'
        : element === 'fire'
          ? '#f77622'
          : element === 'nature'
            ? '#63c74d'
            : element === 'arcane'
              ? '#2ce8f5'
              : element === 'earth'
                ? '#c0cbdc'
                : '#b55088';
    this.effects.push({
      t: 0,
      dur: 0.35,
      top: false,
      draw: (ctx, cx, cy, k) => {
        ctx.save();
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.ellipse(
          Math.round(x - cx),
          Math.round(y - cy),
          radius * (0.3 + k * 0.7),
          radius * (0.3 + k * 0.7) * 0.75,
          0,
          0,
          TAU,
        );
        ctx.stroke();
        ctx.globalAlpha = (1 - k) * 0.25;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      },
    });
  }

  lineEffect(ax: number, ay: number, bx: number, by: number, width: number, element?: string): void {
    const colors =
      element === 'nature'
        ? ['#63c74d', '#3e8948', '#733e39']
        : element === 'earth'
          ? ['#2ce8f5', '#b55088', '#ffffff']
          : ['#b55088', '#ff0044', '#ffffff'];
    const n = Math.ceil(dist(ax, ay, bx, by) / 8);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      this.particles.emit(ax + (bx - ax) * t, ay + (by - ay) * t, {
        count: 3,
        color: colors,
        speed: [10, 30],
        vz: [40, 90],
        gravity: 200,
        life: [0.3, 0.6],
        size: [2, 3],
        jitter: width / 3,
      });
    }
  }

  beamEffect(ax: number, ay: number, bx: number, by: number, width: number): void {
    this.effects.push({
      t: 0,
      dur: 0.04,
      top: true,
      draw: (ctx, cx, cy) => {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#68386c';
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = width + 4;
        ctx.beginPath();
        ctx.moveTo(ax - cx, ay - cy);
        ctx.lineTo(bx - cx, by - cy);
        ctx.stroke();
        ctx.strokeStyle = '#b55088';
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, width / 4);
        ctx.stroke();
        ctx.restore();
      },
    });
    if (Math.random() < 0.5)
      this.particles.emit(bx, by, {
        count: 2,
        color: ['#b55088', '#ff0044'],
        speed: [20, 50],
        life: [0.2, 0.4],
        emissive: true,
      });
  }

  addLightning(pts: { x: number; y: number }[]): void {
    this.effects.push({
      t: 0,
      dur: 0.3,
      top: true,
      draw: (ctx, cx, cy, k) => {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        for (const [color, w] of [
          ['#0099db', 3],
          ['#2ce8f5', 2],
          ['#ffffff', 1],
        ] as const) {
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.beginPath();
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const segs = Math.max(2, Math.floor(dist(a.x, a.y, b.x, b.y) / 8));
            ctx.moveTo(a.x - cx, a.y - cy);
            for (let s = 1; s <= segs; s++) {
              const t = s / segs;
              const j = s === segs ? 0 : 4;
              ctx.lineTo(
                a.x + (b.x - a.x) * t - cx + (Math.random() - 0.5) * j,
                a.y + (b.y - a.y) * t - cy + (Math.random() - 0.5) * j,
              );
            }
          }
          ctx.stroke();
        }
        ctx.restore();
      },
    });
  }

  meteorFall(tx: number, ty: number, dur: number): void {
    this.effects.push({
      t: 0,
      dur,
      top: true,
      draw: (ctx, cx, cy, k) => {
        const sx = tx + 80 * (1 - k);
        const sy = ty - 200 * (1 - k);
        const img = getSprite('proj_fireball', 'fly', Math.floor(k * 8) % 4, 'right');
        ctx.save();
        ctx.translate(Math.round(sx - cx), Math.round(sy - cy));
        ctx.rotate(Math.atan2(200, -80));
        ctx.scale(2.5, 2.5);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      },
    });
  }

  popText(
    x: number,
    y: number,
    text: string,
    color: string,
    o: { big?: boolean; small?: boolean } = {},
  ): void {
    if (!this.game.settings.damageNumbers && /^\d+$/.test(text)) return;
    this.texts.push({ x, y, text, color, t: 0, dur: o.big ? 1.1 : 0.8, big: !!o.big, small: !!o.small });
    if (this.texts.length > 60) this.texts.shift();
  }

  levelUpBurst(): void {
    const p = this.player;
    this.novaEffect(p.x, p.y - 4, 40, 'arcane');
    this.particles.emit(p.x, p.y - 8, {
      count: 40,
      color: ['#feae34', '#fee761', '#ffffff'],
      speed: [30, 90],
      vz: [30, 90],
      gravity: 60,
      life: [0.6, 1.2],
      emissive: true,
      shape: 'glow',
    });
  }

  bossShout(text: string): void {
    this.shoutText = { text, t: 0 };
  }

  shake(power: number, dur: number): void {
    this.cam.shake(power, dur);
  }

  hitStop(t: number): void {
    this.hitstopT = Math.max(this.hitstopT, t);
  }

  flashScreen(color: string, dur: number): void {
    if (this.game.settings.reduceFlashing) return;
    this.flashColor = color;
    this.flashT = dur;
    this.flashDur = dur;
  }

  private pan(x: number): number {
    return clamp((x - this.cam.x - this.game.app.width / 2) / (this.game.app.width / 2), -1, 1) * 0.6;
  }

  private updateEffects(dt: number): void {
    for (const e of this.effects) e.t += dt;
    this.effects = this.effects.filter((e) => e.t < e.dur);
  }

  private updateTexts(dt: number): void {
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter((t) => t.t < t.dur);
  }

  private updateAmbient(dt: number): void {
    const vw = this.game.app.width;
    const vh = this.game.app.height;
    const cx = this.cam.x;
    const cy = this.cam.y;
    const r = (a: number, b: number): number => a + Math.random() * (b - a);
    switch (this.data.ambient) {
      case 'leaves':
        if (Math.random() < dt * 3)
          this.particles.emit(cx + r(0, vw), cy - 4, {
            count: 1,
            color: ['#63c74d', '#3e8948', '#feae34'],
            angle: Math.PI / 2 + 0.4,
            spread: 0.6,
            speed: [12, 22],
            life: [6, 9],
            size: [1, 2],
            drag: 0,
            fadeSize: false,
          });
        if (Math.random() < dt * 2)
          this.particles.emit(cx + r(0, vw), cy + r(0, vh), {
            count: 1,
            color: ['#fee761'],
            speed: [2, 6],
            life: [2, 4],
            size: [1, 1],
            drag: 0.2,
            emissive: true,
            shape: 'glow',
          });
        break;
      case 'petals':
        if (Math.random() < dt * 2)
          this.particles.emit(cx + r(0, vw), cy - 4, {
            count: 1,
            color: ['#f6757a', '#ffffff', '#e8b796'],
            angle: Math.PI / 2 + 0.5,
            spread: 0.6,
            speed: [10, 18],
            life: [7, 10],
            size: [1, 1],
            drag: 0,
            fadeSize: false,
          });
        break;
      case 'dust':
        if (Math.random() < dt * 4)
          this.particles.emit(cx + r(0, vw), cy + r(0, vh), {
            count: 1,
            color: ['#8b9bb4', '#2ce8f5'],
            speed: [1, 4],
            life: [2, 4],
            size: [1, 1],
            drag: 0.1,
            emissive: true,
          });
        break;
      case 'embers':
        if (Math.random() < dt * 10)
          this.particles.emit(cx + r(0, vw), cy + vh + 2, {
            count: 1,
            color: ['#f77622', '#feae34', '#e43b44'],
            angle: -Math.PI / 2,
            spread: 0.6,
            speed: [15, 35],
            life: [3, 6],
            size: [1, 2],
            drag: 0,
            emissive: true,
            fadeSize: false,
          });
        break;
      case 'snow':
        if (Math.random() < dt * 18)
          this.particles.emit(cx + r(-40, vw), cy - 4, {
            count: 1,
            color: ['#ffffff', '#c0cbdc'],
            angle: Math.PI / 2 - 0.3,
            spread: 0.4,
            speed: [18, 30],
            life: [7, 10],
            size: [1, 2],
            drag: 0,
            fadeSize: false,
          });
        break;
      case 'void':
        if (Math.random() < dt * 5)
          this.particles.emit(cx + r(0, vw), cy + r(0, vh), {
            count: 1,
            color: ['#b55088', '#68386c', '#2ce8f5'],
            angle: -Math.PI / 2,
            spread: 0.5,
            speed: [3, 10],
            life: [2, 4],
            size: [1, 2],
            drag: 0,
            emissive: true,
            shape: 'glow',
          });
        break;
    }
  }

  private onAbyssCleared(): void {
    const save = this.game.save;
    const f = this.abyssFloor;
    save.stats.abyssBest = Math.max(save.stats.abyssBest, f);
    this.bumpCounter('abyss_streak', 'abyss_streak_best');
    audio.playSfx('stinger_discovery');
    this.game.banner = {
      title: `FLOOR ${f} CLEARED`,
      sub: 'A portal to the next floor has opened',
      t: 0,
      color: '#b55088',
    };
    // the generator picks open, reachable floor for the rewards; older maps fall back to a search
    const at = this.data.spawnPoints.reward ?? this.safeSpot(this.data.w * 8, this.data.h * 8 - 16);
    const chestAt = this.data.spawnPoints.rewardChest ?? this.safeSpot(at.x + 40, at.y + 10);
    const obj: Extract<MapObject, { kind: 'portal' }> = {
      kind: 'portal',
      id: `abyss_next_${f}`,
      x: at.x,
      y: at.y,
      to: `abyss_${f + 1}`,
      spawn: 'entry',
    };
    this.objects.push(new WorldObject(obj));
    const chest: Extract<MapObject, { kind: 'chest' }> = {
      kind: 'chest',
      id: `abyss_${f}_${Date.now()}`,
      x: chestAt.x,
      y: chestAt.y,
      rare: f % 5 === 0,
      ilvl: abyssLevel(f),
    };
    this.objects.push(new WorldObject(chest));
  }

  // ---------------------------------------------------------------- render ----
  render(ctx: CanvasRenderingContext2D): void {
    const vw = this.game.app.width;
    const vh = this.game.app.height;
    const camX = this.cam.rx;
    const camY = this.cam.ry;
    ctx.fillStyle = BG_COLOR[this.data.theme];
    ctx.fillRect(0, 0, vw, vh);
    this.renderer.renderGround(ctx, camX, camY, vw, vh, this.time);

    // ground layer: hazards, telegraphs, effects, shadows
    for (const h of this.hazards) h.render(ctx, camX, camY);
    for (const e of this.enemies) this.renderTelegraph(ctx, e, camX, camY);
    for (const fx of this.effects) if (!fx.top) fx.draw(ctx, camX, camY, fx.t / fx.dur);
    ctx.fillStyle = 'rgba(24,20,37,0.35)';
    const shadow = (x: number, y: number, r: number): void => {
      ctx.beginPath();
      ctx.ellipse(Math.round(x - camX), Math.round(y - camY), r, Math.max(1.5, r * 0.4), 0, 0, TAU);
      ctx.fill();
    };
    shadow(this.player.x, this.player.y, 5);
    for (const e of this.enemies)
      if (e.alpha > 0.1 || e.airborne) shadow(e.x, e.y, e.radius * (e.airborne ? 1.3 : 0.9));
    for (const n of this.npcs) shadow(n.x, n.y, 5);

    // y-sorted world
    const drawables: Drawable[] = [];
    this.renderer.collectTall(drawables, camX, camY, vw, vh, this.time);
    const add = (e: Entity, yBias = 0): void => {
      if (e.x < camX - 80 || e.x > camX + vw + 80 || e.y < camY - 40 || e.y > camY + vh + 120) return;
      drawables.push({ y: e.sortY + yBias, draw: (c, cx, cy) => e.render(c, cx, cy, this) });
    };
    for (const o of this.objects) add(o);
    for (const n of this.npcs) add(n);
    for (const pk of this.pickups) add(pk, -1);
    for (const e of this.enemies) add(e);
    add(this.player);
    for (const pr of this.projectiles) add(pr, 8);
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw(ctx, camX, camY);
    // x-ray silhouette when the hero is hidden behind tall scenery
    if (this.playerOccluded()) {
      const info = spriteInfo('hero');
      const frame = this.player.currentFrame();
      ctx.globalAlpha = 0.45;
      ctx.drawImage(
        silhouette(frame, '#2ce8f5'),
        Math.round(this.player.x - camX - info.anchorX),
        Math.round(this.player.y - camY - info.anchorY),
      );
      ctx.globalAlpha = 1;
    }

    for (const fx of this.effects) if (fx.top) fx.draw(ctx, camX, camY, fx.t / fx.dur);

    // lighting
    if (this.data.darkness > 0) {
      const lights: Light[] = [{ x: this.player.x, y: this.player.y - 8, radius: 84, color: '#ffffff' }];
      for (const pr of this.projectiles)
        lights.push({ x: pr.x, y: pr.y, radius: 26, color: pr.faction === 'enemy' ? '#f77622' : '#2ce8f5' });
      for (const o of this.objects)
        if (o.obj.kind === 'crystal' || o.obj.kind === 'portal')
          lights.push({ x: o.x, y: o.y - 12, radius: 70, color: '#2ce8f5', flicker: 0.05 });
      for (const h of this.hazards)
        if (h.triggered && h.spec.duration > 0)
          lights.push({ x: h.x, y: h.y, radius: h.spec.radius * 1.6, color: h.spec.color });
      for (const e of this.enemies)
        if (e.def.element === 'fire' || e.elite)
          lights.push({ x: e.x, y: e.y - 8, radius: 30, color: e.elite ? e.elite.color : '#f77622' });
      if (this.player.blades)
        lights.push({ x: this.player.x, y: this.player.y - 8, radius: 60, color: '#2ce8f5' });
      this.renderer.renderLighting(ctx, this.data.darkness, lights, camX, camY, vw, vh, this.time);
    }
    this.particles.render(ctx, camX, camY, false);
    this.particles.render(ctx, camX, camY, true);
    if (this.cannon) this.renderCannon(ctx, camX, camY);
    if (this.data.tint) {
      ctx.fillStyle = this.data.tint;
      ctx.fillRect(0, 0, vw, vh);
    }

    if (this.portalCast) this.renderPortalCast(ctx, camX, camY);

    // overlays: hp bars, labels, texts, prompts
    this.renderEnemyBars(ctx, camX, camY);
    for (const l of this.labels) drawText(ctx, l.text, l.x, l.y, { align: 'center', outline: '#181425' });
    this.renderTexts(ctx, camX, camY);
    this.renderPrompt(ctx, camX, camY);
    if (this.shoutText) {
      const k = this.shoutText.t;
      const a = Math.min(1, k * 4, (2.6 - k) * 3);
      drawText(ctx, this.shoutText.text, vw / 2, vh * 0.28, {
        align: 'center',
        color: '#fee761',
        outline: '#181425',
        scale: 1,
        alpha: a,
      });
    }
    if (this.slowT > 0 && this.player.state !== 'dead') {
      ctx.fillStyle = `rgba(44,232,245,${Math.min(0.12, this.slowT * 0.15)})`;
      ctx.fillRect(0, 0, vw, vh);
    }
    if (this.flashT > 0) {
      ctx.globalAlpha = (this.flashT / this.flashDur) * 0.5;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, vw, vh);
      ctx.globalAlpha = 1;
    }
    if (this.powerUp) {
      const b = this.powerUp.e;
      ctx.globalAlpha = 0.45 * Math.min(1, this.powerUp.t * 3);
      drawSpeedLines(ctx, b.x - camX, b.y - camY - 16, vw, vh, this.time * 2, '#ffffff', 0.8);
      ctx.globalAlpha = 1;
    }
    if (this.zoomFx) {
      const z = this.zoomFx;
      const k = Math.min(1, z.t / z.dur);
      zoomPunch(ctx, vw, vh, z.x - camX, z.y - camY, 1 + (z.scale - 1) * (1 - k) * (1 - k));
    }
    if (this.impactT > 0) applyImpactFrame(ctx, vw, vh, impactStyleAt(this.impactDur - this.impactT, 'cyan'));
    if (this.cutin) drawCutIn(ctx, this.cutin.id, this.cutin.t, vw, vh);
    if (this.cutin) {
      const k = this.cutin.t;
      if (k > 0.2 && k < cutInDuration(this.cutin.id) - 0.15) {
        drawText(ctx, 'AETHER CANNON', vw / 2, vh * 0.72, {
          align: 'center',
          color: '#2ce8f5',
          outline: '#181425',
          scale: 2,
        });
      }
    }
  }

  private playerOccluded(): boolean {
    const p = this.player;
    const tx = Math.floor(p.x / TILE);
    const ty = Math.floor(p.y / TILE);
    for (let y = ty + 1; y <= ty + 2; y++) {
      for (let x = tx - 1; x <= tx + 1; x++) {
        const c = this.map.cell(x, y);
        if (c === CELL.Tree && Math.abs(x * TILE + 8 - p.x) < 20) return true;
      }
    }
    return false;
  }

  private renderTelegraph(ctx: CanvasRenderingContext2D, e: Enemy, camX: number, camY: number): void {
    const a = e.current;
    if (!a) return;
    if (e.state !== 'windup' && !(e.state === 'attack' && a.type === 'dive')) return;
    const k = e.state === 'windup' ? Math.min(1, e.stateT / Math.max(0.05, a.windup)) : 1;
    const x = e.x - camX;
    const y = e.y - camY;
    ctx.save();
    ctx.fillStyle = '#ff0044';
    ctx.strokeStyle = '#ff0044';
    const fillA = 0.12 + k * 0.28;
    switch (a.type) {
      case 'melee':
        ctx.globalAlpha = fillA;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, a.reach + 4, e.aim - a.arc / 2, e.aim + a.arc / 2);
        ctx.closePath();
        ctx.fill();
        break;
      case 'lunge':
      case 'charge':
      case 'line':
      case 'beam': {
        const len = a.type === 'lunge' ? a.speed * a.duration : a.type === 'charge' ? a.length : a.length;
        const w = a.type === 'line' || a.type === 'beam' ? a.width : e.radius * 2;
        ctx.globalAlpha = fillA;
        ctx.translate(x, y);
        ctx.rotate(e.aim);
        ctx.fillRect(0, -w / 2, len * (a.type === 'line' ? k : 1), w);
        ctx.globalAlpha = 0.7;
        ctx.strokeRect(0.5, -w / 2 + 0.5, len, w);
        break;
      }
      case 'nova':
        ctx.globalAlpha = fillA;
        ctx.beginPath();
        ctx.ellipse(x, y, a.radius * k, a.radius * k * 0.75, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.ellipse(x, y, a.radius, a.radius * 0.75, 0, 0, TAU);
        ctx.stroke();
        break;
      case 'cone':
        ctx.globalAlpha = fillA;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(
          x,
          y,
          a.length,
          e.aim - a.arc / 2 - (a.sweep ?? 0) / 2,
          e.aim + a.arc / 2 + (a.sweep ?? 0) / 2,
        );
        ctx.closePath();
        ctx.fill();
        break;
      case 'dive':
        ctx.globalAlpha = 0.25 + 0.2 * Math.sin(this.time * 12);
        ctx.beginPath();
        ctx.ellipse(e.tx - camX, e.ty - camY, a.radius, a.radius * 0.75, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        break;
      default:
        break;
    }
    ctx.restore();
    // "!" warning above regular enemies
    if (e.state === 'windup' && !e.isBoss && e.stateT < 0.35) {
      const info = spriteInfo(e.def.sprite);
      drawText(ctx, '!', x, y - info.anchorY * e.scale - 12, {
        align: 'center',
        color: '#ff0044',
        outline: '#181425',
      });
    }
  }

  private renderEnemyBars(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (!this.game.settings.enemyHealthBars) return;
    for (const e of this.enemies) {
      if (e.isBoss || e.dead || e.alpha < 0.5) continue;
      if (e.hpBarT <= 0 && !e.elite) continue;
      const info = spriteInfo(e.def.sprite);
      const w = Math.max(14, Math.round(e.radius * 2.2));
      const x = Math.round(e.x - camX - w / 2);
      const y = Math.round(e.y - camY - info.anchorY * e.scale - 6 - e.z);
      ctx.fillStyle = '#181425';
      ctx.fillRect(x - 1, y - 1, w + 2, 4);
      ctx.fillStyle = '#3e2731';
      ctx.fillRect(x, y, w, 2);
      ctx.fillStyle = e.elite ? '#feae34' : '#e43b44';
      ctx.fillRect(x, y, Math.max(0, Math.round((w * e.hp) / e.maxHp)), 2);
      if (e.shield > 0) {
        ctx.fillStyle = '#2ce8f5';
        ctx.fillRect(x, y - 2, Math.round((w * e.shield) / (e.maxHp * 0.3)), 1);
      }
      if (e.elite) {
        const diff = e.level - this.game.save.hero.level;
        const col = diff >= 5 ? '#e43b44' : diff >= 2 ? '#feae34' : '#ffffff';
        drawText(ctx, `${e.name} Lv${e.level}`, x + w / 2, y - 10, {
          align: 'center',
          color: col,
          outline: '#181425',
        });
      } else if (e.hpBarT > 0) {
        const diff = e.level - this.game.save.hero.level;
        if (diff >= 3)
          drawText(ctx, `${e.level}`, x - 6, y - 3, {
            color: diff >= 5 ? '#e43b44' : '#feae34',
            outline: '#181425',
          });
      }
    }
  }

  private renderTexts(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const t of this.texts) {
      const k = t.t / t.dur;
      const rise = t.big ? 14 : 10;
      const y = t.y - camY - rise * Math.min(1, k * 2.5);
      const pop = t.big && k < 0.15 ? 2 : 1;
      drawText(ctx, t.text, t.x - camX, y, {
        align: 'center',
        color: t.color,
        outline: '#181425',
        scale: t.big ? pop : 1,
        alpha: k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1,
      });
    }
  }

  private renderPrompt(ctx: CanvasRenderingContext2D, camX: number, camY: number): void {
    const t = this.interactTarget;
    if (!t || this.inputBlocked) return;
    const label = t instanceof Npc ? `Talk to ${t.def.name}` : t.prompt(this);
    if (!label) return;
    const key = this.input.label('interact');
    const text = `[${key}] ${label}`;
    const x = Math.round(t.x - camX);
    const y = Math.round(t.y - camY - (t instanceof Npc ? 34 : 30));
    drawText(ctx, text, x, y, { align: 'center', color: '#fee761', outline: '#181425' });
  }
}

/** Is a status currently active on an actor? */
function hasStatus(a: { statuses: Partial<Record<string, { t: number }>> }, kind: string): boolean {
  return (a.statuses[kind]?.t ?? 0) > 0;
}

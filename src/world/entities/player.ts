/** The hero: movement, combo attacks, dodge roll, skills, flasks and rendering. */
import { getSprite, getWeapon, silhouette, spriteInfo, weaponInfo } from '../../art/pixel';
import { drawAura } from '../../art/anime';
import { heroHand } from '../../art/pixel/actors';
import type { AnimName, Dir, WeaponKind } from '../../art/pixel/types';
import { audio } from '../../audio';
import { WEAPON_FEEL } from '../../data/items';
import { SKILLS, skillCooldown, type SkillId } from '../../data/skills';
import { angleDiff, angleTo, clamp, dirFromAngle, dist, easeOutCubic, TAU } from '../../engine/math';
import { castSkill } from '../skills';
import type { World } from '../world';
import { Actor } from './actor';
import type { Enemy } from './enemy';

export type PlayerState = 'free' | 'attack' | 'roll' | 'cast' | 'hurt' | 'dead' | 'dash';

interface Swing {
  t: number;
  windup: number;
  active: number;
  recover: number;
  arc: number;
  range: number;
  mult: number;
  knock: number;
  aim: number;
  combo: number;
  hit: Set<Enemy>;
  fired: boolean;
  echo: boolean;
}

export const STAMINA_MAX = 100;
const ROLL_COST = 28;
const ROLL_TIME = 0.32;
const ROLL_IFRAMES = 0.26;
const ROLL_SPEED = 215;
const BASE_SPEED = 82;

export class Player extends Actor {
  state: PlayerState = 'free';
  stateT = 0;
  aim = Math.PI / 2;
  dir: Dir = 'down';
  moving = false;
  animT = 0;
  stamina = STAMINA_MAX;
  staminaDelay = 0;
  mp = 40;
  maxMp = 40;
  combo = 0;
  comboTimer = 0;
  swing: Swing | null = null;
  attackBuffer = 0;
  dodgeBuffer = 0;
  rollAngle = 0;
  perfectUsed = false;
  cooldowns: Partial<Record<SkillId, number>> = {};
  castT = 0;
  flaskCd = 0;
  /** Dash-slash skill state. */
  dash: { t: number; dur: number; angle: number; speed: number; hit: Set<Enemy>; mult: number } | null = null;
  whirl: { t: number; tick: number; mult: number } | null = null;
  blades: { t: number; count: number; angle: number; mult: number; hitCd: Map<Enemy, number> } | null = null;
  hot: { t: number; perSec: number } | null = null;
  lastStandCd = 0;
  phoenixUsed = false;
  seraphCd = 0;
  surgeInvuln = 0;
  private stepT = 0;
  private trail: { x: number; y: number; frame: HTMLCanvasElement; a: number }[] = [];
  private regenAcc = 0;
  /** Controls are disabled (dialogue, cutscene, transitions). */
  locked = false;
  vx = 0;
  vy = 0;

  constructor() {
    super();
    this.faction = 'player';
    this.radius = 5;
  }

  get weaponKind(): WeaponKind {
    return this.worldRef?.game.save.equipment.weapon?.kind ?? 'sword';
  }

  private worldRef: World | null = null;

  get invulnerable(): boolean {
    return (
      this.invuln > 0 ||
      this.surgeInvuln > 0 ||
      (this.state === 'roll' && this.stateT < ROLL_IFRAMES) ||
      this.state === 'dash' ||
      this.state === 'dead'
    );
  }

  /** True during the first moments of a roll (perfect dodge window). */
  get inPerfectWindow(): boolean {
    return this.state === 'roll' && this.stateT < 0.16 && !this.perfectUsed;
  }

  syncFromSave(world: World): void {
    const s = world.game.save.hero;
    const st = world.game.stats();
    this.maxHp = st.maxHp;
    this.maxMp = st.maxMp;
    this.hp = clamp(s.hp, 1, st.maxHp);
    this.mp = clamp(s.mp, 0, st.maxMp);
    this.level = s.level;
  }

  // ---------------------------------------------------------------- update ----
  update(dt: number, world: World): void {
    this.worldRef = world;
    const game = world.game;
    const st = game.stats();
    const hero = game.save.hero;
    const input = world.input;
    this.maxHp = st.maxHp;
    this.maxMp = st.maxMp;
    this.level = hero.level;
    this.animT += dt;
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.surgeInvuln = Math.max(0, this.surgeInvuln - dt);
    this.flaskCd = Math.max(0, this.flaskCd - dt);
    this.lastStandCd = Math.max(0, this.lastStandCd - dt);
    this.seraphCd = Math.max(0, this.seraphCd - dt);
    this.attackBuffer = Math.max(0, this.attackBuffer - dt);
    this.dodgeBuffer = Math.max(0, this.dodgeBuffer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0 && this.state !== 'attack') this.combo = 0;
    for (const k of Object.keys(this.cooldowns) as SkillId[])
      this.cooldowns[k] = Math.max(0, (this.cooldowns[k] ?? 0) - dt);

    if (this.state === 'dead') {
      this.applyKnockback(dt, world);
      return;
    }

    // regen (out-of-combat bonus)
    const regenMult = world.inCombat ? 1 : 3;
    this.regenAcc += st.hpRegen * regenMult * dt;
    if (this.hot) {
      this.regenAcc += this.hot.perSec * dt;
      this.hot.t -= dt;
      if (this.hot.t <= 0) this.hot = null;
    }
    if (this.regenAcc >= 1) {
      const n = Math.floor(this.regenAcc);
      this.regenAcc -= n;
      this.hp = Math.min(this.maxHp, this.hp + n);
    }
    this.mp = Math.min(this.maxMp, this.mp + st.mpRegen * regenMult * dt);
    this.staminaDelay -= dt;
    if (this.staminaDelay <= 0) this.stamina = Math.min(STAMINA_MAX, this.stamina + 55 * dt);

    const dot = this.tickStatuses(dt);
    if (dot > 0) world.hurtPlayerRaw(dot, true);
    if (this.dead) return;

    // --- input
    const canAct = !this.locked && !world.inputBlocked;
    const mv = canAct ? input.move() : { x: 0, y: 0 };
    const moveLen = Math.hypot(mv.x, mv.y);
    if (canAct) {
      if (input.pressed('attack')) this.attackBuffer = 0.22;
      else if (input.isDown('attack')) this.attackBuffer = Math.max(this.attackBuffer, 0.05); // hold to keep attacking
      if (input.pressed('dodge')) this.dodgeBuffer = 0.16;
      this.updateAim(world, mv);
      if (input.pressed('potionHp')) this.drinkFlask(world, 'hp');
      if (input.pressed('potionMp')) this.drinkFlask(world, 'mp');
      if (input.pressed('ultimate')) world.tryUltimate();
      for (let i = 0; i < 4; i++) {
        if (input.pressed(`skill${i + 1}` as 'skill1')) this.trySkill(world, hero.slots[i]);
      }
    }

    // --- state machine
    const slowMult = this.speedMult * (this.whirl ? 0.65 : 1);
    const speed = BASE_SPEED * (1 + st.moveSpeed) * slowMult;
    let wantVX = 0;
    let wantVY = 0;

    switch (this.state) {
      case 'free': {
        if (this.dodgeBuffer > 0 && this.tryRoll(world, mv)) break;
        if (this.attackBuffer > 0 && !this.whirl && this.startSwing(world)) break;
        wantVX = mv.x * speed;
        wantVY = mv.y * speed;
        break;
      }
      case 'attack': {
        const sw = this.swing!;
        sw.t += dt;
        const inWindup = sw.t < sw.windup;
        const activeEnd = sw.windup + sw.active;
        // lunge forward during windup & active
        if (sw.t < activeEnd) {
          const lunge = WEAPON_FEEL[this.weaponKind].lunge * (sw.combo === 3 ? 1.3 : 1);
          wantVX = Math.cos(sw.aim) * lunge * (1 - sw.t / activeEnd);
          wantVY = Math.sin(sw.aim) * lunge * (1 - sw.t / activeEnd);
        }
        if (!inWindup && !sw.fired) {
          sw.fired = true;
          this.fireSwing(world, sw);
        }
        if (sw.t >= sw.windup && sw.t < activeEnd) this.swingHits(world, sw);
        // cancels
        const cancellable = inWindup || sw.t >= activeEnd;
        if (cancellable && this.dodgeBuffer > 0 && this.tryRoll(world, mv)) break;
        if (sw.t >= activeEnd + sw.recover * 0.35 && this.attackBuffer > 0 && this.startSwing(world)) break;
        if (sw.t >= activeEnd + sw.recover) {
          this.state = 'free';
          this.swing = null;
          this.comboTimer = 0.45;
        }
        break;
      }
      case 'roll': {
        const k = this.stateT / ROLL_TIME;
        const sp = ROLL_SPEED * (1 - easeOutCubic(k) * 0.7) * Math.max(0.5, this.speedMult);
        wantVX = Math.cos(this.rollAngle) * sp;
        wantVY = Math.sin(this.rollAngle) * sp;
        if (this.stateT > 0.04 && Math.floor(this.stateT / 0.05) !== Math.floor((this.stateT - dt) / 0.05))
          this.pushTrail(0.5);
        if (this.stateT >= ROLL_TIME) {
          this.state = 'free';
          if (this.attackBuffer > 0) this.startSwing(world);
        }
        break;
      }
      case 'dash': {
        const d = this.dash!;
        d.t += dt;
        wantVX = Math.cos(d.angle) * d.speed;
        wantVY = Math.sin(d.angle) * d.speed;
        this.pushTrail(0.6);
        for (const e of world.enemiesNear(this.x, this.y, 18)) {
          if (d.hit.has(e)) continue;
          d.hit.add(e);
          world.playerHit(e, { power: 'atk', mult: d.mult, knock: 140, dir: d.angle, isSkill: true });
        }
        if (d.t >= d.dur) {
          this.state = 'free';
          this.dash = null;
          this.invuln = Math.max(this.invuln, 0.12);
        }
        break;
      }
      case 'cast': {
        wantVX = mv.x * speed * 0.3;
        wantVY = mv.y * speed * 0.3;
        if (this.stateT >= this.castT) this.state = 'free';
        break;
      }
      case 'hurt': {
        if (this.stateT >= 0.2) this.state = 'free';
        break;
      }
    }

    // smooth velocity for responsive-but-weighty movement
    const accel = this.state === 'free' ? 28 : 40;
    this.vx += (wantVX - this.vx) * Math.min(1, accel * dt);
    this.vy += (wantVY - this.vy) * Math.min(1, accel * dt);
    if (this.state === 'roll' || this.state === 'dash') {
      this.vx = wantVX;
      this.vy = wantVY;
    }
    world.moveActor(this, this.vx * dt, this.vy * dt, false, this.state === 'free');
    this.applyKnockback(dt, world);

    this.moving = moveLen > 0.1 && this.state === 'free';
    if (this.moving) {
      this.stepT += dt * (1 + st.moveSpeed);
      if (this.stepT > 0.3) {
        this.stepT = 0;
        audio.playSfx('footstep', { volume: 0.35 });
        world.particles.emit(this.x, this.y, {
          count: 2,
          color: world.dustColor,
          speed: [5, 15],
          life: [0.2, 0.4],
          size: [1, 2],
        });
      }
    }
    // facing follows aim when attacking/casting, otherwise movement
    const faceAngle =
      this.state === 'free' && this.moving && !world.input.mouseAimActive()
        ? Math.atan2(mv.y, mv.x)
        : this.aim;
    this.dir = dirFromAngle(faceAngle);

    // continuous skills
    if (this.whirl) this.updateWhirl(dt, world);
    if (this.blades) this.updateBlades(dt, world);

    // trail fade
    for (const t of this.trail) t.a -= dt * 3;
    this.trail = this.trail.filter((t) => t.a > 0);
  }

  private updateAim(world: World, mv: { x: number; y: number }): void {
    const input = world.input;
    const pad = input.padAim();
    if (input.mouseAimActive()) {
      const wx = input.mouse.x + world.cam.rx;
      const wy = input.mouse.y + world.cam.ry;
      this.aim = angleTo(this.x, this.y - 8, wx, wy);
    } else if (pad) {
      this.aim = Math.atan2(pad.y, pad.x);
    } else if (Math.hypot(mv.x, mv.y) > 0.2) {
      this.aim = Math.atan2(mv.y, mv.x);
    }
  }

  /** Aim assist: nudge toward the best target in a cone. */
  private assistedAim(world: World, range: number, cone: number): number {
    if (!world.game.settings.aimAssist || world.input.mouseAimActive()) return this.aim;
    let best: Enemy | null = null;
    let bestScore = Infinity;
    for (const e of world.enemiesNear(this.x, this.y, range)) {
      const a = angleTo(this.x, this.y, e.x, e.y);
      const da = Math.abs(angleDiff(this.aim, a));
      if (da > cone) continue;
      const score = da * 40 + dist(this.x, this.y, e.x, e.y);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best ? angleTo(this.x, this.y, best.x, best.y) : this.aim;
  }

  // ---------------------------------------------------------------- attack ----
  private startSwing(world: World): boolean {
    const st = world.game.stats();
    const kind = this.weaponKind;
    const feel = WEAPON_FEEL[kind];
    const spd = 1 / (1 + st.atkSpeed);
    this.combo = (this.combo % 3) + 1;
    this.aim = this.assistedAim(world, feel.ranged ? 170 : feel.range + 30, feel.ranged ? 0.5 : 0.9);
    const third = this.combo === 3;
    this.swing = {
      t: 0,
      windup: feel.windup * spd * (third ? 1.4 : 1),
      active: feel.active * spd,
      recover: feel.recover * spd * (third ? 1.35 : 1),
      arc: feel.arc * (third ? 1.15 : 1),
      range: feel.range * (third ? 1.15 : 1),
      mult: feel.dmg * (third ? 1.5 : this.combo === 2 ? 1.1 : 1),
      knock: feel.knockback * (third ? 1.8 : 1),
      aim: this.aim,
      combo: this.combo,
      hit: new Set(),
      fired: false,
      echo: world.game.stats().legendaries.has('echo_blade'),
    };
    this.state = 'attack';
    this.stateT = 0;
    this.attackBuffer = 0;
    this.comboTimer = 0.6;
    return true;
  }

  private fireSwing(world: World, sw: Swing): void {
    const kind = this.weaponKind;
    if (WEAPON_FEEL[kind].ranged) {
      audio.playSfx('staff_bolt');
      const shots = sw.combo === 3 ? 3 : 1;
      for (let i = 0; i < shots; i++) {
        const a = sw.aim + (shots > 1 ? (i - 1) * 0.22 : 0);
        world.spawnPlayerBolt(this.x + Math.cos(a) * 8, this.y - 8 + Math.sin(a) * 8, a, sw.mult);
      }
      return;
    }
    audio.playSfx(kind === 'greatsword' ? 'swing_heavy' : kind === 'dagger' ? 'swing_light' : 'swing');
    world.addSlash(this, sw.aim, sw.arc, sw.range, sw.combo, kind);
    if (sw.combo === 3 && world.game.stats().legendaries.has('dragonbreath')) world.fireWave(this, sw.aim);
    if (sw.echo) world.echoSlash(this, sw.aim, sw.arc, sw.range, sw.mult * 0.6, sw.knock);
  }

  private swingHits(world: World, sw: Swing): void {
    for (const e of world.enemiesNear(this.x, this.y - 4, sw.range + 16)) {
      if (sw.hit.has(e)) continue;
      if (!world.inSector(e, this.x, this.y - 4, sw.range, sw.aim, sw.arc / 2)) continue;
      sw.hit.add(e);
      world.playerHit(e, {
        power: 'atk',
        mult: sw.mult,
        knock: sw.knock,
        dir: sw.aim,
        heavy: sw.combo === 3,
      });
    }
  }

  // ------------------------------------------------------------------ roll ----
  private tryRoll(world: World, mv: { x: number; y: number }): boolean {
    const st = world.game.stats();
    const cost = ROLL_COST * (1 - st.dodgeCost);
    if (this.stamina < cost) {
      if (this.dodgeBuffer > 0.14)
        world.popText(this.x, this.y - 22, 'No stamina', '#8b9bb4', { small: true });
      return false;
    }
    this.stamina -= cost;
    this.staminaDelay = 0.45;
    this.rollAngle = Math.hypot(mv.x, mv.y) > 0.2 ? Math.atan2(mv.y, mv.x) : this.aim;
    this.state = 'roll';
    this.stateT = 0;
    this.swing = null;
    this.dodgeBuffer = 0;
    this.perfectUsed = false;
    audio.playSfx('dodge');
    world.particles.emit(this.x, this.y, {
      count: 6,
      color: world.dustColor,
      speed: [15, 40],
      life: [0.2, 0.4],
    });
    if (st.legendaries.has('windwalkers')) world.gust(this, this.rollAngle);
    return true;
  }

  // ---------------------------------------------------------------- skills ----
  private trySkill(world: World, id: SkillId | null): void {
    if (!id) return;
    const hero = world.game.save.hero;
    const rank = hero.skills[id] ?? 0;
    if (rank <= 0) return;
    if (this.state === 'dead' || this.state === 'hurt' || this.state === 'dash') return;
    if (this.state === 'roll' && this.stateT < ROLL_TIME * 0.6) return;
    const def = SKILLS[id];
    if ((this.cooldowns[id] ?? 0) > 0) {
      audio.playSfx('ui_error', { volume: 0.5 });
      return;
    }
    if (this.mp < def.mp) {
      audio.playSfx('no_mana');
      world.popText(this.x, this.y - 22, 'Not enough MP', '#0099db', { small: true });
      return;
    }
    const st = world.game.stats();
    this.mp -= def.mp;
    this.cooldowns[id] = skillCooldown(def, rank) * (1 - st.cdr);
    this.swing = null;
    this.state = 'cast';
    this.stateT = 0;
    this.castT = 0.18;
    this.aim = this.assistedAim(world, 180, 0.6);
    castSkill(world, this, id, rank);
  }

  cooldownFrac(id: SkillId, world: World): number {
    const rank = world.game.save.hero.skills[id] ?? 1;
    const total = skillCooldown(SKILLS[id], rank) * (1 - world.game.stats().cdr);
    return total > 0 ? (this.cooldowns[id] ?? 0) / total : 0;
  }

  private updateWhirl(dt: number, world: World): void {
    const w = this.whirl!;
    w.t -= dt;
    w.tick -= dt;
    if (w.tick <= 0) {
      w.tick = 0.2;
      audio.playSfx('whirlwind', { volume: 0.6 });
      for (const e of world.enemiesNear(this.x, this.y - 4, 36)) {
        world.playerHit(e, {
          power: 'atk',
          mult: w.mult,
          knock: 60,
          dir: angleTo(this.x, this.y, e.x, e.y),
          isSkill: true,
        });
      }
      world.addSlash(this, (this.animT * 20) % TAU, TAU, 34, 4, this.weaponKind);
    }
    if (w.t <= 0) this.whirl = null;
  }

  private updateBlades(dt: number, world: World): void {
    const b = this.blades!;
    b.t -= dt;
    b.angle += dt * 4.2;
    for (const [e, t] of b.hitCd) {
      const nt = t - dt;
      if (nt <= 0) b.hitCd.delete(e);
      else b.hitCd.set(e, nt);
    }
    for (let i = 0; i < b.count; i++) {
      const a = b.angle + (i / b.count) * TAU;
      const bx = this.x + Math.cos(a) * 28;
      const by = this.y - 6 + Math.sin(a) * 20;
      for (const e of world.enemiesNear(bx, by, 10)) {
        if (b.hitCd.has(e)) continue;
        b.hitCd.set(e, 0.45);
        world.playerHit(e, {
          power: 'atk',
          mult: b.mult,
          knock: 50,
          dir: a + Math.PI / 2,
          isSkill: true,
          noShake: true,
        });
      }
    }
    if (b.t <= 0) this.blades = null;
  }

  // ---------------------------------------------------------------- flasks ----
  private drinkFlask(world: World, kind: 'hp' | 'mp'): void {
    const hero = world.game.save.hero;
    const st = world.game.stats();
    if (this.flaskCd > 0 || this.state === 'dead') return;
    if (kind === 'hp') {
      if (hero.flaskHp <= 0) {
        audio.playSfx('ui_error');
        world.popText(this.x, this.y - 22, 'Out of flasks', '#e43b44', { small: true });
        return;
      }
      if (this.hp >= this.maxHp) return;
      hero.flaskHp--;
      const amt = Math.round(this.maxHp * 0.45 * st.flaskPotency);
      this.hp = Math.min(this.maxHp, this.hp + amt);
      world.popText(this.x, this.y - 20, `+${amt}`, '#63c74d');
      world.particles.emit(this.x, this.y - 8, {
        count: 14,
        color: ['#63c74d', '#ffffff'],
        speed: [10, 30],
        vz: [20, 50],
        gravity: 30,
        life: [0.4, 0.8],
        emissive: true,
      });
    } else {
      if (hero.flaskMp <= 0) {
        audio.playSfx('ui_error');
        world.popText(this.x, this.y - 22, 'Out of flasks', '#0099db', { small: true });
        return;
      }
      if (this.mp >= this.maxMp) return;
      hero.flaskMp--;
      const amt = Math.round(this.maxMp * 0.6 * st.flaskPotency);
      this.mp = Math.min(this.maxMp, this.mp + amt);
      world.popText(this.x, this.y - 20, `+${amt} MP`, '#0099db');
      world.particles.emit(this.x, this.y - 8, {
        count: 14,
        color: ['#0099db', '#2ce8f5'],
        speed: [10, 30],
        vz: [20, 50],
        gravity: 30,
        life: [0.4, 0.8],
        emissive: true,
      });
    }
    this.flaskCd = 0.6;
    audio.playSfx('potion');
  }

  // ------------------------------------------------------------------ hurt ----
  onHurt(amount: number, dir: number, knock: number): void {
    this.flash = 0.12;
    this.invuln = 0.65;
    this.kx += Math.cos(dir) * knock;
    this.ky += Math.sin(dir) * knock;
    if (amount >= this.maxHp * 0.12 && this.state !== 'roll' && this.state !== 'dash') {
      this.state = 'hurt';
      this.stateT = 0;
      this.swing = null;
      this.whirl = null;
    }
  }

  pushTrail(alpha: number): void {
    const frame = this.currentFrame();
    const info = spriteInfo('hero');
    this.trail.push({ x: this.x - info.anchorX, y: this.y - info.anchorY - this.z, frame, a: alpha });
    if (this.trail.length > 8) this.trail.shift();
  }

  // ---------------------------------------------------------------- render ----
  private currentAnim(): { anim: AnimName; frame: number } {
    const info = spriteInfo('hero');
    const fr = (a: AnimName, fallback = 1): number => {
      const ai = info.anims[a];
      return ai ? Math.floor(this.animT * ai.fps) % ai.frames : fallback;
    };
    switch (this.state) {
      case 'roll':
        return { anim: 'roll', frame: Math.min(3, Math.floor((this.stateT / ROLL_TIME) * 4)) };
      case 'attack':
        return { anim: 'attack', frame: this.swing && this.swing.t < this.swing.windup ? 0 : 1 };
      case 'dash':
        return { anim: 'attack', frame: 1 };
      case 'cast':
        return { anim: 'cast', frame: 0 };
      case 'hurt':
      case 'dead':
        return { anim: 'hurt', frame: 0 };
      default:
        return this.moving ? { anim: 'walk', frame: fr('walk') } : { anim: 'idle', frame: fr('idle') };
    }
  }

  currentFrame(): HTMLCanvasElement {
    const { anim, frame } = this.currentAnim();
    return getSprite('hero', anim, frame, this.dir);
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number, world: World): void {
    const info = spriteInfo('hero');
    // afterimages
    for (const t of this.trail) {
      ctx.globalAlpha = t.a * 0.5;
      ctx.drawImage(silhouette(t.frame, '#2ce8f5'), Math.round(t.x - camX), Math.round(t.y - camY));
    }
    ctx.globalAlpha = 1;
    const x = Math.round(this.x - camX);
    const y = Math.round(this.y - camY - this.z);
    // hurt flicker
    if (
      this.invuln > 0 &&
      this.state !== 'dead' &&
      Math.floor(this.invuln * 20) % 2 === 0 &&
      this.flash <= 0
    ) {
      ctx.globalAlpha = 0.45;
    }
    const frame = this.currentFrame();
    const weaponBehind = this.dir === 'up';
    const aura = this.auraIntensity(world);
    if (aura > 0) drawAura(ctx, x, y, 30, this.animT, 'aether', 'back', aura);
    if (weaponBehind) this.renderWeapon(ctx, x, y, world);
    ctx.drawImage(frame, x - info.anchorX, y - info.anchorY);
    if (this.flash > 0) ctx.drawImage(silhouette(frame, '#ffffff'), x - info.anchorX, y - info.anchorY);
    if (this.frozen) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(silhouette(frame, '#2ce8f5'), x - info.anchorX, y - info.anchorY);
    }
    ctx.globalAlpha = 1;
    if (!weaponBehind) this.renderWeapon(ctx, x, y, world);
    if (aura > 0) drawAura(ctx, x, y, 30, this.animT, 'aether', 'front', aura);
    // spectral blades
    if (this.blades) {
      const b = this.blades;
      for (let i = 0; i < b.count; i++) {
        const a = b.angle + (i / b.count) * TAU;
        const bx = x + Math.cos(a) * 28;
        const by = y - 6 + Math.sin(a) * 20;
        const img = getWeapon('sword', 5);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + Math.PI / 2);
        ctx.globalAlpha = 0.85;
        ctx.drawImage(silhouette(img, '#2ce8f5'), -img.width / 2, -img.height / 2);
        ctx.restore();
      }
    }
  }

  /** Aura while the Aether Cannon fires (full) or when Surge is ready (a soft glow). */
  private auraIntensity(world: World): number {
    if (this.state === 'dead') return 0;
    if (world.cannon || world.cutin) return 1;
    const h = world.game.save.hero;
    return h.surgeUnlocked && h.surge >= 100 ? 0.4 : 0;
  }

  private renderWeapon(ctx: CanvasRenderingContext2D, x: number, y: number, world: World): void {
    if (this.state === 'roll' || this.state === 'dead') return;
    const kind = this.weaponKind;
    const tier = world.game.save.equipment.weapon?.tier ?? 0;
    const img = getWeapon(kind, tier);
    const wi = weaponInfo(kind);
    let angle: number;
    const info = spriteInfo('hero');
    const { anim, frame } = this.currentAnim();
    const hand = heroHand(anim, frame, this.dir);
    const hx = hand ? x - info.anchorX + hand.x : x;
    const hy = hand ? y - info.anchorY + hand.y : y - 9;
    if (this.state === 'attack' && this.swing && !WEAPON_FEEL[kind].ranged) {
      const sw = this.swing;
      const k = clamp((sw.t - sw.windup * 0.5) / (sw.windup * 0.5 + sw.active), 0, 1);
      const sweep = easeOutCubic(k);
      const flip = sw.combo === 2 ? -1 : 1;
      angle = sw.aim + flip * (-sw.arc / 2 + sw.arc * sweep);
    } else if (this.state === 'dash' && this.dash) {
      angle = this.dash.angle;
    } else if (this.state === 'attack' || this.state === 'cast') {
      angle = this.aim;
    } else if (this.whirl) {
      angle = (this.animT * 20) % TAU;
    } else {
      // resting pose, held low at the side
      const bob = this.moving ? Math.sin(this.animT * 14) * 0.15 : 0;
      switch (this.dir) {
        case 'down':
          angle = Math.PI * 0.62 + bob;
          break;
        case 'up':
          angle = -Math.PI * 0.62 + bob;
          break;
        case 'left':
          angle = Math.PI * 0.75 + bob;
          break;
        default:
          angle = Math.PI * 0.25 + bob;
      }
    }
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle);
    ctx.drawImage(img, -wi.gripX, -wi.gripY);
    ctx.restore();
  }
}

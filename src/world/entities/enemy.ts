/**
 * Data-driven enemy AI. Every attack has a readable telegraph (wind-up) and a
 * recovery window, so fights are hard but fair. Bosses reuse the same machinery
 * with phases.
 */
import { getSprite, silhouette, spriteInfo } from '../../art/pixel';
import type { AnimName, Dir } from '../../art/pixel/types';
import { audio } from '../../audio';
import type { AttackDef, EliteMod, EnemyDef } from '../../data/enemies';
import { enemyAtkScale, enemyDefScale, enemyHpScale } from '../../game/balance';
import { angleTo, clamp, dist, TAU } from '../../engine/math';
import { rng } from '../../engine/rng';
import type { World } from '../world';
import { Actor } from './actor';

type EState = 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'return' | 'dying' | 'spawn';

export interface EnemyOptions {
  elite?: EliteMod | null;
  group?: number;
  summoned?: boolean;
}

export class Enemy extends Actor {
  readonly def: EnemyDef;
  elite: EliteMod | null;
  atk: number;
  defense: number;
  speed: number;
  xp: number;
  gold: number;
  scale: number;
  homeX: number;
  homeY: number;
  group: number;
  summoned: boolean;
  state: EState = 'spawn';
  stateT = 0;
  animT = Math.random() * 3;
  facing: 'left' | 'right' = 'left';
  aim = 0;
  aggro = false;
  cooldowns: number[];
  current: AttackDef | null = null;
  /** Locked target for the current attack. */
  tx = 0;
  ty = 0;
  repeatsLeft = 0;
  bursts = 0;
  burstT = 0;
  shots = 0;
  spin = 0;
  hitPlayer = false;
  tickT = 0;
  hasToken = false;
  phase = 0;
  hpBarT = 0;
  shield = 0;
  shieldT = 0;
  trailT = 0;
  alpha = 1;
  airborne = false;
  private losT = 0;
  private los = false;
  private wanderT = 0;
  private wx = 0;
  private wy = 0;
  private hopT = 0;
  private strafeDir = rng.chance(0.5) ? 1 : -1;
  private strafeT = 0;
  vx = 0;
  vy = 0;
  /** Recently dealt a damaging hit (for vampiric etc.). */
  deathT = 0;
  killedByPlayer = false;

  constructor(
    def: EnemyDef,
    level: number,
    x: number,
    y: number,
    diffHp: number,
    diffDmg: number,
    diffSpeed: number,
    opts: EnemyOptions = {},
  ) {
    super();
    this.def = def;
    this.level = level;
    this.x = this.homeX = x;
    this.y = this.homeY = y;
    this.elite = opts.elite ?? null;
    this.group = opts.group ?? -1;
    this.summoned = opts.summoned ?? false;
    this.scale = def.scale ?? 1;
    this.radius = def.radius * this.scale;
    this.maxHp = Math.round(def.hp * enemyHpScale(level) * diffHp);
    this.atk = def.atk * enemyAtkScale(level) * diffDmg;
    this.defense = def.def * enemyDefScale(level);
    this.speed = def.speed * diffSpeed;
    this.xp = def.xp;
    this.gold = def.gold;
    this.cooldowns = def.attacks.map(() => rng.range(0.3, 1.2));
    if (this.elite) {
      this.maxHp = Math.round(this.maxHp * 2.6);
      this.atk *= 1.3;
      this.xp *= 4;
      this.gold *= 3;
      switch (this.elite.id) {
        case 'frenzied':
          this.speed *= 1.3;
          break;
        case 'armored':
          this.defense *= 2.2;
          break;
        case 'giant':
          this.maxHp *= 2;
          this.scale *= 1.35;
          this.radius *= 1.35;
          break;
        case 'shielded':
          this.shield = this.maxHp * 0.3;
          break;
      }
    }
    this.hp = this.maxHp;
    this.faction = 'enemy';
    this.aim = rng.range(0, TAU);
    if (def.boss) this.state = 'idle';
  }

  get isBoss(): boolean {
    return !!this.def.boss;
  }

  get name(): string {
    return this.elite ? `${this.elite.prefix} ${this.def.name}` : this.def.name;
  }

  get flying(): boolean {
    return !!this.def.flying;
  }

  get targetable(): boolean {
    return !this.dead && this.state !== 'dying' && !this.airborne && this.alpha > 0.3;
  }

  get cooldownMult(): number {
    let m = this.elite?.id === 'frenzied' ? 0.7 : 1;
    if (this.def.boss) m *= this.def.boss.phases[this.phase]?.cooldownMult ?? 1;
    return m;
  }

  get speedMultPhase(): number {
    return this.def.boss ? (this.def.boss.phases[this.phase]?.speedMult ?? 1) : 1;
  }

  // ---------------------------------------------------------------- update ----
  update(dt: number, world: World): void {
    this.animT += dt;
    this.stateT += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.hpBarT = Math.max(0, this.hpBarT - dt);
    if (this.state === 'dying') {
      this.deathT += dt;
      if (this.deathT > 0.35) this.removed = true;
      return;
    }
    if (this.state === 'spawn') {
      this.alpha = Math.min(1, this.stateT / 0.4);
      if (this.stateT >= 0.4) this.setState('idle');
      return;
    }
    const dot = this.tickStatuses(dt);
    if (dot > 0) world.enemyDot(this, dot);
    if (this.dead) return;
    for (let i = 0; i < this.cooldowns.length; i++) this.cooldowns[i] -= dt;

    if (this.elite?.id === 'shielded') {
      this.shieldT += dt;
      if (this.shieldT > 8 && this.shield <= 0) {
        this.shield = this.maxHp * 0.3;
        this.shieldT = 0;
      }
    }

    if (this.frozen) {
      this.applyKnockback(dt, world, this.flying);
      return;
    }

    const p = world.player;
    const d = dist(this.x, this.y, p.x, p.y);
    this.losT -= dt;
    if (this.losT <= 0) {
      this.losT = 0.25;
      this.los = this.flying || world.map.lineOfSight(this.x, this.y - 4, p.x, p.y - 4);
    }
    const playerAlive = p.state !== 'dead';

    let mvx = 0;
    let mvy = 0;
    const spd = this.speed * this.speedMult * this.speedMultPhase;

    switch (this.state) {
      case 'idle': {
        if (!this.isBoss) {
          this.wanderT -= dt;
          if (this.wanderT <= 0) {
            this.wanderT = rng.range(1.5, 4);
            const a = rng.range(0, TAU);
            const r = rng.range(0, 28);
            this.wx = this.homeX + Math.cos(a) * r;
            this.wy = this.homeY + Math.sin(a) * r;
          }
          const wd = dist(this.x, this.y, this.wx, this.wy);
          if (wd > 3) {
            mvx = ((this.wx - this.x) / wd) * spd * 0.35;
            mvy = ((this.wy - this.y) / wd) * spd * 0.35;
          }
        }
        if (playerAlive && ((d < this.def.aggro && this.los) || this.aggro)) {
          this.aggro = true;
          world.alertGroup(this);
          this.setState('chase');
        }
        break;
      }
      case 'return': {
        const hd = dist(this.x, this.y, this.homeX, this.homeY);
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25 * dt);
        if (hd < 6) {
          this.aggro = false;
          this.setState('idle');
        } else {
          mvx = ((this.homeX - this.x) / hd) * spd * 1.2;
          mvy = ((this.homeY - this.y) / hd) * spd * 1.2;
        }
        break;
      }
      case 'chase': {
        if (!playerAlive) {
          this.setState('return');
          break;
        }
        const homeD = dist(this.x, this.y, this.homeX, this.homeY);
        if (!this.isBoss && !this.summoned && homeD > 380 && d > 160) {
          this.setState('return');
          break;
        }
        this.aim = angleTo(this.x, this.y, p.x, p.y);
        const mv = this.chaseMove(dt, world, d, spd);
        mvx = mv.x;
        mvy = mv.y;
        const atk = this.pickAttack(world, d);
        if (atk) this.startAttack(world, atk);
        break;
      }
      case 'windup': {
        const a = this.current!;
        // track the player during the first 60% so late dodges are rewarded
        if (this.stateT < a.windup * 0.6 && a.type !== 'teleport') {
          this.aim = angleTo(this.x, this.y, p.x, p.y);
          this.tx = p.x;
          this.ty = p.y;
        }
        if (a.type === 'teleport') this.alpha = 1 - clamp(this.stateT / a.windup, 0, 1);
        if (this.stateT >= a.windup) this.execute(world, a);
        break;
      }
      case 'attack': {
        const r = this.updateAttack(dt, world);
        mvx = r.x;
        mvy = r.y;
        break;
      }
      case 'recover': {
        if (this.stateT >= (this.current?.recover ?? 0.4)) {
          if (this.repeatsLeft > 0 && this.current) {
            this.repeatsLeft--;
            this.setState('windup');
            this.stateT = this.current.windup * 0.45;
          } else {
            this.current = null;
            this.releaseToken(world);
            this.setState('chase');
          }
        }
        break;
      }
    }

    // elite: blazing trail
    if (this.elite?.id === 'blazing' && Math.hypot(mvx, mvy) > 1) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.5;
        world.enemyHazard(this, {
          shape: 'circle',
          x: this.x,
          y: this.y,
          radius: 10,
          delay: 0.2,
          duration: 2.5,
          mult: 0.25,
          status: { kind: 'burn', duration: 2, power: 0.15 },
          color: '#f77622',
          tick: 0.5,
        });
      }
    }

    if (this.state !== 'attack' || !this.current || !['lunge', 'charge'].includes(this.current.type)) {
      this.vx += (mvx - this.vx) * Math.min(1, 12 * dt);
      this.vy += (mvy - this.vy) * Math.min(1, 12 * dt);
    }
    if (this.def.speed > 0 || this.state === 'attack')
      world.moveActor(this, this.vx * dt, this.vy * dt, this.flying);
    this.applyKnockback(dt, world, this.flying);
    if (Math.abs(this.vx) > 3) this.facing = this.vx < 0 ? 'left' : 'right';
    if (this.state === 'windup' || this.state === 'attack')
      this.facing = Math.cos(this.aim) < 0 ? 'left' : 'right';
    // hopping arc
    if (this.def.behavior === 'hopper' && this.state !== 'attack') this.z = Math.max(0, this.z - 60 * dt);
  }

  private chaseMove(dt: number, world: World, d: number, spd: number): { x: number; y: number } {
    const p = world.player;
    const toward = world.steer(this, p.x, p.y, this.los);
    const b = this.def.behavior;
    const perp = { x: -toward.y * this.strafeDir, y: toward.x * this.strafeDir };
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = rng.range(1.2, 2.8);
      if (rng.chance(0.4)) this.strafeDir *= -1;
    }
    const minRange = Math.min(...this.def.attacks.map((a) => a.range));
    switch (b) {
      case 'turret':
        return { x: 0, y: 0 };
      case 'ranged':
      case 'caster': {
        const keep = this.def.keepAway ?? 90;
        if (d < keep * 0.7) return { x: -toward.x * spd, y: -toward.y * spd };
        if (d > keep * 1.25 || !this.los) return { x: toward.x * spd, y: toward.y * spd };
        return { x: perp.x * spd * 0.6, y: perp.y * spd * 0.6 };
      }
      case 'hopper': {
        this.hopT -= dt;
        if (this.hopT <= 0) {
          this.hopT = rng.range(0.6, 1.1);
          this.z = 6;
          return { x: toward.x * spd * 3, y: toward.y * spd * 3 };
        }
        return { x: this.vx * 0.9, y: this.vy * 0.9 };
      }
      case 'flyer': {
        const wob = Math.sin(this.animT * 3) * 0.8;
        return { x: (toward.x + perp.x * wob) * spd, y: (toward.y + perp.y * wob) * spd };
      }
      case 'boss': {
        const want = this.def.speed > 0 ? 60 : 0;
        if (d > want + 20) return { x: toward.x * spd, y: toward.y * spd };
        return { x: perp.x * spd * 0.5, y: perp.y * spd * 0.5 };
      }
      default: {
        // melee & kamikaze: approach, but orbit if no attack token is free
        const crowded = !world.tokenAvailable() && !this.hasToken && d < 70;
        if (crowded)
          return {
            x: (perp.x * 0.8 - toward.x * 0.2) * spd * 0.7,
            y: (perp.y * 0.8 - toward.y * 0.2) * spd * 0.7,
          };
        if (d > minRange * 0.6 + this.radius) return { x: toward.x * spd, y: toward.y * spd };
        return { x: perp.x * spd * 0.3, y: perp.y * spd * 0.3 };
      }
    }
  }

  private pickAttack(world: World, d: number): AttackDef | null {
    const options: [number, number][] = [];
    this.def.attacks.forEach((a, i) => {
      if (this.cooldowns[i] > 0) return;
      if (d > a.range || d < (a.minRange ?? 0)) return;
      if (a.phase !== undefined && this.phase < a.phase) return;
      if (a.maxPhase !== undefined && this.phase >= a.maxPhase) return;
      if (a.type === 'summon' && world.countSummons(this) >= a.max) return;
      if (!this.los && !['teleport', 'summon', 'aoe', 'ring', 'spiral', 'dive'].includes(a.type)) return;
      options.push([i, a.weight ?? 1]);
    });
    if (!options.length) return null;
    if (!this.isBoss && !this.hasToken) {
      if (!world.takeToken()) return null;
      this.hasToken = true;
    }
    const idx = rng.weighted(options);
    return this.def.attacks[idx];
  }

  private startAttack(world: World, a: AttackDef): void {
    const idx = this.def.attacks.indexOf(a);
    this.cooldowns[idx] = a.cooldown * this.cooldownMult;
    this.current = a;
    this.repeatsLeft = 'repeat' in a && a.repeat ? a.repeat - 1 : 0;
    this.tx = world.player.x;
    this.ty = world.player.y;
    this.vx = this.vy = 0;
    this.setState('windup');
    if (a.shout) world.bossShout(a.shout);
    if (['nova', 'line', 'charge', 'cone', 'beam', 'dive'].includes(a.type) || this.isBoss)
      audio.playSfx('telegraph', { volume: 0.5 });
    if (a.type === 'shoot' || a.type === 'ring' || a.type === 'spiral')
      audio.playSfx('charge_up', { volume: 0.35 });
  }

  private setState(s: EState): void {
    this.state = s;
    this.stateT = 0;
  }

  releaseToken(world: World): void {
    if (this.hasToken) {
      this.hasToken = false;
      world.returnToken();
    }
  }

  /** End of wind-up: the attack happens. */
  private execute(world: World, a: AttackDef): void {
    const p = world.player;
    if (a.sfx) audio.playSfx(a.sfx);
    this.hitPlayer = false;
    switch (a.type) {
      case 'melee': {
        world.enemySlash(this, this.aim, a.arc, a.reach);
        if (world.playerInSector(this.x, this.y, a.reach, this.aim, a.arc / 2))
          world.hitPlayerFrom(this, a.dmg, this.aim, 110, a.status);
        this.setState('recover');
        break;
      }
      case 'lunge':
      case 'charge': {
        const sp = a.speed * this.speedMultPhase;
        this.aim = angleTo(this.x, this.y, this.tx, this.ty);
        this.vx = Math.cos(this.aim) * sp;
        this.vy = Math.sin(this.aim) * sp;
        this.setState('attack');
        break;
      }
      case 'shoot': {
        this.bursts = (a.bursts ?? 1) - 1;
        this.burstT = a.burstDelay ?? 0.3;
        this.fireVolley(world, a);
        if (this.bursts > 0) this.setState('attack');
        else this.setState('recover');
        break;
      }
      case 'ring': {
        this.bursts = (a.waves ?? 1) - 1;
        this.burstT = a.waveDelay ?? 0.4;
        this.spin = rng.range(0, TAU);
        this.fireRing(world, a);
        if (this.bursts > 0) this.setState('attack');
        else this.setState('recover');
        break;
      }
      case 'spiral': {
        this.shots = a.shots;
        this.burstT = 0;
        this.spin = this.aim;
        this.setState('attack');
        break;
      }
      case 'nova': {
        world.novaEffect(this.x, this.y - 4, a.radius, this.def.element);
        if (dist(this.x, this.y, p.x, p.y) < a.radius + p.radius)
          world.hitPlayerFrom(this, a.dmg, angleTo(this.x, this.y, p.x, p.y), 150, a.status);
        if (a.selfDestruct) {
          world.killEnemy(this, false);
          return;
        }
        world.shake(3, 0.2);
        this.setState('recover');
        break;
      }
      case 'aoe': {
        world.spawnAoe(this, a);
        this.setState('recover');
        break;
      }
      case 'line': {
        const ex = this.x + Math.cos(this.aim) * a.length;
        const ey = this.y + Math.sin(this.aim) * a.length;
        world.lineEffect(this.x, this.y, ex, ey, a.width, this.def.element);
        if (world.playerOnLine(this.x, this.y, ex, ey, a.width / 2))
          world.hitPlayerFrom(this, a.dmg, this.aim, 140, a.status);
        world.shake(4, 0.25);
        this.setState('recover');
        break;
      }
      case 'cone':
      case 'beam': {
        this.spin = this.aim - ('sweep' in a && a.sweep ? a.sweep / 2 : 0) * (rng.chance(0.5) ? 1 : -1);
        this.strafeDir = this.spin < this.aim ? 1 : -1;
        this.tickT = 0;
        this.setState('attack');
        break;
      }
      case 'summon': {
        world.summon(this, a.enemy, a.count);
        this.setState('recover');
        break;
      }
      case 'teleport': {
        world.teleportEnemy(this, a.near);
        this.alpha = 1;
        audio.playSfx('teleport');
        if (a.novaRadius) {
          world.enemyHazard(this, {
            shape: 'circle',
            x: this.x,
            y: this.y,
            radius: a.novaRadius,
            delay: 0.55,
            duration: 0,
            mult: a.dmg,
            status: a.status,
            color: '#b55088',
          });
        }
        this.setState('recover');
        break;
      }
      case 'dive': {
        this.airborne = true;
        audio.playSfx('fire_breath', { volume: 0.4 });
        this.setState('attack');
        break;
      }
    }
  }

  private fireVolley(world: World, a: Extract<AttackDef, { type: 'shoot' }>): void {
    const p = world.player;
    const base =
      angleTo(this.x, this.y - 6, p.x, p.y - 6) + (a.aimJitter ? rng.range(-a.aimJitter, a.aimJitter) : 0);
    for (let i = 0; i < a.count; i++) {
      const off = a.count > 1 ? -a.spread / 2 + (a.spread * i) / (a.count - 1) : 0;
      world.enemyProjectile(this, a.proj, this.x, this.y - 8 * this.scale, base + off, a.dmg);
    }
  }

  private fireRing(world: World, a: Extract<AttackDef, { type: 'ring' }>): void {
    for (let i = 0; i < a.count; i++) {
      world.enemyProjectile(
        this,
        a.proj,
        this.x,
        this.y - 8 * this.scale,
        this.spin + (i / a.count) * TAU,
        a.dmg,
      );
    }
    this.spin += a.rotate ?? 0;
  }

  /** Continuous attacks. Returns desired velocity. */
  private updateAttack(dt: number, world: World): { x: number; y: number } {
    const a = this.current!;
    const p = world.player;
    switch (a.type) {
      case 'lunge':
      case 'charge': {
        const dur = a.type === 'lunge' ? a.duration : a.length / a.speed;
        if (!this.hitPlayer && dist(this.x, this.y, p.x, p.y) < this.radius + p.radius + 3) {
          this.hitPlayer = true;
          world.hitPlayerFrom(this, a.dmg, this.aim, 160, a.status);
        }
        if (a.type === 'charge' && Math.floor(this.stateT / 0.04) !== Math.floor((this.stateT - dt) / 0.04)) {
          world.particles.emit(this.x, this.y, {
            count: 2,
            color: world.dustColor,
            speed: [10, 30],
            life: [0.2, 0.4],
          });
        }
        const blocked = Math.hypot(this.vx, this.vy) < 5;
        if (this.stateT >= dur || blocked) {
          if (a.type === 'charge') world.shake(3, 0.2);
          this.vx *= 0.2;
          this.vy *= 0.2;
          this.setState('recover');
        }
        return { x: this.vx, y: this.vy };
      }
      case 'shoot': {
        this.burstT -= dt;
        if (this.burstT <= 0 && this.bursts > 0) {
          this.bursts--;
          this.burstT = a.burstDelay ?? 0.3;
          if (a.sfx) audio.playSfx(a.sfx, { volume: 0.6 });
          this.fireVolley(world, a);
        }
        if (this.bursts <= 0 && this.burstT <= 0) this.setState('recover');
        return { x: 0, y: 0 };
      }
      case 'ring': {
        this.burstT -= dt;
        if (this.burstT <= 0 && this.bursts > 0) {
          this.bursts--;
          this.burstT = a.waveDelay ?? 0.4;
          this.fireRing(world, a);
        }
        if (this.bursts <= 0 && this.burstT <= 0) this.setState('recover');
        return { x: 0, y: 0 };
      }
      case 'spiral': {
        this.burstT -= dt;
        while (this.burstT <= 0 && this.shots > 0) {
          this.burstT += a.interval;
          this.shots--;
          for (let i = 0; i < a.arms; i++) {
            world.enemyProjectile(
              this,
              a.proj,
              this.x,
              this.y - 8 * this.scale,
              this.spin + (i / a.arms) * TAU,
              a.dmg,
            );
          }
          this.spin += a.turn;
        }
        if (this.shots <= 0) this.setState('recover');
        return { x: 0, y: 0 };
      }
      case 'cone':
      case 'beam': {
        const k = this.stateT / a.duration;
        const sweep = a.sweep ?? 0;
        const angle = this.spin + this.strafeDir * sweep * k;
        this.aim = angle;
        this.tickT -= dt;
        if (a.type === 'cone') {
          for (let i = 0; i < 3; i++) {
            const pa = angle + rng.range(-a.arc / 2, a.arc / 2);
            world.particles.emit(this.x + Math.cos(angle) * 12, this.y - 10 + Math.sin(angle) * 12, {
              count: 1,
              angle: pa,
              spread: 0.1,
              speed: [a.length * 1.6, a.length * 2.2],
              color: ['#feae34', '#f77622', '#e43b44', '#fee761'],
              life: [0.35, 0.55],
              size: [2, 4],
              drag: 1.5,
              emissive: true,
              shape: 'glow',
            });
          }
          if (this.tickT <= 0) {
            this.tickT = 0.18;
            if (world.playerInSector(this.x, this.y, a.length, angle, a.arc / 2))
              world.hitPlayerFrom(this, a.dmg, angle, 60, a.status);
          }
        } else {
          const ex = this.x + Math.cos(angle) * a.length;
          const ey = this.y + Math.sin(angle) * a.length;
          world.beamEffect(this.x, this.y - 10, ex, ey, a.width);
          if (this.tickT <= 0) {
            this.tickT = 0.15;
            if (world.playerOnLine(this.x, this.y, ex, ey, a.width / 2))
              world.hitPlayerFrom(this, a.dmg, angle, 60, a.status);
          }
        }
        if (this.stateT >= a.duration) this.setState('recover');
        return { x: 0, y: 0 };
      }
      case 'dive': {
        const up = 0.45;
        const down = 0.45;
        const air = a.airTime;
        if (this.stateT < up) {
          this.z = (this.stateT / up) * 140;
          this.alpha = 1 - this.stateT / up;
        } else if (this.stateT < up + air) {
          // shadow tracks the player
          this.tx += (p.x - this.tx) * Math.min(1, 3 * dt);
          this.ty += (p.y - this.ty) * Math.min(1, 3 * dt);
          this.x = this.tx;
          this.y = this.ty;
          this.z = 140;
          this.alpha = 0;
        } else if (this.stateT < up + air + down) {
          const k = (this.stateT - up - air) / down;
          this.z = 140 * (1 - k * k);
          this.alpha = k;
        } else {
          this.z = 0;
          this.alpha = 1;
          this.airborne = false;
          world.novaEffect(this.x, this.y, a.radius, 'fire');
          world.shake(7, 0.4);
          audio.playSfx('slam');
          if (dist(this.x, this.y, p.x, p.y) < a.radius + p.radius)
            world.hitPlayerFrom(this, a.dmg, angleTo(this.x, this.y, p.x, p.y), 200, a.status);
          this.setState('recover');
        }
        return { x: 0, y: 0 };
      }
      default:
        this.setState('recover');
        return { x: 0, y: 0 };
    }
  }

  /** Called by the world when damaged. */
  onHurt(dir: number, knock: number): void {
    this.flash = 0.1;
    this.hpBarT = 4;
    if (!this.aggro) this.aggro = true;
    const resist = this.def.mass;
    const k = knock * (1 - resist) * (this.state === 'windup' || this.state === 'attack' ? 0.3 : 1);
    this.kx += Math.cos(dir) * k;
    this.ky += Math.sin(dir) * k;
    if (this.state === 'idle' || this.state === 'return') this.setState('chase');
  }

  /** Should a hit from this direction be blocked by a shield? */
  guards(fromAngle: number): boolean {
    if (!this.def.guard || this.state === 'windup' || this.state === 'attack' || this.frozen) return false;
    const facingAngle = this.facing === 'left' ? Math.PI : 0;
    const incoming = fromAngle + Math.PI;
    return Math.abs(Math.atan2(Math.sin(incoming - facingAngle), Math.cos(incoming - facingAngle))) < 0.9;
  }

  die(): void {
    this.dead = true;
    this.state = 'dying';
    this.stateT = 0;
    this.deathT = 0;
  }

  // ---------------------------------------------------------------- render ----
  private animFor(): { anim: AnimName; frame: number } {
    const info = spriteInfo(this.def.sprite);
    const pick = (a: AnimName): AnimName =>
      info.anims[a] ? a : info.anims.idle ? 'idle' : (Object.keys(info.anims)[0] as AnimName);
    const frameOf = (a: AnimName): number => {
      const ai = info.anims[a];
      return ai ? Math.floor(this.animT * ai.fps) % ai.frames : 0;
    };
    if (this.state === 'windup' || this.state === 'attack') {
      const a = this.current;
      const castLike = a && ['shoot', 'ring', 'spiral', 'aoe', 'summon', 'teleport'].includes(a.type);
      const special =
        a && ['cone', 'beam', 'dive', 'charge', 'nova', 'line'].includes(a.type) && info.anims.special;
      if (special) {
        const anim = pick('special');
        return { anim, frame: this.state === 'windup' ? 0 : frameOf(anim) };
      }
      if (castLike && info.anims.cast) return { anim: 'cast', frame: frameOf('cast') };
      const anim = pick('attack');
      return { anim, frame: this.state === 'windup' ? 0 : Math.min(1, (info.anims[anim]?.frames ?? 1) - 1) };
    }
    if (this.flash > 0.05 && info.anims.hurt) return { anim: 'hurt', frame: 0 };
    const moving = Math.hypot(this.vx, this.vy) > 4;
    if (moving) {
      const anim = pick(info.anims.move ? 'move' : 'walk');
      return { anim, frame: frameOf(anim) };
    }
    return { anim: pick('idle'), frame: frameOf(pick('idle')) };
  }

  frame(): HTMLCanvasElement {
    const info = spriteInfo(this.def.sprite);
    const { anim, frame } = this.animFor();
    const dir: Dir =
      info.dirs === 4
        ? Math.abs(Math.cos(this.aim)) > 0.7
          ? this.facing
          : Math.sin(this.aim) > 0
            ? 'down'
            : 'up'
        : this.facing;
    return getSprite(this.def.sprite, anim, frame, dir);
  }

  render(ctx: CanvasRenderingContext2D, camX: number, camY: number, _world: World): void {
    const info = spriteInfo(this.def.sprite);
    const img = this.frame();
    const s = this.scale;
    let sx = s;
    let sy = s;
    // squash & stretch
    if (this.state === 'windup') {
      const k = Math.min(1, this.stateT / Math.max(0.1, this.current?.windup ?? 0.5));
      sx *= 1 + 0.08 * k;
      sy *= 1 - 0.06 * k;
    }
    if (this.state === 'dying') {
      const k = this.deathT / 0.35;
      sx *= 1 + k * 0.4;
      sy *= 1 - k * 0.6;
    }
    if (this.def.behavior === 'hopper' && this.z > 0) {
      sx *= 0.9;
      sy *= 1.12;
    }
    const w = img.width * sx;
    const h = img.height * sy;
    const x = Math.round(this.x - camX - info.anchorX * sx);
    const bobZ = this.flying && !this.airborne ? Math.round(Math.sin(this.animT * 4) * 1.5) : 0;
    const y = Math.round(this.y - camY - info.anchorY * sy - this.z - bobZ);
    ctx.globalAlpha = this.alpha * (this.state === 'dying' ? 1 - this.deathT / 0.35 : 1);
    // elite aura outline
    if (this.elite) {
      const sil = silhouette(img, this.elite.color);
      const pulse = 0.55 + Math.sin(this.animT * 6) * 0.25;
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * pulse;
      for (const [ox, oy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        ctx.drawImage(sil, x + ox, y + oy, w, h);
      }
      ctx.globalAlpha = prev;
    }
    ctx.drawImage(img, x, y, w, h);
    // telegraph blink
    if (this.state === 'windup' && Math.floor(this.stateT * 12) % 2 === 0) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * 0.55;
      ctx.drawImage(silhouette(img, '#ff0044'), x, y, w, h);
      ctx.globalAlpha = prev;
    }
    if (this.flash > 0) ctx.drawImage(silhouette(img, '#ffffff'), x, y, w, h);
    if (this.frozen) {
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * 0.55;
      ctx.drawImage(silhouette(img, '#2ce8f5'), x, y, w, h);
      ctx.globalAlpha = prev;
    }
    if (this.shield > 0) {
      ctx.strokeStyle = '#2ce8f5';
      ctx.globalAlpha = 0.5 + Math.sin(this.animT * 8) * 0.2;
      ctx.beginPath();
      ctx.arc(
        Math.round(this.x - camX) + 0.5,
        Math.round(this.y - camY - h / 2) + 0.5,
        Math.max(w, h) * 0.6,
        0,
        TAU,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

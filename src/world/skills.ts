/** Active skill implementations for the hero. */
import { audio } from '../audio';
import type { ProjectileSpec } from '../data/enemies';
import { bloodRiteBonus, bloodRiteDuration, SKILLS, skillMult, type SkillId } from '../data/skills';
import { angleDiff, angleTo, dist } from '../engine/math';
import type { Enemy } from './entities/enemy';
import type { Player } from './entities/player';
import type { World } from './world';

export function castSkill(world: World, p: Player, id: SkillId, rank: number): void {
  const def = SKILLS[id];
  const mult = skillMult(def, rank);
  switch (id) {
    case 'slash': {
      p.state = 'dash';
      p.stateT = 0;
      p.dash = { t: 0, dur: 0.2, angle: p.aim, speed: 360, hit: new Set(), mult };
      audio.playSfx('dash_slash');
      world.addSlash(p, p.aim, 1.2, 30, 3, p.weaponKind);
      world.shake(2, 0.15);
      break;
    }
    case 'whirlwind': {
      p.state = 'free';
      p.whirl = { t: 0.8, tick: 0, mult };
      break;
    }
    case 'fireball': {
      const spec: ProjectileSpec = {
        sprite: 'proj_fireball',
        speed: 230,
        radius: 5,
        dmg: 0,
        life: 1.2,
        scale: 1.3,
        explode: { radius: 32, dmg: mult, status: { kind: 'burn', duration: 3, power: 0.3 } },
      };
      world.spawnPlayerProjectile(
        spec,
        p.x + Math.cos(p.aim) * 8,
        p.y - 8 + Math.sin(p.aim) * 8,
        p.aim,
        0,
        'mag',
      );
      audio.playSfx('fireball');
      break;
    }
    case 'frostnova': {
      audio.playSfx('frost_nova');
      const freeze = 1.5 + 0.2 * (rank - 1);
      world.novaEffect(p.x, p.y - 4, 64, 'ice');
      for (const e of world.enemiesNear(p.x, p.y, 64 + 16)) {
        if (dist(p.x, p.y, e.x, e.y) > 64 + e.radius) continue;
        world.playerHit(e, {
          power: 'mag',
          mult,
          knock: 60,
          dir: angleTo(p.x, p.y, e.x, e.y),
          isSkill: true,
          status: { kind: 'freeze', duration: freeze },
        });
      }
      world.shake(3, 0.2);
      break;
    }
    case 'heal': {
      const st = world.game.stats();
      p.hot = { t: 3, perSec: (st.maxHp * mult) / 3 };
      p.clearStatuses();
      audio.playSfx('heal');
      world.particles.emit(p.x, p.y - 8, {
        count: 30,
        color: ['#63c74d', '#fee761', '#ffffff'],
        speed: [10, 40],
        vz: [20, 60],
        gravity: -10,
        life: [0.6, 1.2],
        emissive: true,
        shape: 'glow',
        jitter: 8,
      });
      world.popText(p.x, p.y - 26, 'Healing Light', '#63c74d', { small: true });
      break;
    }
    case 'lightning': {
      audio.playSfx('lightning');
      const max = 3 + rank + world.game.stats().passives.chains;
      const hit: Enemy[] = [];
      let fromX = p.x;
      let fromY = p.y - 10;
      const pts: { x: number; y: number }[] = [{ x: fromX, y: fromY }];
      // first target: favour the aim cone
      let target: Enemy | null = null;
      let best = Infinity;
      for (const e of world.enemiesNear(p.x, p.y, 160)) {
        if (!e.targetable) continue;
        const da = Math.abs(angleDiff(p.aim, angleTo(p.x, p.y, e.x, e.y)));
        const score = dist(p.x, p.y, e.x, e.y) + da * 80;
        if (score < best) {
          best = score;
          target = e;
        }
      }
      while (target && hit.length < max) {
        hit.push(target);
        pts.push({ x: target.x, y: target.y - 6 });
        world.playerHit(target, {
          power: 'mag',
          mult,
          knock: 30,
          dir: angleTo(fromX, fromY, target.x, target.y),
          isSkill: true,
        });
        fromX = target.x;
        fromY = target.y - 6;
        let next: Enemy | null = null;
        let nd = 95;
        for (const e of world.enemiesNear(fromX, fromY, 95)) {
          if (hit.includes(e) || !e.targetable) continue;
          const d = dist(fromX, fromY, e.x, e.y);
          if (d < nd) {
            nd = d;
            next = e;
          }
        }
        target = next;
      }
      if (pts.length === 1) pts.push({ x: p.x + Math.cos(p.aim) * 90, y: p.y - 10 + Math.sin(p.aim) * 90 });
      world.addLightning(pts);
      break;
    }
    case 'blades': {
      audio.playSfx('blades');
      p.blades = { t: 7, count: 3 + Math.floor((rank - 1) / 2), angle: 0, mult, hitCd: new Map() };
      break;
    }
    case 'meteor': {
      const { x: tx, y: ty } = aimPoint(world, p, 170);
      audio.playSfx('meteor_fall');
      world.playerHazard(
        {
          shape: 'circle',
          x: tx,
          y: ty,
          radius: 48,
          delay: 0.75,
          duration: 0,
          mult,
          status: { kind: 'burn', duration: 3, power: 0.35 },
          color: '#f77622',
          visual: 'meteor',
        },
        'mag',
      );
      world.meteorFall(tx, ty, 0.75);
      break;
    }
    case 'shadowstep':
      shadowStep(world, p, mult);
      break;
    case 'earthshatter': {
      audio.playSfx('hit_heavy');
      for (let i = 0; i < 6; i++) {
        const d = 22 + i * 20;
        const x = p.x + Math.cos(p.aim) * d;
        const y = p.y + Math.sin(p.aim) * d;
        if (!world.map.walkableAt(x, y, true)) break;
        world.playerHazard(
          {
            shape: 'circle',
            x,
            y,
            radius: 18,
            delay: 0.1 + i * 0.08,
            duration: 0,
            mult,
            status: { kind: 'slow', duration: 2, power: 0.5 },
            color: '#b86f50',
            visual: 'earth',
          },
          'atk',
        );
      }
      world.shake(4, 0.5);
      break;
    }
    case 'blizzard': {
      const { x, y } = aimPoint(world, p, 160);
      audio.playSfx('frost_nova');
      world.playerHazard(
        {
          shape: 'circle',
          x,
          y,
          radius: 54,
          delay: 0.35,
          duration: 4,
          tick: 0.5,
          mult,
          status: { kind: 'slow', duration: 1, power: 0.45 },
          color: '#2ce8f5',
          visual: 'ice',
        },
        'mag',
      );
      break;
    }
    case 'bloodrite': {
      const cost = Math.round(p.maxHp * (def.hpCost ?? 0.15));
      p.hp = Math.max(1, p.hp - cost);
      world.popText(p.x, p.y - 20, `-${cost}`, '#a22633');
      const buffs = world.game.buffs;
      buffs.rite = bloodRiteDuration(rank);
      buffs.riteBonus = bloodRiteBonus(rank);
      world.game.invalidateStats();
      audio.playSfx('charge_up');
      world.flashScreen('#a22633', 0.2);
      world.particles.emit(p.x, p.y - 8, {
        count: 30,
        color: ['#e43b44', '#a22633', '#ff0044'],
        speed: [20, 60],
        vz: [20, 60],
        gravity: 60,
        life: [0.5, 1],
        emissive: true,
      });
      world.popText(p.x, p.y - 30, 'Blood Rite!', '#e43b44', { small: true });
      break;
    }
  }
}

/** Where a targeted spell lands: the mouse, or the best enemy roughly in front, or ahead. */
function aimPoint(world: World, p: Player, range: number): { x: number; y: number } {
  let tx = p.x + Math.cos(p.aim) * 90;
  let ty = p.y + Math.sin(p.aim) * 90;
  if (world.input.mouseAimActive()) {
    tx = world.input.mouse.x + world.cam.rx;
    ty = world.input.mouse.y + world.cam.ry;
    const d = dist(p.x, p.y, tx, ty);
    if (d > range) {
      tx = p.x + ((tx - p.x) / d) * range;
      ty = p.y + ((ty - p.y) / d) * range;
    }
    return { x: tx, y: ty };
  }
  let best = Infinity;
  for (const e of world.enemiesNear(p.x, p.y, range)) {
    const da = Math.abs(angleDiff(p.aim, angleTo(p.x, p.y, e.x, e.y)));
    if (da > 0.8 || !e.targetable) continue;
    const s = dist(p.x, p.y, e.x, e.y) + da * 60;
    if (s < best) {
      best = s;
      tx = e.x;
      ty = e.y;
    }
  }
  return { x: tx, y: ty };
}

/** Shadow Step: blink behind the best nearby target and strike (always a crit). */
function shadowStep(world: World, p: Player, mult: number): void {
  let target: Enemy | null = null;
  let best = Infinity;
  for (const e of world.enemiesNear(p.x, p.y, 150)) {
    if (!e.targetable) continue;
    const da = Math.abs(angleDiff(p.aim, angleTo(p.x, p.y, e.x, e.y)));
    const score = dist(p.x, p.y, e.x, e.y) + da * 70;
    if (score < best) {
      best = score;
      target = e;
    }
  }
  const puff = (x: number, y: number): void =>
    world.particles.emit(x, y - 8, {
      count: 16,
      color: ['#68386c', '#b55088', '#181425'],
      speed: [10, 50],
      vz: [10, 40],
      gravity: -10,
      life: [0.3, 0.6],
      shape: 'glow',
    });
  puff(p.x, p.y);
  audio.playSfx('dash_slash', { pitch: 0.8 });
  p.invuln = Math.max(p.invuln, 0.35);
  if (!target) {
    // nothing to hit: a short blink forward
    world.moveActor(p, Math.cos(p.aim) * 60, Math.sin(p.aim) * 60);
    puff(p.x, p.y);
    return;
  }
  const a = angleTo(p.x, p.y, target.x, target.y);
  const bx = target.x + Math.cos(a) * (target.radius + 12);
  const by = target.y + Math.sin(a) * (target.radius + 12);
  if (world.map.walkableAt(bx, by) && world.map.walkableAt(bx, by - 6)) {
    p.x = bx;
    p.y = by;
  } else {
    p.x = target.x - Math.cos(a) * (target.radius + 10);
    p.y = target.y - Math.sin(a) * (target.radius + 10);
  }
  p.aim = angleTo(p.x, p.y, target.x, target.y);
  puff(p.x, p.y);
  world.addSlash(p, p.aim, 1.8, 28, 3, p.weaponKind);
  world.playerHit(target, { power: 'atk', mult, knock: 140, dir: p.aim, isSkill: true, forceCrit: true });
  world.shake(3, 0.15);
}

/** Aether Cannon: the ultimate — a Dragon Ball–style beam fired after its cut-in. */
export function fireCannon(world: World, p: Player): void {
  const shards = Math.max(1, world.shardCount());
  const total = 5 + shards * 1.2;
  const dur = 1.2;
  // aim assist: favour the boss or the nearest enemy roughly in front
  let angle = p.aim;
  const boss = world.boss && world.boss.targetable ? world.boss : null;
  const pick = boss && Math.abs(angleDiff(p.aim, angleTo(p.x, p.y, boss.x, boss.y))) < 1 ? boss : null;
  if (pick) angle = angleTo(p.x, p.y - 8, pick.x, pick.y - 8);
  else {
    let best = Infinity;
    for (const e of world.enemiesNear(p.x, p.y, 260)) {
      const a = angleTo(p.x, p.y, e.x, e.y);
      const da = Math.abs(angleDiff(p.aim, a));
      if (da > 0.7) continue;
      const score = da * 100 + dist(p.x, p.y, e.x, e.y);
      if (score < best) {
        best = score;
        angle = angleTo(p.x, p.y - 8, e.x, e.y - 8);
      }
    }
  }
  p.aim = angle;
  world.cannon = { t: 0, dur, angle, tick: 0, mult: (total * 1.3) / Math.round(dur / 0.1), hits: 0 };
  p.state = 'cast';
  p.stateT = 0;
  p.castT = dur;
  p.surgeInvuln = dur + 1;
  audio.playSfx('surge_blast');
  world.shake(7, dur);
  world.flashScreen('#ffffff', 0.25);
  world.impact(0.12);
  world.zoomAt(p.x, p.y - 8, 1.35, 0.3);
  // a close-range shockwave so the ultimate is never wasted
  world.novaEffect(p.x, p.y - 6, 56, 'arcane');
  const st = world.game.stats();
  for (const e of world.enemiesNear(p.x, p.y, 70)) {
    if (dist(p.x, p.y, e.x, e.y) > 56 + e.radius) continue;
    world.playerHit(e, {
      power: 'custom',
      customPower: (st.atk + st.mag) / 2,
      mult: 1.5,
      knock: 200,
      dir: angleTo(p.x, p.y, e.x, e.y),
      isSkill: true,
      noSurge: true,
    });
  }
}

import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { ZONES } from '../src/data/zones';
import { floodFloor, generateAbyssFloor } from '../src/world/abyss';
import { CELL, TILE, type MapData } from '../src/world/mapdata';
import { generateArena, generateZone } from '../src/world/mapgen';
import { buildTown } from '../src/world/town';

function reachable(m: MapData, sx: number, sy: number): Uint8Array {
  const seen = new Uint8Array(m.w * m.h);
  const tx = Math.floor(sx / TILE);
  const ty = Math.floor(sy / TILE);
  const q = [ty * m.w + tx];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % m.w;
    const y = (i / m.w) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const j = ny * m.w + nx;
      const c = m.cells[j];
      if (seen[j] || (c !== CELL.Floor && c !== CELL.Bridge)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

const at = (m: MapData, x: number, y: number): number => Math.floor(y / TILE) * m.w + Math.floor(x / TILE);

describe.each(Object.keys(ZONES))('zone %s', (id) => {
  const m = generateZone(ZONES[id]);

  it('is deterministic', () => {
    expect(Array.from(generateZone(ZONES[id]).cells)).toEqual(Array.from(m.cells));
  });

  it('connects the entry to every crystal, chest and the boss gate', () => {
    const seen = reachable(m, m.spawnPoints.entry.x, m.spawnPoints.entry.y);
    for (const o of m.objects) {
      if (o.kind === 'crystal' || o.kind === 'chest')
        expect(seen[at(m, o.x, o.y - 4)], `${o.kind} ${o.id}`).toBe(1);
    }
    expect(seen[at(m, m.spawnPoints.from_boss.x, m.spawnPoints.from_boss.y - 8)]).toBe(1);
  });

  it('has sensible content', () => {
    expect(m.objects.filter((o) => o.kind === 'bossGate')).toHaveLength(1);
    expect(m.objects.filter((o) => o.kind === 'crystal')).toHaveLength(2);
    expect(m.spawns.length).toBeGreaterThan(20);
    for (const s of m.spawns) {
      expect(ENEMIES[s.enemy]).toBeDefined();
      expect(s.level).toBeGreaterThanOrEqual(ZONES[id].levels[0] - 1);
      expect(s.level).toBeLessThanOrEqual(ZONES[id].levels[1] + 1);
    }
  });

  it('builds a boss arena with a boss and an exit', () => {
    const a = generateArena(id);
    expect(a.boss?.enemy).toBe(ZONES[id].boss.enemy);
    const seen = reachable(a, a.spawnPoints.entry.x, a.spawnPoints.entry.y);
    expect(seen[at(a, a.boss!.x, a.boss!.y)]).toBe(1);
  });
});

describe('town & abyss', () => {
  it('town spawn points are walkable', () => {
    const t = buildTown();
    for (const [name, p] of Object.entries(t.spawnPoints)) {
      const c = t.cells[at(t, p.x, p.y)];
      expect(c === CELL.Floor || c === CELL.Bridge, name).toBe(true);
    }
  });

  it('abyss floors scale and put bosses on every 5th floor', () => {
    const f1 = generateAbyssFloor(1);
    const f5 = generateAbyssFloor(5);
    expect(f1.spawns.length).toBeGreaterThan(0);
    expect(f5.boss).toBeDefined();
    expect(generateAbyssFloor(9).levels[0]).toBeGreaterThan(f1.levels[0]);
  });
});

describe('abyss floors', () => {
  it('keep every floor tile, enemy, boss and reward reachable from the entry', () => {
    for (let f = 1; f <= 120; f++) {
      const m = generateAbyssFloor(f);
      const e = m.spawnPoints.entry;
      const reach = floodFloor(m.cells, m.w, m.h, Math.floor(e.x / TILE), Math.floor(e.y / TILE));
      const ok = (p: { x: number; y: number }): boolean =>
        reach[Math.floor(p.y / TILE) * m.w + Math.floor(p.x / TILE)] === 1;
      for (let i = 0; i < m.w * m.h; i++) if (m.cells[i] === CELL.Floor) expect(reach[i]).toBe(1);
      for (const s of m.spawns) expect(ok(s)).toBe(true);
      expect(ok(m.spawnPoints.reward)).toBe(true);
      expect(ok(m.spawnPoints.rewardChest)).toBe(true);
      if (m.boss) expect(ok(m.boss)).toBe(true);
    }
  });

  it('puts the floor 4 portal on solid ground (it used to land in a void pool)', () => {
    const m = generateAbyssFloor(4);
    const p = m.spawnPoints.reward;
    expect(m.cells[Math.floor(p.y / TILE) * m.w + Math.floor(p.x / TILE)]).toBe(CELL.Floor);
  });
});

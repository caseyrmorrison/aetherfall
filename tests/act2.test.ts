import { describe, expect, it } from 'vitest';
import { BOSS_INTRO, BOSS_OUTRO, CUTSCENES } from '../src/data/cutscenes';
import { ENEMIES } from '../src/data/enemies';
import { NPCS } from '../src/data/npcs';
import { QUESTS } from '../src/data/quests';
import { ACT2_ZONES, hubFor, isTown, ZONES } from '../src/data/zones';
import { CELL, TILE } from '../src/world/mapdata';
import { buildSolenne } from '../src/world/solenne';

describe('Act II zones', () => {
  it('pick up where Act I leaves off and get harder in order', () => {
    let prev = 30;
    for (const id of ACT2_ZONES) {
      const z = ZONES[id];
      expect(z.levels[0]).toBe(prev);
      expect(z.levels[1]).toBeGreaterThan(z.levels[0]);
      prev = z.levels[1];
      expect(z.back.map).toBe('solenne');
      for (const [e] of z.enemies) expect(ENEMIES[e]).toBeDefined();
      expect(ENEMIES[z.boss.enemy]?.boss).toBeDefined();
      expect(hubFor(id)).toBe('solenne');
      expect(hubFor(`${id}_boss`)).toBe('solenne');
    }
    expect(prev).toBe(50);
    expect(hubFor('forest')).toBe('town');
    expect(isTown('solenne') && isTown('town') && !isTown('desert')).toBe(true);
  });
});

describe('Solenne', () => {
  const m = buildSolenne();
  const walkable = (x: number, y: number): boolean => {
    const c = m.cells[Math.floor(y / TILE) * m.w + Math.floor(x / TILE)];
    return c === CELL.Floor || c === CELL.Bridge;
  };

  it('has walkable spawn points for every road and portal', () => {
    for (const [name, p] of Object.entries(m.spawnPoints)) expect(walkable(p.x, p.y), name).toBe(true);
    for (const z of ACT2_ZONES) expect(m.spawnPoints[ZONES[z].back.spawn], z).toBeDefined();
  });

  it('connects its gates, doors and people from the plaza', () => {
    const seen = new Uint8Array(m.w * m.h);
    const s = m.spawnPoints.start;
    const stack = [Math.floor(s.y / TILE) * m.w + Math.floor(s.x / TILE)];
    seen[stack[0]] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % m.w;
      const y = (k / m.w) | 0;
      for (const n of [k - 1, k + 1, k - m.w, k + m.w]) {
        if (
          n < 0 ||
          n >= m.w * m.h ||
          seen[n] ||
          Math.abs((n % m.w) - x) > 1 ||
          Math.abs(((n / m.w) | 0) - y) > 1
        )
          continue;
        if (m.cells[n] !== CELL.Floor && m.cells[n] !== CELL.Bridge) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    const reached = (px: number, py: number): boolean => {
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++)
          if (seen[(Math.floor(py / TILE) + oy) * m.w + Math.floor(px / TILE) + ox]) return true;
      return false;
    };
    for (const o of m.objects) {
      const x = o.kind === 'warp' ? o.x + o.w / 2 : o.x;
      const y = o.kind === 'warp' ? o.y + o.h / 2 : o.y;
      expect(reached(x, y), `${o.kind} ${o.id}`).toBe(true);
    }
  });

  it('is home to the people standing in it', () => {
    for (const o of m.objects) {
      if (o.kind !== 'npc') continue;
      expect(NPCS[o.id], o.id).toBeDefined();
      expect(NPCS[o.id].home).toBe('solenne');
    }
  });
});

describe('Act II story', () => {
  const chain = ['mq2_dusk', 'mq2_sands', 'mq2_oracle', 'mq2_storm', 'mq2_eclipse'];

  it('is one chain of main quests that starts after Malachar', () => {
    expect(QUESTS.mq2_dusk.autoStart).toBe(true);
    expect(QUESTS.mq2_dusk.requires).toBe('boss_malachar_true');
    for (let i = 0; i < chain.length; i++) {
      const q = QUESTS[chain[i]];
      expect(q.main).toBe(true);
      expect(q.next).toBe(chain[i + 1]);
    }
  });

  it('only refers to people, zones, bosses and scenes that exist', () => {
    for (const q of Object.values(QUESTS)) {
      for (const o of q.objectives) {
        if (o.type === 'talk') expect(NPCS[o.npc], `${q.id} talks to ${o.npc}`).toBeDefined();
        // (a guardian's second form, like Malachar's, counts)
        if (o.type === 'boss')
          expect([ZONES[o.map]?.boss.enemy, `${ZONES[o.map]?.boss.enemy}_true`]).toContain(o.boss);
        if (o.type === 'kill') expect(ENEMIES[o.enemy], q.id).toBeDefined();
      }
      for (const c of Object.values(q.talkCutscene ?? {})) expect(CUTSCENES[c], c).toBeDefined();
    }
    for (const id of [...Object.values(BOSS_OUTRO), ...Object.values(BOSS_INTRO)])
      expect(CUTSCENES[id], id).toBeDefined();
    for (const b of ['sandmaw', 'nereth', 'voltaris', 'aurelian']) expect(BOSS_OUTRO[b]).toBeDefined();
  });
});

/**
 * Procedural zone generator. Deterministic per seed: rooms are scattered, joined by
 * a minimum spanning tree (plus a few loops) of wobbly corridors, decorated, and
 * validated for connectivity so every key location is always reachable.
 */
import type { PropId } from '../art/pixel/types';
import { ZONES, type Edge, type ZoneDef } from '../data/zones';
import { RNG } from '../engine/rng';
import {
  CELL,
  GROUND,
  TILE,
  type EnemySpawn,
  type MapData,
  type MapObject,
  type PropPlacement,
} from './mapdata';

interface Room {
  x: number;
  y: number;
  r: number;
  depth: number;
  kind: 'entry' | 'exit' | 'normal';
}

// ------------------------------------------------------------- noise ----

function valueNoise(seed: number): (x: number, y: number) => number {
  const h = (ix: number, iy: number): number => {
    let n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const a = h(ix, iy);
    const b = h(ix + 1, iy);
    const c = h(ix, iy + 1);
    const d = h(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

function fbm(noise: (x: number, y: number) => number, x: number, y: number): number {
  return noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.1;
}

// ---------------------------------------------------------- grid utils ----

class Grid {
  cells: Uint8Array;
  constructor(
    public w: number,
    public h: number,
    fill: number,
  ) {
    this.cells = new Uint8Array(w * h).fill(fill);
  }
  in(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number): number {
    return this.in(x, y) ? this.cells[y * this.w + x] : CELL.Wall;
  }
  set(x: number, y: number, v: number): void {
    if (this.in(x, y)) this.cells[y * this.w + x] = v;
  }
  walkable(x: number, y: number): boolean {
    const c = this.get(x, y);
    return c === CELL.Floor || c === CELL.Bridge;
  }
  carveDisc(cx: number, cy: number, r: number, margin: number): void {
    const r2 = r * r;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < margin || y < margin || x >= this.w - margin || y >= this.h - margin) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) this.set(x, y, CELL.Floor);
      }
    }
  }
  /** BFS distances from a start cell over walkable cells (-1 = unreachable). */
  flood(sx: number, sy: number): Int32Array {
    const dist = new Int32Array(this.w * this.h).fill(-1);
    if (!this.walkable(sx, sy)) return dist;
    const q = [sy * this.w + sx];
    dist[q[0]] = 0;
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      const x = i % this.w;
      const y = (i / this.w) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.walkable(nx, ny)) continue;
        const ni = ny * this.w + nx;
        if (dist[ni] >= 0) continue;
        dist[ni] = dist[i] + 1;
        q.push(ni);
      }
    }
    return dist;
  }
  /** Shortest path between two cells (inclusive), or []. */
  path(sx: number, sy: number, tx: number, ty: number): [number, number][] {
    const dist = this.flood(tx, ty);
    if (dist[sy * this.w + sx] < 0) return [];
    const out: [number, number][] = [[sx, sy]];
    let x = sx;
    let y = sy;
    while (!(x === tx && y === ty)) {
      let best: [number, number] | null = null;
      let bd = dist[y * this.w + x];
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.in(nx, ny)) continue;
        const d = dist[ny * this.w + nx];
        if (d >= 0 && d < bd) {
          bd = d;
          best = [nx, ny];
        }
      }
      if (!best) break;
      [x, y] = best;
      out.push(best);
    }
    return out;
  }
}

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function edgePoint(edge: Edge, w: number, h: number, rng: RNG): { x: number; y: number } {
  const jx = rng.int(-Math.floor(w / 6), Math.floor(w / 6));
  const jy = rng.int(-Math.floor(h / 6), Math.floor(h / 6));
  switch (edge) {
    case 'north':
      return { x: Math.floor(w / 2) + jx, y: 0 };
    case 'south':
      return { x: Math.floor(w / 2) + jx, y: h - 1 };
    case 'west':
      return { x: 0, y: Math.floor(h / 2) + jy };
    case 'east':
      return { x: w - 1, y: Math.floor(h / 2) + jy };
  }
}

const OPPOSITE: Record<Edge, Edge> = { north: 'south', south: 'north', east: 'west', west: 'east' };

/** Step `n` tiles inward from an edge point. */
function inward(edge: Edge, p: { x: number; y: number }, n: number): { x: number; y: number } {
  switch (edge) {
    case 'north':
      return { x: p.x, y: p.y + n };
    case 'south':
      return { x: p.x, y: p.y - n };
    case 'west':
      return { x: p.x + n, y: p.y };
    case 'east':
      return { x: p.x - n, y: p.y };
  }
}

function carveCorridor(
  g: Grid,
  rng: RNG,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
): [number, number][] {
  const len = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(len));
  const nx = -(by - ay) / (len || 1);
  const ny = (bx - ax) / (len || 1);
  const amp = Math.min(6, len / 6) * rng.range(0.4, 1);
  const freq = rng.range(0.8, 2.2);
  const phase = rng.range(0, Math.PI * 2);
  const spine: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const wob = Math.sin(t * Math.PI * freq + phase) * amp * Math.sin(t * Math.PI);
    const x = ax + (bx - ax) * t + nx * wob;
    const y = ay + (by - ay) * t + ny * wob;
    const r = width / 2 + Math.sin(t * 9 + phase) * 0.4;
    g.carveDisc(x, y, r, 2);
    spine.push([Math.round(x), Math.round(y)]);
  }
  return spine;
}

// ------------------------------------------------------------ zones ----

export function generateZone(def: ZoneDef): MapData {
  const rng = new RNG(def.seed);
  const { w, h } = def;
  const g = new Grid(w, h, CELL.Wall);
  const noise = valueNoise(RNG.hashString(def.seed));

  // Key points
  const exitEdge = OPPOSITE[def.entry];
  const entryEdge = edgePoint(def.entry, w, h, rng);
  const exitEdgeP = edgePoint(exitEdge, w, h, rng);
  // the exit room sits a little further in so its north wall can hold the boss gate

  const entryRoomC = inward(def.entry, entryEdge, 8);
  const exitRoomC = inward(exitEdge, exitEdgeP, 9);

  const rooms: Room[] = [
    { ...entryRoomC, r: 6, depth: 0, kind: 'entry' },
    { ...exitRoomC, r: 7, depth: 1, kind: 'exit' },
  ];
  const target = Math.round((w * h) / 460);
  let tries = 0;
  while (rooms.length < target + 2 && tries++ < 3000) {
    const r = rng.range(4, 8);
    const x = rng.int(6 + Math.ceil(r), w - 7 - Math.ceil(r));
    const y = rng.int(6 + Math.ceil(r), h - 7 - Math.ceil(r));
    if (rooms.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + r + 5))
      rooms.push({ x, y, r, depth: 0, kind: 'normal' });
  }

  // MST (Prim) + a few loop edges
  const edges: [number, number][] = [];
  const inTree = new Set([0]);
  while (inTree.size < rooms.length) {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (const i of inTree) {
      for (let j = 0; j < rooms.length; j++) {
        if (inTree.has(j)) continue;
        const d = Math.hypot(rooms[i].x - rooms[j].x, rooms[i].y - rooms[j].y);
        if (d < bd) {
          bd = d;
          best = [i, j];
        }
      }
    }
    if (!best) break;
    edges.push(best);
    inTree.add(best[1]);
  }
  const loops = Math.max(2, Math.floor(rooms.length / 5));
  for (let k = 0; k < loops; k++) {
    const i = rng.int(0, rooms.length - 1);
    let bj = -1;
    let bd = Infinity;
    for (let j = 0; j < rooms.length; j++) {
      if (j === i || edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
      const d = Math.hypot(rooms[i].x - rooms[j].x, rooms[i].y - rooms[j].y);
      if (d < bd) {
        bd = d;
        bj = j;
      }
    }
    if (bj >= 0 && bd < 32) edges.push([i, bj]);
  }

  // Carve rooms (noisy blobs) and corridors
  const clear = new Uint8Array(w * h); // cells to keep free of solid props
  const markClear = (x: number, y: number, r = 1): void => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (g.in(x + dx, y + dy)) clear[(y + dy) * w + x + dx] = 1;
  };
  for (const room of rooms) {
    const seed = rng.range(0, 100);
    for (let y = Math.floor(room.y - room.r - 2); y <= room.y + room.r + 2; y++) {
      for (let x = Math.floor(room.x - room.r - 2); x <= room.x + room.r + 2; x++) {
        if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) continue;
        const a = Math.atan2(y - room.y, x - room.x);
        const rr = room.r * (0.8 + 0.4 * noise(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5 + seed));
        if (Math.hypot(x - room.x, y - room.y) <= rr) g.set(x, y, CELL.Floor);
      }
    }
  }
  const spines: [number, number][][] = [];
  for (const [a, b] of edges) {
    const spine = carveCorridor(g, rng, rooms[a].x, rooms[a].y, rooms[b].x, rooms[b].y, rng.range(3, 4.6));
    spines.push(spine);
    for (const [x, y] of spine) markClear(x, y, 1);
  }
  // entry & exit connectors to the map edge
  const entrySpine = carveCorridor(g, rng, entryEdge.x, entryEdge.y, entryRoomC.x, entryRoomC.y, 4);
  for (const [x, y] of entrySpine) markClear(x, y, 2);
  // open the actual border cells for the entry
  for (let i = -2; i <= 2; i++) {
    for (let n = 0; n < 3; n++) {
      const p = inward(def.entry, entryEdge, n);
      if (def.entry === 'north' || def.entry === 'south') g.set(p.x + i, p.y, CELL.Floor);
      else g.set(p.x, p.y + i, CELL.Floor);
    }
  }
  for (const room of rooms) markClear(Math.round(room.x), Math.round(room.y), 1);

  // Smooth: remove lonely blocker cells
  for (let pass = 0; pass < 2; pass++) {
    const copy = g.cells.slice();
    for (let y = 3; y < h - 3; y++) {
      for (let x = 3; x < w - 3; x++) {
        if (copy[y * w + x] !== CELL.Wall) continue;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (copy[(y + dy) * w + x + dx] === CELL.Floor) n++;
        if (n >= 6) g.set(x, y, CELL.Floor);
      }
    }
  }

  // Room depths by BFS distance from the entry room
  const startX = Math.round(entryRoomC.x);
  const startY = Math.round(entryRoomC.y);
  const baseDist = g.flood(startX, startY);
  let maxD = 1;
  for (const room of rooms) {
    const d = baseDist[Math.round(room.y) * w + Math.round(room.x)];
    room.depth = d;
    if (d > maxD) maxD = d;
  }
  for (const room of rooms) room.depth = Math.max(0, room.depth) / maxD;

  // Liquid pools that never break connectivity
  const keyCells: [number, number][] = rooms.map((r) => [Math.round(r.x), Math.round(r.y)]);
  const reachableAll = (): boolean => {
    const d = g.flood(startX, startY);
    return keyCells.every(([x, y]) => !g.walkable(x, y) || d[y * w + x] >= 0);
  };
  for (const room of rooms) {
    if (room.kind !== 'normal' || !rng.chance(def.liquidChance)) continue;
    const px = room.x + rng.range(-room.r * 0.4, room.r * 0.4);
    const py = room.y + rng.range(-room.r * 0.4, room.r * 0.4);
    const pr = rng.range(1.8, Math.max(2, room.r * 0.6));
    const changed: number[] = [];
    for (let y = Math.floor(py - pr - 1); y <= py + pr + 1; y++) {
      for (let x = Math.floor(px - pr - 1); x <= px + pr + 1; x++) {
        if (!g.in(x, y) || g.get(x, y) !== CELL.Floor) continue;
        const a = Math.atan2(y - py, x - px);
        if (Math.hypot(x - px, y - py) <= pr * (0.75 + 0.5 * noise(Math.cos(a) + px, Math.sin(a) + py))) {
          g.set(x, y, CELL.Liquid);
          changed.push(y * w + x);
        }
      }
    }
    if (!reachableAll()) for (const i of changed) g.cells[i] = CELL.Floor;
  }

  // Force border
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) {
        const nearEntry = Math.abs(x - entryEdge.x) <= 2 && Math.abs(y - entryEdge.y) <= 2;
        if (!nearEntry) g.set(x, y, CELL.Wall);
      }
    }
  }

  // Blocker style
  for (let i = 0; i < w * h; i++) {
    if (g.cells[i] !== CELL.Wall) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (def.blocker === 'tree') g.cells[i] = CELL.Tree;
    else if (def.blocker === 'mixed' && fbm(noise, x * 0.12, y * 0.12) > 0.52) g.cells[i] = CELL.Tree;
  }
  // Boss gate: set into the north wall of the exit room so it always reads as a door facing the camera.
  const gx = Math.round(exitRoomC.x);
  let gy = Math.round(exitRoomC.y);
  while (gy > 4 && g.walkable(gx, gy - 1)) gy--;
  const gateCell = { x: gx, y: gy - 1 };
  const gateFront = { x: gx, y: gy };
  for (let dx = -2; dx <= 2; dx++) {
    g.set(gx + dx, gateCell.y, CELL.Wall);
    g.set(gx + dx, gateCell.y - 1, CELL.Wall);
    if (Math.abs(dx) <= 1) {
      g.set(gx + dx, gateFront.y, CELL.Floor);
      g.set(gx + dx, gateFront.y + 1, CELL.Floor);
    }
  }

  // Ground layer
  const ground = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (fbm(noise, x * 0.09 + 50, y * 0.09 + 50) < def.altAmount) ground[y * w + x] = GROUND.Alt;
    }
  }
  const trunk = g.path(
    inward(def.entry, entryEdge, 1).x,
    inward(def.entry, entryEdge, 1).y,
    gateFront.x,
    gateFront.y,
  );
  if (trunk.length === 0) {
    // Fallback: carve a straight connector (should be rare)
    carveCorridor(g, rng, exitRoomC.x, exitRoomC.y, gateFront.x, gateFront.y, 3);
  }
  if (def.pathTrail) {
    for (const [x, y] of trunk) {
      for (let dy = -1; dy <= 0; dy++)
        for (let dx = -1; dx <= 0; dx++)
          if (g.walkable(x + dx, y + dy)) ground[(y + dy) * w + x + dx] = GROUND.Path;
    }
  }
  for (const [x, y] of trunk) markClear(x, y, 1);

  // Objects
  const objects: MapObject[] = [];
  const props: PropPlacement[] = [];
  const spawns: EnemySpawn[] = [];
  const occupied = new Uint8Array(w * h);
  const px = (t: number): number => t * TILE + TILE / 2;
  const occupy = (x: number, y: number, r = 1): void => {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (g.in(x + dx, y + dy)) occupied[(y + dy) * w + x + dx] = 1;
  };

  const levelAt = (depth: number): number =>
    Math.round(def.levels[0] + (def.levels[1] - def.levels[0]) * depth);

  // Boss gate
  const gateX = px(gateCell.x);
  const gateY = (gateCell.y + 1) * TILE;
  props.push({ id: 'boss_gate', x: gateX, y: gateY });
  objects.push({
    kind: 'bossGate',
    id: `${def.id}_gate`,
    x: gateX,
    y: gateY,
    to: def.boss.arena,
    boss: def.boss.enemy,
  });
  occupy(gateFront.x, gateFront.y, 2);

  // Crystals
  const cA = findOpenNear(g, occupied, Math.round(entryRoomC.x) + 2, Math.round(entryRoomC.y));
  objects.push({
    kind: 'crystal',
    id: `${def.id}_crystal_a`,
    x: px(cA.x),
    y: px(cA.y) + 4,
    name: `${def.name} — Entrance`,
  });
  props.push({ id: 'save_crystal', x: px(cA.x), y: px(cA.y) + 4 });
  occupy(cA.x, cA.y, 2);
  const cB = findOpenNear(g, occupied, Math.round(exitRoomC.x) - 2, Math.round(exitRoomC.y));
  objects.push({
    kind: 'crystal',
    id: `${def.id}_crystal_b`,
    x: px(cB.x),
    y: px(cB.y) + 4,
    name: `${def.name} — Depths`,
  });
  props.push({ id: 'save_crystal', x: px(cB.x), y: px(cB.y) + 4 });
  occupy(cB.x, cB.y, 2);

  // Entry warp back to town (a strip along the edge)
  const ww = def.entry === 'north' || def.entry === 'south' ? 5 * TILE : TILE;
  const wh = def.entry === 'north' || def.entry === 'south' ? TILE : 5 * TILE;
  objects.push({
    kind: 'warp',
    id: `${def.id}_exit`,
    x: def.entry === 'east' ? entryEdge.x * TILE : def.entry === 'west' ? 0 : (entryEdge.x - 2) * TILE,
    y: def.entry === 'south' ? entryEdge.y * TILE : def.entry === 'north' ? 0 : (entryEdge.y - 2) * TILE,
    w: ww,
    h: wh,
    to: def.back.map,
    spawn: def.back.spawn,
  });
  const entrySpawn = inward(def.entry, entryEdge, 3);
  occupy(entrySpawn.x, entrySpawn.y, 3);

  // Sign near the entry
  const signP = findOpenNear(
    g,
    occupied,
    inward(def.entry, entryEdge, 5).x + 3,
    inward(def.entry, entryEdge, 5).y,
  );
  objects.push({
    kind: 'sign',
    id: `${def.id}_sign`,
    x: px(signP.x),
    y: px(signP.y) + 4,
    text: `{gold}${def.name}{/}\nRecommended level: ${def.levels[0]}–${def.levels[1]}.\nBeware — creatures grow stronger the deeper you go.`,
  });
  props.push({ id: 'sign', x: px(signP.x), y: px(signP.y) + 4 });
  occupy(signP.x, signP.y, 1);

  // Chests
  const normal = rooms.filter((r) => r.kind === 'normal');
  const sortedByDepth = [...normal].sort((a, b) => b.depth - a.depth);
  const chestRooms = rng.shuffle([...normal]).slice(0, Math.min(5, normal.length));
  const rareRoom = sortedByDepth[0];
  let ci = 0;
  for (const room of chestRooms) {
    const rare = room === rareRoom;
    const p = findOpenNear(
      g,
      occupied,
      Math.round(room.x + rng.range(-2, 2)),
      Math.round(room.y + rng.range(-2, 2)),
    );
    objects.push({
      kind: 'chest',
      id: `${def.id}_chest_${ci++}`,
      x: px(p.x),
      y: px(p.y) + 4,
      rare,
      ilvl: levelAt(room.depth) + (rare ? 1 : 0),
    });
    props.push({ id: rare ? 'chest_rare' : 'chest', x: px(p.x), y: px(p.y) + 4 });
    occupy(p.x, p.y, 1);
  }
  if (!chestRooms.includes(rareRoom) && rareRoom) {
    const p = findOpenNear(g, occupied, Math.round(rareRoom.x), Math.round(rareRoom.y));
    objects.push({
      kind: 'chest',
      id: `${def.id}_chest_${ci}`,
      x: px(p.x),
      y: px(p.y) + 4,
      rare: true,
      ilvl: levelAt(rareRoom.depth) + 1,
    });
    props.push({ id: 'chest_rare', x: px(p.x), y: px(p.y) + 4 });
    occupy(p.x, p.y, 1);
  }

  // Quest markers in mid-depth rooms
  const mid = [...normal].sort((a, b) => Math.abs(a.depth - 0.5) - Math.abs(b.depth - 0.5));
  mid.slice(0, 3).forEach((room, i) => {
    const p = findOpenNear(g, occupied, Math.round(room.x), Math.round(room.y) - 1);
    objects.push({ kind: 'marker', id: `${def.id}_marker_${i}`, x: px(p.x), y: px(p.y) });
  });

  // Enemy packs
  const packRooms = rooms.filter((r) => r.kind !== 'entry');
  let group = 0;
  for (let k = 0; k < def.packs; k++) {
    const room = packRooms[k % packRooms.length];
    const lvl = levelAt(room.depth);
    const size = rng.int(def.packSize[0], def.packSize[1]);
    const main = rng.weighted(def.enemies);
    for (let n = 0; n < size; n++) {
      const kind = rng.chance(0.7) ? main : rng.weighted(def.enemies);
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(0, room.r * 0.8);
      const tx = Math.round(room.x + Math.cos(a) * d);
      const ty = Math.round(room.y + Math.sin(a) * d);
      if (!g.walkable(tx, ty) || occupied[ty * w + tx]) continue;
      spawns.push({ enemy: kind, level: Math.max(1, lvl + rng.int(-1, 0)), x: px(tx), y: px(ty), group });
    }
    group++;
  }
  // Guaranteed champions deep in the zone
  for (const room of sortedByDepth.slice(0, 2)) {
    const p = findOpenNear(g, occupied, Math.round(room.x), Math.round(room.y));
    spawns.push({
      enemy: rng.weighted(def.enemies),
      level: levelAt(room.depth) + 1,
      x: px(p.x),
      y: px(p.y),
      elite: true,
      group: group++,
    });
  }

  // Props: decor and solids
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      if (g.cells[i] !== CELL.Floor || occupied[i]) continue;
      const onPath = ground[i] === GROUND.Path;
      if (!clear[i] && !onPath) {
        let placed = false;
        for (const [id, density] of def.solids) {
          if (rng.chance(density)) {
            // keep solids off cells that border liquid, so shores stay walkable
            props.push({ id, x: px(x) + rng.int(-2, 2), y: (y + 1) * TILE - 2 });
            occupied[i] = 1;
            placed = true;
            break;
          }
        }
        if (placed) continue;
      }
      if (onPath) continue;
      for (const [id, density] of def.decor) {
        if (rng.chance(density)) {
          props.push({ id, x: px(x) + rng.int(-4, 4), y: px(y) + rng.int(-3, 5) });
          break;
        }
      }
    }
  }
  // Wall torches for dark zones
  if (def.darkness >= 0.3) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (g.get(x, y) === CELL.Wall && g.walkable(x, y + 1) && rng.chance(0.045)) {
          props.push({ id: 'torch_wall', x: px(x), y: (y + 1) * TILE - 1 });
        }
      }
    }
  }

  const spawnPoints: Record<string, { x: number; y: number }> = {
    entry: { x: px(entrySpawn.x), y: px(entrySpawn.y) },
    from_boss: { x: px(gateFront.x), y: px(gateFront.y) + 10 },
    [`${def.id}_crystal_a`]: { x: px(cA.x), y: px(cA.y) + 14 },
    [`${def.id}_crystal_b`]: { x: px(cB.x), y: px(cB.y) + 14 },
  };

  return {
    id: def.id,
    name: def.name,
    theme: def.theme,
    levels: def.levels,
    music: def.music,
    darkness: def.darkness,
    ambient: def.ambient,
    w,
    h,
    cells: g.cells,
    ground,
    props,
    objects,
    spawns,
    spawnPoints,
    tint: def.tint,
  };
}

function findOpenNear(g: Grid, occupied: Uint8Array, x: number, y: number): { x: number; y: number } {
  for (let r = 0; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!g.walkable(nx, ny) || occupied[ny * g.w + nx]) continue;
        // want a little breathing room
        let open = 0;
        for (const [ax, ay] of DIRS4) if (g.walkable(nx + ax, ny + ay)) open++;
        if (open >= 3) return { x: nx, y: ny };
      }
    }
  }
  return { x, y };
}

// ------------------------------------------------------------ arenas ----

export function generateArena(zoneId: string): MapData {
  const def = ZONES[zoneId];
  const w = 34;
  const h = 28;
  const g = new Grid(w, h, CELL.Wall);
  const cx = 17;
  const cy = 12;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (((x - cx) / 13.5) ** 2 + ((y - cy) / 9.5) ** 2 <= 1) g.set(x, y, CELL.Floor);
    }
  }
  // entry corridor from the south
  for (let y = cy + 8; y < h; y++) for (let x = cx - 2; x <= cx + 1; x++) g.set(x, y, CELL.Floor);
  if (def.blocker === 'tree')
    for (let i = 0; i < w * h; i++) if (g.cells[i] === CELL.Wall) g.cells[i] = CELL.Tree;
  const ground = new Uint8Array(w * h);
  const noise = valueNoise(RNG.hashString(zoneId + 'arena'));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (noise(x * 0.25, y * 0.25) < 0.35) ground[y * w + x] = GROUND.Alt;

  const props: PropPlacement[] = [];
  const pillar: Record<string, PropId> = {
    forest: 'rock_big',
    cave: 'crystal_big',
    volcano: 'obsidian_spike',
    tundra: 'ice_spike',
    citadel: 'pillar',
  };
  const pid = pillar[zoneId] ?? 'rock_big';
  for (const [ox, oy] of [
    [-8, -4],
    [8, -4],
    [-8, 4],
    [8, 4],
  ]) {
    props.push({ id: pid, x: (cx + ox) * TILE + 8, y: (cy + oy + 1) * TILE - 2 });
  }
  if (def.darkness >= 0.3) {
    for (let x = 2; x < w - 2; x += 5) {
      for (let y = 1; y < h - 1; y++) {
        if (g.get(x, y) === CELL.Wall && g.walkable(x, y + 1)) {
          props.push(
            zoneId === 'citadel'
              ? { id: 'brazier', x: x * TILE + 8, y: (y + 2) * TILE - 2 }
              : { id: 'torch_wall', x: x * TILE + 8, y: (y + 1) * TILE - 1 },
          );
          break;
        }
      }
    }
  }
  const objects: MapObject[] = [
    {
      kind: 'warp',
      id: `${zoneId}_arena_exit`,
      x: (cx - 2) * TILE,
      y: (h - 1) * TILE,
      w: 4 * TILE,
      h: TILE,
      to: zoneId,
      spawn: 'from_boss',
      requires: { flag: `boss_${def.boss.enemy}`, message: 'A wall of dark energy seals the way out!' },
    },
  ];
  return {
    id: `${zoneId}_boss`,
    name: `${def.name} — Depths`,
    theme: def.theme,
    levels: [def.levels[1], def.levels[1]],
    music: def.music,
    darkness: Math.max(0, def.darkness - 0.15),
    ambient: def.ambient,
    w,
    h,
    cells: g.cells,
    ground,
    props,
    objects,
    spawns: [],
    spawnPoints: { entry: { x: cx * TILE, y: (h - 4) * TILE } },
    boss: { enemy: def.boss.enemy, x: cx * TILE, y: (cy - 3) * TILE },
    arena: true,
    tint: def.tint,
  };
}

/**
 * Self-review page for environment + icon art. Open /tools/preview-env.html on the dev server.
 */
import { TILE, getGroundTile, getLiquidTile, getWallTile, getProp, propInfo } from '../src/art/pixel/env';
import { getIcon } from '../src/art/pixel/icons';
import { hash2 } from '../src/art/pixel/core';
import type { GroundKind, IconId, PropId, Theme } from '../src/art/pixel/types';

const SCALE = Number(new URLSearchParams(location.search).get('scale') ?? 3);
/** ?crop=tx,ty,tw,th shows only part of each map (handy at high zoom). */
const CROP = (new URLSearchParams(location.search).get('crop') ?? '0,0,99,99').split(',').map(Number);
const THEMES: Theme[] = ['town', 'forest', 'cave', 'volcano', 'tundra', 'citadel', 'abyss'];
const DARK: Partial<Record<Theme, string>> = {
  cave: 'rgba(8,6,20,0.55)',
  volcano: 'rgba(20,6,10,0.35)',
  citadel: 'rgba(10,8,24,0.45)',
  abyss: 'rgba(10,4,20,0.55)',
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const root = $('root');
const opt = {
  colliders: () => $<HTMLInputElement>('colliders').checked,
  lights: () => $<HTMLInputElement>('lights').checked,
  shadows: () => $<HTMLInputElement>('shadows').checked,
  pause: () => $<HTMLInputElement>('pause').checked,
};

// ------------------------------------------------------------------- maps ---

type C = 'F' | 'A' | 'P' | 'L' | 'B' | 'W';

interface MapSpec {
  w: number;
  h: number;
  cells: C[][];
  props: [PropId, number, number][];
}

function baseMap(w: number, h: number, seed: number): C[][] {
  const cells: C[][] = [];
  for (let y = 0; y < h; y++) {
    const row: C[] = [];
    for (let x = 0; x < w; x++) {
      // noisy floorAlt patches
      const n = hash2(Math.floor(x / 3), Math.floor(y / 3), seed) * 0.6 + hash2(x, y, seed + 1) * 0.4;
      row.push(n > 0.66 ? 'A' : 'F');
    }
    cells.push(row);
  }
  return cells;
}

function themeMap(theme: Theme, seed: number): MapSpec {
  const w = 24;
  const h = 14;
  const cells = baseMap(w, h, seed);
  const set = (x: number, y: number, c: C) => {
    if (x >= 0 && y >= 0 && x < w && y < h) cells[y][x] = c;
  };
  // wall mass top-left with an irregular bottom edge
  for (let y = 0; y < 3; y++) for (let x = 0; x < 10; x++) set(x, y, 'W');
  for (let x = 0; x < 5; x++) set(x, 3, 'W');
  set(8, 3, 'W');
  set(9, 3, 'W');
  // top-right wall strip + isolated block
  for (let x = 18; x < 24; x++) set(x, 0, 'W');
  for (let x = 20; x < 24; x++) set(x, 1, 'W');
  set(21, 10, 'W');
  set(22, 10, 'W');
  set(21, 9, 'W');
  set(22, 9, 'W');
  // path
  for (let x = 0; x < w; x++) set(x, 7, 'P');
  for (let x = 0; x < 9; x++) set(x, 8, 'P');
  for (let y = 4; y < 7; y++) set(6, y, 'P');
  for (let y = 8; y < h; y++) set(19, y, 'P');
  // river + pond
  for (let y = 0; y < h; y++) {
    set(13, y, 'L');
    set(14, y, 'L');
  }
  for (let y = 9; y < 13; y++) for (let x = 11; x < 17; x++) set(x, y, 'L');
  set(12, 8, 'L');
  set(15, 3, 'L');
  set(16, 12, 'L');
  set(10, 11, 'L');
  // bridge where the path crosses
  set(13, 7, 'B');
  set(14, 7, 'B');
  // small pond
  set(2, 11, 'L');
  set(3, 11, 'L');
  set(3, 12, 'L');
  set(4, 12, 'L');
  set(2, 12, 'L');
  set(7, 11, 'L');
  return { w, h, cells, props: PROPS[theme] };
}

const PROPS: Record<Theme, [PropId, number, number][]> = {
  town: [
    ['tree_oak', 2, 5],
    ['tree_oak', 17, 3],
    ['bush', 4, 5],
    ['bush', 11, 2],
    ['flowers_red', 8, 5],
    ['flowers_yellow', 9, 6],
    ['flowers_blue', 17, 5],
    ['fence_h', 20, 5],
    ['fence_h', 21, 5],
    ['fence_h', 22, 5],
    ['fence_v', 23, 4],
    ['lamp_post', 12, 6],
    ['crate', 20, 12],
    ['barrel', 21, 12],
    ['sign', 5, 6],
    ['chest', 22, 12],
    ['well', 17, 11],
    ['hay_bale', 23, 12],
    ['rock_small', 9, 12],
    ['grass_tuft', 10, 4],
    ['reeds', 15, 13],
    ['reeds', 10, 10],
  ],
  forest: [
    ['tree_oak', 2, 5],
    ['tree_pine', 11, 3],
    ['tree_oak', 17, 3],
    ['tree_pine', 22, 4],
    ['bush', 4, 5],
    ['flowers_red', 8, 5],
    ['flowers_blue', 9, 6],
    ['flowers_yellow', 17, 5],
    ['grass_tuft', 10, 5],
    ['mushroom_cluster', 20, 5],
    ['log', 21, 12],
    ['stump', 17, 13],
    ['reeds', 10, 10],
    ['reeds', 15, 13],
    ['rock_small', 8, 13],
    ['rock_big', 5, 12],
    ['chest', 22, 13],
    ['waypoint', 23, 6],
    ['save_crystal', 18, 9],
  ],
  cave: [
    ['crystal_small', 11, 4],
    ['crystal_small', 5, 10],
    ['crystal_big', 17, 4],
    ['stalagmite', 10, 3],
    ['stalagmite', 22, 5],
    ['bones', 8, 5],
    ['rock_small', 20, 12],
    ['rock_big', 5, 12],
    ['mushroom_cluster', 18, 13],
    ['chest', 22, 13],
    ['torch_wall', 2, 3],
    ['torch_wall', 7, 2],
    ['save_crystal', 9, 12],
    ['boss_gate', 21, 3],
  ],
  volcano: [
    ['tree_dead', 2, 5],
    ['tree_dead', 17, 3],
    ['lava_rock', 10, 5],
    ['lava_rock', 20, 12],
    ['vent', 8, 12],
    ['vent', 22, 5],
    ['obsidian_spike', 11, 3],
    ['obsidian_spike', 18, 12],
    ['rock_big', 5, 11],
    ['bones', 17, 6],
    ['chest_rare', 22, 13],
    ['torch_wall', 3, 3],
    ['waypoint', 23, 8],
  ],
  tundra: [
    ['tree_snowpine', 2, 5],
    ['tree_snowpine', 11, 3],
    ['tree_snowpine', 17, 4],
    ['ice_spike', 9, 5],
    ['ice_spike', 22, 5],
    ['snow_rock', 5, 12],
    ['rock_small', 8, 13],
    ['log', 21, 12],
    ['chest', 17, 12],
    ['sign', 5, 6],
    ['save_crystal', 23, 12],
    ['torch_wall', 7, 2],
  ],
  citadel: [
    ['pillar', 11, 4],
    ['pillar', 17, 4],
    ['pillar_broken', 22, 5],
    ['brazier', 9, 5],
    ['brazier', 20, 5],
    ['banner', 3, 3],
    ['banner', 8, 2],
    ['torch_wall', 5, 2],
    ['void_crystal', 5, 12],
    ['chest_rare', 22, 13],
    ['boss_gate', 21, 1],
    ['portal', 18, 12],
    ['statue', 9, 12],
  ],
  abyss: [
    ['pillar', 11, 4],
    ['pillar_broken', 17, 4],
    ['pillar_broken', 22, 5],
    ['brazier', 9, 5],
    ['banner', 3, 3],
    ['torch_wall', 7, 2],
    ['void_crystal', 5, 12],
    ['void_crystal', 20, 12],
    ['bones', 17, 6],
    ['portal', 18, 10],
    ['chest_rare', 22, 13],
    ['boss_gate', 21, 1],
  ],
};

function townScene(): MapSpec & { theme: Theme } {
  const w = 30;
  const h = 20;
  const cells = baseMap(w, h, 77);
  const set = (x: number, y: number, c: C) => {
    if (x >= 0 && y >= 0 && x < w && y < h) cells[y][x] = c;
  };
  for (let x = 0; x < w; x++) {
    set(x, 0, 'W');
    set(x, 9, 'P');
    set(x, 10, 'P');
  }
  for (let y = 0; y < h; y++) {
    set(14, y, 'P');
    set(15, y, 'P');
  }
  for (let y = 7; y < 13; y++) for (let x = 11; x < 19; x++) set(x, y, 'P');
  for (let y = 15; y < 18; y++) for (let x = 24; x < 28; x++) set(x, y, 'L');
  set(14, 0, 'P');
  set(15, 0, 'P');
  const props: [PropId, number, number][] = [
    ['house_a', 3, 7],
    ['house_b', 8, 7],
    ['elder_house', 20, 7],
    ['inn', 26, 7],
    ['shop', 4, 16],
    ['smithy', 10, 16],
    ['fountain', 15, 11],
    ['statue', 12, 12],
    ['quest_board', 18, 12],
    ['well', 22, 15],
    ['lamp_post', 13, 8],
    ['lamp_post', 16, 8],
    ['lamp_post', 13, 13],
    ['market_stall', 19, 16],
    ['crate', 16, 15],
    ['barrel', 17, 15],
    ['barrel', 7, 12],
    ['hay_bale', 13, 18],
    ['fence_h', 24, 13],
    ['fence_h', 25, 13],
    ['fence_h', 26, 13],
    ['fence_h', 27, 13],
    ['fence_v', 28, 13],
    ['fence_v', 28, 14],
    ['fence_v', 28, 15],
    ['tree_oak', 1, 18],
    ['tree_oak', 29, 11],
    ['tree_pine', 22, 19],
    ['bush', 7, 18],
    ['flowers_red', 1, 12],
    ['flowers_yellow', 2, 12],
    ['flowers_blue', 17, 18],
    ['sign', 15, 3],
    ['chest', 20, 18],
    ['chest_rare', 21, 18],
    ['waypoint', 16, 2],
    ['save_crystal', 12, 3],
    ['reeds', 24, 18],
    ['grass_tuft', 5, 12],
  ];
  return { w, h, cells, props, theme: 'town' };
}

// -------------------------------------------------------------- rendering ---

interface View {
  spec: MapSpec;
  theme: Theme;
  canvas: HTMLCanvasElement;
}

const views: View[] = [];

function addSection(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  root.appendChild(h);
  const div = document.createElement('div');
  root.appendChild(div);
  return div;
}

function isLiq(c: C | undefined): boolean {
  return c === 'L' || c === 'B';
}

function drawMap(v: View, t: number): void {
  const { spec, theme, canvas } = v;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, -CROP[0] * TILE, -CROP[1] * TILE);
  const at = (x: number, y: number): C | undefined => spec.cells[y]?.[x];
  const lf = Math.floor(t * 4) % 4;
  for (let y = 0; y < spec.h; y++)
    for (let x = 0; x < spec.w; x++) {
      const c = at(x, y)!;
      const px = x * TILE;
      const py = y * TILE;
      const variant = Math.floor(hash2(x, y, 9) * 4);
      if (c === 'W') {
        const below = at(x, y + 1);
        const face = below !== undefined && below !== 'W';
        ctx.drawImage(getWallTile(theme, face, variant), px, py);
      } else if (isLiq(c)) {
        const liq = (xx: number, yy: number) => {
          const n = at(xx, yy);
          return n === undefined ? true : isLiq(n);
        };
        const mask =
          (liq(x, y - 1) ? 1 : 0) |
          (liq(x + 1, y) ? 2 : 0) |
          (liq(x, y + 1) ? 4 : 0) |
          (liq(x - 1, y) ? 8 : 0);
        ctx.drawImage(getLiquidTile(theme, mask, lf), px, py);
        if (c === 'B') ctx.drawImage(getGroundTile(theme, 'bridge', variant), px, py);
      } else {
        const kind: GroundKind = c === 'A' ? 'floorAlt' : c === 'P' ? 'path' : 'floor';
        ctx.drawImage(getGroundTile(theme, kind, variant), px, py);
      }
    }
  const props = spec.props
    .map(([id, tx, ty]) => ({ id, x: tx * TILE + 8, y: ty * TILE + 15 }))
    .sort((a, b) => a.y - b.y);
  // shadows
  if (opt.shadows()) {
    ctx.fillStyle = 'rgba(24,20,37,0.35)';
    for (const p of props) {
      const info = propInfo(p.id);
      if (!info.collider) continue;
      const cw = info.collider.w + 2;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - 1, cw / 2, Math.max(2, cw / 5), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const p of props) {
    const info = propInfo(p.id);
    const f = info.frames > 1 ? Math.floor(t * info.fps) % info.frames : 0;
    ctx.drawImage(getProp(p.id, f), p.x - info.anchorX, p.y - info.anchorY);
  }
  // darkness + lights
  const dark = DARK[theme];
  if (dark && opt.lights()) {
    ctx.fillStyle = dark;
    ctx.fillRect(CROP[0] * TILE, CROP[1] * TILE, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of props) {
      const info = propInfo(p.id);
      if (!info.light) continue;
      const cy = p.y - info.anchorY + info.h / 2;
      const g = ctx.createRadialGradient(p.x, cy, 0, p.x, cy, info.light.radius);
      g.addColorStop(0, info.light.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = g;
      ctx.fillRect(
        p.x - info.light.radius,
        cy - info.light.radius,
        info.light.radius * 2,
        info.light.radius * 2,
      );
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (opt.colliders()) {
    ctx.strokeStyle = '#ff0044';
    ctx.lineWidth = 1;
    for (const p of props) {
      const c = propInfo(p.id).collider;
      if (c) ctx.strokeRect(p.x + c.x + 0.5, p.y + c.y + 0.5, c.w - 1, c.h - 1);
      ctx.fillStyle = '#2ce8f5';
      ctx.fillRect(p.x, p.y, 1, 1);
    }
  }
}

function mapView(title: string, spec: MapSpec, theme: Theme): void {
  const sec = addSection(title);
  sec.dataset.theme = theme;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(spec.w - CROP[0], CROP[2]) * TILE;
  canvas.height = Math.min(spec.h - CROP[1], CROP[3]) * TILE;
  canvas.style.width = `${canvas.width * SCALE}px`;
  canvas.style.height = `${canvas.height * SCALE}px`;
  sec.appendChild(canvas);
  views.push({ spec, theme, canvas });
}

// ---------------------------------------------------------- prop sheet ----

const ALL_PROPS: PropId[] = [
  'tree_oak',
  'tree_pine',
  'tree_dead',
  'tree_snowpine',
  'bush',
  'flowers_red',
  'flowers_blue',
  'flowers_yellow',
  'grass_tuft',
  'mushroom_cluster',
  'log',
  'stump',
  'reeds',
  'rock_small',
  'rock_big',
  'crystal_small',
  'crystal_big',
  'stalagmite',
  'bones',
  'lava_rock',
  'vent',
  'obsidian_spike',
  'ice_spike',
  'snow_rock',
  'pillar',
  'pillar_broken',
  'brazier',
  'banner',
  'void_crystal',
  'house_a',
  'house_b',
  'inn',
  'shop',
  'smithy',
  'elder_house',
  'quest_board',
  'fountain',
  'well',
  'fence_h',
  'fence_v',
  'lamp_post',
  'crate',
  'barrel',
  'market_stall',
  'hay_bale',
  'statue',
  'chest',
  'chest_rare',
  'waypoint',
  'save_crystal',
  'sign',
  'boss_gate',
  'portal',
  'torch_wall',
];

const animated: { id: PropId; canvas: HTMLCanvasElement; frame: number | null }[] = [];

function propSheet(): void {
  const sec = addSection('All props (each frame; anchor = cyan dot, collider = red)');
  const row = document.createElement('div');
  row.className = 'row';
  sec.appendChild(row);
  const from = Number(new URLSearchParams(location.search).get('from') ?? 0);
  for (const id of ALL_PROPS.slice(from)) {
    const info = propInfo(id);
    const frames = Array.from({ length: info.frames }, (_, i) => i);
    for (const f of [...frames, null]) {
      if (f === null && info.frames === 1) continue;
      const cell = document.createElement('div');
      cell.className = 'cell';
      const c = document.createElement('canvas');
      c.width = info.w + 8;
      c.height = info.h + 8;
      c.style.width = `${c.width * SCALE}px`;
      c.style.height = `${c.height * SCALE}px`;
      c.style.background = '#3e5a48';
      cell.appendChild(c);
      const label = document.createElement('span');
      label.textContent = f === null ? `${id} ▶` : info.frames > 1 ? `${id} f${f}` : id;
      cell.appendChild(label);
      row.appendChild(cell);
      animated.push({ id, canvas: c, frame: f });
    }
  }
}

function drawSheet(t: number): void {
  for (const a of animated) {
    const info = propInfo(a.id);
    const ctx = a.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, a.canvas.width, a.canvas.height);
    const f = a.frame ?? Math.floor(t * info.fps) % info.frames;
    ctx.drawImage(getProp(a.id, f), 4, 4);
    if (opt.colliders()) {
      const ax = 4 + info.anchorX;
      const ay = 4 + info.anchorY;
      if (info.collider) {
        ctx.strokeStyle = '#ff0044';
        ctx.strokeRect(
          ax + info.collider.x + 0.5,
          ay + info.collider.y + 0.5,
          info.collider.w - 1,
          info.collider.h - 1,
        );
      }
      ctx.fillStyle = '#2ce8f5';
      ctx.fillRect(ax, ay, 1, 1);
    }
  }
}

// --------------------------------------------------------------- tiles ----

function tileSheet(): void {
  const sec = addSection(
    'Tiles per theme: floor×4, floorAlt×4, path×4, bridge×4 | wall cap×4, face×4 | liquid masks 0-15 (frame 0)',
  );
  for (const theme of THEMES) {
    const c = document.createElement('canvas');
    const cols = 16 + 8 + 16;
    c.width = cols * 17;
    c.height = 17;
    c.style.width = `${c.width * SCALE}px`;
    c.style.height = `${c.height * SCALE}px`;
    c.style.marginBottom = '6px';
    const ctx = c.getContext('2d')!;
    let i = 0;
    for (const k of ['floor', 'floorAlt', 'path', 'bridge'] as GroundKind[])
      for (let v = 0; v < 4; v++) ctx.drawImage(getGroundTile(theme, k, v), i++ * 17, 0);
    for (const face of [false, true])
      for (let v = 0; v < 4; v++) ctx.drawImage(getWallTile(theme, face, v), i++ * 17, 0);
    for (let m = 0; m < 16; m++) ctx.drawImage(getLiquidTile(theme, m, 0), i++ * 17, 0);
    sec.appendChild(c);
  }
}

// --------------------------------------------------------------- icons ----

const EQUIP: IconId[] = [
  'icon_sword',
  'icon_greatsword',
  'icon_dagger',
  'icon_staff',
  'icon_helm',
  'icon_armor',
  'icon_boots',
  'icon_ring',
  'icon_amulet',
];
const OTHER: IconId[] = [
  'icon_potion_hp',
  'icon_potion_mp',
  'icon_elixir',
  'icon_phoenix',
  'icon_dust',
  'icon_shard',
  'icon_key',
  'icon_gold',
  'icon_letter',
  'icon_herb',
  'icon_pelt',
  'icon_crystal',
  'icon_ember',
  'icon_frost',
  'icon_void',
  'skill_slash',
  'skill_whirlwind',
  'skill_fireball',
  'skill_frostnova',
  'skill_heal',
  'skill_lightning',
  'skill_blades',
  'skill_meteor',
  'skill_surge',
  'passive_blade',
  'passive_arcane',
  'passive_guard',
  'ui_heart',
  'ui_mana',
  'ui_coin',
  'ui_star',
  'ui_lock',
  'ui_check',
  'ui_quest',
  'ui_waypoint',
  'ui_skull',
  'ui_chest',
  'ui_save',
  'ui_sword',
  'ui_shield',
];

function iconSheet(): void {
  const sec = addSection('Icons — equipment rows = tiers 0-5 (3x and 1x)');
  const slot = 20;
  for (const scale of [SCALE, 1]) {
    const c = document.createElement('canvas');
    c.width = EQUIP.length * slot + 4;
    c.height = 6 * slot + 4;
    c.style.width = `${c.width * scale}px`;
    c.style.height = `${c.height * scale}px`;
    c.style.marginBottom = '8px';
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#262b44';
    ctx.fillRect(0, 0, c.width, c.height);
    for (let tier = 0; tier < 6; tier++)
      EQUIP.forEach((id, i) => {
        ctx.fillStyle = '#181425';
        ctx.fillRect(2 + i * slot, 2 + tier * slot, 18, 18);
        ctx.drawImage(getIcon(id, tier), 3 + i * slot, 3 + tier * slot);
      });
    sec.appendChild(c);
  }
  const perRow = 15;
  for (const scale of [SCALE, 1]) {
    const c = document.createElement('canvas');
    const rows = Math.ceil(OTHER.length / perRow);
    c.width = perRow * slot + 4;
    c.height = rows * slot + 4;
    c.style.width = `${c.width * scale}px`;
    c.style.height = `${c.height * scale}px`;
    c.style.marginBottom = '8px';
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#262b44';
    ctx.fillRect(0, 0, c.width, c.height);
    OTHER.forEach((id, i) => {
      const x = 2 + (i % perRow) * slot;
      const y = 2 + Math.floor(i / perRow) * slot;
      ctx.fillStyle = '#181425';
      ctx.fillRect(x, y, 18, 18);
      ctx.drawImage(getIcon(id), x + 1, y + 1);
    });
    sec.appendChild(c);
    if (scale === SCALE) {
      const names = document.createElement('div');
      names.style.fontSize = '10px';
      names.style.color = '#5a6988';
      names.textContent = OTHER.join('  ·  ');
      sec.appendChild(names);
    }
  }
}

// ----------------------------------------------------------------- boot ----

function boot(): void {
  const only = $<HTMLSelectElement>('only');
  for (const o of ['all', ...THEMES, 'town-scene', 'props', 'tiles', 'icons']) {
    const el = document.createElement('option');
    el.value = el.textContent = o;
    only.appendChild(el);
  }
  const want = new URLSearchParams(location.search).get('only') ?? 'all';
  only.value = want;
  only.onchange = () => {
    location.search = `?only=${only.value}&scale=${SCALE}&crop=${CROP.join(',')}`;
  };
  const show = (k: string) => want === 'all' || want === k;
  if (show('icons')) iconSheet();
  if (show('tiles')) tileSheet();
  if (show('town-scene')) {
    const t = townScene();
    mapView('Town scene', t, 'town');
  }
  THEMES.forEach((theme, i) => {
    if (show(theme)) mapView(`Theme: ${theme}`, themeMap(theme, 100 + i), theme);
  });
  if (show('props')) propSheet();

  let t = 0;
  let last = performance.now();
  let acc = 1;
  const tick = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    if (!opt.pause()) t += dt;
    acc += dt;
    if (acc > 1 / 12) {
      acc = 0;
      for (const v of views) drawMap(v, t);
      drawSheet(t);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

boot();

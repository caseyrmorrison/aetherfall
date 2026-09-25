/**
 * Self-review page for actor art: every sprite / anim / direction animated at
 * N× plus static frame strips, every weapon at every tier, and an in-game
 * scale line-up. Open http://localhost:5188/tools/preview-actors.html
 * Query params: ?group=creatures&only=slime,wolf&scale=4&bg=%233e8948
 */
import { getSprite, getWeapon, spriteInfo, weaponInfo } from '../src/art/pixel/actors';
import type { AnimName, Dir, SpriteId, WeaponKind } from '../src/art/pixel/types';

const GROUPS: Record<string, readonly SpriteId[]> = {
  characters: [
    'hero',
    'lyra',
    'elder',
    'blacksmith',
    'merchant',
    'innkeeper',
    'villager_man',
    'villager_woman',
    'child',
    'guard',
  ],
  creatures: [
    'slime',
    'slime_crystal',
    'slime_magma',
    'wolf',
    'wolf_ice',
    'mushroom',
    'goblin',
    'bat',
    'skeleton',
    'golem',
    'golem_ice',
    'fire_imp',
    'salamander',
    'ember_wisp',
    'hollow_wisp',
    'yeti',
    'frost_wraith',
    'shadow_knight',
    'void_mage',
    'gargoyle',
    'sapling',
  ],
  bosses: [
    'boss_thornmaw',
    'boss_crystal_golem',
    'boss_ignis',
    'boss_seraphine',
    'boss_malachar',
    'boss_malachar_true',
  ],
  projectiles: [
    'proj_arrow',
    'proj_fireball',
    'proj_iceshard',
    'proj_magic',
    'proj_void',
    'proj_seed',
    'proj_rock',
    'proj_snowball',
    'proj_bolt',
    'proj_crystal',
  ],
  fx: ['fx_hit', 'fx_explosion', 'fx_smoke', 'fx_sparkle', 'fx_poof'],
};
const WEAPONS: readonly WeaponKind[] = ['sword', 'greatsword', 'dagger', 'staff'];
const ANIM_ORDER: readonly AnimName[] = [
  'idle',
  'walk',
  'move',
  'attack',
  'cast',
  'hurt',
  'roll',
  'special',
  'fly',
];

const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const root = $('root');
const scaleSel = $<HTMLSelectElement>('scale');
const bgSel = $<HTMLSelectElement>('bg');
const filterInp = $<HTMLInputElement>('filter');
const stripsChk = $<HTMLInputElement>('strips');
const anchorChk = $<HTMLInputElement>('anchor');
const pauseChk = $<HTMLInputElement>('pause');

if (params.get('scale')) {
  const v = params.get('scale')!;
  if (![...scaleSel.options].some((o) => o.value === v)) scaleSel.add(new Option(v, v));
  scaleSel.value = v;
}
if (params.get('bg')) bgSel.value = params.get('bg')!;
if (params.get('only')) filterInp.value = params.get('only')!;
if (params.get('strips') === '0') stripsChk.checked = false;
if (params.get('anchor') === '1') anchorChk.checked = true;
let group = params.get('group') ?? 'all';

interface Live {
  cv: HTMLCanvasElement;
  id: SpriteId;
  anim: AnimName;
  dir: Dir;
  frames: number;
  fps: number;
  scale: number;
  last: number;
}
let live: Live[] = [];

function mkCanvas(w: number, h: number, scale: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w * scale;
  cv.height = h * scale;
  return cv;
}

function blit(cv: HTMLCanvasElement, src: HTMLCanvasElement, scale: number, anchor?: [number, number]): void {
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(src, 0, 0, src.width * scale, src.height * scale);
  if (anchor && anchorChk.checked) {
    ctx.fillStyle = '#ff0044';
    ctx.fillRect(anchor[0] * scale, anchor[1] * scale, scale, scale);
  }
}

const dirFilter = params.get('dir');
const animFilter = params.get('anim');
function dirsFor(n: 1 | 2 | 4): Dir[] {
  const all: Dir[] = n === 4 ? ['down', 'up', 'right', 'left'] : n === 2 ? ['right', 'left'] : ['down'];
  if (!dirFilter) return all;
  const f = all.filter((d) => dirFilter.split(',').includes(d));
  return f.length ? f : all.slice(0, 1);
}

function spriteCard(id: SpriteId, scale: number): HTMLElement {
  const info = spriteInfo(id);
  const card = document.createElement('div');
  card.className = 'sprite';
  const title = document.createElement('div');
  title.className = 'title';
  title.innerHTML = `${id}<span>${info.w}×${info.h} · anchor (${info.anchorX},${info.anchorY}) · dirs ${info.dirs}</span>`;
  card.appendChild(title);
  const big = info.w >= 48 ? Math.max(2, scale - 1) : scale;
  const anims = ANIM_ORDER.filter((a) => info.anims[a] && (!animFilter || animFilter.split(',').includes(a)));
  for (const anim of anims) {
    const ai = info.anims[anim]!;
    const row = document.createElement('div');
    row.className = 'anim';
    const lab = document.createElement('div');
    lab.className = 'label';
    lab.textContent = `${anim} ${ai.frames}f@${ai.fps}`;
    row.appendChild(lab);
    for (const dir of dirsFor(info.dirs)) {
      const grp = document.createElement('div');
      grp.className = 'dirgroup';
      row.appendChild(grp);
      const cell = document.createElement('div');
      cell.className = 'cell';
      const cv = mkCanvas(info.w, info.h, big);
      cell.appendChild(cv);
      const sm = document.createElement('small');
      sm.textContent = info.dirs === 1 ? '' : dir;
      cell.appendChild(sm);
      live.push({ cv, id, anim, dir, frames: ai.frames, fps: ai.fps, scale: big, last: -1 });
      grp.appendChild(cell);
      if (stripsChk.checked && ai.frames > 1) {
        const strip = document.createElement('div');
        strip.className = 'strip';
        const s = info.w >= 48 ? 1 : Math.max(2, big - 1);
        for (let f = 0; f < ai.frames; f++) {
          const fc = mkCanvas(info.w, info.h, s);
          blit(fc, getSprite(id, anim, f, dir), s, [info.anchorX, info.anchorY]);
          strip.appendChild(fc);
        }
        grp.appendChild(strip);
      }
    }
    card.appendChild(row);
  }
  return card;
}

function lineup(ids: readonly SpriteId[], scale: number): HTMLElement {
  // everything at 1x on a small "game" canvas, upscaled like the engine does
  const wrap = document.createElement('div');
  wrap.className = 'sprite lineup';
  wrap.innerHTML =
    '<div class="title">in-game scale line-up <span>1× art, nearest-neighbour upscale</span></div>';
  const GW = 240;
  const pos: { id: SpriteId; x: number; y: number }[] = [];
  let x = 6;
  let y = 4;
  let rowH = 0;
  for (const id of ids) {
    const i = spriteInfo(id);
    if (x + i.w > GW - 4 && x > 6) {
      x = 6;
      y += rowH + 8;
      rowH = 0;
    }
    pos.push({ id, x, y });
    x += i.w + 6;
    rowH = Math.max(rowH, i.h);
  }
  const game = document.createElement('canvas');
  game.width = GW;
  game.height = y + rowH + 6;
  const s = Math.max(2, Math.min(scale, 3));
  const view = mkCanvas(game.width, game.height, s);
  view.style.maxWidth = '100%';
  wrap.appendChild(view);
  const rowOf = new Map<number, number>();
  for (const p of pos) rowOf.set(p.y, Math.max(rowOf.get(p.y) ?? 0, spriteInfo(p.id).h));
  const draw = (t: number): void => {
    const g = game.getContext('2d')!;
    g.fillStyle = bgSel.value;
    g.fillRect(0, 0, game.width, game.height);
    for (const p of pos) {
      const i = spriteInfo(p.id);
      const a = (i.anims.idle ? 'idle' : i.anims.fly ? 'fly' : 'move') as AnimName;
      const ai = i.anims[a]!;
      const fr = Math.floor((t / 1000) * ai.fps) % ai.frames;
      const ground = p.y + (rowOf.get(p.y) ?? i.h);
      const free = p.id.startsWith('proj') || p.id.startsWith('fx');
      if (!free) {
        g.fillStyle = 'rgba(24,20,37,0.35)';
        g.beginPath();
        g.ellipse(p.x + i.anchorX, ground - 1, Math.max(3, i.w * 0.3), 2, 0, 0, Math.PI * 2);
        g.fill();
      }
      const spr = getSprite(p.id, a, fr, i.dirs === 2 ? 'right' : 'down');
      g.drawImage(spr, p.x, free ? ground - i.h : ground - 1 - i.anchorY);
    }
    const v = view.getContext('2d')!;
    v.imageSmoothingEnabled = false;
    v.drawImage(game, 0, 0, view.width, view.height);
  };
  lineupDrawers.push(draw);
  return wrap;
}
let lineupDrawers: ((t: number) => void)[] = [];

function weaponsSection(scale: number): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'sprite';
  const grid = document.createElement('div');
  grid.className = 'weapons';
  grid.appendChild(document.createElement('div'));
  const tierNames = ['0 wood/rust', '1 iron', '2 steel', '3 crystal', '4 ember', '5 aether'];
  for (const t of tierNames) {
    const d = document.createElement('small');
    d.textContent = t;
    d.style.color = '#8b9bb4';
    grid.appendChild(d);
  }
  for (const kind of WEAPONS) {
    const info = weaponInfo(kind);
    const lab = document.createElement('div');
    lab.textContent = `${kind} ${info.w}×${info.h} grip(${info.gripX},${info.gripY})`;
    lab.style.color = '#8b9bb4';
    grid.appendChild(lab);
    for (let tier = 0; tier <= 5; tier++) {
      const cv = mkCanvas(info.w, info.h, scale);
      blit(cv, getWeapon(kind, tier), scale, [info.gripX, info.gripY]);
      grid.appendChild(cv);
    }
  }
  sec.appendChild(grid);
  return sec;
}

function build(): void {
  root.innerHTML = '';
  live = [];
  lineupDrawers = [];
  document.body.style.setProperty('--stage', bgSel.value);
  const scale = Number(scaleSel.value) || 4;
  const only = filterInp.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const wanted = (id: string): boolean => only.length === 0 || only.some((o) => id.includes(o));
  for (const [g, ids] of Object.entries(GROUPS)) {
    if (group !== 'all' && group !== g) continue;
    const sel = ids.filter(wanted);
    if (!sel.length) continue;
    const h = document.createElement('h2');
    h.textContent = g;
    root.appendChild(h);
    if (only.length === 0) root.appendChild(lineup(sel, scale));
    for (const id of sel) root.appendChild(spriteCard(id, scale));
  }
  if (
    (group === 'all' || group === 'weapons') &&
    (only.length === 0 || only.some((o) => 'weapons'.includes(o)))
  ) {
    const h = document.createElement('h2');
    h.textContent = 'weapons';
    root.appendChild(h);
    root.appendChild(weaponsSection(scale));
  }
}

function groupButtons(): void {
  const host = $('groups');
  host.innerHTML = '';
  for (const g of ['all', ...Object.keys(GROUPS), 'weapons']) {
    const b = document.createElement('button');
    b.textContent = g;
    b.className = g === group ? 'on' : '';
    b.onclick = () => {
      group = g;
      groupButtons();
      build();
    };
    host.appendChild(b);
  }
}

let t0 = performance.now();
let paused = 0;
function tick(now: number): void {
  if (pauseChk.checked) {
    if (!paused) paused = now;
  } else if (paused) {
    t0 += now - paused;
    paused = 0;
  }
  const t = (paused || now) - t0;
  for (const l of live) {
    const f = Math.floor((t / 1000) * l.fps) % l.frames;
    if (f === l.last) continue;
    l.last = f;
    const info = spriteInfo(l.id);
    blit(l.cv, getSprite(l.id, l.anim, f, l.dir), l.scale, [info.anchorX, info.anchorY]);
  }
  for (const d of lineupDrawers) d(t);
  requestAnimationFrame(tick);
}

for (const el of [scaleSel, bgSel, stripsChk, anchorChk]) el.addEventListener('change', build);
filterInp.addEventListener('input', build);
groupButtons();
build();
requestAnimationFrame(tick);

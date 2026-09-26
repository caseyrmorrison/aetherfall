/**
 * Dev preview for the anime renderer: portraits × expressions, illustration
 * gallery (with timing), cut-ins over a dummy gameplay frame, speed lines.
 * Open http://localhost:5188/tools/preview-anime.html
 */
import { getSprite, spriteInfo } from '../src/art/pixel';
import {
  CUTIN_IDS,
  drawAura,
  EXPRESSIONS,
  ILLUSTRATION_IDS,
  PORTRAIT_IDS,
  cutInDuration,
  drawCutIn,
  drawIllustration,
  drawPortrait,
  drawSpeedLines,
  type CutInId,
  type IllustrationId,
  type PortraitId,
} from '../src/art/anime';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const params = new URLSearchParams(location.search);
let SCALE = Number(params.get('scale') ?? 3);
($('scale') as HTMLSelectElement).value = String(SCALE);
const view = params.get('view');
if (view) {
  for (const sec of ['portraits', 'illus', 'cutins']) {
    if (sec !== view) (document.getElementById(`sec-${sec}`) as HTMLElement).style.display = 'none';
  }
}
const scaled: HTMLCanvasElement[] = [];

function lowres(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.style.width = `${w * SCALE}px`;
  c.style.height = `${h * SCALE}px`;
  scaled.push(c);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function rescale(): void {
  for (const c of scaled) {
    c.style.width = `${c.width * SCALE}px`;
    c.style.height = `${c.height * SCALE}px`;
  }
}

$('scale').addEventListener('change', () => {
  SCALE = Number(($('scale') as HTMLSelectElement).value);
  rescale();
});

/* ---------------------------------------------------------------- portraits */

const pchar = $<HTMLSelectElement>('pchar');
pchar.innerHTML = ['all', ...PORTRAIT_IDS].map((id) => `<option>${id}</option>`).join('');
pchar.value = params.get('char') ?? 'all';
if (params.get('size')) $<HTMLSelectElement>('psize').value = params.get('size')!;

function cell(label: string, el: HTMLElement): HTMLElement {
  const d = document.createElement('div');
  d.className = 'cell';
  d.appendChild(el);
  const s = document.createElement('span');
  s.textContent = label;
  d.appendChild(s);
  return d;
}

function renderPortraits(): void {
  const host = $('pgrid');
  host.innerHTML = '';
  const [w, h] = $<HTMLSelectElement>('psize').value.split('x').map(Number);
  const variants = $<HTMLInputElement>('pvariants').checked;
  const bg = $<HTMLInputElement>('pbg').checked;
  const ids = pchar.value === 'all' ? PORTRAIT_IDS : [pchar.value as PortraitId];
  const t0 = performance.now();
  let count = 0;
  for (const id of ids) {
    const h3 = document.createElement('h3');
    h3.textContent = id;
    host.appendChild(h3);
    const row = document.createElement('div');
    row.className = 'row';
    host.appendChild(row);
    for (const expr of EXPRESSIONS) {
      const { c, ctx } = lowres(w, h);
      if (bg) {
        ctx.fillStyle = '#262b44';
        ctx.fillRect(0, 0, w, h);
      }
      drawPortrait(ctx, id, expr, 0, 0, w, h);
      count++;
      row.appendChild(cell(expr, c));
    }
    if (variants) {
      const row2 = document.createElement('div');
      row2.className = 'row';
      host.appendChild(row2);
      for (const [label, opts] of [
        ['talking', { talking: true }],
        ['blink', { blink: true }],
        ['flip', { flip: true }],
        ['happy talk', { talking: true }],
        ['angry talk', { talking: true }],
        ['smirk talk', { talking: true }],
        ['sad talk', { talking: true }],
        ['shout talk', { talking: true }],
      ] as const) {
        const { c, ctx } = lowres(w, h);
        if (bg) {
          ctx.fillStyle = '#262b44';
          ctx.fillRect(0, 0, w, h);
        }
        const expr = label.includes(' ') ? (label.split(' ')[0] as (typeof EXPRESSIONS)[number]) : 'neutral';
        drawPortrait(ctx, id, expr, 0, 0, w, h, opts);
        count++;
        row2.appendChild(cell(label, c));
      }
    }
  }
  $('pstat').textContent =
    `${count} portraits in ${(performance.now() - t0).toFixed(0)}ms (first render, uncached)`;
}

const lexpr = $<HTMLSelectElement>('lexpr');
lexpr.innerHTML = EXPRESSIONS.map((e) => `<option>${e}</option>`).join('');

function renderLineup(): void {
  const [w, h] = $<HTMLSelectElement>('psize').value.split('x').map(Number);
  const host = $('lineup');
  host.innerHTML = '';
  const { c, ctx } = lowres((w + 4) * PORTRAIT_IDS.length, h);
  ctx.fillStyle = '#262b44';
  ctx.fillRect(0, 0, c.width, c.height);
  PORTRAIT_IDS.forEach((id, i) => {
    drawPortrait(ctx, id, lexpr.value as (typeof EXPRESSIONS)[number], i * (w + 4), 0, w, h, {
      talking: $<HTMLInputElement>('ltalk').checked,
      blink: $<HTMLInputElement>('lblink').checked,
    });
  });
  host.appendChild(c);
}

function renderAll(): void {
  renderPortraits();
  renderLineup();
}
for (const id of ['pchar', 'psize', 'pvariants', 'pbg']) $(id).addEventListener('change', renderAll);
for (const id of ['lexpr', 'ltalk', 'lblink']) $(id).addEventListener('change', renderLineup);
renderAll();

/* ------------------------------------------------------------ illustrations */

const ishot = $<HTMLSelectElement>('ishot');
ishot.innerHTML = ILLUSTRATION_IDS.map((id) => `<option>${id}</option>`).join('');
const fromHash = params.get('shot') ?? new URLSearchParams(location.hash.slice(1)).get('shot');
if (fromHash && (ILLUSTRATION_IDS as readonly string[]).includes(fromHash)) ishot.value = fromHash;

let shotStart = performance.now();
let pausedAt = params.get('t') ? Number(params.get('t')) : -1;
if (pausedAt >= 0) ($('ipause') as HTMLInputElement).checked = true;
if (params.get('all') === '0') ($('iall') as HTMLInputElement).checked = false;
interface IView {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}
let iviews: IView[] = [];
const frameTimes: number[] = [];

function buildIllusViews(): void {
  const host = $('ihost');
  host.innerHTML = '';
  iviews = [];
  const widths = $<HTMLInputElement>('iall').checked ? [480, 400, 640] : [480];
  for (const w of widths) {
    const { c, ctx } = lowres(w, 270);
    host.appendChild(cell(`${w}x270`, c));
    iviews.push({ ctx, w, h: 270 });
  }
}
buildIllusViews();

function restart(): void {
  shotStart = performance.now();
  frameTimes.length = 0;
  if (pausedAt >= 0) pausedAt = 0;
}
$('irestart').addEventListener('click', restart);
ishot.addEventListener('change', () => {
  location.hash = `shot=${ishot.value}`;
  restart();
});
$('iprev').addEventListener('click', () => {
  ishot.selectedIndex = (ishot.selectedIndex + ILLUSTRATION_IDS.length - 1) % ILLUSTRATION_IDS.length;
  ishot.dispatchEvent(new Event('change'));
});
$('inext').addEventListener('click', () => {
  ishot.selectedIndex = (ishot.selectedIndex + 1) % ILLUSTRATION_IDS.length;
  ishot.dispatchEvent(new Event('change'));
});
$('iall').addEventListener('change', buildIllusViews);
$('ipause').addEventListener('change', () => {
  pausedAt = $<HTMLInputElement>('ipause').checked ? (performance.now() - shotStart) / 1000 : -1;
  if (pausedAt < 0) restart();
});

/** Exposed for automated checks: window.__anime.seek(t) */
(window as unknown as Record<string, unknown>).__anime = {
  seek(t: number) {
    ($('ipause') as HTMLInputElement).checked = true;
    pausedAt = t;
  },
  shot(id: IllustrationId) {
    ishot.value = id;
    restart();
  },
  timeFrames(id: IllustrationId, w = 480, n = 120) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = 270;
    const ctx = c.getContext('2d')!;
    drawIllustration(ctx, id, 0, w, 270); // warm caches
    let worst = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
      const t = i * (1 / 30);
      const t0 = performance.now();
      drawIllustration(ctx, id, t, w, 270);
      const dt = performance.now() - t0;
      worst = Math.max(worst, dt);
      total += dt;
    }
    return { avg: +(total / n).toFixed(3), worst: +worst.toFixed(3) };
  },
};

/* ----------------------------------------------------------------- cut-ins */

const cview = lowres(480, 270);
$('chost').appendChild(cell('480x270 — dummy gameplay frame', cview.c));
let cut: { id: CutInId; start: number } | null = null;
const frozenCut = params.get('cut') as CutInId | null;
const frozenT = Number(params.get('ct') ?? -1);
for (const id of CUTIN_IDS) {
  const b = document.createElement('button');
  b.textContent = `▶ ${id}`;
  b.addEventListener('click', () => {
    cut = { id, start: performance.now() };
  });
  $('cbuttons').insertBefore(b, $('cstat'));
}

function dummyGameplay(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  for (let y = 0; y < h; y += 16) {
    for (let x = 0; x < w; x += 16) {
      ctx.fillStyle = ((x >> 4) + (y >> 4)) % 2 ? '#3e8948' : '#265c42';
      ctx.fillRect(x, y, 16, 16);
    }
  }
  ctx.fillStyle = '#733e39';
  ctx.fillRect(0, 180, w, 20);
  const bob = Math.round(Math.sin(t * 4) * 2);
  ctx.fillStyle = '#0099db';
  ctx.fillRect(w / 2 - 40, 140 + bob, 12, 20);
  ctx.fillStyle = '#e43b44';
  ctx.fillRect(w / 2 + 40, 130 - bob, 24, 30);
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace';
  ctx.fillText('HP ██████', 6, 12);
}

/* ------------------------------------------------------------------- auras */

const aview = lowres(480, 170);
$('ahost').appendChild(
  cell('480x170 — back layer, sprite, front layer; aura-only columns at heights 24/40/56/72/90', aview.c),
);
const auraTimes: number[] = [];

function drawAuraDemo(t: number): void {
  const ctx = aview.ctx;
  const k = Number(($('aint') as HTMLSelectElement).value);
  ctx.fillStyle = '#193c3e';
  ctx.fillRect(0, 0, 480, 170);
  ctx.fillStyle = '#265c42';
  ctx.fillRect(0, 120, 480, 50);
  let calls = 0;
  const t0 = performance.now();
  // real sprites
  const demo: [string, 'aether' | 'void' | 'ice' | 'fire', number][] = [
    ['hero', 'aether', 40],
    ['boss_malachar', 'void', 110],
  ];
  for (const [id, pal, x] of demo) {
    try {
      const info = spriteInfo(id as never);
      const spr = getSprite(id as never, 'idle', Math.floor(t * 3) % 2, 'down');
      drawAura(ctx, x, 128, info.h, t, pal, 'back', k);
      ctx.drawImage(spr, Math.round(x - info.anchorX), Math.round(128 - info.anchorY));
      drawAura(ctx, x, 128, info.h, t, pal, 'front', k);
      calls += 2;
    } catch {
      /* sprite missing */
    }
  }
  // aura-only columns
  const pals = ['aether', 'void', 'ice', 'fire', 'aether'] as const;
  let x = 172;
  for (const [idx, hgt] of [24, 40, 56, 72, 90].entries()) {
    const pal = pals[idx];
    drawAura(ctx, x, 150, hgt, t, pal, 'back', k);
    ctx.fillStyle = '#181425';
    ctx.fillRect(x - 3, 150 - hgt, 6, hgt);
    drawAura(ctx, x, 150, hgt, t, pal, 'front', k);
    calls += 2;
    x += hgt * 0.62 + 30;
  }
  const dt = performance.now() - t0;
  auraTimes.push(dt / calls);
  if (auraTimes.length > 60) auraTimes.shift();
  $('astat').textContent =
    `per call: avg ${(auraTimes.reduce((a, b) => a + b, 0) / auraTimes.length).toFixed(3)}ms`;
}

/* ------------------------------------------------------------- speed lines */

const sview = lowres(320, 180);
$('shost').appendChild(cell('drawSpeedLines', sview.c));

/* -------------------------------------------------------------------- loop */

function frame(now: number): void {
  // illustrations
  const t = pausedAt >= 0 ? pausedAt : (now - shotStart) / 1000;
  $('it').textContent = t.toFixed(2);
  const id = ishot.value as IllustrationId;
  let dt = 0;
  for (const v of iviews) {
    const t0 = performance.now();
    drawIllustration(v.ctx, id, t, v.w, v.h);
    dt = Math.max(dt, performance.now() - t0);
  }
  frameTimes.push(dt);
  if (frameTimes.length > 60) frameTimes.shift();
  if (frameTimes.length > 2) {
    const sorted = [...frameTimes].slice(2).sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    $('istat').textContent = `frame: avg ${avg.toFixed(2)}ms, max ${sorted[sorted.length - 1].toFixed(2)}ms`;
  }

  // cut-ins
  const tt = now / 1000;
  dummyGameplay(cview.ctx, 480, 270, tt);
  if (frozenCut && frozenT >= 0) {
    drawCutIn(cview.ctx, frozenCut, frozenT, 480, 270);
    $('cstat').textContent = `${frozenCut} frozen at t=${frozenT}`;
  } else if (cut) {
    const ct = (now - cut.start) / 1000;
    if (ct > cutInDuration(cut.id)) cut = null;
    else {
      const t0 = performance.now();
      drawCutIn(cview.ctx, cut.id, ct, 480, 270);
      $('cstat').textContent = `${cut.id} t=${ct.toFixed(2)} (${(performance.now() - t0).toFixed(2)}ms)`;
    }
  }

  drawAuraDemo(tt);

  // speed lines
  sview.ctx.fillStyle = '#124e89';
  sview.ctx.fillRect(0, 0, 320, 180);
  drawSpeedLines(sview.ctx, 160, 90, 320, 180, tt, '#ffffff', 1);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

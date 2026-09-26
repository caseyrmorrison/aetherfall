/**
 * Hand-made proportional bitmap font (cap height 7px, descenders to 9px) plus a
 * tiny markup language for colored text:  "Take the {gold}Aether Shard{/}."
 *
 * Text is rendered from a white glyph atlas that is tinted & cached per color, so
 * it stays perfectly crisp on the low-resolution game canvas.
 */
import { PAL } from '../art/palette';

const GLYPHS: Record<string, string> = {
  A: '.##.|#..#|#..#|####|#..#|#..#|#..#',
  B: '###.|#..#|#..#|###.|#..#|#..#|###.',
  C: '.##.|#..#|#...|#...|#...|#..#|.##.',
  D: '###.|#..#|#..#|#..#|#..#|#..#|###.',
  E: '####|#...|#...|###.|#...|#...|####',
  F: '####|#...|#...|###.|#...|#...|#...',
  G: '.##.|#..#|#...|#.##|#..#|#..#|.###',
  H: '#..#|#..#|#..#|####|#..#|#..#|#..#',
  I: '###|.#.|.#.|.#.|.#.|.#.|###',
  J: '..##|...#|...#|...#|#..#|#..#|.##.',
  K: '#..#|#..#|#.#.|##..|#.#.|#..#|#..#',
  L: '#...|#...|#...|#...|#...|#...|####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#..#|##.#|##.#|#.##|#.##|#..#|#..#',
  O: '.##.|#..#|#..#|#..#|#..#|#..#|.##.',
  P: '###.|#..#|#..#|###.|#...|#...|#...',
  Q: '.##.|#..#|#..#|#..#|#..#|#.#.|.#.#',
  R: '###.|#..#|#..#|###.|#.#.|#..#|#..#',
  S: '.###|#...|#...|.##.|...#|...#|###.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#..#|#..#|#..#|#..#|#..#|#..#|.##.',
  V: '#...#|#...#|#...#|#...#|.#.#.|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '####|...#|...#|..#.|.#..|#...|####',
  a: '....|....|.###|#..#|#..#|#..#|.###',
  b: '#...|#...|###.|#..#|#..#|#..#|###.',
  c: '...|...|.##|#..|#..|#..|.##',
  d: '...#|...#|.###|#..#|#..#|#..#|.###',
  e: '....|....|.##.|#..#|####|#...|.###',
  f: '.##|#..|###|#..|#..|#..|#..',
  g: '....|....|.###|#..#|#..#|#..#|.###|...#|.##.',
  h: '#...|#...|###.|#..#|#..#|#..#|#..#',
  i: '#|.|#|#|#|#|#',
  j: '.#|..|.#|.#|.#|.#|.#|.#|#.',
  k: '#...|#...|#..#|#.#.|##..|#.#.|#..#',
  l: '#.|#.|#.|#.|#.|#.|.#',
  m: '.....|.....|####.|#.#.#|#.#.#|#.#.#|#.#.#',
  n: '....|....|###.|#..#|#..#|#..#|#..#',
  o: '....|....|.##.|#..#|#..#|#..#|.##.',
  p: '....|....|###.|#..#|#..#|#..#|###.|#...|#...',
  q: '....|....|.###|#..#|#..#|#..#|.###|...#|...#',
  r: '...|...|#.#|##.|#..|#..|#..',
  s: '....|....|.###|#...|.##.|...#|###.',
  t: '.#.|.#.|###|.#.|.#.|.#.|..#',
  u: '....|....|#..#|#..#|#..#|#..#|.###',
  v: '.....|.....|#...#|#...#|.#.#.|.#.#.|..#..',
  w: '.....|.....|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  x: '....|....|#..#|#..#|.##.|#..#|#..#',
  y: '....|....|#..#|#..#|#..#|#..#|.###|...#|.##.',
  z: '....|....|####|...#|.##.|#...|####',
  '0': '.##.|#..#|#.##|##.#|#..#|#..#|.##.',
  '1': '.#.|##.|.#.|.#.|.#.|.#.|###',
  '2': '.##.|#..#|...#|..#.|.#..|#...|####',
  '3': '###.|...#|...#|.##.|...#|...#|###.',
  '4': '#..#|#..#|#..#|####|...#|...#|...#',
  '5': '####|#...|#...|###.|...#|...#|###.',
  '6': '.##.|#...|#...|###.|#..#|#..#|.##.',
  '7': '####|...#|...#|..#.|.#..|.#..|.#..',
  '8': '.##.|#..#|#..#|.##.|#..#|#..#|.##.',
  '9': '.##.|#..#|#..#|.###|...#|...#|.##.',
  '.': '.|.|.|.|.|.|#',
  ',': '..|..|..|..|..|.#|.#|#.',
  '!': '#|#|#|#|#|.|#',
  '?': '.##.|#..#|...#|..#.|.#..|....|.#..',
  ':': '.|.|#|.|.|.|#',
  ';': '..|..|.#|..|..|..|.#|#.',
  "'": '#|#|.|.|.|.|.',
  '"': '#.#|#.#|...|...|...|...|...',
  '-': '...|...|...|###|...|...|...',
  '+': '...|...|.#.|###|.#.|...|...',
  '=': '...|...|###|...|###|...|...',
  '/': '..#|..#|.#.|.#.|.#.|#..|#..',
  '\\': '#..|#..|.#.|.#.|.#.|..#|..#',
  '(': '.#|#.|#.|#.|#.|#.|.#',
  ')': '#.|.#|.#|.#|.#|.#|#.',
  '[': '##|#.|#.|#.|#.|#.|##',
  ']': '##|.#|.#|.#|.#|.#|##',
  '%': '##...|##..#|...#.|..#..|.#...|#..##|...##',
  '*': '...|#.#|.#.|#.#|...|...|...',
  '#': '.#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.',
  '<': '...|..#|.#.|#..|.#.|..#|...',
  '>': '...|#..|.#.|..#|.#.|#..|...',
  _: '....|....|....|....|....|....|####',
  '&': '.#...|#.#..|.#...|#.#.#|#..#.|#..#.|.##.#',
  '^': '.#.|#.#|...|...|...|...|...',
  '|': '#|#|#|#|#|#|#',
  '~': '....|....|.#.#|#.#.|....|....|....',
  $: '.#.|###|#..|###|..#|###|.#.',
  '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.',
  // special symbols (mapped from unicode below)
  '♥': '.....|##.##|#####|#####|.###.|..#..|.....', // ♥
  '★': '..#..|..#..|#####|.###.|.#.#.|#...#|.....', // ★
  '→': '.....|..#..|...#.|#####|...#.|..#..|.....', // →
  '←': '.....|..#..|.#...|#####|.#...|..#..|.....', // ←
  '↑': '..#..|.###.|#.#.#|..#..|..#..|..#..|.....', // ↑
  '↓': '..#..|..#..|..#..|#.#.#|.###.|..#..|.....', // ↓
  '▲': '.....|..#..|.###.|#####|.....|.....|.....', // ▲
  '▼': '.....|#####|.###.|..#..|.....|.....|.....', // ▼
  '▶': '#...|##..|###.|####|###.|##..|#...', // ▶
  '•': '..|..|##|##|..|..|..', // •
  '×': '...|...|#.#|.#.|#.#|...|...', // ×
  '◆': '.....|..#..|.###.|#####|.###.|..#..|.....', // ◆ filled socket
  '◇': '.....|..#..|.#.#.|#...#|.#.#.|..#..|.....', // ◇ empty socket
};

const ALIASES: Record<string, string> = {
  '’': "'",
  '‘': "'",
  '“': '"',
  '”': '"',
  '—': '-',
  '–': '-',
  '…': '...',
};

export const FONT_CAP = 7;
export const LINE_HEIGHT = 10;
const ATLAS_H = 9;
const SPACE_W = 3;
const LETTER_SPACING = 1;

interface GlyphMetrics {
  x: number;
  w: number;
}

let atlas: HTMLCanvasElement | null = null;
const metrics = new Map<string, GlyphMetrics>();
const tinted = new Map<string, HTMLCanvasElement>();

function buildAtlas(): HTMLCanvasElement {
  const entries = Object.entries(GLYPHS);
  let totalW = 0;
  for (const [, def] of entries) totalW += def.split('|')[0].length + 1;
  const c = document.createElement('canvas');
  c.width = totalW;
  c.height = ATLAS_H;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  let x = 0;
  for (const [ch, def] of entries) {
    const rows = def.split('|');
    const w = rows[0].length;
    rows.forEach((row, y) => {
      for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i, y, 1, 1);
    });
    metrics.set(ch, { x, w });
    x += w + 1;
  }
  return c;
}

function getAtlas(color: string): HTMLCanvasElement {
  if (!atlas) atlas = buildAtlas();
  const key = color.toLowerCase();
  let t = tinted.get(key);
  if (!t) {
    t = document.createElement('canvas');
    t.width = atlas.width;
    t.height = atlas.height;
    const ctx = t.getContext('2d')!;
    ctx.drawImage(atlas, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, t.width, t.height);
    tinted.set(key, t);
  }
  return t;
}

/** Named colors usable in markup, e.g. {gold}...{/}. Any #hex also works: {#ff0044}. */
export const TEXT_COLORS: Record<string, string> = {
  white: PAL.white,
  gray: PAL.gray,
  light: PAL.lightGray,
  dark: PAL.slate,
  gold: PAL.gold,
  yellow: PAL.yellow,
  red: PAL.red,
  green: PAL.green,
  blue: PAL.sky,
  cyan: PAL.cyan,
  purple: PAL.magenta,
  orange: PAL.orange,
  pink: PAL.pink,
  common: PAL.lightGray,
  uncommon: PAL.green,
  rare: PAL.sky,
  epic: PAL.magenta,
  legendary: PAL.orange,
  abyssal: PAL.hotPink,
};

export interface TextRun {
  text: string;
  color: string | null; // null = default color
}

function normalizeChars(s: string): string {
  let out = '';
  for (const ch of s) out += ALIASES[ch] ?? ch;
  return out;
}

/** Split markup into colored runs. */
export function parseMarkup(src: string): TextRun[] {
  const runs: TextRun[] = [];
  let color: string | null = null;
  let buf = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') {
      const end = src.indexOf('}', i);
      if (end > i) {
        const tag = src.slice(i + 1, end);
        const resolved = tag === '/' ? null : tag.startsWith('#') ? tag : (TEXT_COLORS[tag] ?? undefined);
        if (resolved !== undefined) {
          if (buf) runs.push({ text: normalizeChars(buf), color });
          buf = '';
          color = resolved;
          i = end + 1;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  if (buf) runs.push({ text: normalizeChars(buf), color });
  return runs;
}

/** Removes markup tags. */
export function stripMarkup(src: string): string {
  return parseMarkup(src)
    .map((r) => r.text)
    .join('');
}

function charWidth(ch: string): number {
  if (ch === ' ') return SPACE_W;
  const m = metrics.get(ch) ?? metrics.get('?');
  return m ? m.w : 4;
}

function ensureMetrics(): void {
  if (!atlas) atlas = buildAtlas();
}

/** Width in pixels of text (markup-aware) at scale 1. */
export function measureText(src: string): number {
  ensureMetrics();
  let w = 0;
  let first = true;
  for (const run of parseMarkup(src)) {
    for (const ch of run.text) {
      if (!first) w += LETTER_SPACING;
      w += charWidth(ch);
      first = false;
    }
  }
  return w;
}

/** Count of visible characters (markup removed). */
export function visibleLength(src: string): number {
  return stripMarkup(src).length;
}

export interface TextOptions {
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Drop shadow color (1px down-right); false disables. Default: dark shadow. */
  shadow?: string | false;
  /** 1px outline in this color (heavier than shadow). */
  outline?: string;
  scale?: number;
  /** Only draw the first N visible characters (typewriter effect). */
  maxChars?: number;
  alpha?: number;
}

function drawRuns(
  ctx: CanvasRenderingContext2D,
  runs: TextRun[],
  x: number,
  y: number,
  defColor: string,
  scale: number,
  maxChars: number,
  forceColor?: string,
): void {
  let cx = x;
  let n = 0;
  for (const run of runs) {
    const sheet = getAtlas(forceColor ?? run.color ?? defColor);
    for (const ch of run.text) {
      if (n >= maxChars) return;
      n++;
      if (ch === ' ') {
        cx += (SPACE_W + LETTER_SPACING) * scale;
        continue;
      }
      const m = metrics.get(ch) ?? metrics.get('?')!;
      ctx.drawImage(sheet, m.x, 0, m.w, ATLAS_H, cx, y, m.w * scale, ATLAS_H * scale);
      cx += (m.w + LETTER_SPACING) * scale;
    }
  }
}

/** Draw a single line of (markup) text. Returns the drawn width. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  src: string,
  x: number,
  y: number,
  opts: TextOptions = {},
): number {
  ensureMetrics();
  const scale = opts.scale ?? 1;
  const color = opts.color ?? PAL.white;
  const w = measureText(src) * scale;
  let dx = Math.round(x);
  if (opts.align === 'center') dx = Math.round(x - w / 2);
  else if (opts.align === 'right') dx = Math.round(x - w);
  const dy = Math.round(y);
  const runs = parseMarkup(src);
  const maxChars = opts.maxChars ?? Infinity;
  const prevAlpha = ctx.globalAlpha;
  if (opts.alpha !== undefined) ctx.globalAlpha = prevAlpha * opts.alpha;
  if (opts.outline) {
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [1, 1],
    ] as const) {
      drawRuns(ctx, runs, dx + ox * scale, dy + oy * scale, color, scale, maxChars, opts.outline);
    }
  } else if (opts.shadow !== false) {
    drawRuns(ctx, runs, dx + scale, dy + scale, color, scale, maxChars, opts.shadow ?? PAL.black);
  }
  drawRuns(ctx, runs, dx, dy, color, scale, maxChars);
  ctx.globalAlpha = prevAlpha;
  return w;
}

/**
 * Word-wrap markup text to a pixel width. Color state carries across lines
 * (each wrapped line re-opens the active color tag).
 */
export function wrapText(src: string, maxWidth: number): string[] {
  ensureMetrics();
  const out: string[] = [];
  for (const paragraph of src.split('\n')) {
    const runs = parseMarkup(paragraph);
    // tokenise into words carrying color
    interface Word {
      parts: TextRun[];
      width: number;
    }
    const words: Word[] = [];
    let cur: Word = { parts: [], width: 0 };
    const pushChar = (ch: string, color: string | null): void => {
      const last = cur.parts[cur.parts.length - 1];
      if (last && last.color === color) last.text += ch;
      else cur.parts.push({ text: ch, color });
      cur.width += charWidth(ch) + (cur.width > 0 ? LETTER_SPACING : 0);
    };
    for (const run of runs) {
      for (const ch of run.text) {
        if (ch === ' ') {
          if (cur.parts.length) words.push(cur);
          cur = { parts: [], width: 0 };
        } else pushChar(ch, run.color);
      }
    }
    if (cur.parts.length) words.push(cur);

    const spaceW = SPACE_W + LETTER_SPACING * 2;
    let line: TextRun[] = [];
    let lineW = 0;
    const flush = (): void => {
      out.push(runsToMarkup(line));
      line = [];
      lineW = 0;
    };
    for (const w of words) {
      const add = (lineW > 0 ? spaceW : 0) + w.width;
      if (lineW > 0 && lineW + add > maxWidth) flush();
      if (lineW > 0) {
        const last = line[line.length - 1];
        last.text += ' ';
      }
      for (const p of w.parts) {
        const last = line[line.length - 1];
        if (last && last.color === p.color) last.text += p.text;
        else line.push({ ...p });
      }
      lineW += (lineW > 0 ? spaceW : 0) + w.width;
    }
    flush();
  }
  return out;
}

function runsToMarkup(runs: TextRun[]): string {
  let s = '';
  for (const r of runs) {
    const safe = r.text.replace(/\{/g, '(').replace(/\}/g, ')');
    s += r.color ? `{${r.color}}${safe}{/}` : safe;
  }
  return s;
}

/** Draw pre-wrapped lines with a shared typewriter budget. Returns chars consumed. */
export function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  opts: TextOptions & { lineHeight?: number } = {},
): number {
  let budget = opts.maxChars ?? Infinity;
  const lh = opts.lineHeight ?? LINE_HEIGHT;
  let used = 0;
  lines.forEach((line, i) => {
    if (budget <= 0) return;
    drawText(ctx, line, x, y + i * lh * (opts.scale ?? 1), { ...opts, maxChars: budget });
    const len = visibleLength(line);
    budget -= len;
    used += Math.min(len, len + budget);
  });
  return used;
}

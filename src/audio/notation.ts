/**
 * Compact music notation + song compiler.
 *
 * A song is a set of tracks (instrument + kind) and sections. Each section has a length in bars,
 * an optional chord progression and one "part" string per track:
 *
 *  kind 'mml'   — melodic line in an MML dialect:
 *                 o4 set octave, > / < octave up/down, l8 default length, v1..15 velocity,
 *                 q1..8 gate, k-3 transpose, notes c d e f g a b with + # (sharp) - (flat),
 *                 length 1 2 4 8 16 (+ dots, 12/6/3 = triplets), r rest, ^4 tie/extend previous note,
 *                 {ceg}2 chord, [ ... ]3 repeat, | bar check (warns if not on a bar line).
 *                 A part shorter than its section loops to fill it.
 *  kind 'pat'   — chord-tone pattern (bass / arpeggio): one char per step (track.step beats):
 *                 0-9 a-f = index into the current chord's tones (0 root, 1 third, 2 fifth, 3 root+8va ...),
 *                 '-' hold, '.' rest, '!' accent next. Holds re-trigger when the chord changes.
 *  kind 'pad'   — chord voicing within [lo, lo+12): 'x' strike, '-' hold, '.' rest; '*' = one strike per chord.
 *  kind 'drums' — 'k:x...x... s:....x... h:x.x.x.x.' (see DRUM_KEYS). x hit, X accent, o ghost, . rest.
 *                 A pattern ending in ';' plays once instead of looping.
 *
 * Chords: 'Em7 | A | C D | B7' — bars separated by '|', several chords in a bar split it evenly,
 * '.' continues the previous chord. Bars cycle if fewer than the section length.
 */
import { DRUM_KEYS, type Inst } from './synth';
import { chordLadder, LETTER, parseChord, placeAbove, type Chord } from './theory';

export interface Ev {
  /** start, in beats */
  t: number;
  /** sounding duration, in beats */
  d: number;
  /** midi notes (or drum indices) */
  n: number[];
  /** velocity 0..1 */
  v: number;
}

export interface TrackDef {
  inst: Inst;
  kind?: 'mml' | 'pat' | 'pad' | 'drums';
  /** intensity layer: 'hi' fades in with intensity, 'lo' fades partly out, or [gainAt0, gainAt1] */
  layer?: 'hi' | 'lo' | [number, number];
  vol?: number;
  pan?: number;
  /** reverb / delay send amounts */
  rev?: number;
  dly?: number;
  /** lowest midi note for pat/pad voicing */
  lo?: number;
  /** beats per step for pat/pad/drums (default 0.25) */
  step?: number;
  tones?: 'triad' | 'seventh' | 'full';
  /** pat: index 0 uses the slash-chord bass note */
  slash?: boolean;
  /** semitone transpose (mml/pat/pad) */
  tr?: number;
  /** pat/pad note length as a fraction of its step span (default 0.92) */
  gate?: number;
}

export interface Section {
  bars: number;
  ch?: string;
  [track: string]: string | number | undefined;
}

export interface SongDef {
  bpm: number;
  bpb?: number;
  /** overall song gain (for loudness matching) */
  gain?: number;
  /** per-song echo: time in beats, feedback */
  delay?: { beats: number; fb: number; lp?: number };
  tracks: Record<string, TrackDef>;
  sections: Record<string, Section>;
  order: string[];
  /** section name to loop back to (default: first) */
  loopTo?: string;
}

export interface CEvent extends Ev {
  /** track index */
  k: number;
}

export interface CompiledSong {
  def: SongDef;
  trackNames: string[];
  tracks: TrackDef[];
  spb: number;
  total: number;
  loopStart: number;
  loopIdx: number;
  events: CEvent[];
  warnings: string[];
}

type Warn = (msg: string) => void;
const EPS = 1e-6;

// ---------------------------------------------------------------------------------------------
// MML

function expandLoops(src: string): string {
  const re = /\[([^[\]]*)\](\d*)/;
  let s = src;
  for (let guard = 0; guard < 100 && re.test(s); guard++) {
    s = s.replace(re, (_m, body: string, n: string) => ` ${body} `.repeat(n ? parseInt(n, 10) : 2));
  }
  return s;
}

export function parseMML(src: string, bpb: number, warn: Warn): { ev: Ev[]; len: number } {
  const s = expandLoops(src);
  let i = 0;
  let pos = 0;
  let oct = 4;
  let len = 1;
  let vel = 12;
  let gate = 1;
  let tr = 0;
  const ev: Ev[] = [];
  let last: { e: Ev; full: number; gate: number } | null = null;

  const readInt = (): number => {
    const m = /^-?\d+/.exec(s.slice(i));
    if (!m) {
      warn(`expected number at "${s.slice(i, i + 8)}"`);
      return 0;
    }
    i += m[0].length;
    return parseInt(m[0], 10);
  };
  const readLen = (): number => {
    const m = /^(\d+)?(\.*)/.exec(s.slice(i))!;
    i += m[0].length;
    const base = m[1] ? 4 / parseInt(m[1], 10) : len;
    let add = base;
    let total = base;
    for (let k = 0; k < m[2].length; k++) {
      add /= 2;
      total += add;
    }
    return total;
  };
  const readPitch = (): number | null => {
    const c = s[i];
    if (!(c in LETTER)) return null;
    i++;
    let pc = LETTER[c];
    while (s[i] === '+' || s[i] === '#' || s[i] === '-') {
      pc += s[i] === '-' ? -1 : 1;
      i++;
    }
    return (oct + 1) * 12 + pc + tr;
  };

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c in LETTER) {
      const n = readPitch()!;
      const l = readLen();
      const e: Ev = { t: pos, d: l * gate, n: [n], v: vel / 15 };
      ev.push(e);
      last = { e, full: l, gate };
      pos += l;
      continue;
    }
    i++;
    switch (c) {
      case '|': {
        const r = pos % bpb;
        if (r > EPS && bpb - r > EPS)
          warn(`bar check failed at beat ${pos.toFixed(3)} (bar ${Math.floor(pos / bpb) + 1})`);
        break;
      }
      case 'o':
        oct = readInt();
        break;
      case '>':
        oct++;
        break;
      case '<':
        oct--;
        break;
      case 'l':
        len = readLen();
        break;
      case 'v':
        vel = Math.max(0, Math.min(15, readInt()));
        break;
      case 'q':
        gate = Math.max(1, Math.min(8, readInt())) / 8;
        break;
      case 'k':
        tr = readInt();
        break;
      case 'r':
        pos += readLen();
        last = null;
        break;
      case '^': {
        const l = readLen();
        if (last) {
          last.full += l;
          last.e.d = last.full * last.gate;
        }
        pos += l;
        break;
      }
      case '{': {
        const saveOct = oct;
        const notes: number[] = [];
        while (i < s.length && s[i] !== '}') {
          const ch = s[i];
          if (ch === '>') {
            oct++;
            i++;
          } else if (ch === '<') {
            oct--;
            i++;
          } else if (ch in LETTER) notes.push(readPitch()!);
          else i++;
        }
        i++; // }
        oct = saveOct;
        const l = readLen();
        const e: Ev = { t: pos, d: l * gate, n: notes, v: vel / 15 };
        ev.push(e);
        last = { e, full: l, gate };
        pos += l;
        break;
      }
      default:
        warn(`unexpected "${c}"`);
    }
  }
  return { ev, len: pos };
}

// ---------------------------------------------------------------------------------------------
// Chords

interface Span {
  s: number;
  e: number;
  c: Chord;
}

export function parseChords(str: string, bpb: number, bars: number, warn: Warn): Span[] {
  const barStrs = str
    .split('|')
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  const spans: Span[] = [];
  if (!barStrs.length) return spans;
  if (bars % barStrs.length !== 0) warn(`${barStrs.length} chord bars do not divide ${bars} bars`);
  for (let b = 0; b < bars; b++) {
    const toks = barStrs[b % barStrs.length].split(/\s+/);
    const each = bpb / toks.length;
    toks.forEach((tok, k) => {
      const st = b * bpb + k * each;
      if (tok === '.' || tok === '%') {
        if (spans.length) spans[spans.length - 1].e = st + each;
        return;
      }
      try {
        spans.push({ s: st, e: st + each, c: parseChord(tok) });
      } catch (err) {
        warn((err as Error).message);
      }
    });
  }
  return spans;
}

function spanAt(spans: Span[], beat: number): Span | undefined {
  for (const sp of spans) if (beat >= sp.s - EPS && beat < sp.e - EPS) return sp;
  return spans[spans.length - 1];
}

// ---------------------------------------------------------------------------------------------
// Step patterns

interface Tok {
  c: string;
  acc: boolean;
}

function tokenize(p: string): { toks: Tok[]; once: boolean } {
  let s = p.replace(/[\s|]/g, '');
  const once = s.endsWith(';');
  if (once) s = s.slice(0, -1);
  const toks: Tok[] = [];
  let acc = false;
  for (const c of s) {
    if (c === '!') {
      acc = true;
      continue;
    }
    toks.push({ c, acc });
    acc = false;
  }
  return { toks, once };
}

function checkPeriod(n: number, step: number, bpb: number, warn: Warn, what: string): void {
  const per = n * step;
  const isInt = (x: number): boolean => Math.abs(x - Math.round(x)) < EPS;
  if (!isInt(bpb / per) && !isInt(per / bpb))
    warn(`${what} pattern of ${n} steps (${per} beats) does not align with the bar`);
}

const hexIdx = (c: string): number => {
  const n = parseInt(c, 16);
  return Number.isNaN(n) ? 0 : n;
};

function patPart(
  part: string,
  beats: number,
  def: TrackDef,
  spans: Span[],
  pad: boolean,
  bpb: number,
  warn: Warn,
): Ev[] {
  const step = def.step ?? 0.25;
  const gate = def.gate ?? 0.92;
  const lo = def.lo ?? (pad ? 55 : 36);
  const tones = def.tones ?? 'seventh';
  const n = Math.round(beats / step);
  // '*' = strike on each chord change and hold (the hold re-triggers when the chord changes)
  const src = part.trim() === '*' ? 'x' + '-'.repeat(Math.max(0, n - 1)) + ';' : part;
  const { toks, once } = tokenize(src);
  if (!toks.length) return [];
  if (!once) checkPeriod(toks.length, step, bpb, warn, pad ? 'pad' : 'pat');
  for (const tk of toks) if (!/[0-9a-fx.-]/.test(tk.c)) warn(`bad pattern char "${tk.c}"`);
  const out: { e: Ev; raw: number }[] = [];
  let cur: { e: Ev; raw: number; span: Span; idx: number } | null = null;

  const notesFor = (span: Span, idx: number): number[] => {
    const c = span.c;
    if (pad) {
      const pcs = [...new Set(c.iv.map((iv) => (c.root + iv) % 12))];
      return pcs.map((pc) => placeAbove(pc, lo)).sort((a, b) => a - b);
    }
    if (idx === 0 && def.slash) return [placeAbove(c.bass, lo)];
    const lad = chordLadder(c, tones);
    const root = placeAbove(c.root, lo);
    return [root + lad[idx % lad.length] + 12 * Math.floor(idx / lad.length)];
  };

  for (let i = 0; i < n; i++) {
    if (once && i >= toks.length) break;
    const tk = toks[i % toks.length];
    const t = i * step;
    const span = spanAt(spans, t);
    if (!span) continue;
    if (tk.c === '-') {
      if (cur) {
        if (cur.span === span) {
          cur.raw += step;
          continue;
        }
        // chord changed under a held note: re-trigger with the same index
        const e: Ev = { t, d: 0, n: notesFor(span, cur.idx), v: cur.e.v };
        cur = { e, raw: step, span, idx: cur.idx };
        out.push(cur);
      }
      continue;
    }
    if (tk.c === '.') {
      cur = null;
      continue;
    }
    const idx = pad ? 0 : hexIdx(tk.c);
    const e: Ev = { t, d: 0, n: notesFor(span, idx), v: tk.acc ? 1 : 0.78 };
    cur = { e, raw: step, span, idx };
    out.push(cur);
  }
  return out.map(({ e, raw }) => ((e.d = raw * gate), e));
}

function drumPart(part: string, beats: number, step: number, bpb: number, warn: Warn): Ev[] {
  const out: Ev[] = [];
  const chunks = part.trim().split(/\s+(?=[a-z]:)/);
  for (const chunk of chunks) {
    const m = /^([a-z]):(.*)$/s.exec(chunk.trim());
    if (!m) {
      warn(`bad drum chunk "${chunk}"`);
      continue;
    }
    const idx = DRUM_KEYS.indexOf(m[1]);
    if (idx < 0) {
      warn(`unknown drum "${m[1]}"`);
      continue;
    }
    const { toks, once } = tokenize(m[2]);
    if (!toks.length) continue;
    if (!once) checkPeriod(toks.length, step, bpb, warn, `drum "${m[1]}"`);
    for (const tk of toks) if (!/[xXo.-]/.test(tk.c)) warn(`bad drum char "${tk.c}" in "${m[1]}"`);
    const n = Math.round(beats / step);
    for (let i = 0; i < n; i++) {
      if (once && i >= toks.length) break;
      const tk = toks[i % toks.length];
      const c = tk.c;
      if (c === '.' || c === '-') continue;
      const v = tk.acc || c === 'X' ? 1 : c === 'o' ? 0.45 : 0.78;
      out.push({ t: i * step, d: step, n: [idx], v });
    }
  }
  return out;
}

function mmlPart(part: string, beats: number, bpb: number, warn: Warn): Ev[] {
  const { ev, len } = parseMML(part, bpb, warn);
  if (len <= EPS) return [];
  if (len > beats + EPS) warn(`part is ${len} beats but section is ${beats}; truncated`);
  else if (Math.abs(beats / len - Math.round(beats / len)) > EPS)
    warn(`part length ${len} does not divide section ${beats}`);
  const out: Ev[] = [];
  for (let off = 0; off < beats - EPS; off += len) {
    for (const e of ev) {
      const t = off + e.t;
      if (t < beats - EPS) out.push({ t, d: e.d, n: e.n, v: e.v });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Song compiler

export function compileSong(def: SongDef): CompiledSong {
  const bpb = def.bpb ?? 4;
  const trackNames = Object.keys(def.tracks);
  const tracks = trackNames.map((n) => def.tracks[n]);
  const warnings: string[] = [];
  const events: CEvent[] = [];
  const loopName = def.loopTo ?? def.order[0];
  let pos = 0;
  let loopStart = -1;

  for (const secName of def.order) {
    const sec = def.sections[secName];
    if (!sec) {
      warnings.push(`missing section "${secName}"`);
      continue;
    }
    if (loopStart < 0 && secName === loopName) loopStart = pos;
    const beats = sec.bars * bpb;
    const secWarn: Warn = (m) => warnings.push(`${secName}: ${m}`);
    const spans = sec.ch ? parseChords(sec.ch, bpb, sec.bars, secWarn) : [];
    for (const key of Object.keys(sec)) {
      if (key !== 'bars' && key !== 'ch' && !def.tracks[key]) secWarn(`unknown track "${key}"`);
    }
    trackNames.forEach((name, k) => {
      const part = sec[name];
      if (typeof part !== 'string' || !part.trim()) return;
      const td = tracks[k];
      const w: Warn = (m) => warnings.push(`${secName}.${name}: ${m}`);
      const kind = td.kind ?? 'mml';
      let evs: Ev[];
      if (kind === 'mml') evs = mmlPart(part, beats, bpb, w);
      else if (kind === 'drums') evs = drumPart(part, beats, td.step ?? 0.25, bpb, w);
      else {
        if (!spans.length) {
          w('pattern track needs chords');
          return;
        }
        evs = patPart(part, beats, td, spans, kind === 'pad', bpb, w);
      }
      const tr = kind === 'drums' ? 0 : (td.tr ?? 0);
      for (const e of evs)
        events.push({ t: pos + e.t, d: e.d, n: tr ? e.n.map((x) => x + tr) : e.n, v: e.v, k });
    });
    pos += beats;
  }
  if (loopStart < 0) {
    warnings.push(`loop section "${loopName}" not in order`);
    loopStart = 0;
  }
  events.sort((a, b) => a.t - b.t || a.k - b.k);
  let loopIdx = events.findIndex((e) => e.t >= loopStart - EPS);
  if (loopIdx < 0) loopIdx = events.length;
  return { def, trackNames, tracks, spb: 60 / def.bpm, total: pos, loopStart, loopIdx, events, warnings };
}

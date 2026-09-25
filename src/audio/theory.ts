/** Small music-theory helpers: pitch math and chord-symbol parsing. */

export const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export const LETTER: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "C", "F#", "Bb", "c+", "e-" -> pitch class 0..11 */
export function pitchClass(name: string): number {
  let pc = LETTER[name[0].toLowerCase()];
  if (pc === undefined) throw new Error(`bad note name "${name}"`);
  for (const ch of name.slice(1)) {
    if (ch === '#' || ch === '+') pc++;
    else if (ch === 'b' || ch === '-') pc--;
  }
  return ((pc % 12) + 12) % 12;
}

/** Chord qualities as semitone intervals above the root. */
const QUALITIES: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mM7: [0, 3, 7, 11],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '7b9': [0, 4, 7, 10, 13],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  '+': [0, 4, 8],
  '7#5': [0, 4, 8, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  /** whole-tone cluster */
  wt: [0, 2, 4, 6, 8, 10],
};

export interface Chord {
  /** root pitch class */
  root: number;
  /** intervals above root */
  iv: number[];
  /** bass pitch class (slash chords), = root otherwise */
  bass: number;
  sym: string;
}

const CHORD_RE = /^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/;

export function parseChord(sym: string): Chord {
  const m = CHORD_RE.exec(sym.trim());
  if (!m) throw new Error(`bad chord "${sym}"`);
  const iv = QUALITIES[m[2]];
  if (!iv) throw new Error(`unknown chord quality "${m[2]}" in "${sym}"`);
  const root = pitchClass(m[1]);
  return { root, iv, bass: m[3] ? pitchClass(m[3]) : root, sym };
}

/** Chord tones (intervals mod 12, ascending, unique) used to index arpeggio / bass patterns. */
export function chordLadder(c: Chord, tones: 'triad' | 'seventh' | 'full'): number[] {
  const src = tones === 'triad' ? c.iv.slice(0, 3) : tones === 'seventh' ? c.iv.slice(0, 4) : c.iv;
  return [...new Set(src.map((i) => i % 12))].sort((a, b) => a - b);
}

/** Lowest midi note >= lo with the given pitch class. */
export function placeAbove(pc: number, lo: number): number {
  return lo + ((((pc - lo) % 12) + 12) % 12);
}

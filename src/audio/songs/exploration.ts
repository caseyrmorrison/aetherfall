/**
 * Exploration tracks. Tracks marked `layer: 'hi'` (drums, driving bass, fast arpeggios) follow
 * setIntensity(): silent at 0 (calm exploration), full at 1 (combat nearby).
 */
import type { Section, SongDef } from '../notation';
import { P } from '../synth';

// ---------------------------------------------------------------------------------------------
// FOREST — adventurous but mysterious, E dorian, 120 bpm

const FOREST_A =
  'o5 e4 b8 a8 g8 f+8 e8 f+8 | a4 >c+8 <b8 a4 e4 | g4 f+8 e8 b4 a8 g8 | f+4 e8 f+8 c+4 e4 | g4 b8 >d8 e4 d4< | >c+4. <a8 f+4 d4 | d4 f+8 a8 b4 a4 | e2. r4 |';
const FOREST_B =
  'o5 b2 a4 g4 | a2. f+4 | e2 c+4 e4 | g2. r4 | d4 e4 g4 b4 | a2 f+4 d4 | e4 f+4 a4 >c+4< | b2 a2 |';

const forestBase = { arp: '0123 2102', pad: '*', bass: '0-------', perc: 'x:..x...x.x.x...x.' };
const forestHi = {
  hbass: '0020 0302',
  hiarp: '0123',
  drums: 'k:x.....x.x....... s:....x.......x... h:x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.xx',
};
const forestA: Section = {
  bars: 8,
  ch: 'Em7 | A/E | Em7 | A/E | G | D | Bm7 | A',
  lead: FOREST_A,
  ...forestBase,
  ...forestHi,
};

export const forest: SongDef = {
  bpm: 120,
  gain: 0.68,
  delay: { beats: 0.75, fb: 0.3 },
  tracks: {
    lead: { inst: { ...P.lead, gain: 0.14 }, rev: 0.2, dly: 0.18 },
    tri: { inst: { ...P.tri, gain: 0.16 }, tr: -12, rev: 0.2 },
    arp: {
      inst: { ...P.harp, gain: 0.1 },
      kind: 'pat',
      step: 0.5,
      lo: 52,
      tones: 'seventh',
      rev: 0.3,
      dly: 0.25,
      pan: -0.25,
    },
    pad: { inst: { ...P.pad, gain: 0.03 }, kind: 'pad', lo: 52, rev: 0.35 },
    bass: { inst: { ...P.bass, gain: 0.16 }, kind: 'pat', step: 0.5, lo: 33, tones: 'triad', slash: true },
    perc: { inst: P.kit, kind: 'drums', vol: 1, pan: 0.2 },
    hbass: {
      inst: { ...P.pbass },
      kind: 'pat',
      step: 0.5,
      lo: 33,
      tones: 'triad',
      slash: true,
      layer: 'hi',
      gate: 0.7,
    },
    hiarp: {
      inst: { ...P.arp, gain: 0.08 },
      kind: 'pat',
      step: 0.25,
      lo: 64,
      tones: 'triad',
      layer: 'hi',
      pan: 0.3,
      dly: 0.2,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.6, rev: 0.1 },
  },
  sections: {
    intro: {
      bars: 4,
      ch: 'Em7 | A/E | Em7 | A/E',
      ...forestBase,
      drums: forestHi.drums,
      hbass: forestHi.hbass,
    },
    A: forestA,
    B: { bars: 8, ch: 'G | D | A | Em | G | D | F#m7 | A', lead: FOREST_B, ...forestBase, ...forestHi },
    A2: { ...forestA, tri: FOREST_A },
  },
  order: ['intro', 'A', 'B', 'A2'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// CAVE — sparse, echoing, A minor, 80 bpm

const CAVE_A =
  'o5 r4 e4 a4 b4 | g2. r4 | r4 a4 >c4 e4< | b2. r4 | r4 >c4 <b4 a4 | f2. e4 | d2 f4 a4 | g+2. r4 |';
const CAVE_B =
  'o5 e2 g4 >c4< | b2. r4 | a4. g8 e2 | b4 g4 e2 | f2 a4 >c4< | e2. r4 | d4 f4 a4 >d4< | >c2 <b2 |';
const DRIP = 'o6 r2 e8 r8 r4 | r4. a16 r16 r2 |';
const caveHi = {
  hbass: '0..0..0.',
  drums: 'k:x.......x..x.... t:......x.......x. h:..x...x...x...x.',
};

export const cave: SongDef = {
  bpm: 80,
  gain: 0.78,
  delay: { beats: 0.75, fb: 0.45, lp: 2000 },
  tracks: {
    bell: { inst: { ...P.bell, gain: 0.14 }, rev: 0.45, dly: 0.4 },
    tri: { inst: { ...P.tri, gain: 0.2 }, rev: 0.4, dly: 0.35 },
    drip: { inst: { ...P.glass, gain: 0.07 }, rev: 0.5, dly: 0.5, pan: 0.35 },
    pad: { inst: { ...P.pad, gain: 0.035, lp: 700 }, kind: 'pad', lo: 48, rev: 0.45 },
    bass: { inst: { ...P.bass, gain: 0.16 }, kind: 'pat', step: 0.5, lo: 33, tones: 'triad' },
    hbass: {
      inst: { ...P.pbass, gain: 0.1 },
      kind: 'pat',
      step: 0.5,
      lo: 33,
      tones: 'triad',
      layer: 'hi',
      gate: 0.6,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.55, rev: 0.3 },
  },
  sections: {
    intro: { bars: 2, ch: 'Am | Am', pad: '*', bass: '0-------', drip: DRIP },
    A: {
      bars: 8,
      ch: 'Am | G | Fmaj7 | E | Am | Dm7 | Bm7b5 | E',
      bell: CAVE_A,
      pad: '*',
      bass: '0-------',
      drip: DRIP,
      ...caveHi,
    },
    B: {
      bars: 8,
      ch: 'C | G | Am | Em | F | C | Dm | E',
      tri: CAVE_B,
      pad: '*',
      bass: '0-------',
      drip: DRIP,
      ...caveHi,
    },
  },
  order: ['intro', 'A', 'B'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// VOLCANO — driving & hot, E phrygian, 140 bpm

const VOLC_A =
  'o5 e4 f8 e8 b4 a8 g8 | a4. g8 f2 | e4 f8 g8 a4 b8 >c8< | d2. r4 | b4 >c8 <b8 a4 g8 f8 | a4 >c8 <a8 f4 e8 f8 | g4. f8 d4 b4 | a2. f4 |';
const VOLC_B =
  'o5 a4. >c8 e4 d8 c8 | c2 <a4 f4 | g4. a8 b4 >d4 | <b2. r4 | >e4. d8 c4 <a4 | >c4. <a8 f4 a4 | f4. e8 d4 f4 | a2 g4 f4 |';
const volcBase = { bass: '0030 2010', pad: '*', perc: 'b:x...............' };
const volcHi = {
  arp: '0121 3212',
  drums:
    'k:x.....x.x..x.... s:....x.......x... h:x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x. t:................|............x.x.',
};
const volcA: Section = {
  bars: 8,
  ch: 'Em | F | Em | Dm | Em | F | G | F',
  lead: VOLC_A,
  ...volcBase,
  ...volcHi,
};
const volcB: Section = {
  bars: 8,
  ch: 'Am | F | G | Em | Am | F | Dm | F',
  lead: VOLC_B,
  ...volcBase,
  ...volcHi,
};

export const volcano: SongDef = {
  bpm: 140,
  gain: 0.7,
  tracks: {
    lead: { inst: { ...P.square, gain: 0.1 }, rev: 0.15 },
    lead2: { inst: { ...P.brass, gain: 0.07 }, tr: -12, rev: 0.15 },
    bass: { inst: { ...P.sawbass, gain: 0.09 }, kind: 'pat', step: 0.5, lo: 33, tones: 'triad', gate: 0.8 },
    pad: { inst: { ...P.organ, gain: 0.03 }, kind: 'pad', lo: 52, rev: 0.2 },
    perc: { inst: P.kit, kind: 'drums', vol: 0.35, rev: 0.2 },
    arp: {
      inst: { ...P.arp, gain: 0.09 },
      kind: 'pat',
      step: 0.25,
      lo: 64,
      tones: 'triad',
      layer: 'hi',
      pan: 0.3,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.5, rev: 0.1 },
  },
  sections: {
    intro: { bars: 4, ch: 'Em | F | Em | F', ...volcBase, drums: volcHi.drums },
    A: volcA,
    B: volcB,
    A2: { ...volcA, lead2: VOLC_A },
    B2: { ...volcB, lead2: VOLC_B },
  },
  order: ['intro', 'A', 'B', 'A2', 'B2'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// TUNDRA — melancholic, crystalline, B minor, 96 bpm

const TUN_A =
  'o5 f+2. e8 d8 | e2. d8 <b8> | d2. <a4> | c+2. r4 | f+2. b8 a8 | g2. f+8 e8 | e4. f+8 g4 b4 | a+2. r4 |';
const TUN_B =
  'o5 b2 >d4 <b4 | a2 e4 c+4 | c+2. f+4 | d2. r4 | b2 >d4 e4 | c+2 <a4 e4 | b2. a+8 b8 | f+2. r4 |';
const tunBase = { pad: '*', arp: '0123 4321', bass: '0-------' };
const tunHi = {
  hbass: '0..0..0.',
  drums: 'k:x.....x.x....... s:....x.......x... h:..x...x...x...x. t:................|..........x..x.x',
};
const tunA: Section = { bars: 8, ch: 'Bm | G | D | A | Bm | G | Em | F#', bell: TUN_A, ...tunBase, ...tunHi };

export const tundra: SongDef = {
  bpm: 96,
  gain: 0.73,
  delay: { beats: 1.5, fb: 0.35, lp: 2600 },
  tracks: {
    bell: { inst: { ...P.bell, gain: 0.14 }, rev: 0.5, dly: 0.3 },
    flute: { inst: { ...P.flute, gain: 0.13 }, tr: -12, rev: 0.4 },
    arp: {
      inst: { ...P.glass, gain: 0.05 },
      kind: 'pat',
      step: 0.5,
      lo: 66,
      tones: 'triad',
      rev: 0.5,
      dly: 0.3,
      pan: 0.3,
    },
    pad: { inst: { ...P.choir, gain: 0.045 }, kind: 'pad', lo: 54, rev: 0.5 },
    bass: { inst: { ...P.bass, gain: 0.15 }, kind: 'pat', step: 0.5, lo: 35, tones: 'triad' },
    hbass: {
      inst: { ...P.pbass, gain: 0.1 },
      kind: 'pat',
      step: 0.5,
      lo: 35,
      tones: 'triad',
      layer: 'hi',
      gate: 0.6,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.55, rev: 0.25 },
  },
  sections: {
    intro: { bars: 4, ch: 'Bm | G | D | A', ...tunBase, drums: tunHi.drums },
    A: tunA,
    B: { bars: 8, ch: 'G | A | F#m | Bm | G | A | F#sus4 | F#', bell: TUN_B, ...tunBase, ...tunHi },
    A2: { ...tunA, flute: TUN_A },
  },
  order: ['intro', 'A', 'B', 'A2'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// CITADEL — dark & grand, C minor, 100 bpm

const CIT_A =
  'o5 c4. d8 e-4 g4 | a-2 g4 f4 | a-4. g8 f4 c4 | d2 <b2> | g4. a-8 g4 e-4 | >c2 <a-4 e-4 | d4. e-8 f4 d4 | g2. r4 |';
const CIT_B =
  'o5 e-4. f8 a-4 >c4< | b-2. g4 | a-4. g8 f4 a-4 | g2. r4 | >c4. <b-8 a-4 >e-4< | >d2 <b-4 f4 | c2 d4 c4 | <b2. r4> |';
const citBase = { choir: '*', organ: 'x-x-', bass: '0-0-', toll: 'o3 c1 | r1 | r1 | r1 |' };
const citHi = {
  hbass: '0000 0020',
  drums: 'k:x.......x..x.... s:....x.......x.oo b:x...............|x.......x.......',
};
const citA: Section = {
  bars: 8,
  ch: 'Cm | Ab | Fm | G | Cm | Ab | Bb | G7',
  horn: CIT_A,
  ...citBase,
  ...citHi,
};

export const citadel: SongDef = {
  bpm: 100,
  gain: 0.72,
  tracks: {
    horn: { inst: { ...P.brass, gain: 0.12, lp: 550 }, rev: 0.35 },
    str: { inst: { ...P.strings, gain: 0.05, a: 0.08 }, tr: 12, rev: 0.4 },
    choir: { inst: { ...P.choir, gain: 0.045 }, kind: 'pad', lo: 55, rev: 0.5 },
    organ: { inst: { ...P.organ, gain: 0.028 }, kind: 'pad', step: 1, lo: 48, rev: 0.3 },
    bass: { inst: { ...P.bass, gain: 0.16 }, kind: 'pat', step: 1, lo: 31, tones: 'triad' },
    toll: { inst: { ...P.bell, gain: 0.14 }, rev: 0.5 },
    hbass: {
      inst: { ...P.sawbass, gain: 0.09 },
      kind: 'pat',
      step: 0.5,
      lo: 31,
      tones: 'triad',
      layer: 'hi',
      gate: 0.7,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.5, rev: 0.25 },
  },
  sections: {
    intro: { bars: 4, ch: 'Cm | Ab | Fm | G', ...citBase, drums: citHi.drums },
    A: citA,
    B: { bars: 8, ch: 'Ab | Eb | Fm | Cm | Ab | Bb | Gsus4 | G', horn: CIT_B, ...citBase, ...citHi },
    A2: { ...citA, str: CIT_A },
  },
  order: ['intro', 'A', 'B', 'A2'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// ABYSS — eerie, hypnotic, chromatic / whole-tone, 110 bpm

const ABY_A = 'o5 g2. f+4 | f2. e4 | e-2 d4 <b4> | a+2. r4 | g4 a-4 g4 f+4 | e2 >c2< | a-2 d2 | d+2. r4 |';
const ABY_B =
  'o5 c4 d4 e4 f+4 | g+2. r4 | a2 g4 f4 | d+2. r4 | e4 f+4 g+4 a+4 | >c2. r4< | b2 a4 g4 | b2. r4 |';
const abyBase = { pad: '*', ost: '0213 0214', sub: '0-' };
const abyHi = {
  hbass: '0..0..0.0..0..0.',
  drums: 'k:x..x..x...x..x.. t:....x.......x... h:..x...x...x...x. m:................|..............oo',
};
const abyA: Section = {
  bars: 8,
  ch: 'CmM7 | Abaug/C | CmM7 | Daug | CmM7 | Abaug | Fm6 | Gaug',
  lead: ABY_A,
  ...abyBase,
  ...abyHi,
};

export const abyss: SongDef = {
  bpm: 110,
  gain: 0.65,
  delay: { beats: 0.75, fb: 0.4, lp: 1800 },
  tracks: {
    lead: { inst: { ...P.theremin, gain: 0.1 }, rev: 0.45, dly: 0.3 },
    bell: { inst: { ...P.bell, gain: 0.06 }, tr: -12, rev: 0.5, dly: 0.3 },
    ost: {
      inst: { ...P.arp, gain: 0.08, lp: 1800 },
      kind: 'pat',
      step: 0.25,
      lo: 60,
      tones: 'full',
      rev: 0.3,
      dly: 0.35,
      pan: -0.3,
    },
    pad: { inst: { ...P.pad, gain: 0.025, lp: 800 }, kind: 'pad', lo: 48, rev: 0.5 },
    sub: { inst: { ...P.sub, gain: 0.13 }, kind: 'pat', step: 2, lo: 36, tones: 'triad', slash: true },
    hbass: {
      inst: { ...P.pbass, gain: 0.09 },
      kind: 'pat',
      step: 0.25,
      lo: 36,
      tones: 'triad',
      slash: true,
      layer: 'hi',
      gate: 0.5,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.45, rev: 0.25 },
  },
  sections: {
    intro: { bars: 4, ch: 'CmM7 | Abaug/C | CmM7 | Daug', ...abyBase, drums: abyHi.drums },
    A: abyA,
    B: {
      bars: 8,
      ch: 'Cwt | Cwt | Dbwt | Dbwt | Cwt | Cwt | Dbwt | Gaug',
      lead: ABY_B,
      ...abyBase,
      ...abyHi,
    },
    A2: { ...abyA, bell: ABY_A },
  },
  order: ['intro', 'A', 'B', 'A2'],
  loopTo: 'A',
};

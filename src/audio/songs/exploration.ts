/**
 * Exploration tracks. Tracks marked `layer: 'hi'` (drums, driving bass, fast arpeggios) follow
 * setIntensity(): silent at 0 (calm exploration), full at 1 (combat nearby).
 */
import type { Section, SongDef } from '../notation';
import { P } from '../synth';
import { MOTIF_MIN } from './motif';

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

// ---------------------------------------------------------------------------------------------
// DESERT (Sunscar Dunes) — driving & sun-scorched, E phrygian dominant / A harmonic minor,
// 132 bpm. Hand drums (saidi groove) play even when calm; the combat layer adds kick, clap,
// hats, a gritty bass and 16th arps. C is a horn call over the dunes. Loop ~58 s.

const DES_A =
  'o5 b4. >c8 <b8 a8 g+8 a8 | f4 a4 >c4. <b8 | g+4 f8 e8 f4 g+4 | a2 f4 d4 | e4 b4 >c8 d8 c8 <b8 | a4. >c8 <b8 a8 g+8 f8 | g8 a8 b8 >d8 c8 <b8 a8 g+8 | e2. r4 |';
const DES_B =
  'o5 >e4. d8 c4 <a4 | b4. a8 g4 d4 | a4. g8 f4 c4 | e4 f4 g+2 | a4. b8 >c4 d4 | e2 c4 <a4 | >c4. <b8 a4 f4 | g+4. f8 e2 |';
const DES_C =
  'o4 b2 >e4 f4 | g+2. a8 g+8 | a2 >c4 <a4 | g+2. r4 | a4. b8 >c4 e4 | d2 <b4 g4 | a4. g+8 f4 d4 | e1 |';
// saidi: doum (low tom) on 1, 2& and 3; tek (rim) with ghosts; high-tom fill every 2nd bar
const desBase = {
  oud: '01213212',
  pad: '*',
  bass: '0..0..2.',
  perc: 't:x.....x.x....... r:..x.o.....o.x.o. x:x.o.x.o.x.o.x.o. i:................|............x.xx',
};
const desHi = {
  hbass: '0030 0020',
  hiarp: '0123 2101',
  drums: 'k:x.......x.x..... p:....x.......x... h:x.x.x.x.x.x.x.x. c:x;',
};
const desA: Section = {
  bars: 8,
  ch: 'E | F | E | Dm | E | F | G F | E',
  lead: DES_A,
  ...desBase,
  ...desHi,
};

export const desert: SongDef = {
  bpm: 132,
  gain: 0.77,
  delay: { beats: 0.75, fb: 0.28 },
  tracks: {
    lead: { inst: { ...P.lead12, gain: 0.2, vib: 20, vrate: 6.4, vdel: 0.12 }, rev: 0.18, dly: 0.12 },
    horn: { inst: { ...P.brass, gain: 0.14 }, rev: 0.3, dly: 0.1 },
    oud: {
      inst: { ...P.pluck, gain: 0.14 },
      kind: 'pat',
      step: 0.5,
      lo: 52,
      tones: 'triad',
      rev: 0.15,
      dly: 0.12,
      pan: -0.25,
    },
    pad: { inst: { ...P.strings, gain: 0.03 }, kind: 'pad', lo: 52, rev: 0.35 },
    bass: { inst: { ...P.bass, gain: 0.16 }, kind: 'pat', step: 0.5, lo: 33, tones: 'triad' },
    perc: { inst: P.kit, kind: 'drums', vol: 0.55, rev: 0.12, pan: -0.1 },
    hbass: {
      inst: { ...P.sawbass, gain: 0.075 },
      kind: 'pat',
      step: 0.5,
      lo: 33,
      tones: 'triad',
      layer: 'hi',
      gate: 0.75,
    },
    hiarp: {
      inst: { ...P.arp, gain: 0.07 },
      kind: 'pat',
      step: 0.25,
      lo: 64,
      tones: 'triad',
      layer: 'hi',
      pan: 0.3,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.45, rev: 0.1 },
  },
  sections: {
    intro: {
      bars: 4,
      ch: 'E | F | E | E',
      lead: 'o5 r1 | r1 | r2 b4. >c8 | <b8 a8 g+8 f8 e4 r4 |',
      ...desBase,
      hbass: desHi.hbass,
      drums: desHi.drums,
    },
    A: desA,
    B: { bars: 8, ch: 'Am | G | F | E | Dm | Am | F | E', lead: DES_B, ...desBase, ...desHi },
    A2: { ...desA, horn: 'k-12 ' + DES_A },
    C: {
      bars: 8,
      ch: 'E | E | F | E | Am | G | F | E',
      horn: DES_C,
      ...desBase,
      ...desHi,
      // darbuka takes the spotlight; the kit drops to half time
      perc: 't:x.....x.x.....x. r:..x.o.oo..o.x.oo x:x.o.x.o.x.o.x.o.',
      drums: 'k:x.........x..... p:........x....... h:x.x.x.x.x.x.x.x. c:x;',
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// RUINS (Sunken Temple) — mysterious & watery, C# minor with maj7/add9 colours and a
// Neapolitan D, 76 bpm. Echoing harp arpeggios through a long delay, drips, a breathy flute;
// the bell carries B. Loop ~76 s.

const RUI_A =
  'o5 g+2. f+8 e8 | e4. d+8 c+2 | c+4 e4 g+4 a4 | f+2. r4 | g+4. a8 b4 >c+4 | d+2 <b4 g+4 | a2 f+4 d4 | f+4 d+4 c2 |';
const RUI_B =
  'o5 c+4 e4 g+2 | f+4 d+4 c+2 | d+4 f+4 b2 | g+2. r4 | a4 g+4 f+4 c+4 | f+2 a4 b4 | >c+2 <g+2 | >c2. r4 |';
const RUI_DRIP = 'o6 r2 g+8 r8 r4 | r1 | r4. d+16 r16 r2 | r1 |';
const ruiBase = { pad: '*', arp: '02346432', bass: '0-------', drip: RUI_DRIP };
const ruiHi = {
  hbass: '0...0.2.',
  drums: 'k:x.........x..... t:......x.......x. h:..x...x...x...x. m:................|............o.oo',
};
const ruiA: Section = {
  bars: 8,
  ch: 'C#madd9 | Amaj7 | F#m9 | G#7sus4 | C#madd9 | Amaj9 | Dmaj7 | G#7',
  flute: RUI_A,
  ...ruiBase,
  ...ruiHi,
};

export const ruins: SongDef = {
  bpm: 76,
  gain: 0.71,
  delay: { beats: 0.75, fb: 0.45, lp: 1800 },
  tracks: {
    flute: { inst: { ...P.flute, gain: 0.09, lp: 3200 }, rev: 0.4, dly: 0.35 },
    low: { inst: { ...P.tri, gain: 0.08 }, tr: -12, rev: 0.4, dly: 0.2 },
    bell: { inst: { ...P.bell, gain: 0.17 }, rev: 0.5, dly: 0.35 },
    arp: {
      inst: { ...P.harp, gain: 0.09 },
      kind: 'pat',
      step: 0.5,
      lo: 49,
      tones: 'seventh',
      rev: 0.35,
      dly: 0.4,
      pan: -0.3,
    },
    shim: {
      inst: { ...P.glass, gain: 0.035 },
      kind: 'pat',
      step: 0.25,
      lo: 68,
      tones: 'seventh',
      rev: 0.5,
      dly: 0.4,
      pan: 0.35,
    },
    drip: { inst: { ...P.glass, gain: 0.06 }, rev: 0.5, dly: 0.5, pan: 0.4 },
    pad: { inst: { ...P.pad, gain: 0.03, lp: 750 }, kind: 'pad', lo: 49, rev: 0.45 },
    choir: { inst: { ...P.choir, gain: 0.035, lp: 1400 }, kind: 'pad', lo: 56, rev: 0.55 },
    bass: { inst: { ...P.bass, gain: 0.15 }, kind: 'pat', step: 0.5, lo: 33, tones: 'triad' },
    hbass: {
      inst: { ...P.pbass, gain: 0.13 },
      kind: 'pat',
      step: 0.5,
      lo: 33,
      tones: 'triad',
      layer: 'hi',
      gate: 0.6,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.7, rev: 0.3 },
  },
  sections: {
    intro: {
      bars: 2,
      ch: 'C#madd9 | Amaj7',
      ...ruiBase,
      drip: 'o6 r2 g+8 r8 r4 | r1 |',
      drums: ruiHi.drums,
    },
    A: ruiA,
    B: {
      bars: 8,
      ch: 'Amaj7 | Badd9 | G#m7 | C#m7 | F#m9 | Dmaj7 | G#sus4 | G#',
      bell: RUI_B,
      choir: '*',
      // 3-against-4 glass shimmer, like light through water
      shim: '0..2..1..3..2..1',
      ...ruiBase,
      ...ruiHi,
    },
    A2: { ...ruiA, low: RUI_A, shim: '0..2..1..3..2..1' },
  },
  order: ['intro', 'A', 'B', 'A2'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// STORM (Stormspire) — tense & windy, F minor with a lament bass (Fm - Fm/Eb - Db - C),
// 152 bpm. Fast 16th arpeggios and a howling slow-vibrato choir "wind" play even when calm;
// thunder rolls on the timpani. C is the eye of the storm (theremin). Loop ~63 s.

const STM_A =
  'o5 f4 c8 f8 a-4 g8 f8 | g4. a-8 g8 f8 e-8 c8 | d-4 f8 a-8 >c4 <b-8 a-8 | g2 e4 c4 | f4 d-8 f8 b-4 a-8 g8 | a-4. g8 f4 c4 | d-4 e-8 f8 g4 b-4 | >c4 <b-8 a-8 g4 e4 |';
const STM_B =
  'o5 a-2. f4 | g2 b-4 e-4 | g4. a-8 g4 e-4 | f2. c4 | b-2. >d-4< | >e-2 <b-4 g4 | >c2< g4 f4 | e2. r4 |';
const STM_C = 'o5 f2. e-4 | e-2. c4 | d-2 f4 b-4 | g2. r4 | f2. e-4 | g2. e-4 | f4 d-4 b-4 a-4 | g2 e2 |';
const stmBase = {
  arp: '0123 4321',
  wind: '*',
  bass: '0-------',
  perc: 'b:x...............|................|................|........x.......',
};
const stmHi = {
  hbass: '0000 3020',
  drums: 'k:x.x...x.x.x...x. s:....X.......X... h:xoxoxoxoxoxoxoxo t:................|............xxxx c:x;',
};
const STM_A_CH = 'Fm | Fm/Eb | Dbmaj7 | C | Bbm | Fm/Ab | Gm7b5 | C7';
const STM_B_CH = 'Dbmaj7 | Eb | Cm7 | Fm | Bbm | Eb | Csus4 | C';
const stmA: Section = { bars: 8, ch: STM_A_CH, lead: STM_A, ...stmBase, ...stmHi };
const stmB: Section = { bars: 8, ch: STM_B_CH, lead: STM_B, ...stmBase, ...stmHi };

export const storm: SongDef = {
  bpm: 152,
  gain: 0.63,
  delay: { beats: 0.75, fb: 0.3, lp: 2200 },
  tracks: {
    lead: { inst: { ...P.square, gain: 0.1 }, rev: 0.18, dly: 0.12 },
    lead2: { inst: { ...P.brass, gain: 0.07 }, tr: -12, rev: 0.2 },
    str: { inst: { ...P.strings, gain: 0.05, a: 0.08 }, rev: 0.35 },
    eye: { inst: { ...P.theremin, gain: 0.11 }, rev: 0.45, dly: 0.3 },
    arp: {
      inst: { ...P.arp, gain: 0.12 },
      kind: 'pat',
      step: 0.25,
      lo: 60,
      tones: 'seventh',
      rev: 0.2,
      dly: 0.2,
      pan: -0.3,
    },
    wind: {
      inst: { ...P.choir, gain: 0.035, lp: 1100, vib: 40, vrate: 0.7, vdel: 0.3 },
      kind: 'pad',
      lo: 53,
      rev: 0.5,
    },
    bass: { inst: { ...P.bass, gain: 0.15 }, kind: 'pat', step: 0.5, lo: 34, tones: 'triad', slash: true },
    perc: { inst: P.kit, kind: 'drums', vol: 0.4, rev: 0.35 },
    hbass: {
      inst: { ...P.sawbass, gain: 0.09 },
      kind: 'pat',
      step: 0.5,
      lo: 34,
      tones: 'triad',
      slash: true,
      layer: 'hi',
      gate: 0.75,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.42, rev: 0.15 },
  },
  sections: {
    intro: { bars: 4, ch: 'Fm | Fm/Eb | Dbmaj7 | C', ...stmBase, ...stmHi },
    A: stmA,
    B: stmB,
    C: {
      bars: 8,
      ch: 'Dbmaj7 | Cm7 | Bbm7 | C | Dbmaj7 | Cm7 | Bbm7 | Csus4 C',
      eye: STM_C,
      ...stmBase,
      arp: '0.2.3.2.',
      hbass: '0.......',
      drums: 't:x.......x....... h:..x...x...x...x. c:x;',
    },
    A2: { ...stmA, lead2: STM_A },
    B2: { ...stmB, str: STM_B },
  },
  order: ['intro', 'A', 'B', 'C', 'A2', 'B2'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// ECLIPSE (Eclipse Sanctum) — grand, eerie and holy, E minor with chromatic-mediant turns
// (C -> Cm, G#m -> Cmaj7), 88 bpm. A solo choir "voice" over organ and choir pads with a
// tolling bell; B quotes the Aetherfall leitmotif in E minor on the horn; C is a luminous
// E-major interlude that darkens again. Loop ~87 s.

const ECL_A = 'o4 e2 g4 b4 | >c2 <b2 | >c2 e-4 g4 | d2 <b2 | >c2 e4 a4 | a2 >c4 <a4 | e2 f+2 | d+1 |';
const ECL_C =
  'o5 g+2. f+8 e8 | e2 g+4 b4 | a2. g+8 f+8 | f+2. r4 | g+4. a8 b4 >e4< | >d+2 <b4 g+4 | g2 e4 g4 | f+2 d+2 |';
const eclBase = { choir: '*', organ: 'x---', bass: '0-0-', toll: 'o3 e1 | r1 | r1 | r1 |' };
const eclHi = {
  hbass: '0.0.0.0.',
  drums: 'b:x.......x....... s:................|........x.....oo h:..x...x...x...x. c:x;',
};
const eclA: Section = {
  bars: 8,
  ch: 'Em | Cmaj7 | Cm | G/B | Am | F | Bsus4 | B',
  voice: ECL_A,
  ...eclBase,
  ...eclHi,
};

export const eclipse: SongDef = {
  bpm: 88,
  gain: 0.66,
  delay: { beats: 1.5, fb: 0.3, lp: 2400 },
  tracks: {
    voice: {
      inst: { ...P.choir, gain: 0.12, a: 0.2, d: 0.6, s: 0.9, r: 0.7, lp: 2800 },
      rev: 0.45,
      dly: 0.2,
    },
    horn: { inst: { ...P.brass, gain: 0.11, lp: 600 }, rev: 0.4 },
    bell: { inst: { ...P.glock, gain: 0.04 }, tr: 12, rev: 0.45 },
    str: { inst: { ...P.strings, gain: 0.045, a: 0.1 }, tr: 12, rev: 0.4 },
    choir: { inst: { ...P.choir, gain: 0.045 }, kind: 'pad', lo: 52, rev: 0.55 },
    organ: { inst: { ...P.organ, gain: 0.026 }, kind: 'pad', step: 1, lo: 45, rev: 0.35 },
    bass: { inst: { ...P.bass, gain: 0.15 }, kind: 'pat', step: 1, lo: 33, tones: 'triad', slash: true },
    toll: { inst: { ...P.bell, gain: 0.12 }, rev: 0.55 },
    hbass: {
      inst: { ...P.sawbass, gain: 0.085 },
      kind: 'pat',
      step: 0.5,
      lo: 33,
      tones: 'triad',
      slash: true,
      layer: 'hi',
      gate: 0.7,
    },
    drums: { inst: P.kit, kind: 'drums', layer: 'hi', vol: 0.5, rev: 0.3 },
  },
  sections: {
    intro: { bars: 4, ch: 'Em | Cmaj7 | Cm | B', ...eclBase, drums: eclHi.drums },
    A: eclA,
    B: {
      bars: 8,
      ch: 'Em | D7 | Em | G | Am | C | B | Em',
      horn: 'k2 ' + MOTIF_MIN,
      bell: 'k2 ' + MOTIF_MIN,
      ...eclBase,
      toll: 'o3 e1 | r1 | r1 | r1 | r1 | r1 | r1 | r1 |',
      ...eclHi,
    },
    A2: { ...eclA, str: ECL_A },
    C: {
      bars: 8,
      ch: 'Emaj7 | C#m7 | Amaj7 | B | Emaj7 | G#m7 | Cmaj7 | B7',
      voice: ECL_C,
      bell: ECL_C,
      ...eclBase,
      organ: 'x-x-',
      ...eclHi,
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopTo: 'A',
};

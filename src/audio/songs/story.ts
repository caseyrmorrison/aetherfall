/** Title, town, cutscene, victory, game-over and credits music. */
import type { Section, SongDef } from '../notation';
import { P } from '../synth';
import { MOTIF, MOTIF_CH, THEME_B, THEME_B_CH } from './motif';

// ---------------------------------------------------------------------------------------------
// TITLE — majestic & nostalgic, D minor -> F major, 88 bpm

export const title: SongDef = {
  bpm: 88,
  gain: 0.61,
  delay: { beats: 0.75, fb: 0.3 },
  tracks: {
    lead: { inst: { ...P.lead, gain: 0.14 }, rev: 0.25, dly: 0.15 },
    horn: { inst: { ...P.brass, gain: 0.1 }, rev: 0.3 },
    bell: { inst: { ...P.glock, gain: 0.05 }, tr: 12, rev: 0.35 },
    harp: {
      inst: { ...P.harp, gain: 0.11 },
      kind: 'pat',
      step: 0.25,
      lo: 50,
      tones: 'triad',
      rev: 0.3,
      dly: 0.2,
      pan: -0.2,
    },
    pad: { inst: { ...P.strings, gain: 0.045 }, kind: 'pad', lo: 53, rev: 0.4 },
    bass: { inst: { ...P.bass, gain: 0.16 }, kind: 'pat', step: 1, lo: 33, tones: 'triad' },
    drums: { inst: P.kit, kind: 'drums', rev: 0.3, vol: 0.55 },
  },
  sections: {
    intro: { bars: 4, ch: 'Dm | Bb | Gm | A', harp: '0123 4321', pad: '*', bass: '0---' },
    A: {
      bars: 8,
      ch: MOTIF_CH,
      lead: MOTIF,
      harp: '0124 2124',
      pad: '*',
      bass: '0-2-',
      drums: 'b:x...............',
    },
    B: {
      bars: 8,
      ch: THEME_B_CH,
      lead: THEME_B,
      harp: '0123 4321',
      pad: '*',
      bass: '0-2-',
      drums: 'b:x.......x.......|x.......x...x.x.',
    },
    A2: {
      bars: 8,
      ch: MOTIF_CH,
      horn: MOTIF,
      bell: MOTIF,
      harp: '0124 5421',
      pad: '*',
      bass: '0202',
      drums: 'b:x.......x....... s:........x.......|........x.....oo c:x;',
    },
  },
  order: ['intro', 'A', 'B', 'A2'],
};

// ---------------------------------------------------------------------------------------------
// TOWN — warm pastoral village, G major, 112 bpm

const TOWN_A =
  'o5 d4 g8 a8 b4 a8 g8 | e4 e8 g8 b4. a8 | f+4 a8 f+8 g4 e4 | e4 c8 e8 d4 f+4 | g4 b8 >d8< g4 f+8 e8 | e4 g8 e8 c4 e4 | e8 d8 c8 d8 e4 f+4 | g2. r4 |';
const TOWN_B =
  'o5 g2 e4 g4 | a2 f+4 a4 | b4. a8 f+4 d4 | e2 g4 b4 | >c2 <b4 a4 | b4 a4 f+4 a4 | g4 e4 c4 e4 | a2 f+4 e8 f+8 |';
const townAcc = {
  bass: '0.2.3.2.',
  gtr: '.x.x.x.x',
  organ: '*',
  drums: 'k:x.......x....... r:....x.......x... x:..x...x...x...x.',
};
const townA: Section = {
  bars: 8,
  ch: 'G | Cmaj7 | Bm7 Em | Am7 D | G | C | Am7 D7 | G',
  lead: TOWN_A,
  ...townAcc,
};

export const town: SongDef = {
  bpm: 112,
  gain: 0.68,
  tracks: {
    lead: { inst: { ...P.flute, gain: 0.12 }, rev: 0.2 },
    glock: { inst: { ...P.glock, gain: 0.05 }, tr: 12, rev: 0.25 },
    bass: { inst: { ...P.bassPluck, gain: 0.2 }, kind: 'pat', step: 0.5, lo: 36, tones: 'triad' },
    gtr: { inst: { ...P.pluck, gain: 0.12 }, kind: 'pad', step: 0.5, lo: 55, pan: 0.25 },
    organ: { inst: { ...P.organ, gain: 0.03 }, kind: 'pad', lo: 52, pan: -0.2 },
    drums: { inst: P.kit, kind: 'drums', vol: 0.45 },
  },
  sections: {
    intro: { bars: 2, ch: 'G | D7', bass: townAcc.bass, gtr: townAcc.gtr, drums: townAcc.drums },
    A: townA,
    B: { bars: 8, ch: 'C | D | Bm7 | Em | Am7 | Bm7 | C | D7', lead: TOWN_B, ...townAcc },
    A2: { ...townA, glock: TOWN_A },
  },
  order: ['intro', 'A', 'B', 'A2'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// CUTSCENE_CALM — gentle, C major, 70 bpm

const CALM_A = 'o5 g2. e4 | e2. c4 | <a2 >c4 e4 | d2. r4 | g2. b4 | a4. g8 e2 | f4 a4 >c4< a4 | g2 d2 |';
const CALM_B = 'o5 c2 e4 a4 | g2. b4 | a2 f4 c4 | e2. r4 | f2 a4 >c4< | b2 g4 d4 | e2 g2 | c1 |';

export const cutscene_calm: SongDef = {
  bpm: 70,
  gain: 0.61,
  tracks: {
    lead: { inst: { ...P.flute, gain: 0.13 }, rev: 0.35 },
    harp: {
      inst: { ...P.harp, gain: 0.11 },
      kind: 'pat',
      step: 0.5,
      lo: 48,
      tones: 'seventh',
      rev: 0.35,
      pan: -0.2,
    },
    pad: { inst: { ...P.strings, gain: 0.04 }, kind: 'pad', lo: 55, rev: 0.4 },
    bass: { inst: { ...P.bass, gain: 0.14 }, kind: 'pat', step: 1, lo: 36, tones: 'triad' },
  },
  sections: {
    A: {
      bars: 8,
      ch: 'Cmaj7 | Am7 | Fmaj7 | G | Cmaj7 | Em7 | Fmaj7 | Gsus4 G',
      lead: CALM_A,
      harp: '0123 4321',
      pad: '*',
      bass: '0-2-',
    },
    B: {
      bars: 8,
      ch: 'Am | Em | F | C | Dm7 | G | C | C',
      lead: CALM_B,
      harp: '0213 2431',
      pad: '*',
      bass: '0-2-',
    },
  },
  order: ['A', 'B'],
};

// ---------------------------------------------------------------------------------------------
// CUTSCENE_SAD — piano-like decaying tones, A minor, 60 bpm

const SAD_A = 'o5 e2 c4 <a4> | f2. e4 | g2 e4 c4 | d2. r4 | e2 a4 b4 | >c2. <a4 | f2 e4 d4 | g+2. r4 |';
const SAD_B = 'o5 a2 >c4 <a4 | b2 >d4 <b4 | g2. e4 | a2. r4 | f2 a4 >d4< | >c2 <b4 a4 | a2 g4 f4 | e1 |';

export const cutscene_sad: SongDef = {
  bpm: 60,
  gain: 1.11,
  tracks: {
    lead: { inst: { ...P.piano, gain: 0.15 }, rev: 0.4 },
    acc: {
      inst: { ...P.piano, gain: 0.08 },
      kind: 'pat',
      step: 0.5,
      lo: 45,
      tones: 'triad',
      rev: 0.4,
      pan: -0.15,
    },
    pad: { inst: { ...P.strings, gain: 0.025 }, kind: 'pad', lo: 55, rev: 0.5 },
  },
  sections: {
    A: { bars: 8, ch: 'Am | F | C | G | Am | F | Dm | E', lead: SAD_A, acc: '0234 3232', pad: '*' },
    B: { bars: 8, ch: 'F | G | Em | Am | Dm | Am | F | E', lead: SAD_B, acc: '0234 3232', pad: '*' },
  },
  order: ['A', 'B'],
};

// ---------------------------------------------------------------------------------------------
// CUTSCENE_TENSE — low drone + ticking, D minor, 90 bpm

const TENSE_M = 'o3 d2. e-4 | d1 | f2. e-4 | d1 | a2. b-4 | a1 | g+2 a2 | a1 |';
const tenseCh = 'Dm | Dm | Eb | Dm | Dm | Bb/D | Eb | A7';

export const cutscene_tense: SongDef = {
  bpm: 90,
  gain: 0.6,
  tracks: {
    drone: { inst: { ...P.pad, gain: 0.045, lp: 500, a: 1.2 }, kind: 'pad', lo: 38, rev: 0.4 },
    low: { inst: { ...P.strings, gain: 0.07, lp: 900 }, rev: 0.3 },
    sub: { inst: { ...P.sub, gain: 0.12 }, kind: 'pat', step: 2, lo: 26, tones: 'triad' },
    arp: {
      inst: { ...P.arp, gain: 0.06, lp: 1600 },
      kind: 'pat',
      step: 0.25,
      lo: 62,
      tones: 'triad',
      pan: 0.3,
      rev: 0.3,
    },
    tick: { inst: P.kit, kind: 'drums', vol: 2, pan: 0.15 },
    beat: { inst: P.kit, kind: 'drums', vol: 0.6, rev: 0.2 },
  },
  sections: {
    A: {
      bars: 8,
      ch: tenseCh,
      drone: '*',
      low: TENSE_M,
      sub: '0-',
      tick: 'z:x.o.x.o.x.o.x.o.',
      beat: 'k:x..x............',
    },
    B: {
      bars: 8,
      ch: tenseCh,
      drone: '*',
      low: TENSE_M,
      sub: '0-',
      arp: '0202 1212',
      tick: 'z:x.o.x.o.x.o.x.o.',
      beat: 'k:x..x......x.x... b:x...............|................',
    },
  },
  order: ['A', 'B'],
};

// ---------------------------------------------------------------------------------------------
// CUTSCENE_EPIC — triumphant leitmotif, G major, 120 bpm

const EPIC_CH = 'G | Am | G | Bm | C | Em | D7 | G';

export const cutscene_epic: SongDef = {
  bpm: 120,
  gain: 0.66,
  tracks: {
    horn: { inst: { ...P.brass, gain: 0.13 }, rev: 0.3 },
    lead: { inst: { ...P.lead, gain: 0.13 }, rev: 0.25 },
    bell: { inst: { ...P.glock, gain: 0.05 }, tr: 12, rev: 0.3 },
    arp: {
      inst: { ...P.harp, gain: 0.09 },
      kind: 'pat',
      step: 0.25,
      lo: 55,
      tones: 'triad',
      rev: 0.25,
      pan: -0.25,
    },
    str: { inst: { ...P.strings, gain: 0.045 }, kind: 'pad', lo: 55, rev: 0.35 },
    bass: { inst: { ...P.bass, gain: 0.17 }, kind: 'pat', step: 0.5, lo: 31, tones: 'triad' },
    drums: { inst: P.kit, kind: 'drums', vol: 0.6, rev: 0.2 },
  },
  sections: {
    intro: {
      bars: 4,
      ch: 'Em | C | D | D',
      str: '*',
      bass: '0-------',
      arp: '0123 4321',
      drums: 'b:x...............|x...............|x...............|x.......x.x.xxxx',
    },
    A: {
      bars: 8,
      ch: EPIC_CH,
      horn: 'k2 ' + MOTIF,
      str: '*',
      bass: '0-2-0-2-',
      arp: '0123 4321',
      drums: 'k:x.......x....... s:....x.......x... c:x;',
    },
    B: {
      bars: 8,
      ch: EPIC_CH,
      lead: 'k2 ' + MOTIF,
      horn: 'k-10 ' + MOTIF,
      bell: 'k2 ' + MOTIF,
      str: '*',
      bass: '0-020-02',
      arp: '0123 4321',
      drums:
        'k:x.......x.x..... s:....x.......x... h:x.x.x.x.x.x.x.x. b:x...............|x.......x.x.xxxx c:x;',
    },
  },
  order: ['intro', 'A', 'B'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// VICTORY — fanfare, then a light celebratory loop, C major, 132 bpm

const VIC_F = 'o5 c12 e12 g12 >c4 <g8 >c8 e4 | d4. c8 d8 e8 f8 d8 | e2. r4 |';
const VIC_FB = 'o4 {ceg}2. r4 | {<b->df}2 {<a>cf}2 | {eg>c}2. r4 |';
const VIC_A =
  'o5 e8 g8 >c8 <g8 e8 g8 c4 | f8 a8 >c8 <a8 f4 a4 | g8 b8 >d8 <b8 g8 f8 d4 | e4 g4 >c4< r4 | a8 >c8 e8 c8 <a4 >c4< | f8 a8 >c8 <a8 f8 e8 d8 c8 | d4 g4 b4 >d4< | >c2< r2 |';
const vicA: Section = {
  bars: 8,
  ch: 'C | F | G | C | Am | F | G7 | C',
  lead: VIC_A,
  bass: '0.2.3.2.',
  gtr: '.x.x.x.x',
  drums: 'k:x.......x....... r:....x.......x... x:..x...x...x...x.',
};

export const victory: SongDef = {
  bpm: 132,
  gain: 0.87,
  tracks: {
    fan: { inst: { ...P.lead, gain: 0.12, vdel: 0.12 }, rev: 0.3, vol: 0.75 },
    brass: { inst: { ...P.brass, gain: 0.08 }, rev: 0.3, vol: 0.75 },
    fbass: { inst: { ...P.bass, gain: 0.18 }, vol: 0.75 },
    lead: { inst: { ...P.lead12, gain: 0.14 }, rev: 0.2 },
    bell: { inst: { ...P.glock, gain: 0.05 }, tr: 12, rev: 0.2 },
    bass: { inst: { ...P.bassPluck, gain: 0.18 }, kind: 'pat', step: 0.5, lo: 36, tones: 'triad' },
    gtr: { inst: { ...P.pluck, gain: 0.11 }, kind: 'pad', step: 0.5, lo: 55, pan: 0.25 },
    drums: { inst: P.kit, kind: 'drums', vol: 0.5, rev: 0.15 },
  },
  sections: {
    fanfare: {
      bars: 3,
      fan: VIC_F,
      brass: VIC_FB,
      fbass: 'o3 c2. r4 | <b-2 >f2 | c2. r4 |',
      drums: `b:x...............|x.......x.x.xxxx|X............... c:${'.'.repeat(32)}x;`,
    },
    A: vicA,
    A2: { ...vicA, bell: VIC_A },
  },
  order: ['fanfare', 'A', 'A2'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// GAMEOVER — somber, quiet, D minor, 62 bpm

const GO_A = 'o5 a2. f4 | d2. r4 | g2 b-4 a4 | c+2. r4 | d2 f4 a4 | b-2. g4 | f4 d4 e4 c+4 | d1 |';

export const gameover: SongDef = {
  bpm: 62,
  gain: 1.0,
  tracks: {
    lead: { inst: { ...P.piano, gain: 0.13 }, rev: 0.45 },
    pad: { inst: { ...P.strings, gain: 0.03, lp: 1000 }, kind: 'pad', lo: 50, rev: 0.5 },
    bass: { inst: { ...P.sub, gain: 0.07 }, kind: 'pat', step: 1, lo: 38, tones: 'triad' },
  },
  sections: {
    A: { bars: 8, ch: 'Dm | Bb | Gm | A | Dm | Gm | Bb A | Dm', lead: GO_A, pad: '*', bass: '0---' },
  },
  order: ['A'],
};

// ---------------------------------------------------------------------------------------------
// CREDITS — main theme, heroic & nostalgic, F major, 100 bpm (~2 min)

const CRED_C =
  'o5 d4. c8 d4 <b-4> | c4. d8 c4 <a4> | <b-4. >c8 d4 g4 | f2. r4 | g4. f8 e-4 b-4 | a4 b-8 a8 f2 | g4. a8 g4 e4 | e2 g4 b-4 |';
const credAcc = { harp: '0124 2124', pad: '*', bass: '0-2-' };

export const credits: SongDef = {
  bpm: 100,
  gain: 0.61,
  delay: { beats: 0.75, fb: 0.25 },
  tracks: {
    lead: { inst: { ...P.lead, gain: 0.14 }, rev: 0.25, dly: 0.12 },
    horn: { inst: { ...P.brass, gain: 0.1 }, rev: 0.3 },
    bell: { inst: { ...P.glock, gain: 0.05 }, tr: 12, rev: 0.3 },
    harp: {
      inst: { ...P.harp, gain: 0.1 },
      kind: 'pat',
      step: 0.25,
      lo: 50,
      tones: 'triad',
      rev: 0.3,
      dly: 0.15,
      pan: -0.2,
    },
    pad: { inst: { ...P.strings, gain: 0.045 }, kind: 'pad', lo: 53, rev: 0.4 },
    bass: { inst: { ...P.bass, gain: 0.16 }, kind: 'pat', step: 1, lo: 33, tones: 'triad' },
    drums: { inst: P.kit, kind: 'drums', vol: 0.55, rev: 0.2 },
  },
  sections: {
    intro: { bars: 4, ch: 'Dm | Bb | Gm | A', harp: '0123 4321', pad: '*', bass: '0---' },
    A: { bars: 8, ch: MOTIF_CH, lead: MOTIF, ...credAcc, drums: 'b:x...............' },
    B: {
      bars: 8,
      ch: THEME_B_CH,
      lead: THEME_B,
      ...credAcc,
      harp: '0123 4321',
      drums: 'b:x.......x....... x:..x...x...x...x.',
    },
    A2: {
      bars: 8,
      ch: MOTIF_CH,
      horn: MOTIF,
      bell: MOTIF,
      ...credAcc,
      bass: '0202',
      drums: 'k:x.......x....... s:....x.......x... h:x.x.x.x.x.x.x.x. c:x;',
    },
    C: {
      bars: 8,
      ch: 'Bb | F | Gm | Dm | Eb | Bb | C | C7',
      lead: CRED_C,
      ...credAcc,
      drums: 'k:x.......x....... r:....x.......x... x:..x...x...x...x.',
    },
    A3: {
      bars: 8,
      ch: MOTIF_CH,
      lead: MOTIF,
      horn: 'k-12 ' + MOTIF,
      bell: MOTIF,
      ...credAcc,
      harp: '0124 5421',
      bass: '0202',
      drums: 'k:x.......x.x..... s:....x.......x... h:x.x.x.x.x.x.x.x. c:x;',
    },
    outro: {
      bars: 4,
      ch: 'Bb | C | F | F',
      horn: 'o5 d1 | e1 | f1 | ^1 |',
      pad: '*',
      bass: '0---',
      harp: '0123 4321',
      drums: 'b:x...............|x...............|x...............;',
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C', 'A3', 'outro'],
};

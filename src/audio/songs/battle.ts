/** Boss battle music. */
import type { Section, SongDef } from '../notation';
import { P } from '../synth';
import { MOTIF, MOTIF_MIN, MOTIF_MIN_CH } from './motif';

// ---------------------------------------------------------------------------------------------
// BOSS — fast, aggressive, G minor, 160 bpm

const BOSS_A =
  'o5 g4 d8 g8 b-4 a8 g8 | f+4. g8 d2 | g4 b-8 >e-8 d4 c8 <b-8 | a2 f4 c4 | d4 g8 b-8 >d4 c8 <b-8 | a4. b-8 g2 | e-4 g8 b-8 >e-4 d8 c8 | d2 <a4 f+4 |';
const BOSS_B =
  'o5 c4 e-8 g8 r8 g8 a-8 g8 | f+4 a8 >d8 r8 c8 <a8 f+8 | g4. a8 b-4 >d4< | >e-2 <b-4 g4 | >c4 <b-8 a-8 g4 e-4 | f+4 g8 a8 >d4 <a4 | b-4. a-8 g4 e-4 | f+4 a4 >c4 <a4 |';
const bossDrums = 'k:x.x.x.x.x.x.x.x. s:....X.......X...|....X.......X.xx h:..x...x...x...x. c:x;';
const bossAcc = { bass: '0030 0020', pad: '*', stab: 'x..x..x.', drums: bossDrums };
const bossA: Section = { bars: 8, ch: 'Gm | Gm | Eb | F | Gm | Gm | Eb | D', lead: BOSS_A, ...bossAcc };
const bossB: Section = { bars: 8, ch: 'Cm | D | Gm | Eb | Cm | D | Eb | D7', lead: BOSS_B, ...bossAcc };

export const boss: SongDef = {
  bpm: 160,
  gain: 0.54,
  tracks: {
    lead: { inst: { ...P.square, gain: 0.11 }, rev: 0.12 },
    lead2: { inst: { ...P.brass, gain: 0.07 }, tr: -12, rev: 0.12 },
    bass: { inst: { ...P.sawbass, gain: 0.1 }, kind: 'pat', step: 0.5, lo: 31, tones: 'triad', gate: 0.8 },
    pad: { inst: { ...P.strings, gain: 0.035 }, kind: 'pad', lo: 55, rev: 0.25 },
    stab: { inst: { ...P.pluck, gain: 0.1 }, kind: 'pad', step: 0.5, lo: 55, pan: 0.25 },
    drums: { inst: P.kit, kind: 'drums', vol: 0.45, rev: 0.1 },
  },
  sections: {
    intro: {
      bars: 2,
      ch: 'Gm | D',
      bass: '0000 0000',
      stab: 'x..x..x.',
      drums:
        'k:x.x.x.x.x.x.x.x. t:x...x...x...x...|x.x.x.x......... m:................|........x.x..... i:................|............x.x. c:x;',
    },
    A: bossA,
    B: bossB,
    A2: { ...bossA, lead2: BOSS_A },
    B2: { ...bossB, lead2: BOSS_B },
  },
  order: ['intro', 'A', 'B', 'A2', 'B2'],
  loopTo: 'A',
};

// ---------------------------------------------------------------------------------------------
// FINAL BOSS — epic, D minor, 150 bpm. Riff (A) -> leitmotif in minor (B) -> riff (A2)
// -> leitmotif turned heroic in D major (C) -> loop.

const FB_A =
  'o5 d8 d8 a8 d8 >c8 <d8 b-8 a8 | d8 d8 a8 d8 >d8 c8 <b-8 a8 | b-4. a8 f4 d4 | e4. f8 g4 >c4< | d8 d8 a8 d8 >c8 <d8 b-8 a8 | d8 d8 a8 d8 >d8 c8 <b-8 a8 | g4. a8 b-4 >d4< | c+2 e4 a4 |';
const fbA: Section = {
  bars: 8,
  ch: 'Dm | Dm | Bb | C | Dm | Dm | Gm | A',
  lead: FB_A,
  bass: '0030 0020',
  arp: '0123 2101',
  str: '*',
  drums: 'k:x.x.x.x.x.x.x.x. s:....X.......X...|....X.......X.xx h:x.x.x.x.x.x.x.x. c:x;',
};

export const final_boss: SongDef = {
  bpm: 150,
  gain: 0.58,
  tracks: {
    lead: { inst: { ...P.square, gain: 0.1 }, rev: 0.15 },
    horn: { inst: { ...P.brass, gain: 0.1 }, rev: 0.3 },
    bell: { inst: { ...P.glock, gain: 0.05 }, tr: 12, rev: 0.3 },
    choir: { inst: { ...P.choir, gain: 0.05 }, kind: 'pad', lo: 57, rev: 0.45 },
    str: { inst: { ...P.strings, gain: 0.04 }, kind: 'pad', lo: 50, rev: 0.3 },
    bass: { inst: { ...P.sawbass, gain: 0.1 }, kind: 'pat', step: 0.5, lo: 33, tones: 'triad', gate: 0.8 },
    arp: { inst: { ...P.arp, gain: 0.08 }, kind: 'pat', step: 0.25, lo: 62, tones: 'triad', pan: 0.3 },
    drums: { inst: P.kit, kind: 'drums', vol: 0.42, rev: 0.15 },
  },
  sections: {
    intro: {
      bars: 4,
      ch: 'Dm | Bb | Gm | A',
      choir: '*',
      bass: '0-------',
      drums: 'b:X...............|X...............|X...............|X.......x.x.xxxx;',
    },
    A: fbA,
    B: {
      bars: 8,
      ch: MOTIF_MIN_CH,
      horn: MOTIF_MIN,
      choir: '*',
      bass: '0---0-2-',
      arp: '0123 2101',
      drums: 'b:x.......x....... k:x.x.x.x.x.x.x.x. s:....X.......X... c:x;',
    },
    A2: { ...fbA, horn: 'k-12 ' + FB_A },
    C: {
      bars: 8,
      ch: 'D | Em | D | F#m | G | Bm | A7 | D',
      horn: 'k-3 ' + MOTIF,
      bell: 'k-3 ' + MOTIF,
      choir: '*',
      str: '*',
      bass: '0030 0020',
      arp: '0123 4321',
      drums:
        'k:x.......x.x..... s:....X.......X... h:x.x.x.x.x.x.x.x. b:x...............|x.......x.x.xxxx c:x;',
    },
  },
  order: ['intro', 'A', 'B', 'A2', 'C'],
  loopTo: 'A',
};

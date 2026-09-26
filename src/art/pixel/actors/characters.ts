/**
 * Humanoid characters: 16x24 frames, feet anchor (8,23), authored facing
 * down / up / right (left = mirrored right). Heads are hand-drawn ASCII
 * templates per hair style; bodies, legs and arms are posed procedurally so
 * every character shares the same animation rig.
 */
import { PAL } from '../../palette';
import type { AnimName, CharacterId } from '../types';
import { Buf, INK, mix, type Col } from './buf';
import { anims, type FaceDir, type SpriteDef } from './defs';

const FW = 16;
const FH = 24;

// ------------------------------------------------------------------ heads ---

interface Tpl {
  y: number;
  rows: readonly string[];
}
type HeadSet = Readonly<Record<FaceDir, Tpl>>;

const HEADS = {
  spiky: {
    down: {
      y: 1,
      rows: [
        '....h..hh.h.....',
        '...hHh.hHhHh....',
        '..hHHHhHHHHHh...',
        '.hHLLHHHHHHHHh..',
        '.hHLHHHHHHHHHHh.',
        '.hHHHHHHHHHHHHh.',
        '.hHHSHHHSSHHSHh.',
        '..hSSESSSSESSh..',
        '..hSSeSSSSeSsh..',
        '..hSbSSSSSSbsh..',
        '...hSSSSSSSSh...',
        '.....sSSSSs.....',
      ],
    },
    up: {
      y: 1,
      rows: [
        '.....hh..h.h....',
        '...hhHHhhHhHh...',
        '..hHHHHHHHHHHh..',
        '.hHLLHHHHHHHHh..',
        '.hHLHHHHHHHHHHh.',
        '.hHHHHHHHHHHHHh.',
        '.hHHHHHHHHHHHHh.',
        '..hHHHHHHHHHHh..',
        '..hHHhHHHHhHHh..',
        '..hHhHHhHHHhHh..',
        '...hHhHHhHHhh...',
        '....h.hsshh.....',
      ],
    },
    right: {
      y: 1,
      rows: [
        '....hh.hh.......',
        '...hHHhHHhh.....',
        '..hHLLHHHHHhh...',
        '.hHLHHHHHHHHHh..',
        '.hHHHHHHHHHHHHh.',
        '.hHHHHHHHhHHhHh.',
        '.hHHHHHhSShSShh.',
        '..hHHHhSSSSSES..',
        '..hHHHsSSSSSeSS.',
        '...hHhSSSSSbSS..',
        '....hsSSSSSSs...',
        '......sSSSSs....',
      ],
    },
  },
  long: {
    down: {
      y: 2,
      rows: [
        '....hHHHHHHh....',
        '...hHLLHHHHHh...',
        '..hHLHHHHHYHHh..',
        '.hHLHHHHHYYYHHh.',
        '.hHHHHHHHHYHHHh.',
        '.hHHHSSHHHHSSHh.',
        '.hHSSESSSSESSHh.',
        '.hHSSeSSSSeSsHh.',
        '.hHSbSSSSSSbsHh.',
        '.hHhSSSSSSSShHh.',
        '.hHh.sSSSSs.hHh.',
        '.hHH........HHh.',
        '.hHH........HHh.',
        '..hh........hh..',
      ],
    },
    up: {
      y: 2,
      rows: [
        '....hHHHHHHh....',
        '...hHLLHHHHHh...',
        '..hHHYHHHHHHHh..',
        '.hHYYYHHHHHHHHh.',
        '.hHHYHHHHHHHHHh.',
        '.hHHHHHHHHHHHHh.',
        '.hHHHHHHHHHHHHh.',
        '.hHHHHHHHHHHHHh.',
        '.hHHHHhHHhHHHHh.',
        '.hHHHhHHHHhHHHh.',
        '..hHHHHHHHHHHh..',
        '...hHHHHHHHHh...',
        '...hHHHHHHHHh...',
        '....hHHHHHHh....',
        '....hHhHHhHh....',
        '.....h.hh.h.....',
      ],
    },
    right: {
      y: 2,
      rows: [
        '....hHHHHHh.....',
        '...hHLLHHHHh....',
        '..hHLHHHYHHHh...',
        '.hHLHHHYYYHHHh..',
        '.hHHHHHHYHHHHHh.',
        '.hHHHHHHHHHSSHh.',
        '.hHHHHHHhSSSES..',
        '.hHHHHHhSSSSeSS.',
        '.hHHHHHSsSSbSS..',
        '.hHHHHhSSSSSs...',
        '.hHHHHh.sSSs....',
        '.hHHHHh.........',
        '..hHHHh.........',
        '..hHHh..........',
        '...hh...........',
      ],
    },
  },
  bald: {
    down: {
      y: 3,
      rows: [
        '.....sSSSSs.....',
        '....SllSSSSs....',
        '...SlSSSSSSSs...',
        '...SSSSSSSSSs...',
        '..WwSSSSSSSSwW..',
        '..wWWWSSSSWWWw..',
        '..wSSESSSSESSw..',
        '...SSWWWWWWSs...',
        '...WWWWWWWWWW...',
        '...WWWWWWWWWW...',
        '....WWWWWWWW....',
        '....wWWWWWWw....',
        '.....wWWWWw.....',
        '......wWWw......',
      ],
    },
    up: {
      y: 3,
      rows: [
        '.....sSSSSs.....',
        '....SllSSSSs....',
        '...SlSSSSSSSs...',
        '...SSSSSSSSSs...',
        '..WSSSSSSSSSsW..',
        '..WWSSSSSSSsWW..',
        '..wWWsSSSsWWWw..',
        '...wWWWWWWWWw...',
        '....wwWWWWww....',
      ],
    },
    right: {
      y: 3,
      rows: [
        '......sSSSs.....',
        '.....SllSSSs....',
        '....SlSSSSSSs...',
        '...SSSSSSSSSs...',
        '...WWSSSSSSSSS..',
        '...WWWsSSSWWSS..',
        '...wWWSSSSSESS..',
        '....wWsSSSSSSSS.',
        '.....wWSSWWWWWS.',
        '......WWWWWWWW..',
        '.......WWWWWWW..',
        '........WWWWWw..',
        '.........WWWw...',
        '..........Ww....',
      ],
    },
  },
  short: {
    down: {
      y: 2,
      rows: [
        '....hhHHHHhh....',
        '...hHHLLHHHHh...',
        '..hHHLHHHHHHHh..',
        '..hHLHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHSSSSSHHHHh..',
        '..hSSESSSSESSh..',
        '..hSSeSSSSeSsh..',
        '...SbSSSSSSbs...',
        '....sSSSSSSs....',
        '.....sSSSSs.....',
      ],
    },
    up: {
      y: 2,
      rows: [
        '....hhHHHHhh....',
        '...hHHLLHHHHh...',
        '..hHHLHHHHHHHh..',
        '..hHLHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '...hHHHHHHHHh...',
        '....hhhhhhhh....',
        '.....sSSSSs.....',
      ],
    },
    right: {
      y: 2,
      rows: [
        '....hhHHHHh.....',
        '...hHHLLHHHh....',
        '..hHHLHHHHHHh...',
        '..hHLHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHHHHHHSSS..',
        '..hHHHHhSSSSES..',
        '..hHHHhSSSSSeSS.',
        '...hHhSsSSSbSS..',
        '....hhSSSSSSs...',
        '......sSSSSs....',
      ],
    },
  },
  ponytail: {
    down: {
      y: 2,
      rows: [
        '....rRRRRRRr....',
        '...rRQQRRRRRr...',
        '..rRQRRRRRRRRr..',
        '..rrRRRRRRRRrrH.',
        '..hHHHHHHHHHhHH.',
        '..hHHSSSHHSSHhH.',
        '..hSSESSSSESShH.',
        '..hSSeSSSSeSshH.',
        '...SbSSSSSSbshH.',
        '....sSSSSSSs.hH.',
        '.....sSSSSs..hH.',
        '.............hh.',
      ],
    },
    up: {
      y: 2,
      rows: [
        '....rRRRRRRr....',
        '...rRQQRRRRRr...',
        '..rRQRRRRRRRRr..',
        '.HrrRRRRRRRRrr..',
        '.HhHHHHrrHHHHh..',
        '.HhHHHHRrHHHHh..',
        '.HhHHHrRHrHHHh..',
        '.HhhHHHHHHHHh...',
        '.Hh.hHHHHHHh....',
        '.Hh..hsSSsh.....',
        '.hh.............',
      ],
    },
    right: {
      y: 2,
      rows: [
        '....rRRRRRr.....',
        '...rRQQRRRRr....',
        '..rRQRRRRRRRr...',
        '.rrRRRRRRRRRRr..',
        '.rhHHHHHHHHHHh..',
        '.hHhHHHHHHSSSS..',
        '.hHhHHHhSSSSES..',
        '.hHhHHhSSSSSeSS.',
        '.hHhhHSsSSSbSS..',
        '..hHh.hSSSSSs...',
        '..hh...sSSSs....',
      ],
    },
  },
  bun: {
    down: {
      y: 1,
      rows: [
        '......hHHh......',
        '.....hHLHHh.....',
        '....hhHHHHhh....',
        '...hHHLLHHHHh...',
        '..hHHLHHHHHHHh..',
        '..hHLHHHHHHHHh..',
        '..hHHSSSHHSSHh..',
        '..hSSESSSSESSh..',
        '..hSSeSSSSeSsh..',
        '..hSbSSSSSSbsh..',
        '...hsSSSSSSsh...',
        '.....sSSSSs.....',
      ],
    },
    up: {
      y: 1,
      rows: [
        '......hHHh......',
        '.....hHLHHh.....',
        '....hhHHHHhh....',
        '...hHHLLHHHHh...',
        '..hHHLHHHHHHHh..',
        '..hHLHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHhHHhHHHh..',
        '...hHHHHHHHHh...',
        '.....sSSSSs.....',
      ],
    },
    right: {
      y: 1,
      rows: [
        '...hHHh.........',
        '..hHLHHh........',
        '..hHHHHhhHHh....',
        '...hHLLHHHHHh...',
        '..hHLHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHHHHHHSSS..',
        '..hHHHHhSSSSES..',
        '..hHHHhSSSSSeSS.',
        '...hHhSsSSSbSS..',
        '....hhSSSSSSs...',
        '......sSSSSs....',
      ],
    },
  },
  messy: {
    down: {
      y: 2,
      rows: [
        '.....h.hh.h.....',
        '....hHhHHhHh....',
        '...hHHLHHHHHh...',
        '..hHLLHHHHHHHh..',
        '..hHLHHHHHHHHh..',
        '..hHHSHHHSHHHh..',
        '..hSSESSSSESSh..',
        '..hSSeSSSSeSsh..',
        '...SbSSSSSSbs...',
        '....sSSSSSSs....',
        '.....sSSSSs.....',
      ],
    },
    up: {
      y: 2,
      rows: [
        '.....h.hh.h.....',
        '....hHhHHhHh....',
        '...hHHLHHHHHh...',
        '..hHLLHHHHHHHh..',
        '..hHLHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHHHHHHHHh..',
        '..hHHHhHHhHHHh..',
        '...hHHHHHHHHh...',
        '....hhhhhhhh....',
        '.....sSSSSs.....',
      ],
    },
    right: {
      y: 2,
      rows: [
        '....h.hh........',
        '...hHhHHhh......',
        '..hHHLHHHHHh....',
        '..hHLLHHHHHHh...',
        '..hHLHHHHHHHHh..',
        '..hHHHHHHHHSHSh.',
        '..hHHHHhSSSSES..',
        '..hHHHhSSSSSeSS.',
        '...hHhSsSSSbSS..',
        '....hhSSSSSSs...',
        '......sSSSSs....',
      ],
    },
  },
  helmet: {
    down: {
      y: 1,
      rows: [
        '......rRRr......',
        '.....rRRRRr.....',
        '....mMNNMMMm....',
        '...mMNNMMMMMm...',
        '..mMNMMMMMMMMm..',
        '..mMMMMMMMMMMm..',
        '..mmmmmMMmmmmm..',
        '..mSSESmmSESSm..',
        '..mSSeSmmSeSsm..',
        '..mSbSSSSSSbsm..',
        '...mSSSSSSSSm...',
        '.....sSSSSs.....',
      ],
    },
    up: {
      y: 1,
      rows: [
        '......rRRr......',
        '.....rRRRRr.....',
        '....mMNNMMMm....',
        '...mMNNMMMMMm...',
        '..mMNMMMMMMMMm..',
        '..mMMMMMMMMMMm..',
        '..mMMMMMMMMMMm..',
        '..mMMMMMMMMMMm..',
        '..mmMMMMMMMMmm..',
        '..mmmmmmmmmmmm..',
        '...hHHHHHHHHh...',
        '.....sSSSSs.....',
      ],
    },
    right: {
      y: 1,
      rows: [
        '.....rRRr.......',
        '...rrRRRRr......',
        '....mMNNMMMm....',
        '...mMNNMMMMMm...',
        '..mMNMMMMMMMMm..',
        '..mMMMMMMMMMMm..',
        '..mmmmmmmmmmmmm.',
        '..mMMMmSSSSSES..',
        '..mMMMmSSSSSeSS.',
        '..mMMmSsSSSbSS..',
        '...mmSSSSSSSs...',
        '......sSSSSs....',
      ],
    },
  },
  // Tessaly: tricorn hat, grey-streaked braid over her right shoulder
  tricorn: {
    down: {
      y: 1,
      rows: [
        '.....tTTTTt.....',
        '....tTUUTTTt....',
        '.G..tTUTTTTt..G.',
        '.tG.TTTTTTTT.Gt.',
        '.tTGTTTTTTTTGTt.',
        '..ttGGGGGGGGtt..',
        '..hXSSSSSSSSHh..',
        '..hXSESSSSESSh..',
        '..hHSeSSSSeSsh..',
        '..hHbSSSSSSbsh..',
        '..hX.sSSSSSs....',
        '..Hh..sSSSs.....',
        '..hX............',
        '..Hh............',
        '..hX............',
        '...G............',
        '...X............',
      ],
    },
    up: {
      y: 1,
      rows: [
        '.....tTTTTt.....',
        '....tTTTTTTt....',
        '.G..tTTTTTTt..G.',
        '.tG.TTTTTTTT.Gt.',
        '.tTGTTTTTTTTGTt.',
        '..ttGGGGGGGGtt..',
        '..hHHXHHHHHHHh..',
        '..hHXHHHHHHXHh..',
        '..hHHHHHHHXHHh..',
        '..hHHHHHHXHHHh..',
        '...hHHHHHHHXXh..',
        '....hhsSSshHXh..',
        '...........hX...',
      ],
    },
    right: {
      y: 1,
      rows: [
        '.....tTTTt......',
        '....tTUUTTt.....',
        '.G..tUTTTTTt.G..',
        '.tG.TTTTTTTT.Gt.',
        '.tTGTTTTTTTTGTt.',
        '..ttGGGGGGGGtt..',
        '..hXHHHHHHHSSS..',
        '..hHXHHhSSSSES..',
        '..hHXHhSSSSSeSS.',
        '...hHhSsSSSbSS..',
        '....hhSSSSSSs...',
        '....Xh.sSSSs....',
        '.....hX.........',
        '.....Xh.........',
        '.....hX.........',
        '......G.........',
        '......X.........',
      ],
    },
  },
  // desert merchant: saffron head wrap with a teal band
  wrap: {
    down: {
      y: 1,
      rows: [
        '.....jJJJJj.....',
        '....jJIIJJJj....',
        '...jJIJJJJJJj...',
        '..jJJJJJJJJJJj..',
        '..jFFFFFfFFFFj..',
        '..jJJJJJJJJJJj..',
        '..jsSSSSSSSSsj..',
        '..jSSESSSSESSj..',
        '..jSSeSSSSeSsj..',
        '...SbSSSSSSbs...',
        '....sSSSSSSs....',
        '.....sSSSSs.....',
      ],
    },
    up: {
      y: 1,
      rows: [
        '.....jJJJJj.....',
        '....jJIJJJJj....',
        '...jJIJJJJJJj...',
        '..jJJJJJJJJJJj..',
        '..jFFFFFFFFFFj..',
        '..jJJJJJJJJJJj..',
        '..jjJJJJJJJJjj..',
        '..jJJjJJJJjJJj..',
        '...jJJJJJJJJj...',
        '....jjJJJJjj....',
        '.....jJJJJj.....',
        '......jJJj......',
        '......jJJj......',
      ],
    },
    right: {
      y: 1,
      rows: [
        '....jjJJJj......',
        '...jJIIJJJj.....',
        '..jJIJJJJJJj....',
        '..jJJJJJJJJJj...',
        '..jFFFFFFFfFj...',
        '..jJJJJJJJJJSs..',
        '..jJJJJJJjSSSS..',
        '..jJJJJJjSSSES..',
        '.jJjJJJjSSSSeSS.',
        '.jJ.jjSsSSSbSS..',
        '.jJ...sSSSSSs...',
        '..j....sSSSs....',
      ],
    },
  },
  // desert smith: shaved head, gold earring in the right ear
  shaved: {
    down: {
      y: 2,
      rows: [
        '.....sSSSSs.....',
        '....sSllSSSs....',
        '...sSlSSSSSSs...',
        '..sSSSSSSSSSSs..',
        '..sSSSSSSSSSSs..',
        '..sSnnSSSSnnSs..',
        '..sSSESSSSESSs..',
        '..sSSeSSSSeSss..',
        '..OSbSSSSSSbs...',
        '....sSSSSSSs....',
        '.....sSSSSs.....',
      ],
    },
    up: {
      y: 2,
      rows: [
        '.....sSSSSs.....',
        '....sSllSSSs....',
        '...sSlSSSSSSs...',
        '..sSSSSSSSSSSs..',
        '..sSSSSSSSSSSs..',
        '..sSSSSSSSSSSs..',
        '..sSSSSSSSSSSs..',
        '..sSSSSSSSSSSs..',
        '...sSSSSSSSSsO..',
        '....ssSSSSss....',
        '.....sSSSSs.....',
      ],
    },
    right: {
      y: 2,
      rows: [
        '.....sSSSSs.....',
        '....sSllSSSs....',
        '...sSlSSSSSSs...',
        '..sSSSSSSSSSSs..',
        '..sSSSSSSSSSSS..',
        '..sSSSSSSSSnnS..',
        '..sSSssSSSSSES..',
        '..sSSssSSSSSeSS.',
        '...sSOSsSSSbSS..',
        '....ssSSSSSSs...',
        '......sSSSSs....',
      ],
    },
  },
  // Order of Stars mage: white hood with gold trim, brown fringe
  hood: {
    down: {
      y: 1,
      rows: [
        '......zZZz......',
        '....zZZZZZZz....',
        '...zZZZZZZZZz...',
        '..zZZZZZZZZZZz..',
        '.zZZYYYYYYYYZZz.',
        '.zZYhHHHHHHhYZz.',
        '.zZYHHSSSSHHYZz.',
        '.zZYSESSSSESYZz.',
        '.zZYSeSSSSeSYZz.',
        '.zZzYbSSSSbYzZz.',
        '..zZzYsSSsYzZz..',
        '...zzZYYYYZzz...',
      ],
    },
    up: {
      y: 1,
      rows: [
        '......zZZz......',
        '....zZZZZZZz....',
        '...zZZZZZZZZz...',
        '..zZZZZzZZZZZz..',
        '.zZZZZZzZZZZZZz.',
        '.zZZZZZzZZZZZZz.',
        '.zZZZZZzZZZZZZz.',
        '.zZZZZZzZZZZZZz.',
        '.zZZZZZzZZZZZZz.',
        '.zzZZZZzZZZZZzz.',
        '..zzZZZzZZZZzz..',
        '...zzZZzZZZzz...',
        '.....zzYYzz.....',
      ],
    },
    right: {
      y: 1,
      rows: [
        '....zZZZz.......',
        '..zZZZZZZz......',
        '.zZZZZZZZZz.....',
        '.zZZZZZZZZZz....',
        '.zZZZZZZZZYYz...',
        '.zZZZZZZZYhHHY..',
        '.zZZZZZZYhHSSSY.',
        '.zZZZZZzYSSSSES.',
        '.zZZZZzYSSSSSeS.',
        '.zZZZZzYSsSSSbS.',
        '..zZZZzYsSSSSs..',
        '...zzzYYsSSs....',
      ],
    },
  },
} as const satisfies Record<string, HeadSet>;

type HeadStyle = keyof typeof HEADS;

const FACE_OVERLAYS = {
  beard: {
    down: {
      y: 10,
      rows: [
        '..WW..WWWW..WW..',
        '..WWWWWWWWWWWW..',
        '...WWWWWWWWWW...',
        '....wWWWWWWw....',
        '.....wWWWWw.....',
      ],
    },
    up: { y: 10, rows: ['..W..........W..', '..WW........WW..'] },
    right: {
      y: 9,
      rows: [
        '......W.........',
        '......WW...WWW..',
        '......WWWWWWWWW.',
        '.......WWWWWWW..',
        '........wWWWw...',
        '.........ww.....',
      ],
    },
  },
  goatee: {
    down: { y: 11, rows: ['.....wWWWWw.....', '......WWWW......', '.......ww.......'] },
    up: { y: 11, rows: [] },
    right: { y: 11, rows: ['.........WWWWw..', '..........WWw...', '...........w....'] },
  },
  mustache: {
    down: { y: 10, rows: ['.....WWWWWW.....', '.....W....W.....'] },
    up: { y: 10, rows: [] },
    right: { y: 10, rows: ['..........WWWW..', '............W...'] },
  },
} as const satisfies Record<string, HeadSet>;

// ---------------------------------------------------------- definitions ---

type BodyKind = 'tunic' | 'robe' | 'dress' | 'burly' | 'plump' | 'armor' | 'mantle' | 'coat' | 'layered';
type Letters = Record<string, Col>;

interface CharDef {
  pal: Letters;
  head: HeadStyle;
  body: BodyKind;
  face?: keyof typeof FACE_OVERLAYS;
  child?: boolean;
  prop?: 'star' | 'stick' | 'spear';
  scarf?: boolean;
  hem?: boolean;
  /** Gold hem + front seam on robes. */
  trim?: boolean;
  /** Order of Stars star badge on the chest (and back). */
  emblem?: boolean;
}

const SKIN: Letters = {
  S: PAL.skin,
  s: PAL.skinShade,
  l: '#f4d2b8',
  b: '#ef9a8c',
  E: INK,
};

function pal(p: Letters): Letters {
  const o: Letters = { ...SKIN, ...p };
  // a dark line colour used to separate overlapping limbs
  if (!o.o) o.o = mix(o.c ?? INK, INK, 0.55);
  return o;
}

const CHARS: Record<CharacterId, CharDef> = {
  hero: {
    head: 'spiky',
    body: 'tunic',
    hem: true,
    scarf: true,
    pal: pal({
      H: PAL.darkSlate,
      h: PAL.navy,
      L: PAL.slate,
      e: PAL.gold,
      C: PAL.sky,
      c: PAL.blue,
      D: '#4cc2ee',
      R: PAL.red,
      r: PAL.darkRed,
      Q: PAL.pink,
      B: PAL.darkBrown,
      G: PAL.gold,
      P: PAL.darkSlate,
      p: PAL.navy,
      K: PAL.brown,
      k: PAL.darkBrown,
    }),
  },
  lyra: {
    head: 'long',
    body: 'mantle',
    prop: 'star',
    pal: pal({
      H: PAL.lightGray,
      h: PAL.gray,
      L: PAL.white,
      Y: PAL.gold,
      y: PAL.orange,
      e: '#9c5fd6',
      C: PAL.blue,
      c: PAL.navy,
      D: '#2a6cb0',
      A: PAL.white,
      a: PAL.lightGray,
      B: PAL.gold,
      P: PAL.lightGray,
      p: PAL.gray,
      K: PAL.navy,
      k: INK,
      V: PAL.brown,
      v: PAL.darkBrown,
    }),
  },
  elder: {
    head: 'bald',
    body: 'robe',
    prop: 'stick',
    pal: pal({
      W: PAL.white,
      w: PAL.lightGray,
      C: PAL.darkGreen,
      c: PAL.forest,
      D: PAL.green,
      B: PAL.sand,
      G: PAL.tan,
      K: PAL.darkBrown,
      k: PAL.plum,
      V: PAL.brown,
      v: PAL.darkBrown,
    }),
  },
  blacksmith: {
    head: 'short',
    body: 'burly',
    face: 'beard',
    pal: pal({
      H: PAL.rust,
      h: PAL.darkBrown,
      L: PAL.orangeBrown,
      W: PAL.rust,
      w: PAL.darkBrown,
      e: PAL.darkBrown,
      S: '#dfa47f',
      s: '#b87a5c',
      C: PAL.darkSlate,
      c: PAL.navy,
      D: PAL.slate,
      A: PAL.brown,
      a: PAL.darkBrown,
      B: PAL.plum,
      G: PAL.gray,
      P: PAL.plum,
      p: INK,
      K: PAL.darkBrown,
      k: PAL.plum,
    }),
  },
  merchant: {
    head: 'ponytail',
    body: 'dress',
    pal: pal({
      H: PAL.brown,
      h: PAL.darkBrown,
      L: PAL.tan,
      R: PAL.orange,
      r: PAL.rust,
      Q: PAL.gold,
      e: PAL.darkGreen,
      C: PAL.darkGreen,
      c: PAL.forest,
      D: PAL.green,
      A: PAL.sand,
      a: PAL.tan,
      B: PAL.orange,
      K: PAL.darkBrown,
      k: PAL.plum,
      P: PAL.skin,
      p: PAL.skinShade,
    }),
  },
  innkeeper: {
    head: 'short',
    body: 'plump',
    face: 'mustache',
    pal: pal({
      H: PAL.darkBrown,
      h: PAL.plum,
      L: PAL.brown,
      W: PAL.darkBrown,
      w: PAL.plum,
      e: PAL.navy,
      C: PAL.rust,
      c: PAL.darkRed,
      D: PAL.orangeBrown,
      A: '#f2f4f8',
      a: PAL.lightGray,
      B: PAL.darkBrown,
      G: PAL.gold,
      P: PAL.darkBrown,
      p: PAL.plum,
      K: PAL.plum,
      k: INK,
    }),
  },
  villager_man: {
    head: 'short',
    body: 'tunic',
    pal: pal({
      H: PAL.darkBrown,
      h: PAL.plum,
      L: PAL.brown,
      e: PAL.navy,
      C: PAL.orangeBrown,
      c: PAL.rust,
      D: PAL.tan,
      B: PAL.darkBrown,
      G: PAL.sand,
      P: PAL.slate,
      p: PAL.darkSlate,
      K: PAL.darkBrown,
      k: PAL.plum,
    }),
  },
  villager_woman: {
    head: 'bun',
    body: 'dress',
    pal: pal({
      H: PAL.gold,
      h: PAL.orange,
      L: PAL.yellow,
      e: PAL.blue,
      C: PAL.magenta,
      c: PAL.purple,
      D: PAL.pink,
      A: PAL.white,
      a: PAL.lightGray,
      B: PAL.purple,
      K: PAL.darkBrown,
      k: PAL.plum,
      P: PAL.skin,
      p: PAL.skinShade,
    }),
  },
  child: {
    head: 'messy',
    body: 'tunic',
    child: true,
    pal: pal({
      H: PAL.orange,
      h: PAL.rust,
      L: PAL.gold,
      e: PAL.darkGreen,
      C: PAL.green,
      c: PAL.darkGreen,
      D: '#9de36f',
      B: PAL.darkBrown,
      G: PAL.sand,
      P: PAL.brown,
      p: PAL.darkBrown,
      K: PAL.darkBrown,
      k: PAL.plum,
    }),
  },
  guard: {
    head: 'helmet',
    body: 'armor',
    prop: 'spear',
    pal: pal({
      H: PAL.darkBrown,
      h: PAL.plum,
      R: PAL.red,
      r: PAL.darkRed,
      M: PAL.lightGray,
      m: PAL.slate,
      N: PAL.white,
      e: PAL.navy,
      C: PAL.blue,
      c: PAL.navy,
      D: PAL.sky,
      B: PAL.darkBrown,
      G: PAL.gold,
      P: PAL.darkSlate,
      p: PAL.navy,
      K: PAL.gray,
      k: PAL.slate,
      V: PAL.brown,
      v: PAL.darkBrown,
    }),
  },
  // ---------------------------------------------------- Act II: Solenne
  tessaly: {
    head: 'tricorn',
    body: 'coat',
    pal: pal({
      T: PAL.navy,
      t: INK,
      U: PAL.darkSlate,
      G: PAL.gold,
      H: PAL.plum,
      h: INK,
      X: PAL.gray,
      S: '#9a5c45',
      s: PAL.darkBrown,
      l: PAL.brown,
      b: '#b0584c',
      e: PAL.navy,
      C: PAL.blue,
      c: PAL.navy,
      D: '#2a6cb0',
      A: PAL.white,
      a: PAL.lightGray,
      B: PAL.darkBrown,
      P: PAL.sand,
      p: PAL.tan,
      K: PAL.darkBrown,
      k: PAL.plum,
    }),
  },
  desert_merchant: {
    head: 'wrap',
    body: 'layered',
    face: 'mustache',
    pal: pal({
      J: PAL.sand,
      j: PAL.tan,
      I: PAL.white,
      F: '#1f9192',
      f: PAL.gold,
      W: PAL.plum,
      w: INK,
      e: PAL.darkBrown,
      S: '#dfa47f',
      s: '#b87a5c',
      C: '#1f9192',
      c: '#1c5566',
      D: '#48c7b0',
      A: PAL.gold,
      a: PAL.orange,
      B: PAL.rust,
      G: PAL.yellow,
      K: PAL.darkBrown,
      k: PAL.plum,
    }),
  },
  desert_smith: {
    head: 'shaved',
    body: 'burly',
    face: 'goatee',
    pal: pal({
      W: PAL.plum,
      w: INK,
      S: PAL.skinShade,
      s: PAL.brown,
      l: PAL.tan,
      b: PAL.orangeBrown,
      n: PAL.plum,
      O: PAL.gold,
      e: PAL.plum,
      C: PAL.sand,
      c: PAL.tan,
      D: '#fff4dc',
      A: PAL.darkBrown,
      a: PAL.plum,
      B: INK,
      G: PAL.gold,
      P: PAL.darkRed,
      p: PAL.plum,
      K: PAL.darkBrown,
      k: PAL.plum,
    }),
  },
  order_mage: {
    head: 'hood',
    body: 'robe',
    trim: true,
    emblem: true,
    pal: pal({
      Z: PAL.white,
      z: PAL.lightGray,
      Y: PAL.gold,
      H: PAL.brown,
      h: PAL.darkBrown,
      e: PAL.sky,
      C: '#e4eaf2',
      c: PAL.lightGray,
      D: PAL.white,
      B: PAL.gold,
      G: PAL.yellow,
      K: PAL.darkBrown,
      k: PAL.plum,
    }),
  },
};

// ------------------------------------------------------------------ rig ---

interface Lay {
  hd: number; // head vertical offset
  top: number; // first torso row
  belt: number; // belt row
  hip: number; // hip row (legs start below)
}
const ADULT: Lay = { hd: 0, top: 13, belt: 17, hip: 18 };
const CHILD: Lay = { hd: 3, top: 16, belt: 19, hip: 20 };

type Hand = readonly [number, number];
type LegPose = 'stand' | 'stepL' | 'stepR' | 'strideA' | 'strideB' | 'pass' | 'passB' | 'wide';

interface Pose {
  dir: FaceDir;
  /** upper-body offset */
  dx: number;
  dy: number;
  /** extra head offset (relative to the upper body) */
  hx: number;
  hy: number;
  legs: LegPose;
  /** hand positions (absolute, before dx/dy). down/up: [screen-left, screen-right]; right: [far, near]. null = rest */
  l: Hand | null;
  r: Hand | null;
  /** draw the arm(s) over the head */
  armsOver?: boolean;
  eyes: 'open' | 'closed';
  /** cloth phase (scarf etc.) */
  t: number;
  moving: boolean;
}

function shoulders(d: CharDef, L: Lay, dir: FaceDir): [Hand, Hand] {
  if (dir === 'right')
    return [
      [6, L.top],
      [7, L.top],
    ];
  if (d.body === 'burly')
    return [
      [1, L.top],
      [13, L.top],
    ];
  if (d.body === 'plump')
    return [
      [1, L.top + 1],
      [13, L.top + 1],
    ];
  return [
    [3, L.top],
    [11, L.top],
  ];
}

function restHands(d: CharDef, L: Lay, dir: FaceDir): [Hand, Hand] {
  const [a, b] = shoulders(d, L, dir);
  const len = d.body === 'burly' ? 4 : d.body === 'plump' ? 3 : L.belt - 1 - L.top;
  return [
    [a[0], a[1] + len],
    [b[0], b[1] + len],
  ];
}

/** 2px wide limb from shoulder to hand; the last row/col is the hand. */
function drawArm(b: Buf, s: Hand, h: Hand, sl: Col, slS: Col, sk: Col, skS: Col): void {
  const pts = Buf.linePts(s[0], s[1], h[0], h[1]);
  const vertical = Math.abs(h[1] - s[1]) >= Math.abs(h[0] - s[0]);
  pts.forEach(([x, y], i) => {
    const last = i === pts.length - 1;
    const a = last ? sk : sl;
    const c = last ? skS : slS;
    if (vertical) {
      b.set(x, y, a);
      b.set(x + 1, y, c);
    } else {
      b.set(x, y, a);
      b.set(x, y + 1, c);
    }
  });
}

// ---------------------------------------------------------------- legs ---

function legsFront(b: Buf, q: Letters, L: Lay, dy: number, liftL: number, liftR: number, spread = 0): void {
  const hip = L.hip + dy;
  b.hline(5 - spread, 10 + spread, hip, q.P);
  const leg = (x: number, lift: number, left: boolean): void => {
    const bot = 22 - lift;
    const bt = bot - 1;
    for (let y = hip + 1; y < bt; y++) {
      b.set(x, y, q.P);
      b.set(x + 1, y, q.p);
    }
    const bx = left ? x - 1 : x;
    b.set(bx, bt, q.K)
      .set(bx + 1, bt, q.K)
      .set(bx + 2, bt, q.k);
    b.set(bx, bot, q.k)
      .set(bx + 1, bot, q.k)
      .set(bx + 2, bot, q.k);
  };
  leg(5 - spread, liftL, true);
  leg(9 + spread, liftR, false);
}

function legSide(b: Buf, q: Letters, hx: number, hy: number, fx: number, fy: number, far: boolean): void {
  const P = far ? q.p : q.P;
  const P2 = q.p;
  const K = far ? q.k : q.K;
  const pts = Buf.linePts(hx, hy, fx, fy - 2);
  for (const [x, y] of pts) {
    b.set(x, y, P);
    b.set(x + 1, y, far ? P : P2);
  }
  b.set(fx, fy - 1, K)
    .set(fx + 1, fy - 1, K)
    .set(fx + 2, fy - 1, K);
  b.set(fx, fy, q.k)
    .set(fx + 1, fy, q.k)
    .set(fx + 2, fy, q.k);
}

function drawLegs(b: Buf, d: CharDef, q: Letters, L: Lay, p: Pose): void {
  const dy = p.dy;
  const short = d.body === 'robe' || d.body === 'dress' || d.body === 'mantle' || d.body === 'layered';
  if (p.dir !== 'right') {
    let lL = 0;
    let lR = 0;
    if (p.legs === 'stepL') lL = 1;
    if (p.legs === 'stepR') lR = 1;
    if (short) {
      // only boots peek out below the skirt / robe
      const foot = (x: number, lift: number): void => {
        const y = 22 - lift;
        b.set(x, y - 1, q.K).set(x + 1, y - 1, q.K);
        b.set(x, y, q.k).set(x + 1, y, q.k);
      };
      foot(5, lL);
      foot(9, lR);
      return;
    }
    legsFront(b, q, L, dy, lL, lR, p.legs === 'wide' ? 1 : 0);
    return;
  }
  const hip = L.hip + dy;
  const far: [number, number] = [5, 22];
  const near: [number, number] = [7, 22];
  switch (p.legs) {
    case 'strideA':
      far[0] = 4;
      near[0] = 9;
      break;
    case 'strideB':
      far[0] = 8;
      near[0] = 4;
      break;
    case 'pass':
      far[0] = 5;
      far[1] = 21;
      break;
    case 'passB':
      near[0] = 6;
      near[1] = 21;
      far[0] = 7;
      break;
    case 'wide':
      far[0] = 3;
      near[0] = 9;
      break;
    default:
      break;
  }
  if (short) {
    const foot = (x: number, y: number, fr: boolean): void => {
      const x0 = Math.max(4, Math.min(9, x));
      b.set(x0, y - 1, fr ? q.k : q.K)
        .set(x0 + 1, y - 1, fr ? q.k : q.K)
        .set(x0 + 2, y - 1, fr ? q.k : q.K);
      b.set(x0, y, q.k)
        .set(x0 + 1, y, q.k)
        .set(x0 + 2, y, q.k);
    };
    foot(far[0], far[1], true);
    foot(near[0], near[1], false);
    return;
  }
  legSide(b, q, 6, hip, far[0], far[1], true);
  legSide(b, q, 7, hip, near[0], near[1], false);
}

// --------------------------------------------------------------- torso ---

function drawTorso(b: Buf, d: CharDef, q: Letters, L: Lay, p: Pose): void {
  const top = L.top + p.dy;
  const belt = L.belt + p.dy;
  const x = p.dx;
  const side = p.dir === 'right';
  const front = p.dir === 'down';
  const rowFill = (y: number, x0: number, x1: number, light: Col, mid: Col, dark: Col): void => {
    for (let i = x0; i <= x1; i++) b.set(i + x, y, i === x0 ? light : i === x1 ? dark : mid);
  };
  switch (d.body) {
    case 'tunic': {
      const [x0, x1] = side ? [5, 10] : [4, 11];
      for (let y = top; y < belt; y++) rowFill(y, x0, x1, side ? q.C : q.D, q.C, q.c);
      if (front && !d.scarf) {
        b.set(7 + x, top, q.S).set(8 + x, top, q.s);
        b.set(6 + x, top, q.c).set(9 + x, top, q.c);
      }
      b.hline(x0 + x, x1 + x, belt, q.B);
      if (front) b.set(7 + x, belt, q.G).set(8 + x, belt, q.G);
      if (side) b.set(x1 + x, belt, q.G);
      if (d.hem) {
        rowFill(belt + 1, x0, x1, q.C, q.C, q.c);
        if (!side) b.set(7 + x, belt + 1, q.c).set(8 + x, belt + 1, q.c);
      }
      break;
    }
    case 'robe': {
      for (let y = top; y <= 21; y++) {
        const wide = y >= 19 ? 1 : 0;
        const [x0, x1] = side ? [5 - wide, 10 + wide] : [4 - wide, 11 + wide];
        const yy = Math.min(21, y);
        rowFill(yy, x0, x1, q.D, q.C, q.c);
        if (y === 21) b.hline(x0 + x + 1, x1 + x, 21, q.c);
      }
      b.hline((side ? 5 : 4) + x, (side ? 10 : 11) + x, belt, q.B);
      if (front) {
        b.set(8 + x, belt, q.G);
        for (let y = belt + 1; y <= 21; y++) b.set(8 + x, y, q.c);
        b.set(7 + x, top, q.c).set(8 + x, top, q.c);
      }
      if (side) for (let y = belt + 1; y <= 21; y++) b.set(9 + x, y, q.c);
      if (d.trim) {
        // gold hem and front seam
        for (let i = 0; i < FW; i++) if (b.get(i, 21) !== null) b.set(i, 21, q.B);
        if (front) for (let y = belt + 1; y <= 20; y++) b.set(8 + x, y, q.B);
        if (side) for (let y = belt + 1; y <= 20; y++) b.set(10 + x + (y >= 19 ? 1 : 0), y, q.B);
      }
      break;
    }
    case 'dress': {
      const [x0, x1] = side ? [5, 10] : [4, 11];
      for (let y = top; y < belt; y++) rowFill(y, x0, x1, q.D, q.C, q.c);
      if (front) b.set(7 + x, top, q.S).set(8 + x, top, q.s);
      b.hline(x0 + x, x1 + x, belt, q.B);
      for (let y = belt + 1; y <= 20; y++) {
        const w = y - belt >= 2 ? 1 : 0;
        rowFill(y, x0 - w, x1 + w, q.D, q.C, q.c);
      }
      b.hline(x0 - 1 + x + 1, x1 + 1 + x, 20, q.c);
      if (front) {
        // apron
        for (let y = belt + 1; y <= 19; y++) rowFill(y, 5, 10, q.A, q.A, q.a);
        b.hline(6 + x, 9 + x, 20, q.a);
        b.set(5 + x, top + 1, q.A).set(10 + x, top + 1, q.a);
      } else if (side) {
        for (let y = belt + 1; y <= 19; y++) b.set(10 + x, y, q.A).set(11 + x, y, q.a);
      } else {
        b.set(7 + x, belt, q.A)
          .set(8 + x, belt, q.A)
          .set(6 + x, belt + 1, q.A)
          .set(9 + x, belt + 1, q.A);
      }
      break;
    }
    case 'burly': {
      const [x0, x1] = side ? [4, 11] : [3, 12];
      for (let y = top; y <= belt; y++) rowFill(y, x0, x1, q.D, q.C, q.c);
      if (front) {
        b.set(7 + x, top, q.S).set(8 + x, top, q.s);
        for (let y = top + 1; y <= 20; y++) {
          const [a0, a1] = y <= belt - 1 ? [5, 10] : [4, 11];
          rowFill(y, a0, a1, q.A, q.A, q.a);
        }
        b.set(5 + x, top, q.a).set(10 + x, top, q.a);
        b.hline(4 + x, 11 + x, belt - 1, q.a);
      } else if (side) {
        for (let y = top + 1; y <= 20; y++) {
          b.set(9 + x, y, q.A)
            .set(10 + x, y, q.A)
            .set(11 + x, y, q.a);
          if (y >= belt) b.set(8 + x, y, q.A);
        }
        b.set(9 + x, top, q.a);
      } else {
        // straps crossing on the back
        for (let i = 0; i < 4; i++) {
          b.set(4 + i + x, top + i, q.a);
          b.set(11 - i + x, top + i, q.a);
        }
        b.hline(3 + x, 12 + x, belt, q.a);
        b.set(3 + x, belt + 1, q.A).set(12 + x, belt + 1, q.a);
        b.set(3 + x, belt + 2, q.A).set(12 + x, belt + 2, q.a);
      }
      break;
    }
    case 'plump': {
      if (side) {
        for (let y = top; y <= belt + 1; y++) {
          const bulge = y >= top + 2 && y <= belt ? 2 : y === top + 1 || y === belt + 1 ? 1 : 0;
          rowFill(y, 5, 10 + bulge, q.C, q.C, q.c);
        }
        for (let y = top + 2; y <= 20; y++) {
          const bulge = y >= top + 2 && y <= belt ? 2 : y === belt + 1 ? 1 : 0;
          for (let i = 9; i <= 10 + bulge; i++) b.set(i + x, y, i === 10 + bulge || y === 20 ? q.a : q.A);
        }
        b.hline(5 + x, 8 + x, top + 2, q.a);
      } else {
        for (let y = top; y <= belt + 1; y++) {
          const w = y === top ? 0 : y === top + 1 || y === belt + 1 ? 1 : 2;
          rowFill(y, 4 - w, 11 + w, q.D, q.C, q.c);
        }
        if (front) {
          b.set(7 + x, top, q.S).set(8 + x, top, q.s);
          for (let y = top + 3; y <= 20; y++) {
            for (let i = 4; i <= 11; i++) b.set(i + x, y, i === 11 || y === 20 ? q.a : q.A);
          }
          // waist tie + pocket
          b.hline(3 + x, 12 + x, top + 2, q.a);
          b.hline(6 + x, 9 + x, belt + 1, q.a);
          b.set(6 + x, belt + 2, q.a).set(9 + x, belt + 2, q.a);
        } else {
          b.hline(2 + x, 13 + x, top + 2, q.a);
          b.set(7 + x, top + 3, q.A)
            .set(8 + x, top + 3, q.A)
            .set(6 + x, top + 4, q.A)
            .set(9 + x, top + 4, q.a);
        }
      }
      break;
    }
    case 'armor': {
      const [x0, x1] = side ? [5, 10] : [4, 11];
      for (let y = top; y < belt; y++) rowFill(y, x0, x1, q.N, q.M, q.m);
      b.hline(x0 + x, x1 + x, belt, q.B);
      if (front) {
        b.set(8 + x, belt, q.G);
        for (let y = top + 1; y <= belt + 2; y++) {
          b.set(7 + x, y, q.C).set(8 + x, y, y > belt ? q.c : q.C);
          if (y > top + 1) b.set(6 + x, y, q.D).set(9 + x, y, q.c);
        }
        b.set(7 + x, top + 2, q.G).set(8 + x, top + 2, q.G);
      } else if (side) {
        for (let y = top + 1; y <= belt + 2; y++) b.set(10 + x, y, q.C).set(9 + x, y, y > belt ? q.c : q.C);
      } else {
        b.hline(x0 + 1 + x, x1 - 1 + x, top + 1, q.m);
        for (let y = belt + 1; y <= belt + 2; y++) b.hline(5 + x, 10 + x, y, q.C);
      }
      break;
    }
    case 'mantle': {
      // dress below
      for (let y = belt + 1; y <= 20; y++) {
        const w = y >= 19 ? 1 : 0;
        const [x0, x1] = side ? [5 - w, 10 + w] : [4 - w, 11 + w];
        rowFill(y, x0, x1, q.A, q.A, q.a);
      }
      if (side) {
        for (let y = top; y <= belt; y++) {
          const w = y >= top + 2 ? 1 : 0;
          rowFill(y, 4 - w, 10, q.D, q.C, q.c);
          b.set(10 + x, y, q.Y);
        }
        b.hline(3 + x, 9 + x, belt, q.Y);
        // hood lump at the back of the neck
        b.set(4 + x, top - 1, q.c)
          .set(5 + x, top - 1, q.C)
          .set(3 + x, top, q.c);
      } else if (front) {
        for (let y = top; y <= belt; y++) {
          const w = y >= top + 1 ? 1 : 0;
          rowFill(y, 3 - w + 1, 12 + w - 1, q.D, q.C, q.c);
          if (y > top) {
            b.set(7 + x, y, q.A).set(8 + x, y, q.a);
            b.set(6 + x, y, q.Y).set(9 + x, y, q.Y);
          }
        }
        b.hline(3 + x, 12 + x, belt, q.Y);
        b.set(7 + x, belt, q.A).set(8 + x, belt, q.a);
        // collar (hood down)
        b.hline(3 + x, 5 + x, top - 1, q.c).hline(10 + x, 12 + x, top - 1, q.c);
        b.set(7 + x, top, q.Y).set(8 + x, top, q.Y);
      } else {
        for (let y = top - 1; y <= belt; y++) {
          const w = y >= top + 1 ? 1 : 0;
          rowFill(y, 3 - w + 1, 12 + w - 1, q.D, q.C, q.c);
        }
        b.hline(3 + x, 12 + x, belt, q.Y);
        // hood
        for (let y = top - 1; y <= top + 2; y++) b.hline(5 + x, 10 + x, y, q.c);
        b.hline(6 + x, 9 + x, top + 3, q.c);
        b.hline(5 + x, 10 + x, top - 1, q.Y);
      }
      break;
    }
    case 'coat': {
      // long captain's coat: open over a shirt, gold buttons, skirts to the knee
      const [x0, x1] = side ? [5, 10] : [4, 11];
      for (let y = top; y < belt; y++) rowFill(y, x0, x1, q.D, q.C, q.c);
      if (front) {
        for (let y = top; y < belt; y++) b.set(7 + x, y, q.A).set(8 + x, y, q.a);
        b.set(6 + x, top, q.D).set(9 + x, top, q.c);
        b.set(6 + x, top + 1, q.G).set(9 + x, top + 1, q.G);
        b.set(6 + x, top + 3, q.G).set(9 + x, top + 3, q.G);
      } else if (side) {
        b.set(10 + x, top, q.A).set(10 + x, top + 1, q.a);
        b.set(9 + x, top + 1, q.G).set(9 + x, top + 3, q.G);
      } else {
        b.hline(x0 + 1 + x, x1 - 1 + x, top, q.c);
      }
      b.hline(x0 + x, x1 + x, belt, q.B);
      if (front) b.set(7 + x, belt, q.G).set(8 + x, belt, q.G);
      if (side) b.set(x1 + x, belt, q.G);
      for (let y = belt + 1; y <= 20; y++) {
        const w = y >= 19 ? 1 : 0;
        if (front) {
          rowFill(y, x0 - w, 6, q.D, q.C, q.c);
          rowFill(y, 9, x1 + w, q.C, q.C, q.c);
        } else if (side) {
          rowFill(y, x0 - 1 - w, x1, q.D, q.C, q.c);
        } else {
          rowFill(y, x0 - w, x1 + w, q.D, q.C, q.c);
          if (y > belt + 1) b.set(8 + x, y, q.c);
        }
      }
      // gold-trimmed hem and back half-belt buttons
      for (let i = 0; i < FW; i++) {
        const c = b.get(i, 20);
        if (c === q.C || c === q.D || c === q.c) b.set(i, 20, q.G);
      }
      if (!front && !side) b.set(6 + x, belt, q.G).set(9 + x, belt, q.G);
      break;
    }
    case 'layered': {
      // teal outer robe open over a saffron under-robe, knotted sash
      for (let y = top; y <= 21; y++) {
        const wide = y >= 19 ? 1 : 0;
        const [x0, x1] = side ? [5 - wide, 10 + wide] : [4 - wide, 11 + wide];
        rowFill(y, x0, x1, q.D, q.C, q.c);
        if (y === 21) b.hline(x0 + x + 1, x1 + x, 21, q.c);
      }
      if (front) {
        for (let y = top; y <= 21; y++) {
          const w = y > belt ? Math.min(2, Math.floor((y - belt) / 2)) : 0;
          for (let i = 7 - w; i <= 8 + w; i++) b.set(i + x, y, i === 8 + w ? q.a : q.A);
        }
        b.set(6 + x, top, q.A).set(9 + x, top, q.a);
      } else if (side) {
        for (let y = top; y <= 21; y++) b.set(10 + x + (y >= 19 ? 1 : 0), y, y > belt ? q.A : q.a);
        b.set(9 + x, top, q.A);
      } else {
        // shawl draped over the shoulders
        b.hline(4 + x, 11 + x, top, q.A)
          .hline(5 + x, 10 + x, top + 1, q.A)
          .hline(6 + x, 9 + x, top + 2, q.a);
      }
      const [s0, s1] = side ? [5, 10] : [4, 11];
      b.hline(s0 + x, s1 + x, belt, q.B);
      if (front)
        b.set(9 + x, belt, q.G)
          .set(9 + x, belt + 1, q.B)
          .set(10 + x, belt + 2, q.B);
      else if (side)
        b.set(5 + x, belt + 1, q.B)
          .set(4 + x, belt + 2, q.B)
          .set(6 + x, belt, q.G);
      else b.set(5 + x, belt + 1, q.B).set(5 + x, belt + 2, q.G);
      break;
    }
  }
  if (d.emblem) {
    // Order of Stars badge
    const [ex, ey] =
      p.dir === 'right' ? [9 + x, top + 2] : p.dir === 'up' ? [8 + x, top + 3] : [9 + x, top + 2];
    b.set(ex, ey - 1, q.B)
      .set(ex - 1, ey, q.B)
      .set(ex, ey, q.G)
      .set(ex + 1, ey, q.B)
      .set(ex, ey + 1, q.B);
  }
}

// --------------------------------------------------------------- extras ---

/** Hero's red scarf: wrap + flowing tail. `layer` = 'back' (behind body) or 'front'. */
function drawScarf(b: Buf, q: Letters, L: Lay, p: Pose, layer: 'back' | 'front'): void {
  const top = L.top + p.dy;
  const x = p.dx;
  const t = p.t;
  if (p.dir === 'right') {
    if (layer === 'back') {
      // tail streaming behind (to the left)
      const tails: readonly (readonly string[])[] = p.moving
        ? [
            ['..QRR', 'RRRr.', '.r...'],
            ['...RR', '.RRr.', 'Rr...'],
            ['..QRR', 'RRrr.', '.....'],
            ['...RR', '..RRr', 'RRr..'],
          ]
        : [
            ['...RR', '..Rr.', '.Rr..', '.r...'],
            ['...RR', '..Rr.', '..Rr.', '..r..'],
          ];
      const tl = tails[t % tails.length];
      b.stamp(tl, q, Math.max(1, 1 + x), top, false);
      return;
    }
    b.hline(5 + x, 10 + x, top, q.R);
    b.set(5 + x, top, q.r)
      .set(9 + x, top, q.Q)
      .set(10 + x, top, q.R);
    b.set(10 + x, top + 1, q.r);
    return;
  }
  if (p.dir === 'down') {
    if (layer === 'back') {
      if (p.moving) {
        const flap = t % 2 === 0;
        b.set(13 + x, top - 1 + (flap ? 0 : 1), q.r).set(14 + x, top - 1 + (flap ? 1 : 0), q.r);
        b.set(12 + x, top, q.r);
      }
      return;
    }
    b.hline(4 + x, 11 + x, top, q.R);
    b.set(5 + x, top, q.Q)
      .set(6 + x, top, q.Q)
      .set(11 + x, top, q.r)
      .set(4 + x, top, q.r);
    // knot + hanging end on the chest
    const sway = p.moving && t % 2 === 1 ? 1 : 0;
    b.set(9 + x, top + 1, q.R).set(10 + x, top + 1, q.r);
    b.set(9 + x + sway, top + 2, q.R).set(10 + x + sway, top + 2, q.r);
    b.set(10 + x + sway, top + 3, q.r);
    return;
  }
  // up: wrap + two tails hanging down the back
  if (layer === 'back') return;
  b.hline(4 + x, 11 + x, top, q.R);
  b.set(4 + x, top, q.Q).set(11 + x, top, q.r);
  const sw = p.moving ? (t % 2 === 0 ? 1 : -1) : t % 2;
  b.set(8 + x, top + 1, q.R).set(9 + x, top + 1, q.r);
  b.set(8 + x, top + 2, q.R).set(9 + x, top + 2, q.r);
  b.set(8 + x + (sw > 0 ? 1 : 0), top + 3, q.R).set(9 + x + (sw > 0 ? 1 : 0), top + 3, q.r);
  b.set(9 + x + sw, top + 4, q.r);
  b.set(7 + x, top + 1, q.R).set(7 + x - (sw < 0 ? 1 : 0), top + 2, q.r);
}

function drawProp(b: Buf, d: CharDef, q: Letters, L: Lay, p: Pose): void {
  if (!d.prop) return;
  const dy = p.dy;
  const px = (p.dir === 'down' ? 3 : p.dir === 'up' ? 12 : 10) + p.dx;
  if (d.prop === 'spear') {
    const topY = 3 + dy;
    b.vline(px, topY + 3, 22, q.V);
    b.set(px, 22, q.v);
    b.set(px, topY, q.N)
      .set(px, topY + 1, q.M)
      .set(px, topY + 2, q.m);
    b.set(px - 1, topY + 2, q.m).set(px + 1, topY + 2, q.m);
    b.set(px, topY - 1, q.N);
    return;
  }
  if (d.prop === 'stick') {
    const topY = L.top + 1 + dy;
    const sx = p.dir === 'down' ? 2 : p.dir === 'up' ? 13 : 11;
    b.vline(sx + p.dx, topY, 22, q.V);
    b.set(sx + p.dx, 22, q.v);
    b.set(sx + p.dx + (p.dir === 'down' ? 1 : -1) * 0, topY - 1, q.v);
    b.set(sx + p.dx + (p.dir === 'right' || p.dir === 'up' ? -1 : 1), topY - 1, q.V);
    return;
  }
  // star staff
  const sx = (p.dir === 'down' ? 2 : p.dir === 'up' ? 13 : 12) + p.dx;
  const cy = (p.dir === 'right' ? 12 : 8) + dy;
  b.vline(sx, cy + 2, 21, q.V);
  b.set(sx, 21, q.v);
  b.set(sx, cy - 1, PAL.yellow)
    .set(sx - 1, cy, q.Y)
    .set(sx, cy, PAL.white)
    .set(sx + 1, cy, q.Y)
    .set(sx, cy + 1, q.y);
}

// ---------------------------------------------------------------- frame ---

function headTpl(d: CharDef, dir: FaceDir): Tpl {
  return HEADS[d.head][dir];
}

function drawHead(b: Buf, d: CharDef, q: Letters, L: Lay, p: Pose): void {
  const t = headTpl(d, p.dir);
  let letters: Letters = q;
  if (p.eyes === 'closed') letters = { ...q, E: q.S, e: INK };
  const ox = p.dx + p.hx;
  const oy = t.y + L.hd + p.dy + p.hy;
  b.stamp(t.rows, letters, ox, oy);
  if (d.face) {
    const f = FACE_OVERLAYS[d.face][p.dir];
    b.stamp(f.rows, q, ox, f.y + L.hd + p.dy + p.hy);
  }
}

function drawArms(b: Buf, d: CharDef, q: Letters, L: Lay, p: Pose, which: 'far' | 'near' | 'both'): void {
  if (d.body === 'mantle') {
    // arms hidden under the mantle: only hands peek out
    const [rl, rr] = restHands(d, L, p.dir);
    const hand = (h: Hand): void => {
      b.set(h[0] + p.dx, h[1] + p.dy, q.S).set(h[0] + 1 + p.dx, h[1] + p.dy, q.s);
    };
    if (p.dir === 'down' && which !== 'far') {
      hand(p.l ?? [2, rl[1] - 1]);
      if (p.r) hand(p.r);
    } else if (p.dir === 'up' && which !== 'far') {
      hand(p.r ?? [12, rr[1] - 1]);
    } else if (p.dir === 'right' && which !== 'far') {
      hand(p.r ?? [11, rr[1] - 1]);
    }
    return;
  }
  const [sl, sr] = shoulders(d, L, p.dir);
  const [rl, rr] = restHands(d, L, p.dir);
  const bare = d.body === 'burly';
  const armor = d.body === 'armor';
  const sleeve = bare ? q.S : armor ? q.M : q.C;
  const sleeveS = bare ? q.s : armor ? q.m : q.c;
  const hand = armor ? q.K : q.S;
  const handS = armor ? q.k : q.s;
  const off = (h: Hand): Hand => [h[0] + p.dx, h[1] + p.dy];
  if (p.dir === 'right') {
    if (which !== 'near') {
      drawArm(b, off(sl), off(p.l ?? rl), q.c, q.o, handS, handS);
    }
    if (which !== 'far') {
      const lay = new Buf(FW, FH);
      drawArm(
        lay,
        off(sr),
        off(p.r ?? rr),
        bare || armor ? sleeve : q.D,
        bare || armor ? sleeveS : q.C,
        hand,
        handS,
      );
      if (armor) lay.set(sr[0] + p.dx, sr[1] + p.dy, q.N).set(sr[0] + 1 + p.dx, sr[1] + p.dy, q.M);
      b.overlay(lay, q.o, 'back');
    }
    return;
  }
  // down / up: both arms are at the sides
  const lay = new Buf(FW, FH);
  drawArm(lay, off(sl), off(p.l ?? rl), sleeve, sleeveS, hand, handS);
  drawArm(lay, off(sr), off(p.r ?? rr), sleeveS, sleeveS, handS, handS);
  if (armor) {
    lay
      .set(sl[0] - 1 + p.dx, sl[1] + p.dy, q.M)
      .set(sl[0] + p.dx, sl[1] + p.dy, q.N)
      .set(sl[0] + 1 + p.dx, sl[1] + p.dy, q.M);
    lay
      .set(sr[0] + p.dx, sr[1] + p.dy, q.M)
      .set(sr[0] + 1 + p.dx, sr[1] + p.dy, q.M)
      .set(sr[0] + 2 + p.dx, sr[1] + p.dy, q.m);
  }
  const custom = p.l !== null || p.r !== null;
  if (custom) b.overlay(lay, q.o, 'all');
  else b.blit(lay);
}

function composeChar(d: CharDef, p: Pose): Buf {
  const q = d.pal;
  const L = d.child ? CHILD : ADULT;
  const b = new Buf(FW, FH);
  const dir = p.dir;
  if (dir === 'up') drawProp(b, d, q, L, p);
  if (d.scarf) drawScarf(b, q, L, p, 'back');
  if (dir === 'right') drawArms(b, d, q, L, p, 'far');
  drawLegs(b, d, q, L, p);
  drawTorso(b, d, q, L, p);
  if (d.scarf) drawScarf(b, q, L, p, 'front');
  if (dir === 'right') {
    if (!p.armsOver) drawArms(b, d, q, L, p, 'near');
    drawHead(b, d, q, L, p);
    if (p.armsOver) drawArms(b, d, q, L, p, 'near');
  } else {
    if (!p.armsOver) drawArms(b, d, q, L, p, 'both');
    drawHead(b, d, q, L, p);
    if (p.armsOver) drawArms(b, d, q, L, p, 'both');
  }
  if (dir !== 'up') drawProp(b, d, q, L, p);
  if (d.prop && dir !== 'up') {
    // hand over the prop
    const [rl] = restHands(d, L, dir);
    if (dir === 'down' && d.body !== 'mantle') b.set(rl[0] + p.dx, rl[1] + p.dy, q.S);
  }
  b.outline(INK);
  return b;
}

// ------------------------------------------------------------ hero roll ---

const ROLL_BALL = [
  '....hHHh....',
  '..hHHLLHHh..',
  '.hHHLHHHHHh.',
  '.HHHHHHHHHSs',
  'hHHHHHHHHSSs',
  'RRRRQQRRRRRr',
  'CDDCCCCCCBKk',
  'CDCCCCCCCBKk',
  'cCCCCCCCCBKk',
  '.cCCCCCCBKk.',
  '..cCCCCCBk..',
  '....cccc....',
];

/** Looping band texture for rolling toward / away from the camera. */
const ROLL_BANDS = [
  'HHLHHHHHHHHH',
  'HHHHHHHHHHHH',
  'hHHHHHHHHHHh',
  'RRQRRRRRRRRr',
  'CDCCCCCCCCCc',
  'CDCCCCCCCCCc',
  'CCCCCCCCCCCc',
  'BBBBGBBBBBBB',
  'PPPPPPPPPPPp',
  'KKKkkKKKKKkk',
  'hHHHHHHHHHHh',
  'HHHHHHHHHHHH',
];

function heroRoll(frame: number, dir: FaceDir): Buf {
  const d = CHARS.hero;
  const q = d.pal;
  const disc = new Buf(12, 12).ellipse(6, 6, 6, 6, '#000000');
  let ball: Buf;
  if (dir === 'right') {
    ball = Buf.rows(ROLL_BALL, q).rot90(frame);
  } else {
    // scroll the bands downward (toward camera) or upward (away)
    ball = new Buf(12, 12);
    const shift = dir === 'down' ? -frame * 3 : frame * 3;
    for (let y = 0; y < 12; y++) {
      const row = ROLL_BANDS[(((y + shift) % 12) + 12) % 12];
      ball.stamp([row], q, 0, y);
    }
  }
  // clip to the disc
  ball.each((_c, x, y) => {
    if (!disc.has(x, y)) ball.set(x, y, null);
  });
  const b = new Buf(FW, FH);
  const lift = frame === 1 || frame === 2 ? 1 : 0;
  const bx = 2;
  const by = 11 - lift;
  // scarf trailing behind the ball
  const w = frame % 2;
  if (dir === 'right') {
    b.set(bx - 1, by + 5 + w, q.R)
      .set(bx, by + 4 + w, q.R)
      .set(bx - 1, by + 6 + w, q.r);
  } else if (dir === 'down') {
    b.set(bx + 5 + w, by - 1, q.R)
      .set(bx + 6 + w, by - 1, q.r)
      .set(bx + 6 + w, by - 2 + w, q.r);
  }
  b.blit(ball, bx, by);
  // consistent top-left lighting regardless of rotation
  const cx = bx + 6;
  const cy = by + 6;
  const src = b.clone();
  src.each((c, x, y) => {
    const nx = x + 0.5 - cx;
    const ny = y + 0.5 - cy;
    const r = Math.hypot(nx, ny);
    if (r < 3.6 || r > 6.5) return;
    const lit = -(nx * 0.6 + ny * 0.8) / r;
    if (lit < -0.35) b.set(x, y, mix(c, INK, 0.38));
    else if (lit > 0.6) b.set(x, y, mix(c, '#ffffff', 0.2));
  });
  b.outline(INK);
  return b;
}

// --------------------------------------------------------------- poses ---

function basePose(dir: FaceDir): Pose {
  return {
    dir,
    dx: 0,
    dy: 0,
    hx: 0,
    hy: 0,
    legs: 'stand',
    l: null,
    r: null,
    eyes: 'open',
    t: 0,
    moving: false,
  };
}

function idlePose(dir: FaceDir, f: number): Pose {
  const p = basePose(dir);
  // 8 frames: breathe every 2 frames, blink on frame 5
  const breath = Math.floor(f / 2) % 2;
  p.hy = breath;
  p.eyes = f === 5 ? 'closed' : 'open';
  p.t = breath;
  return p;
}

function walkPose(d: CharDef, dir: FaceDir, f: number): Pose {
  const p = basePose(dir);
  const L = d.child ? CHILD : ADULT;
  const [rl, rr] = restHands(d, L, dir);
  p.moving = true;
  p.t = f;
  if (dir === 'right') {
    const legs: LegPose[] = ['strideA', 'pass', 'strideB', 'passB'];
    p.legs = legs[f];
    p.dy = f % 2 === 1 ? 0 : 1;
    if (f === 0) {
      p.r = [rr[0] - 2, rr[1] - 1];
      p.l = [rl[0] + 2, rl[1] - 1];
    } else if (f === 2) {
      p.r = [rr[0] + 2, rr[1] - 1];
      p.l = [rl[0] - 2, rl[1] - 1];
    }
    if (p.l) p.l = null; // far arm stays tucked behind the body
    return p;
  }
  const legs: LegPose[] = ['stand', 'stepL', 'stand', 'stepR'];
  p.legs = legs[f];
  p.dy = f % 2 === 1 ? 0 : 1;
  if (f === 1) p.l = [rl[0], rl[1] - 1];
  if (f === 3) p.r = [rr[0], rr[1] - 1];
  return p;
}

// hero-only poses. Hand positions are exported (heroHand) so the engine can
// attach the weapon precisely.
function heroPose(anim: AnimName, f: number, dir: FaceDir): Pose {
  const p = basePose(dir);
  switch (anim) {
    case 'attack':
      if (dir === 'down') {
        if (f === 0) {
          p.l = [1, 10];
          p.armsOver = true;
          p.dy = 0;
          p.hy = 0;
        } else {
          p.l = [5, 18];
          p.dy = 1;
          p.hy = 0;
          p.legs = 'wide';
          p.armsOver = true;
        }
      } else if (dir === 'up') {
        if (f === 0) {
          p.r = [13, 17];
        } else {
          p.r = [13, 9];
          p.legs = 'wide';
          p.armsOver = true;
        }
      } else if (f === 0) {
        p.r = [3, 15];
        p.dx = -1;
        p.hx = 1;
      } else {
        p.r = [12, 15];
        p.dx = 1;
        p.hx = -1;
        p.legs = 'strideA';
        p.moving = true;
      }
      p.t = f;
      return p;
    case 'cast':
      p.armsOver = true;
      if (dir === 'down') {
        p.l = [1, 7];
      } else if (dir === 'up') {
        p.r = [13, 7];
      } else {
        p.r = [13, 10];
        p.armsOver = false;
      }
      return p;
    case 'hurt':
      p.eyes = 'closed';
      if (dir === 'right') {
        p.dx = -1;
        p.hx = 1;
        p.hy = 1;
        p.r = [4, 14];
        p.legs = 'strideB';
      } else {
        p.dy = 1;
        p.l = [1, 13];
        p.r = [13, 13];
        p.legs = 'wide';
      }
      p.moving = true;
      return p;
    default:
      return p;
  }
}

// ----------------------------------------------------------------- defs ---

const NPC_ANIMS = anims({ idle: [8, 4], walk: [4, 8] });
const HERO_ANIMS = anims({
  idle: [8, 4],
  walk: [4, 8],
  attack: [2, 10],
  cast: [1, 1],
  hurt: [1, 1],
  roll: [4, 14],
});

function charDef(id: CharacterId): SpriteDef {
  const d = CHARS[id];
  return {
    info: { w: FW, h: FH, anchorX: 8, anchorY: 23, dirs: 4, anims: id === 'hero' ? HERO_ANIMS : NPC_ANIMS },
    draw(anim, frame, dir) {
      if (anim === 'walk') return composeChar(d, walkPose(d, dir, frame));
      if (id === 'hero') {
        if (anim === 'roll') return heroRoll(frame, dir);
        if (anim === 'attack' || anim === 'cast' || anim === 'hurt')
          return composeChar(d, heroPose(anim, frame, dir));
      }
      return composeChar(d, idlePose(dir, frame));
    },
  };
}

export const CHARACTER_DEFS: Record<CharacterId, SpriteDef> = {
  hero: charDef('hero'),
  lyra: charDef('lyra'),
  elder: charDef('elder'),
  blacksmith: charDef('blacksmith'),
  merchant: charDef('merchant'),
  innkeeper: charDef('innkeeper'),
  villager_man: charDef('villager_man'),
  villager_woman: charDef('villager_woman'),
  child: charDef('child'),
  guard: charDef('guard'),
  tessaly: charDef('tessaly'),
  desert_merchant: charDef('desert_merchant'),
  desert_smith: charDef('desert_smith'),
  order_mage: charDef('order_mage'),
};

/**
 * Where the hero's weapon hand is in a given frame (frame pixel coords,
 * already mirrored for 'left'). Null during 'roll'.
 */
export function heroHand(
  anim: AnimName,
  frame: number,
  dir: 'down' | 'up' | 'left' | 'right',
): { x: number; y: number } | null {
  if (anim === 'roll') return null;
  const fd: FaceDir = dir === 'left' ? 'right' : dir;
  const d = CHARS.hero;
  let p: Pose;
  if (anim === 'walk') p = walkPose(d, fd, ((frame % 4) + 4) % 4);
  else if (anim === 'attack' || anim === 'cast' || anim === 'hurt')
    p = heroPose(anim, anim === 'attack' ? ((frame % 2) + 2) % 2 : 0, fd);
  else p = idlePose(fd, ((frame % 8) + 8) % 8);
  const [rl, rr] = restHands(d, ADULT, fd);
  // weapon hand: down → screen-left arm, up → screen-right arm, side → near arm
  const h = fd === 'down' ? (p.l ?? rl) : (p.r ?? rr);
  let x = h[0] + p.dx + 0.5;
  const y = h[1] + p.dy + 0.5;
  if (dir === 'left') x = FW - x;
  return { x: Math.round(x * 2) / 2, y };
}

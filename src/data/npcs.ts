/** Town NPCs: who they are, where they appear and what they say as the story progresses. */
import type { PortraitId } from '../art/anime';
import type { CharacterId, Dir } from '../art/pixel/types';
import type { Step } from '../game/dialogue';
import { hasFlag, type SaveData } from '../game/state';

export type Service = 'shop' | 'smith' | 'inn' | 'board' | 'respec';

export interface NpcContext {
  save: SaveData;
  hero: string;
  open: (service: Service) => void;
}

export interface NpcDef {
  id: string;
  name: string;
  sprite: CharacterId;
  portrait?: PortraitId;
  facing?: Dir;
  wander?: number;
  /** The town this person lives in (for quest markers). Defaults to Havenbrook. */
  home?: 'town' | 'solenne';
  visible?: (s: SaveData) => boolean;
  lines: (c: NpcContext) => Step[];
}

const say = (text: string): Step => ({ text });
const f = (s: SaveData, flag: string): boolean => hasFlag(s, flag);

function gateGuard(
  id: string,
  zone: string,
  flag: string,
  dir: string,
  home: 'town' | 'solenne' = 'town',
): NpcDef {
  return {
    id,
    name: home === 'solenne' ? 'Harbor Guard' : 'Town Guard',
    sprite: 'guard',
    facing: 'down',
    home,
    lines: ({ save }) =>
      f(save, flag)
        ? [say(`The ${dir} road is open again, thanks to you. ${zone} lies beyond. Stay sharp out there.`)]
        : [
            say(`Halt! The ${dir} road is sealed by some strange power. Nobody passes until it lifts.`),
            say('Word is it’s tied to the shards. Maybe you’d know more about that than me.'),
          ],
  };
}

export const NPCS: Record<string, NpcDef> = {
  maren: {
    id: 'maren',
    name: 'Elder Maren',
    sprite: 'elder',
    portrait: 'maren',
    facing: 'down',
    lines: ({ save, open }) => {
      const out: Step[] = [];
      if (f(save, 'act2_clear'))
        out.push(
          say('Two skies saved in one lifetime. Havenbrook will be telling stories about you for a century.'),
        );
      else if (f(save, 'act2_start'))
        out.push(
          say('Solenne is a long way from home, {hero}. The portal in the square will take you there.'),
        );
      else if (f(save, 'game_clear'))
        out.push(
          say(
            'The sky is whole again. I never thought I’d live to see it. Though… the Abyss beneath the portal still stirs.',
          ),
        );
      else if (f(save, 'portal_open'))
        out.push(say('The portal in the square leads to the Sky Citadel. Only go when you’re ready.'));
      else if (f(save, 'boss_thornmaw'))
        out.push(say('Every shard you claim makes you stronger — and makes Malachar more desperate.'));
      else
        out.push(
          say('The Whispering Woods lie north. Follow the old trail and you’ll find the heart of it.'),
        );
      out.push({
        choices: [
          { label: 'Reset my skill points', action: () => open('respec') },
          { label: 'Any advice?', then: [say(tip(save))] },
          { label: 'Farewell' },
        ],
      });
      return out;
    },
  },
  mira: {
    id: 'mira',
    name: 'Mira',
    sprite: 'merchant',
    portrait: 'mira',
    facing: 'down',
    lines: ({ save, open }) => [
      say(
        f(save, 'boss_ignis')
          ? 'Business is booming! Monsters get stronger, adventurers get richer, I get richer!'
          : 'Welcome to Mira’s Curios! Best prices this side of the sky!',
      ),
      {
        choices: [{ label: 'Show me your wares', action: () => open('shop') }, { label: 'Just browsing' }],
      },
    ],
  },
  brom: {
    id: 'brom',
    name: 'Brom',
    sprite: 'blacksmith',
    portrait: 'brom',
    facing: 'down',
    lines: ({ open }) => [
      say('Gear looking tired? Bring me gold and Aether Dust and I’ll make it sing. Salvage junk for dust.'),
      {
        choices: [{ label: 'Use the forge', action: () => open('smith') }, { label: 'Not now' }],
      },
    ],
  },
  innkeeper: {
    id: 'innkeeper',
    name: 'Tobias',
    sprite: 'innkeeper',
    facing: 'down',
    lines: ({ open }) => [
      say('Welcome to the Sleeping Griffin! Rest is free for the hero of Havenbrook.'),
      {
        choices: [{ label: 'Rest (restore & save)', action: () => open('inn') }, { label: 'Maybe later' }],
      },
    ],
  },
  rowan: {
    id: 'rowan',
    name: 'Guard Rowan',
    sprite: 'guard',
    facing: 'down',
    lines: ({ save }) => [
      say(
        f(save, 'boss_thornmaw')
          ? 'The woods are calmer now. Still, keep your guard up — things out there respawn when you rest at a crystal.'
          : 'North road leads to the Whispering Woods. Slimes, wolves, goblins with bows. Roll away from the arrows!',
      ),
    ],
  },
  guard_e: gateGuard('guard_e', 'the Crystal Caverns', 'boss_thornmaw', 'eastern'),
  guard_s: gateGuard('guard_s', 'Emberpeak', 'boss_crystal_golem', 'southern'),
  guard_w: gateGuard('guard_w', 'Frostveil', 'boss_ignis', 'western'),
  villager_a: {
    id: 'villager_a',
    name: 'Farmer Hal',
    sprite: 'villager_man',
    wander: 40,
    lines: ({ save }) => [
      say(
        f(save, 'boss_crystal_golem')
          ? 'My cows are giving glowing milk now. Is that… a shard thing? Should I be worried?'
          : 'Saw the sky crack open with my own eyes. Then a star fell right into the woods. My cows haven’t stopped mooing since.',
      ),
    ],
  },
  villager_b: {
    id: 'villager_b',
    name: 'Nell',
    sprite: 'villager_woman',
    wander: 36,
    lines: ({ save }) => [
      say(
        f(save, 'portal_open')
          ? 'That portal hums all night. I’ve started knitting to the rhythm. It’s very productive.'
          : 'If you’re heading out, check the quest board in the square. Folks pay good coin for monster bounties.',
      ),
    ],
  },
  child: {
    id: 'child',
    name: 'Pip',
    sprite: 'child',
    wander: 30,
    lines: ({ save, hero }) => [
      say(
        f(save, 'boss_thornmaw')
          ? `${hero}! ${hero}! Is it true you beat a GIANT PLANT? Can you teach me the spin move?!`
          : 'When I grow up I’m gonna be a hero too. I’ve been practicing rolling. Watch! …Ow.',
      ),
    ],
  },
  lyra: {
    id: 'lyra',
    name: 'Lyra',
    sprite: 'lyra',
    portrait: 'lyra',
    facing: 'down',
    // in Act II she goes ahead to Solenne
    visible: (s) => hasFlag(s, 'boss_thornmaw') && !hasFlag(s, 'visited_solenne'),
    lines: ({ save }) => [
      {
        who: 'Lyra',
        portrait: 'lyra',
        expr: 'happy',
        text: f(save, 'game_clear')
          ? 'We did it, {hero}. …Want to go poke at the Abyss portal together? For science.'
          : 'Here’s a trick from the Order: roll {gold}just{/} as an attack lands and time itself slows. The shards love that — your Aether Surge charges faster.',
      },
      {
        choices: [
          {
            label: 'Tell me about the shards',
            then: [
              {
                who: 'Lyra',
                portrait: 'lyra',
                expr: 'neutral',
                text: 'Five great shards fell. Each one is guarded by something it has corrupted. Every shard you take makes your Aether Surge stronger.',
              },
            ],
          },
          { label: 'See you around' },
        ],
      },
    ],
  },
  // --------------------------------------------------------------- Solenne ----
  tessaly: {
    id: 'tessaly',
    name: 'Tessaly',
    sprite: 'tessaly',
    portrait: 'tessaly',
    facing: 'down',
    home: 'solenne',
    lines: ({ save }) => [
      say(
        f(save, 'act2_clear')
          ? 'Look at that — a sunrise. I’d forgotten how loud the gulls get when it’s warm. Thank you, {hero}.'
          : f(save, 'boss_voltaris')
            ? 'The sky portal burns gold now. Whatever waits in that Sanctum, Solenne is behind you.'
            : f(save, 'boss_sandmaw')
              ? 'Every day without sun the tide rises a little higher. Find out what the Grandmaster did.'
              : 'Thirty days of dusk. The fishing boats can’t find the reefs and the crops are dying. We need that sun back.',
      ),
    ],
  },
  farid: {
    id: 'farid',
    name: 'Farid',
    sprite: 'desert_merchant',
    facing: 'down',
    home: 'solenne',
    lines: ({ open }) => [
      say(
        'Welcome, welcome! Farid’s Bazaar has survived sandstorms, pirates and a month of night. Buy something!',
      ),
      {
        choices: [{ label: 'Show me your wares', action: () => open('shop') }, { label: 'Just browsing' }],
      },
    ],
  },
  kesh: {
    id: 'kesh',
    name: 'Kesh',
    sprite: 'desert_smith',
    facing: 'down',
    home: 'solenne',
    lines: ({ open }) => [
      say(
        'Brom from Havenbrook? Taught him half of what he knows. The other half he made up. Let’s see that gear.',
      ),
      {
        choices: [{ label: 'Use the anvil', action: () => open('smith') }, { label: 'Not now' }],
      },
    ],
  },
  lyra_solenne: {
    id: 'lyra_solenne',
    name: 'Lyra',
    sprite: 'lyra',
    portrait: 'lyra',
    facing: 'down',
    home: 'solenne',
    visible: (s) => hasFlag(s, 'visited_solenne'),
    lines: ({ save }) => [
      {
        who: 'Lyra',
        portrait: 'lyra',
        expr: f(save, 'act2_clear') ? 'happy' : 'determined',
        text: f(save, 'act2_clear')
          ? 'The Order will need a new Grandmaster. …Don’t look at me like that. I’m thinking about it.'
          : f(save, 'boss_nereth')
            ? 'Aurelian taught me everything I know about the stars. I never thought I’d have to use it against him.'
            : 'Solenne used to glow at night — every dome lit from the inside. Now it just… waits.',
      },
    ],
  },
  sella: {
    id: 'sella',
    name: 'Sella',
    sprite: 'order_mage',
    wander: 30,
    home: 'solenne',
    lines: ({ save }) => [
      say(
        f(save, 'boss_voltaris')
          ? 'The Sanctum portal is lit! I studied its runes for six years. Never thought I’d see it open.'
          : 'I’m an initiate of the Order. Most of the senior mages followed the Grandmaster to the Sanctum. None came back.',
      ),
    ],
  },
  orin: {
    id: 'orin',
    name: 'Orin',
    sprite: 'order_mage',
    wander: 30,
    home: 'solenne',
    lines: ({ save }) => [
      say(
        f(save, 'boss_nereth')
          ? 'The storm on the Stormspire isn’t natural. Something up there is feeding on the lightning.'
          : 'Our oracle, Nereth, dove into the Sunken Temple to scry the eclipse. That was three weeks ago.',
      ),
    ],
  },
  guard_solenne_w: gateGuard('guard_solenne_w', 'the Sunscar Dunes', 'act2_arrived', 'western', 'solenne'),
  guard_solenne_e: gateGuard('guard_solenne_e', 'the Stormspire', 'boss_nereth', 'eastern', 'solenne'),
  guard_solenne_s: gateGuard('guard_solenne_s', 'the Sunken Temple', 'boss_sandmaw', 'harbor', 'solenne'),
};

function tip(save: SaveData): string {
  const tips = [
    'Enemies flash red before they strike. Watch for it, then roll through the attack.',
    'Elite monsters glow with colored auras. They hit hard, but always drop something good.',
    'Struggling? There is no shame in growing stronger. Monsters return whenever you rest at a crystal.',
    'Brom can upgrade your gear with Aether Dust. Salvage what you don’t need.',
    'Your flasks refill whenever you rest at an Aether Crystal.',
    'Skeletons block with their shields from the front. Strike after they swing, or flank them.',
  ];
  return tips[(save.stats.kills + save.hero.level) % tips.length];
}

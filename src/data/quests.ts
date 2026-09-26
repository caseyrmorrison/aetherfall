/** Main story and side quest definitions. */
import type { MaterialId, Rarity, Slot } from '../game/types';
import type { SkillId } from './skills';

export type Objective =
  | { type: 'talk'; npc: string; text: string }
  | { type: 'kill'; enemy: string; count: number; text: string; zone: string }
  | { type: 'collect'; material: MaterialId; count: number; text: string; zone: string }
  | { type: 'reach'; map: string; marker: string; text: string }
  | { type: 'boss'; boss: string; map: string; text: string }
  | { type: 'flag'; flag: string; text: string; map?: string }
  /** A number kept in save flags reaching `count` (e.g. a best streak). */
  | { type: 'counter'; counter: string; count: number; text: string };

export interface QuestReward {
  xp?: number;
  gold?: number;
  skillPoints?: number;
  dust?: number;
  item?: { rarity: Rarity; slot?: Slot; ilvl: number; legendary?: boolean };
  elixirs?: number;
  flaskUpgrade?: boolean;
  flags?: string[];
  /** Teaches a skill (challenge rewards). */
  skill?: SkillId;
}

export interface QuestDef {
  id: string;
  name: string;
  giver: string;
  main: boolean;
  summary: string;
  objectives: Objective[];
  reward: QuestReward;
  next?: string;
  /** Dialogue when the quest is offered / on completion (by the giver). */
  offer?: string[];
  complete?: string[];
  /** Lines spoken when a 'talk' objective at this stage is completed ("speaker|expr: text"). */
  talkLines?: Record<number, string[]>;
  /** Flag required before the giver offers this quest. */
  requires?: string;
  /** Challenges start by themselves once `requires` is met (no giver needed). */
  challenge?: boolean;
}

export const QUESTS: Record<string, QuestDef> = {
  // --------------------------------------------------------------- main ----
  mq_fallen_star: {
    id: 'mq_fallen_star',
    name: 'The Fallen Star',
    giver: 'maren',
    main: true,
    summary: 'A shard of the Aether Crystal fell into the Whispering Woods. Its corruption must be stopped.',
    objectives: [
      { type: 'talk', npc: 'maren', text: 'Speak with Elder Maren' },
      { type: 'boss', boss: 'thornmaw', map: 'forest', text: 'Cleanse the heart of the Whispering Woods' },
      { type: 'talk', npc: 'maren', text: 'Return to Elder Maren' },
    ],
    reward: { xp: 250, gold: 200, skillPoints: 1, item: { rarity: 'rare', slot: 'armor', ilvl: 6 } },
    next: 'mq_deep',
    talkLines: {
      0: [
        'maren|sad: {hero}! Thank the stars you\u2019re awake. You\u2019ve been out cold since the sky broke.',
        'kai|neutral: Elder\u2026 there was a girl. Lyra. She said the Aether Crystal shattered.',
        'maren|surprised: The Order of Stars, here? Then it\u2019s true\u2026',
        'maren|sad: A great shard fell into the Whispering Woods. Since then the forest has turned against us.',
        'maren|determined: That mark on your hand \u2014 the shard chose you. I won\u2019t pretend I like it.',
        'maren|neutral: Go north into the woods and find the heart of the corruption. Rest at the {cyan}Aether Crystal{/} in the square whenever you need \u2014 it will mend you and remember your progress.',
        'maren|happy: And {hero}\u2026 come back alive. That\u2019s an order from your elder.',
      ],
      2: [
        'maren|surprised: You\u2019re back! And the woods\u2026 I can feel it. The corruption is fading.',
        'kai|determined: The shard\u2019s power is part of me now. But someone else is hunting them. Malachar.',
        'maren|sad: The Hollow King\u2026 I prayed that name was only a legend.',
        'maren|determined: Then you must reach the other shards first. The barrier on the {gold}eastern road{/} has fallen \u2014 the Crystal Caverns await.',
      ],
    },
  },
  mq_deep: {
    id: 'mq_deep',
    name: 'Echoes in the Deep',
    giver: 'maren',
    main: true,
    summary: 'The second great shard hums somewhere beneath the eastern hills, in the Crystal Caverns.',
    objectives: [
      {
        type: 'boss',
        boss: 'crystal_golem',
        map: 'cave',
        text: 'Reclaim the Prism Shard from the Crystal Caverns',
      },
      { type: 'talk', npc: 'maren', text: 'Report to Elder Maren' },
    ],
    reward: { xp: 1200, gold: 500, skillPoints: 1, item: { rarity: 'epic', ilvl: 12 } },
    next: 'mq_ember',
    talkLines: {
      1: [
        'maren|happy: Two shards! The old stories never said the chosen one would be so stubborn.',
        'maren|neutral: The {gold}southern pass{/} to Emberpeak is scorching, but with two shards you\u2019ll withstand it.',
        'maren|sad: Something vast sleeps in that mountain. Be careful, {hero}.',
      ],
    },
  },
  mq_ember: {
    id: 'mq_ember',
    name: 'The Burning Peak',
    giver: 'maren',
    main: true,
    summary: 'Emberpeak to the south has erupted. A drake guards the Ember Shard.',
    objectives: [
      { type: 'boss', boss: 'ignis', map: 'volcano', text: 'Defeat the drake atop Emberpeak' },
      { type: 'talk', npc: 'lyra', text: 'Find Lyra in Havenbrook' },
    ],
    reward: { xp: 2000, gold: 1000, skillPoints: 1, item: { rarity: 'epic', ilvl: 18 } },
    next: 'mq_frost',
    talkLines: {
      1: [
        'lyra|sad: {hero}\u2026 there\u2019s something I haven\u2019t told you.',
        'lyra|sad: The Rime Shard fell in Frostveil. Its bearer is Seraphine. She was my mentor \u2014 my sister in the Order.',
        'lyra|hurt: Years ago a shard chose her, just like you. Malachar\u2019s whispers found her. The cold did the rest.',
        'kai|determined: Then we bring her back. Whatever it takes.',
        'lyra|determined: \u2026Thank you. The {gold}western road{/} is open now. I\u2019ll be right behind you.',
      ],
    },
  },
  mq_frost: {
    id: 'mq_frost',
    name: 'Heart of Winter',
    giver: 'lyra',
    main: true,
    summary: 'Seraphine, the Frost Queen, holds the Rime Shard in the frozen west.',
    objectives: [
      { type: 'boss', boss: 'seraphine', map: 'tundra', text: 'Confront Seraphine in Frostveil' },
      { type: 'talk', npc: 'maren', text: 'Return to Havenbrook' },
    ],
    reward: {
      xp: 4000,
      gold: 2000,
      skillPoints: 1,
      item: { rarity: 'legendary', ilvl: 24, legendary: true },
      flags: ['portal_open'],
    },
    next: 'mq_hollow',
    talkLines: {
      1: [
        'maren|sad: Lyra told me about Seraphine. I\u2019m so sorry, child.',
        'maren|determined: Four shards now burn within you. Look \u2014 the {purple}portal{/} in the square has awakened.',
        'maren|neutral: It leads to the Sky Citadel. Malachar waits there with what remains of the Crystal\u2019s light.',
        'maren|determined: Prepare well. Whatever lies beyond may not let you return.',
      ],
    },
  },
  mq_hollow: {
    id: 'mq_hollow',
    name: 'The Hollow King',
    giver: 'maren',
    main: true,
    summary: 'The portal in the town square leads to Malachar’s Sky Citadel. End this.',
    objectives: [
      { type: 'boss', boss: 'malachar_true', map: 'citadel', text: 'Defeat Malachar in the Sky Citadel' },
    ],
    reward: { xp: 20000, gold: 5000, skillPoints: 2 },
  },
  // --------------------------------------------------------------- side ----
  sq_wolves: {
    id: 'sq_wolves',
    name: 'Wolf Trouble',
    giver: 'rowan',
    main: false,
    summary: 'Shard-maddened wolves are prowling the road north of town.',
    objectives: [
      { type: 'kill', enemy: 'wolf', count: 8, text: 'Hunt Shardfang Wolves', zone: 'forest' },
      { type: 'talk', npc: 'rowan', text: 'Report to Guard Rowan' },
    ],
    reward: { xp: 180, gold: 150, item: { rarity: 'rare', slot: 'boots', ilvl: 5 } },
    offer: [
      "Those wolves in the woods — their eyes glow like the falling stars. They've gone mad.",
      'Thin the pack for me, would you? Eight should do it. I’ll make it worth your while.',
    ],
    complete: ['Eight?! You’re braver than the whole watch combined. Here — these boots served me well.'],
  },
  sq_stew: {
    id: 'sq_stew',
    name: 'Moonpetal Stew',
    giver: 'innkeeper',
    main: false,
    summary: 'Tobias needs glowing Moonpetals from the woods for his famous stew.',
    objectives: [
      { type: 'collect', material: 'herb', count: 5, text: 'Gather Moonpetals', zone: 'forest' },
      { type: 'talk', npc: 'innkeeper', text: 'Bring the Moonpetals to Tobias' },
    ],
    reward: { xp: 160, gold: 100, elixirs: 2 },
    offer: [
      'Ahh, a hungry face! My Moonpetal Stew fixes anything — broken hearts, broken bones…',
      '…but I’m clean out of Moonpetals. They glow in the Whispering Woods. Bring me five?',
    ],
    complete: ['Smell that? Magnificent! Take these Elixirs — my secret recipe, bottled.'],
  },
  sq_cargo: {
    id: 'sq_cargo',
    name: 'Lost Cargo',
    giver: 'mira',
    main: false,
    summary: 'Mira’s supply cart was overturned somewhere in the Whispering Woods.',
    objectives: [
      { type: 'reach', map: 'forest', marker: 'forest_marker_0', text: 'Find Mira’s lost cargo' },
      { type: 'talk', npc: 'mira', text: 'Return to Mira' },
    ],
    reward: { xp: 220, gold: 120, flaskUpgrade: true },
    offer: [
      'Oh! A customer! …Sorry, I’m a little frazzled.',
      'My supply cart tipped over in the woods when the sky exploded. If you find my crate, I’ll upgrade your flask belt for free!',
    ],
    complete: ['My crate! You’re a lifesaver. As promised — one extra flask slot, on the house!'],
  },
  sq_ore: {
    id: 'sq_ore',
    name: 'Singing Stone',
    giver: 'brom',
    main: false,
    requires: 'boss_thornmaw',
    summary: 'Brom wants Cave Crystals to forge something special.',
    objectives: [
      { type: 'collect', material: 'crystal', count: 6, text: 'Collect Cave Crystals', zone: 'cave' },
      { type: 'talk', npc: 'brom', text: 'Bring the crystals to Brom' },
    ],
    reward: { xp: 900, dust: 40, item: { rarity: 'rare', slot: 'weapon', ilvl: 11 } },
    offer: [
      'Hear that hum? Cave crystal. It sings when you strike it right.',
      'Fetch me six from the Crystal Caverns and I’ll hammer you a blade that sings too.',
    ],
    complete: ['Hah! Listen to her ring! Take it, and some Aether Dust for your troubles.'],
  },
  sq_embers: {
    id: 'sq_embers',
    name: 'Forge of Legends',
    giver: 'brom',
    main: false,
    requires: 'boss_crystal_golem',
    summary: 'Brom needs Ember Cores to reach a legendary forging heat.',
    objectives: [
      { type: 'collect', material: 'ember', count: 6, text: 'Collect Ember Cores', zone: 'volcano' },
      { type: 'talk', npc: 'brom', text: 'Bring the cores to Brom' },
    ],
    reward: { xp: 2500, dust: 80, item: { rarity: 'epic', slot: 'weapon', ilvl: 17 } },
    offer: [
      'My forge can’t get hot enough for real mastercraft. Ember Cores from Emberpeak would change that. Six of ’em.',
    ],
    complete: ['THAT’S the heat I needed! Here — my finest work in twenty years.'],
  },
  sq_frost: {
    id: 'sq_frost',
    name: "Winter's Pack",
    giver: 'rowan',
    main: false,
    requires: 'boss_ignis',
    summary: 'Rime Wolves from Frostveil have been spotted near the western road.',
    objectives: [
      { type: 'kill', enemy: 'wolf_ice', count: 10, text: 'Hunt Rime Wolves', zone: 'tundra' },
      { type: 'talk', npc: 'rowan', text: 'Report to Guard Rowan' },
    ],
    reward: { xp: 5000, gold: 900, item: { rarity: 'epic', slot: 'armor', ilvl: 22 } },
    offer: ['Wolves again — but these ones breathe frost. Ten of them should keep the west road safe.'],
    complete: ['The west road is quiet for the first time in weeks. Take this armor — you’ve earned it.'],
  },
  sq_void: {
    id: 'sq_void',
    name: 'Whispers of the Void',
    giver: 'maren',
    main: false,
    requires: 'portal_open',
    summary: 'Maren wants to study Void Fragments to understand Malachar’s power.',
    objectives: [
      { type: 'collect', material: 'void', count: 8, text: 'Collect Void Fragments', zone: 'citadel' },
      { type: 'talk', npc: 'maren', text: 'Bring the fragments to Maren' },
    ],
    reward: { xp: 12000, item: { rarity: 'legendary', ilvl: 28, legendary: true } },
    offer: [
      'The void that Malachar commands… if I could study its fragments, perhaps I could find a weakness.',
      'Bring me eight Void Fragments from the Citadel. In return — an heirloom of our village.',
    ],
    complete: ['Fascinating… and terrifying. Here. This belonged to the first hero of Havenbrook.'],
  },
  // ---------------------------------------------------------- challenges ----
  ch_untouchable: {
    id: 'ch_untouchable',
    name: 'Challenge: Untouchable',
    giver: 'maren',
    main: false,
    challenge: true,
    requires: 'boss_thornmaw',
    summary: 'Prove you can fight without being touched. A streak ends the moment anything hits you.',
    objectives: [
      {
        type: 'counter',
        counter: 'streak_nohit_best',
        count: 30,
        text: 'Defeat 30 enemies in a row without getting hit',
      },
    ],
    reward: { xp: 2000, skill: 'shadowstep' },
  },
  ch_unbowed: {
    id: 'ch_unbowed',
    name: 'Challenge: Unbowed',
    giver: 'maren',
    main: false,
    challenge: true,
    requires: 'boss_crystal_golem',
    summary:
      'On Hard or Nightmare, defeat a guardian (or an Abyss guardian) without drinking a single flask. It can be at most 3 levels below you.',
    objectives: [{ type: 'flag', flag: 'ch_unbowed_done', text: 'Beat a guardian on Hard+ without flasks' }],
    reward: { xp: 6000, skill: 'earthshatter' },
  },
  ch_flawless: {
    id: 'ch_flawless',
    name: 'Challenge: Flawless',
    giver: 'maren',
    main: false,
    challenge: true,
    requires: 'boss_ignis',
    summary:
      'Defeat a guardian (or an Abyss guardian) without getting hit even once. It can be at most 3 levels below you.',
    objectives: [{ type: 'flag', flag: 'ch_flawless_done', text: 'Beat a guardian without getting hit' }],
    reward: { xp: 12000, skill: 'blizzard' },
  },
  ch_deathless: {
    id: 'ch_deathless',
    name: 'Challenge: Deathless Descent',
    giver: 'maren',
    main: false,
    challenge: true,
    requires: 'game_clear',
    summary: 'Clear Abyss floors one after another without dying. Dying resets the streak.',
    objectives: [
      {
        type: 'counter',
        counter: 'abyss_streak_best',
        count: 10,
        text: 'Clear 10 Abyss floors in a row without dying',
      },
    ],
    reward: { xp: 40000, skill: 'bloodrite' },
  },
};

export const CHALLENGES = Object.values(QUESTS).filter((q) => q.challenge);

export const SIDE_QUESTS = Object.values(QUESTS).filter((q) => !q.main && !q.challenge);

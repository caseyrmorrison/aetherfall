/** High-level game flow: starting, continuing and loading games. */
import { rng } from '../engine/rng';
import type { Game } from '../game/game';
import { generateItem } from '../game/items';
import { newGame, type SaveData } from '../game/state';
import type { Difficulty } from '../game/types';
import { playCutscene } from './cutscene';
import { WorldScene } from './world-scene';

export async function startNewGame(
  game: Game,
  slot: number,
  name: string,
  difficulty: Difficulty,
): Promise<void> {
  const save = newGame(slot, name, difficulty);
  // starter kit
  save.equipment.weapon = {
    ...generateItem(rng, 1, { slot: 'weapon', kind: 'sword', rarity: 'common' }),
    name: "Father's Old Blade",
    isNew: false,
  };
  save.equipment.armor = { ...generateItem(rng, 1, { slot: 'armor', rarity: 'common' }), isNew: false };
  game.setSave(save);
  game.quests.start('mq_fallen_star', true);
  const st = game.stats();
  save.hero.hp = st.maxHp;
  save.hero.mp = st.maxMp;
  game.saveNow();
  await game.app.transition(() => {
    game.app.reset(new BlankScene());
  }, 0.5);
  await playCutscene(game, 'intro');
  enterWorld(game, save, 'town', 'start');
  game.toast(
    `Move: WASD / stick  •  Attack: ${game.app.input.label('attack')}  •  Dodge: ${game.app.input.label('dodge')}`,
    'ui_star',
  );
  game.toast(`Talk to Elder Maren (the quest arrow points the way).`, 'ui_quest');
}

export function continueGame(game: Game, data: SaveData): void {
  game.setSave(data);
  void game.app.transition(() => {
    enterWorld(
      game,
      data,
      data.location.map,
      data.location.x >= 0 ? { x: data.location.x, y: data.location.y } : 'start',
    );
  }, 0.5);
}

function enterWorld(game: Game, save: SaveData, map: string, spawn: string | { x: number; y: number }): void {
  const ws = new WorldScene(game);
  game.app.reset(ws);
  try {
    ws.start(map, spawn);
  } catch {
    // corrupted location (e.g. an abyss floor): fall back to town
    ws.start('town', 'town_crystal');
  }
  void save;
}

/** Placeholder scene shown while the world is being prepared. */
class BlankScene {
  readonly opaque = true;
  update(): void {}
  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}

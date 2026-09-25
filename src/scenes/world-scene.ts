/** The gameplay scene: owns the World and HUD, and implements all world hooks. */
import { preloadCutIn, setPortraitFlags } from '../art/anime';
import { audio } from '../audio';
import { BOSS_INTRO, BOSS_OUTRO } from '../data/cutscenes';
import { NPCS, type NpcContext, type Service } from '../data/npcs';
import { ZONES } from '../data/zones';
import type { Scene } from '../engine/app';
import { DIFFICULTY } from '../game/balance';
import { parseLine, type Step } from '../game/dialogue';
import type { Game } from '../game/game';
import { bossCleared, hasFlag, setFlag } from '../game/state';
import { Hud } from '../ui/hud';
import { Tips } from '../ui/tips';
import type { Enemy } from '../world/entities/enemy';
import type { Npc } from '../world/entities/npc';
import type { MapObject } from '../world/mapdata';
import { World, type WorldHooks } from '../world/world';
import { BossIntroScene } from './boss-intro';
import { ConfirmScene } from './confirm';
import { CreditsScene } from './credits';
import { playCutscene } from './cutscene';
import { showDialogue } from './dialogue';
import { GameOverScene } from './gameover';
import { MenuScene, type MenuTab } from './menu/menu';
import { openService } from './services';
import { TravelScene } from './travel';

export class WorldScene implements Scene, WorldHooks {
  readonly opaque = true;
  readonly world: World;
  readonly hud = new Hud();
  readonly tips: Tips;
  private busy = false;
  private autosaveT = 0;

  private unsubs: (() => void)[] = [];

  constructor(readonly game: Game) {
    this.world = new World(game, game.quests, game.app.input);
    this.world.hooks = this;
    this.tips = new Tips(this.world);
  }

  enter(): void {
    // level-up flourish on the hero
    this.unsubs.push(this.game.events.on('levelUp', () => this.world.levelUpBurst()));
    window.addEventListener('blur', this.onBlur);
  }

  exit(): void {
    for (const u of this.unsubs) u();
    this.unsubs = [];
    window.removeEventListener('blur', this.onBlur);
  }

  /** Auto-pause when the window loses focus (only if nothing else is open). */
  private onBlur = (): void => {
    if (this.game.app.top() === this && !this.busy && this.world.player.state !== 'dead')
      this.openMenu('system');
  };

  /** Load a map and announce it. */
  start(mapId: string, spawn: string | { x: number; y: number }): void {
    setPortraitFlags({ kaiMark: true });
    this.world.load(mapId, spawn);
    this.announce(mapId);
    if (this.game.save.hero.surgeUnlocked)
      preloadCutIn('kai_surge', this.game.app.width, this.game.app.height);
  }

  private announce(mapId: string): void {
    const save = this.game.save;
    this.hud.zoneCard = null;
    const zone = ZONES[mapId];
    const first = !mapId.startsWith('abyss') && !hasFlag(save, `visited_${mapId}`);
    if (!mapId.startsWith('abyss')) setFlag(save, `visited_${mapId}`);
    if (mapId === 'town')
      this.hud.zoneCard = { title: 'Havenbrook', sub: 'A quiet village beneath the broken sky', t: 0 };
    else if (zone)
      this.hud.zoneCard = {
        title: zone.name,
        sub: `Recommended Level ${zone.levels[0]}–${zone.levels[1]}`,
        t: 0,
      };
    else if (mapId.startsWith('abyss'))
      this.hud.zoneCard = {
        title: this.world.data.name,
        sub: `Enemy Level ${this.world.data.levels[0]}`,
        t: 0,
      };
    if (first && zone) audio.playSfx('stinger_discovery');
  }

  update(dt: number): void {
    const input = this.game.app.input;
    if (!this.busy && !this.world.cutin && this.world.player.state !== 'dead') {
      if (input.pressed('pause')) this.openMenu('system');
      else if (input.pressed('menu')) this.openMenu('hero');
      else if (input.pressed('map')) this.openMenu('map');
    }
    this.world.inputBlocked = this.busy || this.game.app.fading;
    this.world.update(dt);
    this.hud.update(dt, this.world);
    if (!this.busy) this.tips.update(dt);
    // periodic autosave while exploring safely
    this.autosaveT += dt;
    if (this.autosaveT > 90 && !this.world.inCombat && !this.world.boss) {
      this.autosaveT = 0;
      this.game.saveNow();
    }
  }

  resume(): void {
    this.game.app.input.releaseAll();
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.world.render(ctx);
    this.hud.render(ctx, this.world);
    this.tips.render(ctx, this.game.app.width);
  }

  openMenu(tab: MenuTab): void {
    audio.playSfx('ui_open');
    this.game.app.push(new MenuScene(this.game, this, tab));
  }

  // ------------------------------------------------------------- hooks ----
  warp(to: string, spawn: string): void {
    if (this.busy) return;
    this.busy = true;
    void this.game.app
      .transition(() => {
        this.world.load(to, spawn);
        this.announce(to);
        this.game.saveNow();
      }, 0.3)
      .then(() => {
        this.busy = false;
      });
  }

  /** Fast travel / respawn to a position. */
  travelTo(map: string, pos: string | { x: number; y: number }, after?: () => void): void {
    this.busy = true;
    void this.game.app
      .transition(() => {
        this.world.load(map, pos);
        this.announce(map);
        after?.();
        this.game.saveNow();
      }, 0.4)
      .then(() => {
        this.busy = false;
      });
  }

  death(): void {
    this.game.app.push(new GameOverScene(this.game, this));
  }

  /** Respawn at the last crystal, dropping some gold where you fell. */
  respawn(): void {
    const save = this.game.save;
    const p = this.world.player;
    const loss = Math.floor(save.hero.gold * DIFFICULTY[save.difficulty].goldLossOnDeath);
    if (loss > 0) {
      save.hero.gold -= loss;
      save.droppedGold = { map: this.world.data.id, x: p.x, y: p.y, amount: loss };
    }
    const st = this.game.stats();
    save.hero.hp = st.maxHp;
    save.hero.mp = st.maxMp;
    save.hero.flaskHp = st.flaskHpMax;
    save.hero.flaskMp = st.flaskMpMax;
    const r = save.respawn;
    const pos = r.x < 0 ? 'town_crystal' : { x: r.x, y: r.y };
    this.travelTo(r.map, pos, () => {
      this.world.player.invuln = 2;
      if (loss > 0) this.game.toast(`Dropped ${loss} gold where you fell. Go reclaim it!`, 'ui_coin');
    });
  }

  talk(npc: Npc): void {
    const save = this.game.save;
    const hero = save.hero.name;
    const speaker = { who: npc.def.name, portrait: npc.def.portrait };
    const qt = this.game.quests.talk(npc.def.id);
    let steps: Step[];
    if (qt && (qt.lines.length || qt.offer)) {
      steps = qt.lines.map((l) => parseLine(l, hero, speaker));
      if (qt.offer) {
        const offer = qt.offer;
        steps.push({
          choices: [
            { label: `Accept: ${offer.name}`, action: () => this.game.quests.start(offer.id) },
            { label: 'Not right now' },
          ],
        });
      }
    } else {
      const ctx: NpcContext = { save, hero, open: (s) => this.service(s) };
      steps = NPCS[npc.def.id]
        .lines(ctx)
        .map((s) => ('text' in s ? { ...s, text: s.text.replace(/\{hero\}/g, hero) } : s));
    }
    void showDialogue(this.game, steps, speaker);
  }

  service(kind: Service): void {
    openService(this.game, this, kind);
  }

  /** The town portal: after the story it can also lead down into the Abyss. */
  portal(to: string, spawn: string): void {
    const save = this.game.save;
    if (!hasFlag(save, 'game_clear') || to !== 'citadel') {
      this.warp(to, spawn);
      return;
    }
    const best = save.stats.abyssBest;
    const resume = Math.max(1, Math.floor(best / 5) * 5 + 1);
    const choices = [
      { label: 'Sky Citadel', action: () => this.warp('citadel', 'entry') },
      { label: 'The Abyss \u2014 Floor 1', action: () => this.warp('abyss_1', 'entry') },
    ];
    if (resume > 1)
      choices.push({
        label: `The Abyss \u2014 Floor ${resume}`,
        action: () => this.warp(`abyss_${resume}`, 'entry'),
      });
    choices.push({ label: 'Stay', action: () => undefined });
    void showDialogue(this.game, [
      { text: `The portal hums with two destinations. {gray}(Deepest Abyss floor: ${best}){/}` },
      { choices },
    ]);
  }

  sign(text: string): void {
    void showDialogue(this.game, [{ text }]);
  }

  message(text: string): void {
    audio.playSfx('ui_error');
    void showDialogue(this.game, [{ text }]);
  }

  crystal(id: string): void {
    this.world.restAt(id);
    this.game.saveNow();
    this.game.toast('Rested. Flasks refilled. Progress saved.', 'ui_save');
    this.game.app.push(new TravelScene(this.game, this, id));
  }

  enterArena(o: Extract<MapObject, { kind: 'bossGate' }>): void {
    const defeated = bossCleared(this.game.save, o.boss);
    const go = (): void => {
      this.world.rematch = defeated;
      this.warp(o.to, 'entry');
    };
    if (defeated) {
      this.game.app.push(
        new ConfirmScene(
          this.game,
          'This guardian has been defeated. Challenge its echo again for more loot?',
          go,
        ),
      );
    } else {
      this.game.app.push(
        new ConfirmScene(this.game, 'A powerful presence lies beyond. Enter? (Rest at a crystal first!)', go),
      );
    }
  }

  bossIntro(e: Enemy): void {
    const id = e.def.id;
    const introId = BOSS_INTRO[id];
    const seen = hasFlag(this.game.save, `intro_${id}`);
    this.busy = true;
    this.world.focus = e;
    const splash = (): void => {
      audio.playSfx('stinger_boss_intro');
      audio.playMusic(e.def.boss?.music ?? 'boss', { fade: 0.3 });
      this.game.app.push(
        new BossIntroScene(this.game, e, () => {
          this.busy = false;
          this.world.focus = null;
        }),
      );
    };
    if (introId && !seen) {
      setFlag(this.game.save, `intro_${id}`);
      void playCutscene(this.game, introId).then(splash);
    } else splash();
  }

  bossDefeated(e: Enemy): void {
    const id = e.def.id;
    const save = this.game.save;
    const first = !hasFlag(save, `boss_${id}`);
    this.game.quests.onBoss(id);
    if (id === 'thornmaw' && !save.hero.surgeUnlocked) {
      save.hero.surgeUnlocked = true;
      save.hero.surge = 100;
    }
    save.hero.skillPoints += first ? 1 : 0;
    this.game.saveNow();
    const outro = BOSS_OUTRO[id];
    if (id === 'malachar') {
      // phase transition into the true form, every time
      void playCutscene(this.game, outro).then(() => {
        const nb = this.world.spawnBoss('malachar_true', e.level, e.x, e.y - 10);
        nb.aggro = true;
      });
      return;
    }
    if (id === 'malachar_true') {
      const firstClear = !hasFlag(save, 'game_clear');
      setFlag(save, 'game_clear');
      this.game.saveNow();
      if (firstClear) {
        void playCutscene(this.game, 'ending').then(() => this.rollCredits());
        return;
      }
    }
    if (first && outro && !this.world.abyssFloor) {
      void playCutscene(this.game, outro).then(() => {
        audio.playMusic(this.world.data.music);
        if (id === 'thornmaw')
          this.game.toast(
            `Press [${this.game.app.input.label('ultimate')}] to unleash Aether Surge!`,
            'skill_surge',
          );
      });
    } else {
      audio.playMusic('victory');
      setTimeout(() => audio.playMusic(this.world.data.music), 7000);
    }
  }

  private rollCredits(): void {
    this.game.app.push(new CreditsScene(this.game, () => this.travelTo('town', 'portal')));
  }
}

/** System tab: save/load, settings, New Game+, quit — plus play statistics. */
import { audio } from '../../audio';
import { drawText } from '../../engine/font';
import type { Rect } from '../../engine/math';
import { formatPlayTime } from '../../game/saves';
import { hasFlag } from '../../game/state';
import { ListView, UI } from '../../ui/widgets';
import { ConfirmScene } from '../confirm';
import { LoadScene } from '../load';
import { SettingsScene } from '../settings';
import type { MenuScene, TabView } from './menu';

type Opt = 'resume' | 'save' | 'load' | 'settings' | 'ngplus' | 'title';

export class SystemTab implements TabView {
  readonly label = 'System';
  private list: ListView<Opt>;

  constructor(private menu: MenuScene) {
    const opts: Opt[] = ['resume', 'save', 'load', 'settings'];
    if (hasFlag(menu.game.save, 'game_clear')) opts.push('ngplus');
    opts.push('title');
    this.list = new ListView(opts, 13, opts.length, true);
  }

  private canSave(): boolean {
    const w = this.menu.ws.world;
    return !w.inCombat && !(w.boss && !w.boss.dead);
  }

  update(): 'close' | void {
    const g = this.menu.game;
    const r = this.list.update(g.app.input);
    if (r === 'cancel') return 'close';
    if (r !== 'confirm') return;
    switch (this.list.selected) {
      case 'resume':
        return 'close';
      case 'save':
        if (!this.canSave()) {
          audio.playSfx('ui_error');
          g.toast("You can't save during combat.", 'ui_lock', 0, UI.bad);
          return;
        }
        if (g.saveNow()) {
          audio.playSfx('save');
          g.toast(`Saved to slot ${g.save.slot + 1}`, 'ui_save');
        } else g.toast('Saving failed (storage full or disabled).', 'ui_lock', 0, UI.bad);
        return;
      case 'load':
        g.app.push(new LoadScene(g, 'load'));
        return;
      case 'settings':
        g.app.push(new SettingsScene(g));
        return;
      case 'ngplus':
        g.app.push(
          new ConfirmScene(
            g,
            'Begin New Game+? You keep your level, gear, skills and gold. Enemies become far stronger and the story restarts.',
            () => {
              const s = g.save;
              s.ngPlus++;
              s.quests = {};
              s.bounties = [];
              const keep = ['game_clear'];
              s.flags = Object.fromEntries(
                Object.entries(s.flags).filter(
                  ([k]) => keep.includes(k) || k.startsWith('visited_') || k.startsWith('tip_'),
                ),
              );
              s.hero.surgeUnlocked = false;
              s.hero.surge = 0;
              s.discovered = ['town_crystal'];
              s.respawn = { map: 'town', x: -1, y: -1 };
              g.quests.start('mq_fallen_star', true);
              g.saveNow();
              this.menu.close();
              this.menu.ws.travelTo('town', 'start', () =>
                g.toast(`New Game+ ${s.ngPlus} begins!`, 'ui_star'),
              );
            },
          ),
        );
        return;
      case 'title':
        g.app.push(
          new ConfirmScene(
            g,
            'Return to the title screen? Unsaved progress since your last save will be lost.',
            () => {
              void import('../title').then(({ TitleScene }) =>
                g.app.transition(() => g.app.reset(new TitleScene(g))),
              );
            },
          ),
        );
        return;
    }
  }

  hints(): [string, string][] {
    return [['confirm', 'Select']];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    const g = this.menu.game;
    const s = g.save;
    const labels: Record<Opt, string> = {
      resume: 'Resume',
      save: this.canSave() ? 'Save Game' : 'Save Game {gray}(in combat){/}',
      load: 'Load Game',
      settings: 'Settings & Controls',
      ngplus: '{gold}Begin New Game+{/}',
      title: 'Quit to Title',
    };
    this.list.draw(ctx, r.x + 4, r.y + 8, 150, (o, x, y, sel) =>
      drawText(ctx, labels[o], x + 2, y, { color: sel ? UI.accent : '#ffffff' }),
    );
    drawText(
      ctx,
      `Save slot ${s.slot + 1}  \u2022  Play time ${formatPlayTime(s.playTime)}`,
      r.x + 180,
      r.y + 8,
      { color: UI.dim },
    );
    drawText(ctx, 'Statistics and achievements are in the Records tab.', r.x + 180, r.y + 20, {
      color: UI.dim,
    });
  }
}

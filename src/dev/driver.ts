/**
 * Dev-only automation driver (window.T) for testing in the browser even when the
 * tab is hidden and requestAnimationFrame is paused. Never included in production.
 */
import type { App } from '../engine/app';
import type { Game } from '../game/game';
import { playCutscene } from '../scenes/cutscene';
import type { WorldScene } from '../scenes/world-scene';
import type { World } from '../world/world';

export function installDriver(app: App, game: Game): void {
  const flush = async (): Promise<void> => {
    for (let k = 0; k < 6; k++) await Promise.resolve();
  };
  const T = {
    app,
    game,
    get ws(): WorldScene | undefined {
      // duck-typed so it also works in minified builds
      return app.scenes.find((s) => 'world' in s && 'hud' in s) as WorldScene | undefined;
    },
    get w(): World | undefined {
      return this.ws?.world;
    },
    async step(n = 1, dt = 1 / 60): Promise<void> {
      for (let i = 0; i < n; i++) {
        app.step(dt);
        await flush();
      }
    },
    down(code: string): void {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    },
    up(code: string): void {
      window.dispatchEvent(new KeyboardEvent('keyup', { code }));
    },
    async tap(code: string, frames = 3): Promise<void> {
      this.down(code);
      await this.step(1);
      this.up(code);
      await this.step(frames);
    },
    async hold(code: string, frames: number): Promise<void> {
      this.down(code);
      await this.step(frames);
      this.up(code);
      await this.step(1);
    },
    /** Show a nearest-neighbour magnified crop of the game canvas as an overlay (for screenshots). */
    zoom(x: number, y: number, w: number, h: number, scale = 4): void {
      let c = document.getElementById('__zoom') as HTMLCanvasElement | null;
      if (!c) {
        c = document.createElement('canvas');
        c.id = '__zoom';
        c.style.cssText =
          'position:fixed;left:0;top:0;z-index:99;image-rendering:pixelated;border:2px solid #f0f;background:#000';
        document.body.appendChild(c);
      }
      c.width = w * scale;
      c.height = h * scale;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(app.screen.canvas, x, y, w, h, 0, 0, w * scale, h * scale);
      c.style.display = 'block';
    },
    /** Save a 2x screenshot of the game canvas to docs/screenshots/<name>.png (dev/preview server only). */
    async shot(name: string): Promise<number> {
      const src = app.screen.canvas;
      const c = document.createElement('canvas');
      c.width = src.width * 2;
      c.height = src.height * 2;
      const x = c.getContext('2d')!;
      x.imageSmoothingEnabled = false;
      x.drawImage(src, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/png').split(',')[1];
      const r = await fetch('/__screenshot', { method: 'POST', body: JSON.stringify({ name, data }) });
      return r.status;
    },
    cutscene(id: string): Promise<void> {
      return playCutscene(game, id);
    },
    unzoom(): void {
      const c = document.getElementById('__zoom');
      if (c) c.style.display = 'none';
    },
    /** Title → Continue. Returns true once the world is loaded. */
    async cont(): Promise<boolean> {
      await this.step(30);
      for (let i = 0; i < 5 && !this.w; i++) {
        await this.tap('Enter', 10);
        await this.step(50);
      }
      return !!this.w;
    },
    /** Make the hero a given level with matching epic gear, full HP/MP and flasks. */
    kit(level: number): void {
      const s = game.save;
      s.hero.level = level;
      s.hero.xp = 0;
      for (const slot of ['weapon', 'armor', 'helm', 'boots', 'ring', 'amulet'] as const) {
        s.equipment[slot] = game.rollItem(level, {
          slot,
          kind: slot === 'weapon' ? 'sword' : undefined,
          rarity: 'rare',
        });
      }
      game.invalidateStats();
      const st = game.stats();
      s.hero.hp = st.maxHp;
      s.hero.mp = st.maxMp;
      s.hero.flaskHp = st.flaskHpMax;
      s.hero.flaskMp = st.flaskMpMax;
      this.w?.player.syncFromSave(this.w);
    },
    /** Simple heuristic player: approach, attack, dodge telegraphs, drink flasks. */
    async bot(maxT = 150): Promise<Record<string, unknown>> {
      const w = this.w!;
      const p = w.player;
      const keys = new Set<string>();
      const set = (code: string, on: boolean): void => {
        if (on && !keys.has(code)) {
          this.down(code);
          keys.add(code);
        } else if (!on && keys.has(code)) {
          this.up(code);
          keys.delete(code);
        }
      };
      const press = async (code: string): Promise<void> => {
        this.down(code);
        await this.step(1);
        this.up(code);
      };
      let t = 0;
      let rolls = 0;
      let minHp = p.hp;
      const errors: string[] = [];
      const onErr = (e: ErrorEvent): void => {
        errors.push(e.message);
      };
      window.addEventListener('error', onErr);
      const startBoss = w.boss?.def.id;
      while (t < maxT && p.state !== 'dead') {
        const b = this.w!.boss;
        if (app.scenes.length > 1) {
          await press('Enter');
          await this.step(8);
          t += 9 / 60;
          continue;
        }
        if (!b || b.dead) break;
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        const d = Math.hypot(dx, dy);
        const danger =
          w.hazards.some(
            (h) => h.faction === 'enemy' && !h.triggered && h.t > h.spec.delay - 0.35 && h.contains(p),
          ) ||
          (b.state === 'windup' && b.stateT > (b.current?.windup ?? 0.5) - 0.3 && d < 140) ||
          w.projectiles.some((pr) => pr.faction === 'enemy' && Math.hypot(pr.x - p.x, pr.y - p.y) < 26);
        for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) set(k, false);
        if (p.hp < p.maxHp * 0.4 && game.save.hero.flaskHp > 0 && p.flaskCd <= 0) await press('KeyQ');
        if (danger && p.stamina > 30 && p.state !== 'roll') {
          const perp = Math.atan2(dy, dx) + (Math.PI / 2) * (Math.random() < 0.5 ? 1 : -1);
          set(Math.cos(perp) > 0.3 ? 'KeyD' : Math.cos(perp) < -0.3 ? 'KeyA' : 'x', true);
          set(Math.sin(perp) > 0.3 ? 'KeyS' : Math.sin(perp) < -0.3 ? 'KeyW' : 'x', true);
          await this.step(1);
          await press('Space');
          rolls++;
        } else {
          set(dx > 6 ? 'KeyD' : dx < -6 ? 'KeyA' : 'x', true);
          set(dy > 6 ? 'KeyS' : dy < -6 ? 'KeyW' : 'x', true);
          if (d < 40 + b.radius) {
            await this.step(1);
            for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) set(k, false);
            await press('KeyJ');
            if (Math.random() < 0.06) await press(`Digit${1 + Math.floor(Math.random() * 4)}`);
            if (game.save.hero.surge >= 100) await press('KeyF');
          }
        }
        await this.step(3);
        t += 5 / 60;
        minHp = Math.min(minHp, p.hp);
      }
      for (const k of [...keys]) set(k, false);
      window.removeEventListener('error', onErr);
      const b = this.w!.boss;
      return {
        t: +t.toFixed(1),
        startBoss,
        boss: b?.def.id ?? null,
        bossHp: b ? Math.round(b.hp) : 0,
        heroHp: Math.round(p.hp),
        heroMax: p.maxHp,
        minHp: Math.round(minHp),
        dead: p.state === 'dead',
        rolls,
        lvl: game.save.hero.level,
        errors,
      };
    },
    scenes(): string[] {
      return app.scenes.map((s) => s.constructor.name);
    },
  };
  (window as unknown as { T: typeof T }).T = T;
}

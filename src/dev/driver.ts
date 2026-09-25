/**
 * Dev-only automation driver (window.T) for testing in the browser even when the
 * tab is hidden and requestAnimationFrame is paused. Never included in production.
 */
import type { App } from '../engine/app';
import type { Game } from '../game/game';
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
    unzoom(): void {
      const c = document.getElementById('__zoom');
      if (c) c.style.display = 'none';
    },
    scenes(): string[] {
      return app.scenes.map((s) => s.constructor.name);
    },
  };
  (window as unknown as { T: typeof T }).T = T;
}

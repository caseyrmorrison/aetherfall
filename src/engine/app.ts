/**
 * Main loop and scene stack. Scenes are pushed/popped like a stack of screens: the
 * top scene receives updates; rendering starts at the highest opaque scene so
 * overlays (menus, dialogue) can draw on top of the world.
 */
import { Input } from './input';
import { Screen } from './screen';

export interface Scene {
  /** When true, scenes below this one are not rendered. */
  readonly opaque: boolean;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  /** Called when pushed / made active for the first time. */
  enter?(): void;
  /** Called when removed from the stack. */
  exit?(): void;
  /** Called when the scene above it was popped and it becomes the top again. */
  resume?(): void;
  /** When true, the scene directly below also keeps updating (e.g. non-pausing toasts). */
  readonly updateBelow?: boolean;
}

interface Fade {
  alpha: number;
  from: number;
  to: number;
  t: number;
  dur: number;
  color: string;
  resolve: (() => void) | null;
}

export class App {
  readonly screen: Screen;
  readonly input: Input;
  private stack: Scene[] = [];
  private fade: Fade = { alpha: 0, from: 0, to: 0, t: 0, dur: 0, color: '#000', resolve: null };
  private last = 0;
  private running = false;
  /** Seconds since start (unscaled). */
  time = 0;
  fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;
  /** Hook that runs every frame before scenes update (e.g. touch overlay, audio). */
  preUpdate: ((dt: number) => void) | null = null;
  /** Hook that renders on top of all scenes (e.g. touch controls, fps counter). */
  postRender: ((ctx: CanvasRenderingContext2D) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.screen = new Screen(canvas);
    this.input = new Input(canvas, this.screen.toInternal);
  }

  get width(): number {
    return this.screen.width;
  }

  get height(): number {
    return this.screen.height;
  }

  // ------------------------------------------------------------ scenes ----
  top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  get scenes(): readonly Scene[] {
    return this.stack;
  }

  push(scene: Scene): void {
    this.stack.push(scene);
    scene.enter?.();
  }

  pop(): Scene | undefined {
    const s = this.stack.pop();
    s?.exit?.();
    this.top()?.resume?.();
    return s;
  }

  /** Remove a specific scene wherever it is in the stack. */
  remove(scene: Scene): void {
    const i = this.stack.indexOf(scene);
    if (i < 0) return;
    const wasTop = i === this.stack.length - 1;
    this.stack.splice(i, 1);
    scene.exit?.();
    if (wasTop) this.top()?.resume?.();
  }

  /** Replace the whole stack with a single scene. */
  reset(scene: Scene): void {
    while (this.stack.length) this.stack.pop()?.exit?.();
    this.push(scene);
  }

  // ------------------------------------------------------------- fades ----
  fadeTo(alpha: number, dur: number, color = '#000'): Promise<void> {
    return new Promise((resolve) => {
      this.fade.resolve?.();
      this.fade = { alpha: this.fade.alpha, from: this.fade.alpha, to: alpha, t: 0, dur, color, resolve };
      if (dur <= 0) {
        this.fade.alpha = alpha;
        this.fade.resolve = null;
        resolve();
      }
    });
  }

  /** Fade out, run `fn` (e.g. swap scenes), fade back in. */
  async transition(fn: () => void | Promise<void>, dur = 0.35, color = '#000'): Promise<void> {
    await this.fadeTo(1, dur, color);
    await fn();
    await this.fadeTo(0, dur, color);
  }

  get fading(): boolean {
    return this.fade.resolve !== null;
  }

  // -------------------------------------------------------------- loop ----
  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  /** Advance one frame manually (used by automated tests / debugging when rAF is paused). */
  step(dt: number): void {
    this.tick(dt, dt);
  }

  private frame = (now: number): void => {
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    this.tick(Math.min(0.05, Math.max(0, rawDt)), rawDt);
    requestAnimationFrame(this.frame);
  };

  private tick(dt: number, rawDt: number): void {
    this.time += dt;
    this.fpsAcc += rawDt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }

    this.input.update(dt);
    this.preUpdate?.(dt);
    this.updateFade(dt);

    // update top scene (and below it while scenes allow pass-through)
    for (let i = this.stack.length - 1; i >= 0; i--) {
      const s = this.stack[i];
      s.update(dt);
      if (!s.updateBelow || this.stack[i] !== s) break;
    }

    this.render();
    this.input.endFrame();
  }

  private updateFade(dt: number): void {
    const f = this.fade;
    if (!f.resolve) return;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    f.alpha = f.from + (f.to - f.from) * k;
    if (k >= 1) {
      const r = f.resolve;
      f.resolve = null;
      r();
    }
  }

  private render(): void {
    const ctx = this.screen.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    let start = 0;
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].opaque) {
        start = i;
        break;
      }
    }
    if (this.stack.length === 0 || !this.stack[start]?.opaque) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.width, this.height);
    }
    for (let i = start; i < this.stack.length; i++) {
      ctx.save();
      this.stack[i].render(ctx);
      ctx.restore();
    }
    if (this.fade.alpha > 0.001) {
      ctx.globalAlpha = Math.min(1, this.fade.alpha);
      ctx.fillStyle = this.fade.color;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
    }
    this.postRender?.(ctx);
  }
}

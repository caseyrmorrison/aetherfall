/**
 * Owns the display canvas. The game renders at a low internal resolution chosen so
 * that the canvas is upscaled by an INTEGER factor in physical pixels — keeping
 * pixel art perfectly crisp while filling (almost) any window shape.
 */
export const BASE_HEIGHT = 270;
const MIN_W = 320;
const MAX_W = 720;
const MIN_H = 220;
const MAX_H = 360;

export class Screen {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  width = 480;
  height = 270;
  scale = 1;
  private listeners: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  onResize(fn: () => void): void {
    this.listeners.push(fn);
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const physW = Math.floor(vw * dpr);
    const physH = Math.floor(vh * dpr);
    let scale = Math.max(1, Math.round(physH / BASE_HEIGHT));
    scale = Math.max(1, Math.min(scale, Math.floor(physW / MIN_W), Math.floor(physH / MIN_H)));
    const w = Math.max(MIN_W, Math.min(MAX_W, Math.floor(physW / scale)));
    const h = Math.max(MIN_H, Math.min(MAX_H, Math.floor(physH / scale)));
    this.width = w;
    this.height = h;
    this.scale = scale;
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.width = `${(w * scale) / dpr}px`;
    this.canvas.style.height = `${(h * scale) / dpr}px`;
    this.ctx.imageSmoothingEnabled = false;
    for (const fn of this.listeners) fn();
  }

  /** Convert a client (CSS px) coordinate into internal canvas pixels. */
  toInternal = (clientX: number, clientY: number): { x: number; y: number } => {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * this.width,
      y: ((clientY - r.top) / r.height) * this.height,
    };
  };

  get isPortrait(): boolean {
    return window.innerHeight > window.innerWidth * 1.1;
  }
}

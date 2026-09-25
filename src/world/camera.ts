/** Smooth-follow camera with screen shake, clamped to the map. */
import { damp } from '../engine/math';

export class Camera {
  x = 0;
  y = 0;
  private shakeT = 0;
  private shakeDur = 0;
  private shakePow = 0;
  ox = 0;
  oy = 0;
  /** Global multiplier from settings (0 disables shake). */
  shakeScale = 1;

  follow(
    tx: number,
    ty: number,
    dt: number,
    viewW: number,
    viewH: number,
    mapW: number,
    mapH: number,
    snap = false,
  ): void {
    const cx = tx - viewW / 2;
    const cy = ty - viewH / 2;
    if (snap) {
      this.x = cx;
      this.y = cy;
    } else {
      this.x = damp(this.x, cx, 7, dt);
      this.y = damp(this.y, cy, 7, dt);
    }
    // clamp (center small maps)
    this.x = mapW <= viewW ? (mapW - viewW) / 2 : Math.max(0, Math.min(mapW - viewW, this.x));
    this.y = mapH <= viewH ? (mapH - viewH) / 2 : Math.max(0, Math.min(mapH - viewH, this.y));
    // shake
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeDur) * this.shakePow * this.shakeScale;
      this.ox = (Math.random() * 2 - 1) * k;
      this.oy = (Math.random() * 2 - 1) * k;
    } else {
      this.ox = this.oy = 0;
    }
  }

  shake(power: number, dur: number): void {
    if (power * this.shakeScale <= 0) return;
    if (power >= this.shakePow * Math.max(0, this.shakeT / (this.shakeDur || 1))) {
      this.shakePow = power;
      this.shakeDur = dur;
      this.shakeT = dur;
    }
  }

  /** Integer render offset (keeps pixels crisp). */
  get rx(): number {
    return Math.round(this.x + this.ox);
  }
  get ry(): number {
    return Math.round(this.y + this.oy);
  }
}

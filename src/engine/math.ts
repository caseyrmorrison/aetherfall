/** Small math helpers shared by the engine and game code. */

export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const sign = (v: number): number => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Frame-rate independent exponential approach: move `a` toward `b` with the given rate (1/s). */
export const damp = (a: number, b: number, rate: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-rate * dt));

export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
};

export const angleTo = (ax: number, ay: number, bx: number, by: number): number =>
  Math.atan2(by - ay, bx - ax);

/** Smallest signed difference between two angles, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

export function normalize(x: number, y: number): Vec {
  const l = Math.hypot(x, y);
  return l > 1e-9 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
}

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const pointInRect = (px: number, py: number, r: Rect): boolean =>
  px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;

export const circlesOverlap = (
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean => dist2(ax, ay, bx, by) < (ar + br) * (ar + br);

/** Does a circle intersect an arc-shaped sector (e.g. a sword swing)? */
export function circleInSector(
  cx: number,
  cy: number,
  cr: number,
  sx: number,
  sy: number,
  radius: number,
  facing: number,
  halfArc: number,
): boolean {
  const d = dist(sx, sy, cx, cy);
  if (d > radius + cr) return false;
  if (d <= cr) return true;
  const a = angleTo(sx, sy, cx, cy);
  // widen the arc by the angular size of the target so edge hits register
  const slack = Math.asin(Math.min(1, cr / d));
  return Math.abs(angleDiff(facing, a)) <= halfArc + slack;
}

/** Distance from point to segment. */
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, py, ax + vx * t, ay + vy * t);
}

/** Circle vs oriented "thick line" (a rectangle from a to b with half-width hw). */
export const circleHitsLine = (
  cx: number,
  cy: number,
  cr: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  hw: number,
): boolean => distToSegment(cx, cy, ax, ay, bx, by) <= hw + cr;

/** Direction name from an angle, 4-way. */
export function dirFromAngle(a: number): 'down' | 'up' | 'left' | 'right' {
  const d = ((a % TAU) + TAU) % TAU;
  if (d < Math.PI / 4 || d >= (7 * Math.PI) / 4) return 'right';
  if (d < (3 * Math.PI) / 4) return 'down';
  if (d < (5 * Math.PI) / 4) return 'left';
  return 'up';
}

export function angleFromDir(d: 'down' | 'up' | 'left' | 'right'): number {
  switch (d) {
    case 'right':
      return 0;
    case 'down':
      return Math.PI / 2;
    case 'left':
      return Math.PI;
    case 'up':
      return -Math.PI / 2;
  }
}

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number): number => t * t * t;
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t: number): number =>
  t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;

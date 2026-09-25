/**
 * On-screen touch controls: a floating virtual joystick on the left half and
 * action buttons on the right. Feeds the Input system's virtual actions.
 */
import type { App } from '../engine/app';
import { drawText } from '../engine/font';
import type { Action } from '../engine/input';
import type { Game } from '../game/game';

interface Btn {
  action: Action;
  label: string;
  x: number;
  y: number;
  r: number;
}

export class TouchControls {
  private enabled = false;
  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private stickPos = { x: 0, y: 0 };
  private btnTouches = new Map<number, Action>();
  private buttons: Btn[] = [];
  private seenTouch = false;

  constructor(
    private app: App,
    private game: Game,
  ) {
    const c = app.screen.canvas;
    c.addEventListener('touchstart', this.onStart, { passive: false });
    c.addEventListener('touchmove', this.onMove, { passive: false });
    c.addEventListener('touchend', this.onEnd, { passive: false });
    c.addEventListener('touchcancel', this.onEnd, { passive: false });
  }

  private get active(): boolean {
    const mode = this.game.settings.touchControls;
    return mode === 'on' || (mode === 'auto' && this.seenTouch);
  }

  private layout(): void {
    const W = this.app.width;
    const H = this.app.height;
    const inWorld = this.game.hasSave && this.app.scenes.length === 1;
    const bx = W - 34;
    const by = H - 40;
    this.buttons = inWorld
      ? [
          { action: 'attack', label: 'ATK', x: bx, y: by, r: 17 },
          { action: 'dodge', label: 'ROLL', x: bx - 40, y: by + 12, r: 14 },
          { action: 'interact', label: 'USE', x: bx + 2, y: by - 40, r: 12 },
          { action: 'skill1', label: '1', x: bx - 34, y: by - 30, r: 11 },
          { action: 'skill2', label: '2', x: bx - 62, y: by - 14, r: 11 },
          { action: 'skill3', label: '3', x: bx - 30, y: by - 62, r: 11 },
          { action: 'skill4', label: '4', x: bx - 60, y: by - 46, r: 11 },
          { action: 'ultimate', label: 'SRG', x: bx - 76, y: by + 16, r: 11 },
          { action: 'potionHp', label: 'HP', x: 64, y: 58, r: 10 },
          { action: 'potionMp', label: 'MP', x: 88, y: 58, r: 10 },
          { action: 'menu', label: 'MENU', x: W - 90, y: 10, r: 9 },
        ]
      : [
          { action: 'confirm', label: 'OK', x: W - 30, y: H - 34, r: 16 },
          { action: 'cancel', label: 'BACK', x: W - 70, y: H - 22, r: 13 },
          { action: 'tabPrev', label: '<', x: 18, y: 10, r: 9 },
          { action: 'tabNext', label: '>', x: W - 18, y: 10, r: 9 },
        ];
  }

  private toLocal(t: Touch): { x: number; y: number } {
    return this.app.screen.toInternal(t.clientX, t.clientY);
  }

  private onStart = (e: TouchEvent): void => {
    this.seenTouch = true;
    if (!this.active) return;
    e.preventDefault();
    this.layout();
    for (const t of Array.from(e.changedTouches)) {
      const p = this.toLocal(t);
      const b = this.buttons.find((b) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 5);
      if (b) {
        this.btnTouches.set(t.identifier, b.action);
        this.app.input.setVirtual(b.action, true);
        continue;
      }
      if (p.x < this.app.width * 0.5 && this.stickId === null) {
        this.stickId = t.identifier;
        this.stickOrigin = p;
        this.stickPos = p;
      } else {
        // tap anywhere else = confirm in menus / dialogue
        this.btnTouches.set(t.identifier, 'confirm');
        this.app.input.setVirtual('confirm', true);
      }
    }
  };

  private onMove = (e: TouchEvent): void => {
    if (!this.active) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stickId) this.stickPos = this.toLocal(t);
    }
  };

  private onEnd = (e: TouchEvent): void => {
    if (!this.active) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stickId) {
        this.stickId = null;
        this.app.input.virtualStick = { x: 0, y: 0 };
        for (const a of ['up', 'down', 'left', 'right'] as Action[]) this.app.input.setVirtual(a, false);
      }
      const a = this.btnTouches.get(t.identifier);
      if (a) {
        this.btnTouches.delete(t.identifier);
        this.app.input.setVirtual(a, false);
      }
    }
  };

  update(_dt: number): void {
    this.enabled = this.active;
    if (!this.enabled) return;
    this.layout();
    if (this.stickId !== null) {
      const dx = this.stickPos.x - this.stickOrigin.x;
      const dy = this.stickPos.y - this.stickOrigin.y;
      const max = 22;
      const l = Math.hypot(dx, dy);
      const k = l > max ? max / l : 1;
      this.app.input.virtualStick = { x: (dx * k) / max, y: (dy * k) / max };
      // digital directions for menus
      const input = this.app.input;
      input.setVirtual('left', dx < -12);
      input.setVirtual('right', dx > 12);
      input.setVirtual('up', dy < -12);
      input.setVirtual('down', dy > 12);
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled) return;
    ctx.save();
    ctx.globalAlpha = 0.35;
    if (this.stickId !== null) {
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.stickOrigin.x, this.stickOrigin.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      const dx = this.stickPos.x - this.stickOrigin.x;
      const dy = this.stickPos.y - this.stickOrigin.y;
      const l = Math.hypot(dx, dy);
      const k = l > 22 ? 22 / l : 1;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.stickOrigin.x + dx * k, this.stickOrigin.y + dy * k, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.game.hasSave && this.app.scenes.length === 1) {
      drawText(ctx, 'drag to move', 30, this.app.height - 30, { color: '#ffffff' });
    }
    for (const b of this.buttons) {
      const held = [...this.btnTouches.values()].includes(b.action);
      ctx.globalAlpha = held ? 0.6 : 0.3;
      ctx.fillStyle = '#181425';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.globalAlpha = 0.8;
      drawText(ctx, b.label, b.x, b.y - 4, { align: 'center', color: '#ffffff', shadow: false });
    }
    ctx.restore();
  }
}

/**
 * Unified input: keyboard, mouse, gamepad (standard mapping) and touch, mapped to
 * abstract game actions. Supports rebinding, menu auto-repeat and device-aware
 * button prompts.
 */

export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'confirm'
  | 'cancel'
  | 'attack'
  | 'dodge'
  | 'interact'
  | 'skill1'
  | 'skill2'
  | 'skill3'
  | 'skill4'
  | 'ultimate'
  | 'potionHp'
  | 'potionMp'
  | 'menu'
  | 'map'
  | 'pause'
  | 'tabPrev'
  | 'tabNext'
  | 'menuAlt'
  | 'menuAlt2';

export const ACTIONS: readonly Action[] = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'cancel',
  'attack',
  'dodge',
  'interact',
  'skill1',
  'skill2',
  'skill3',
  'skill4',
  'ultimate',
  'potionHp',
  'potionMp',
  'menu',
  'map',
  'pause',
  'tabPrev',
  'tabNext',
  'menuAlt',
  'menuAlt2',
];

/** Actions shown (and rebindable) in the controls menu. */
export const REBINDABLE: readonly Action[] = [
  'up',
  'down',
  'left',
  'right',
  'attack',
  'dodge',
  'interact',
  'skill1',
  'skill2',
  'skill3',
  'skill4',
  'ultimate',
  'potionHp',
  'potionMp',
  'menu',
  'map',
  'pause',
];

export const ACTION_LABELS: Record<Action, string> = {
  up: 'Move Up',
  down: 'Move Down',
  left: 'Move Left',
  right: 'Move Right',
  confirm: 'Confirm',
  cancel: 'Cancel',
  attack: 'Attack',
  dodge: 'Dodge Roll',
  interact: 'Interact / Talk',
  skill1: 'Skill 1',
  skill2: 'Skill 2',
  skill3: 'Skill 3',
  skill4: 'Skill 4',
  ultimate: 'Aether Surge',
  potionHp: 'Health Flask',
  potionMp: 'Mana Flask',
  menu: 'Menu',
  map: 'Map',
  pause: 'Pause',
  tabPrev: 'Prev Tab',
  tabNext: 'Next Tab',
  menuAlt: 'Menu Action',
  menuAlt2: 'Menu Action 2',
};

export type KeyBindings = Record<Action, string[]>;

export const DEFAULT_KEYS: KeyBindings = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  confirm: ['Enter', 'Space', 'KeyJ', 'NumpadEnter'],
  cancel: ['Escape', 'Backspace', 'KeyK'],
  attack: ['KeyJ', 'Mouse0'],
  dodge: ['Space', 'KeyK', 'Mouse2'],
  interact: ['KeyE', 'Enter'],
  skill1: ['Digit1'],
  skill2: ['Digit2'],
  skill3: ['Digit3'],
  skill4: ['Digit4'],
  ultimate: ['KeyF'],
  potionHp: ['KeyQ'],
  potionMp: ['KeyR'],
  menu: ['Tab', 'KeyI'],
  map: ['KeyM'],
  pause: ['Escape', 'KeyP'],
  tabPrev: ['KeyQ', 'PageUp'],
  tabNext: ['KeyE', 'PageDown'],
  menuAlt: ['KeyX'],
  menuAlt2: ['KeyC'],
};

// Standard gamepad button indices
const PAD: Record<Action, number[]> = {
  up: [12],
  down: [13],
  left: [14],
  right: [15],
  confirm: [0],
  cancel: [1],
  attack: [2],
  dodge: [1],
  interact: [0],
  skill1: [4],
  skill2: [5],
  skill3: [6],
  skill4: [7],
  ultimate: [3],
  potionHp: [12],
  potionMp: [13],
  menu: [9],
  map: [8],
  pause: [], // Start opens the main menu; System is one tab away (LB)
  tabPrev: [4],
  tabNext: [5],
  menuAlt: [2],
  menuAlt2: [3],
};

export const PAD_LABELS: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'SEL',
  9: 'START',
  12: 'UP',
  13: 'DOWN',
  14: 'LEFT',
  15: 'RIGHT',
};

export type Device = 'keyboard' | 'gamepad' | 'touch';

const STICK_DEAD = 0.22;

export class Input {
  keys: KeyBindings;
  lastDevice: Device = 'keyboard';

  private down = new Set<string>();
  private justDown = new Set<string>();
  private justUp = new Set<string>();

  private padDown = new Set<number>();
  private padPrev = new Set<number>();
  private stick = { x: 0, y: 0 };
  private rstick = { x: 0, y: 0 };

  /** Virtual (touch) action states set by the touch overlay. */
  private virtualDown = new Set<Action>();
  private virtualPressed = new Set<Action>();
  virtualStick = { x: 0, y: 0 };

  private prevActions = new Set<Action>();
  private curActions = new Set<Action>();
  /** Actions whose key went down this frame (even if released again before we polled). */
  private forcePressed = new Set<Action>();

  // menu auto-repeat
  private repeatTimers = new Map<Action, number>();
  private repeated = new Set<Action>();

  /** Mouse position in internal (low-res) canvas pixels. */
  mouse = { x: -1, y: -1, moved: false, clicked: false, rightClicked: false, wheel: 0, lastMoveTime: -1e9 };

  private captureCb: ((code: string) => void) | null = null;
  private anyPressedFlag = false;
  private time = 0;

  constructor(
    target: HTMLElement,
    private toInternal: (clientX: number, clientY: number) => { x: number; y: number },
    keys?: Partial<KeyBindings>,
  ) {
    this.keys = { ...DEFAULT_KEYS, ...keys } as KeyBindings;
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', () => this.releaseAll());
    target.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener(
      'wheel',
      (e) => {
        this.mouse.wheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setBindings(keys: Partial<KeyBindings>): void {
    this.keys = { ...DEFAULT_KEYS, ...keys } as KeyBindings;
  }

  /** Next raw key/mouse code is delivered to cb instead of the game (for rebinding). */
  captureNext(cb: (code: string) => void): void {
    this.captureCb = cb;
  }

  get capturing(): boolean {
    return this.captureCb !== null;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // Let the browser handle key combos like Cmd+R / Ctrl+Shift+I, and inputs in DOM text fields.
    if (e.metaKey || e.ctrlKey || (e.target instanceof HTMLInputElement && e.target.type === 'text')) return;
    if (e.code === 'F11' || e.code === 'F12' || e.code === 'F5') return;
    e.preventDefault();
    this.lastDevice = 'keyboard';
    if (this.captureCb) {
      if (!e.repeat) {
        const cb = this.captureCb;
        this.captureCb = null;
        cb(e.code);
      }
      return;
    }
    if (e.repeat) return;
    this.down.add(e.code);
    this.justDown.add(e.code);
    this.anyPressedFlag = true;
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
    this.justUp.add(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    const code = `Mouse${e.button}`;
    this.lastDevice = 'keyboard';
    this.updateMousePos(e);
    if (this.captureCb) {
      const cb = this.captureCb;
      this.captureCb = null;
      cb(code);
      return;
    }
    this.down.add(code);
    this.justDown.add(code);
    if (e.button === 0) this.mouse.clicked = true;
    if (e.button === 2) this.mouse.rightClicked = true;
    this.anyPressedFlag = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    const code = `Mouse${e.button}`;
    this.down.delete(code);
    this.justUp.add(code);
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.updateMousePos(e);
    this.mouse.moved = true;
    this.mouse.lastMoveTime = this.time;
    if (this.lastDevice === 'gamepad') this.lastDevice = 'keyboard';
  };

  private updateMousePos(e: MouseEvent): void {
    const p = this.toInternal(e.clientX, e.clientY);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
  }

  releaseAll(): void {
    for (const k of this.down) this.justUp.add(k);
    this.down.clear();
    this.virtualDown.clear();
  }

  // ---- touch bridge -------------------------------------------------------
  setVirtual(action: Action, isDown: boolean): void {
    if (isDown && !this.virtualDown.has(action)) this.virtualPressed.add(action);
    if (isDown) this.virtualDown.add(action);
    else this.virtualDown.delete(action);
    this.lastDevice = 'touch';
    this.anyPressedFlag = this.anyPressedFlag || isDown;
  }

  // ---- per-frame ------------------------------------------------------------
  /** Poll devices and compute action states. Call once at the start of each frame. */
  update(dt: number): void {
    this.time += dt;
    this.pollGamepad();
    this.prevActions = this.curActions;
    this.curActions = new Set();
    for (const a of ACTIONS) {
      if (this.rawDown(a)) this.curActions.add(a);
    }
    // just-pressed keys that were released within the same frame still count as pressed
    for (const a of ACTIONS) {
      if (this.keys[a].some((k) => this.justDown.has(k)) || this.virtualPressed.has(a)) {
        if (!this.prevActions.has(a)) this.curActions.add(a);
        this.forcePressed.add(a);
      }
    }
    // menu auto-repeat for directions & tabs
    this.repeated.clear();
    for (const a of ['up', 'down', 'left', 'right', 'tabPrev', 'tabNext'] as const) {
      if (this.curActions.has(a)) {
        const t = (this.repeatTimers.get(a) ?? -1) + dt;
        if (!this.prevActions.has(a) || this.forcePressed.has(a)) {
          this.repeated.add(a);
          this.repeatTimers.set(a, 0);
        } else if (t > 0.34) {
          this.repeated.add(a);
          this.repeatTimers.set(a, 0.34 - 0.07);
        } else this.repeatTimers.set(a, t);
      } else this.repeatTimers.delete(a);
    }
  }

  /** Clear per-frame edges. Call at the end of each frame. */
  endFrame(): void {
    this.justDown.clear();
    this.justUp.clear();
    this.virtualPressed.clear();
    this.forcePressed.clear();
    this.mouse.clicked = false;
    this.mouse.rightClicked = false;
    this.mouse.moved = false;
    this.mouse.wheel = 0;
    this.anyPressedFlag = false;
    this.padPrev = new Set(this.padDown);
  }

  private rawDown(a: Action): boolean {
    if (this.keys[a].some((k) => this.down.has(k))) return true;
    if (this.virtualDown.has(a)) return true;
    if (PAD[a].some((b) => this.padDown.has(b))) return true;
    // left stick as digital directions
    if (a === 'up' && this.stick.y < -0.5) return true;
    if (a === 'down' && this.stick.y > 0.5) return true;
    if (a === 'left' && this.stick.x < -0.5) return true;
    if (a === 'right' && this.stick.x > 0.5) return true;
    return false;
  }

  isDown(a: Action): boolean {
    return this.curActions.has(a);
  }

  pressed(a: Action): boolean {
    return (this.curActions.has(a) && !this.prevActions.has(a)) || this.forcePressed.has(a);
  }

  released(a: Action): boolean {
    return !this.curActions.has(a) && this.prevActions.has(a);
  }

  /** Pressed with keyboard-style auto-repeat (menus). */
  repeat(a: 'up' | 'down' | 'left' | 'right' | 'tabPrev' | 'tabNext'): boolean {
    return this.repeated.has(a);
  }

  /** Was any key/button/touch pressed this frame? */
  anyPressed(): boolean {
    return this.anyPressedFlag || [...this.padDown].some((b) => !this.padPrev.has(b));
  }

  /** Analog movement vector, length <= 1. */
  move(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    // D-pad is reserved for quick items in the field, so pads move with the stick only.
    const kb = (a: Action): boolean => this.keys[a].some((k) => this.down.has(k));
    if (kb('left')) x -= 1;
    if (kb('right')) x += 1;
    if (kb('up')) y -= 1;
    if (kb('down')) y += 1;
    if (x !== 0 || y !== 0) {
      const l = Math.hypot(x, y);
      return { x: x / l, y: y / l };
    }
    const s = Math.hypot(this.stick.x, this.stick.y) > 0 ? this.stick : this.virtualStick;
    const l = Math.hypot(s.x, s.y);
    if (l < STICK_DEAD) return { x: 0, y: 0 };
    const m = Math.min(1, (l - STICK_DEAD) / (1 - STICK_DEAD) + 0.15);
    return { x: (s.x / l) * m, y: (s.y / l) * m };
  }

  /** Right-stick aim direction, or null. */
  padAim(): { x: number; y: number } | null {
    const l = Math.hypot(this.rstick.x, this.rstick.y);
    return l > 0.4 ? { x: this.rstick.x / l, y: this.rstick.y / l } : null;
  }

  /** True if the mouse was used recently enough that it should drive aiming. */
  mouseAimActive(): boolean {
    return this.lastDevice === 'keyboard' && this.time - this.mouse.lastMoveTime < 3 && this.mouse.x >= 0;
  }

  private pollGamepad(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    this.padDown.clear();
    if (!pad) {
      this.stick.x = this.stick.y = 0;
      this.rstick.x = this.rstick.y = 0;
      return;
    }
    let active = false;
    pad.buttons.forEach((b, i) => {
      if (b.pressed || b.value > 0.5) {
        this.padDown.add(i);
        active = true;
      }
    });
    const ax = pad.axes;
    this.stick.x = Math.abs(ax[0] ?? 0) > STICK_DEAD ? (ax[0] ?? 0) : 0;
    this.stick.y = Math.abs(ax[1] ?? 0) > STICK_DEAD ? (ax[1] ?? 0) : 0;
    this.rstick.x = ax[2] ?? 0;
    this.rstick.y = ax[3] ?? 0;
    if (active || this.stick.x !== 0 || this.stick.y !== 0 || Math.hypot(this.rstick.x, this.rstick.y) > 0.4)
      this.lastDevice = 'gamepad';
  }

  /** Short label for the primary binding of an action on the current device. */
  label(a: Action): string {
    if (this.lastDevice === 'gamepad') {
      const b = PAD[a][0];
      return PAD_LABELS[b] ?? `B${b}`;
    }
    const k = this.keys[a][0];
    return k ? keyLabel(k) : '-';
  }
}

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'N' + code.slice(6);
  const map: Record<string, string> = {
    Space: 'SPACE',
    Enter: 'ENTER',
    Escape: 'ESC',
    Backspace: 'BKSP',
    Tab: 'TAB',
    ShiftLeft: 'SHIFT',
    ShiftRight: 'RSHIFT',
    ControlLeft: 'CTRL',
    AltLeft: 'ALT',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    Mouse0: 'LMB',
    Mouse1: 'MMB',
    Mouse2: 'RMB',
    PageUp: 'PGUP',
    PageDown: 'PGDN',
    Semicolon: ';',
    Quote: "'",
    Comma: ',',
    Period: '.',
    Slash: '/',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backquote: '`',
  };
  return map[code] ?? code;
}

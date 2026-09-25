/** Anime cutscene player: illustrations, dialogue, narration, cut-ins, flashes, shake & title cards. */
import {
  cutInDuration,
  drawCutIn,
  drawIllustration,
  drawPortrait,
  drawSpeedLines,
  preloadCutIn,
  preloadIllustration,
  setPortraitFlags,
  type CutInId,
  type IllustrationId,
} from '../art/anime';
import { audio } from '../audio';
import { CUTSCENES, type CutStep } from '../data/cutscenes';
import type { Scene } from '../engine/app';
import { drawLines, drawText, visibleLength, wrapText } from '../engine/font';
import { parseLine, type Line } from '../game/dialogue';
import type { Game } from '../game/game';
import { TEXT_SPEED_CPS } from '../game/settings';
import { drawBar, drawPanel, UI } from '../ui/widgets';
import { applyImpactFrame, impactStyleAt, zoomPunch, type ImpactStyle } from '../ui/fx';
import { BacklogScene } from './backlog';

export class CutsceneScene implements Scene {
  readonly opaque = true;
  private steps: CutStep[];
  private i = -1;
  private stepT = 0;
  private illus: IllustrationId | null = null;
  private illusT = 0;
  private illusFrozen = false;
  private illusLoop: [number, number] | null = null;
  private prevIllus: IllustrationId | null = null;
  private prevT = 0;
  private crossT = 1;
  private line: Line | null = null;
  private narration: string | null = null;
  private wrapped: string[] = [];
  private shown = 0;
  private total = 0;
  private fade = 0;
  private fadeFrom = 0;
  private fadeTo = 0;
  private fadeDur = 0;
  private fadeColor = '#000';
  private flashT = 0;
  private impactT = 0;
  private impactDur = 0;
  private impactStyle: ImpactStyle = 'red';
  private zoom: { scale: number; t: number; dur: number; x: number; y: number } | null = null;
  private flashDur = 0;
  private flashColor = '#fff';
  private shakeT = 0;
  private shakePow = 0;
  private speed = false;
  private title: { text: string; sub?: string } | null = null;
  private cutin: CutInId | null = null;
  private skipHold = 0;
  private t = 0;
  private blipAcc = 0;
  private done = false;

  private preloaded = new Set<string>();

  constructor(
    private game: Game,
    private id: string,
    private onDone: () => void,
  ) {
    this.steps = CUTSCENES[id] ?? [];
  }

  enter(): void {
    // Kai only bears the shard mark after the fusion scene in the intro.
    setPortraitFlags({ kaiMark: this.id !== 'intro' });
    const first = this.steps.find((s): s is { illus: IllustrationId } => 'illus' in s && !!s.illus);
    if (first) this.preload(first.illus, 1);
    this.advance();
  }

  /** Warm the next illustration / cut-in while the player reads, so shot changes never hitch. */
  private preloadAhead(): void {
    for (let j = this.i + 1; j < this.steps.length; j++) {
      const s = this.steps[j];
      if ('illus' in s && s.illus) {
        this.preload(s.illus, 2);
        return;
      }
      if ('cutin' in s && !this.preloaded.has(s.cutin)) {
        this.preloaded.add(s.cutin);
        preloadCutIn(s.cutin, this.game.app.width, this.game.app.height);
        return;
      }
    }
  }

  private preload(id: IllustrationId, seconds: number): void {
    if (this.preloaded.has(id)) return;
    this.preloaded.add(id);
    preloadIllustration(id, this.game.app.width, this.game.app.height, seconds);
  }

  private advance(): void {
    this.line = null;
    this.narration = null;
    this.title = null;
    this.cutin = null;
    this.i++;
    this.stepT = 0;
    if (this.i >= this.steps.length) {
      this.finish();
      return;
    }
    const s = this.steps[this.i];
    const hero = this.game.hasSave ? this.game.save.hero.name : 'Kai';
    if ('music' in s) {
      if (s.music) audio.playMusic(s.music, { fade: 1 });
      else audio.stopMusic(0.5);
      this.advance();
    } else if ('illus' in s) {
      this.prevIllus = this.illus;
      this.prevT = this.illusT;
      this.illus = s.illus;
      this.illusT = 0;
      this.crossT = s.fade ?? (this.prevIllus ? 0 : 1);
      this.illusFrozen = false;
      this.illusLoop = null;
      if (s.illus === 'shard_fusion') setPortraitFlags({ kaiMark: true });
      this.advance();
    } else if ('illusT' in s) {
      this.illusT = s.illusT;
      this.illusFrozen = !!s.freeze;
      this.illusLoop = null;
      this.advance();
    } else if ('illusLoop' in s) {
      this.illusLoop = s.illusLoop;
      if (s.illusLoop && (this.illusT < s.illusLoop[0] || this.illusT > s.illusLoop[1]))
        this.illusT = s.illusLoop[0];
      this.advance();
    } else if ('say' in s) {
      this.line = parseLine(s.say, hero);
      this.setText(this.line.text, this.line.portrait ? 360 : 440);
      this.game.logLine(this.line.who, this.line.text);
    } else if ('narrate' in s) {
      this.narration = s.narrate.replace(/\{hero\}/g, hero);
      this.setText(this.narration, Math.min(this.game.app.width - 60, 380));
      this.game.logLine(undefined, this.narration);
    } else if ('sfx' in s) {
      audio.playSfx(s.sfx);
      this.advance();
    } else if ('flash' in s) {
      if (!this.game.settings.reduceFlashing) {
        this.flashColor = s.flash;
        this.flashDur = this.flashT = s.dur ?? 0.3;
      }
      this.advance();
    } else if ('shake' in s) {
      this.shakePow = s.shake * this.game.settings.screenShake;
      this.shakeT = s.dur ?? 0.5;
      this.advance();
    } else if ('fadeOut' in s) {
      this.fadeFrom = this.fade;
      this.fadeTo = 1;
      this.fadeDur = s.fadeOut;
      this.fadeColor = s.color ?? '#000';
    } else if ('fadeIn' in s) {
      this.fadeFrom = this.fade;
      this.fadeTo = 0;
      this.fadeDur = s.fadeIn;
    } else if ('speedlines' in s) {
      this.speed = s.speedlines;
      this.advance();
    } else if ('title' in s) {
      this.title = { text: s.title, sub: s.sub };
      this.fade = 0;
    } else if ('cutin' in s) {
      this.cutin = s.cutin;
      audio.playSfx('surge_cutin');
    } else if ('impact' in s) {
      if (!this.game.settings.reduceFlashing) {
        this.impactT = this.impactDur = s.impact;
        this.impactStyle = s.style ?? 'red';
      }
      this.advance();
    } else if ('zoom' in s) {
      this.zoom = { scale: s.zoom, t: 0, dur: s.dur ?? 0.35, x: s.x ?? 0.5, y: s.y ?? 0.45 };
      this.advance();
    }
  }

  private setText(text: string, width: number): void {
    const box = Math.min(this.game.app.width - 12, 440);
    this.wrapped = wrapText(text, Math.min(width, box - (this.line?.portrait ? 94 : 20)));
    this.total = this.wrapped.reduce((n, l) => n + visibleLength(l), 0);
    this.shown = this.game.settings.textSpeed === 'instant' ? this.total : 0;
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.game.app.remove(this);
    this.onDone();
  }

  update(dt: number): void {
    const input = this.game.app.input;
    this.t += dt;
    this.stepT += dt;
    if (!this.illusFrozen) this.illusT += dt;
    if (this.illusLoop && this.illusT > this.illusLoop[1])
      this.illusT = this.illusLoop[0] + (this.illusT - this.illusLoop[1]);
    this.prevT += dt;
    this.crossT = Math.min(1, this.crossT + dt / 0.6);
    this.flashT = Math.max(0, this.flashT - dt);
    this.impactT = Math.max(0, this.impactT - dt);
    if (this.zoom) {
      this.zoom.t += dt;
      if (this.zoom.t >= this.zoom.dur) this.zoom = null;
    }
    this.shakeT = Math.max(0, this.shakeT - dt);

    // hold to skip
    if (input.isDown('cancel') || input.isDown('pause') || input.isDown('menu')) {
      this.skipHold += dt;
      if (this.skipHold > 0.9) {
        audio.playSfx('ui_back');
        this.finish();
        return;
      }
    } else this.skipHold = 0;

    const s = this.steps[this.i];
    if (!s) return;
    if (input.pressed('menuAlt2')) {
      this.game.app.push(new BacklogScene(this.game));
      return;
    }
    if (input.pressed('menuAlt')) {
      this.game.settings.autoAdvance = !this.game.settings.autoAdvance;
      this.game.persistSettings();
    }
    if (this.stepT > 0.25 && ('say' in s || 'narrate' in s)) this.preloadAhead();
    const click = input.pressed('confirm') || input.pressed('interact') || input.mouse.clicked;
    if ('say' in s || 'narrate' in s) {
      if (this.shown < this.total) {
        const before = Math.floor(this.shown);
        this.shown = Math.min(this.total, this.shown + TEXT_SPEED_CPS[this.game.settings.textSpeed] * dt);
        this.blipAcc += Math.floor(this.shown) - before;
        if (this.blipAcc >= 3 && 'say' in s) {
          this.blipAcc = 0;
          audio.playSfx('text_blip', { volume: 0.3 });
        }
        if (click) this.shown = this.total;
      } else if (click || (this.game.settings.autoAdvance && this.stepT > 1.5 + this.total / 50)) {
        audio.playSfx('ui_move', { volume: 0.4 });
        this.advance();
      }
    } else if ('wait' in s) {
      if (this.stepT >= s.wait || click) this.advance();
    } else if ('fadeOut' in s || 'fadeIn' in s) {
      const k = Math.min(1, this.stepT / Math.max(0.01, this.fadeDur));
      this.fade = this.fadeFrom + (this.fadeTo - this.fadeFrom) * k;
      if (k >= 1) this.advance();
    } else if ('title' in s) {
      if (this.stepT >= (s.dur ?? 2.5) || (click && this.stepT > 0.6)) this.advance();
    } else if ('cutin' in s) {
      if (this.stepT >= cutInDuration(s.cutin)) this.advance();
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    if (this.shakeT > 0)
      ctx.translate(
        Math.round((Math.random() * 2 - 1) * this.shakePow),
        Math.round((Math.random() * 2 - 1) * this.shakePow),
      );
    if (this.prevIllus && this.crossT < 1) drawIllustration(ctx, this.prevIllus, this.prevT, W, H);
    if (this.illus) {
      ctx.globalAlpha = this.crossT;
      drawIllustration(ctx, this.illus, this.illusT, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.speed) drawSpeedLines(ctx, W / 2, H / 2, W, H, this.t, '#ffffff', 1);
    ctx.restore();

    // cinematic letterbox
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, 14);
    ctx.fillRect(0, H - 14, W, 14);

    if (this.cutin) drawCutIn(ctx, this.cutin, this.stepT, W, H);
    if (this.zoom) {
      const k = Math.min(1, this.zoom.t / this.zoom.dur);
      // snap in, ease back out
      const scale = 1 + (this.zoom.scale - 1) * (1 - k) * (1 - k);
      zoomPunch(ctx, W, H, this.zoom.x * W, this.zoom.y * H, scale);
    }
    if (this.impactT > 0)
      applyImpactFrame(ctx, W, H, impactStyleAt(this.impactDur - this.impactT, this.impactStyle));

    if (this.fade > 0) {
      ctx.globalAlpha = this.fade;
      ctx.fillStyle = this.fadeColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.flashT > 0) {
      ctx.globalAlpha = this.flashT / this.flashDur;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    if (this.line) this.renderSay(ctx, W, H);
    if (this.narration) this.renderNarration(ctx, W, H);
    if (this.title) this.renderTitle(ctx, W, H);

    // skip hint
    if (this.skipHold > 0) {
      drawText(ctx, 'Skipping…', W - 8, 3, { align: 'right', color: '#ffffff' });
      drawBar(ctx, W - 60, 12, 52, 1, this.skipHold / 0.9, UI.accent, { shine: false });
    } else {
      const input = this.game.app.input;
      const auto = this.game.settings.autoAdvance;
      drawText(
        ctx,
        `[${input.label('menuAlt')}] ${auto ? '{cyan}AUTO{/}' : 'Auto'}  [${input.label('menuAlt2')}] Log  Hold [${input.label('cancel')}] Skip`,
        W - 6,
        3,
        { align: 'right', color: UI.dim, alpha: this.t < 4 || auto ? 1 : 0.55 },
      );
    }
  }

  private renderSay(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const line = this.line!;
    const w = Math.min(W - 12, 440);
    const x = Math.round((W - w) / 2);
    const h = 56;
    const y = H - h - 18;
    const talking = this.shown < this.total && Math.floor(this.t * 8) % 2 === 0;
    if (line.portrait) {
      drawPortrait(ctx, line.portrait, line.expr ?? 'neutral', x - 2, y - 44, 92, 100, {
        talking,
        blink: Math.floor(this.t * 10) % 41 === 0,
      });
    }
    const off = line.portrait ? 84 : 0;
    drawPanel(ctx, x + off, y, w - off, h, { alpha: 0.9 });
    if (line.who) {
      drawPanel(ctx, x + off + 6, y - 12, Math.max(40, line.who.length * 5 + 12), 13, {
        fill: UI.bg2,
        border: UI.accent,
      });
      drawText(ctx, line.who, x + off + 12, y - 9, { color: UI.accent });
    }
    drawLines(ctx, this.wrapped, x + off + 10, y + 8, { maxChars: Math.floor(this.shown), lineHeight: 11 });
    if (this.shown >= this.total && Math.floor(this.t * 3) % 2 === 0)
      drawText(ctx, '▼', x + w - 10, y + h - 11, { color: UI.accent });
  }

  private renderNarration(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const lh = 12;
    const h = this.wrapped.length * lh + 16;
    const y = Math.round(H / 2 - h / 2);
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, y, W, h);
    ctx.globalAlpha = 1;
    this.wrapped.forEach((l, i) => {
      const before = this.wrapped.slice(0, i).reduce((n, x) => n + visibleLength(x), 0);
      const budget = Math.floor(this.shown) - before;
      if (budget <= 0) return;
      drawText(ctx, l, W / 2, y + 8 + i * lh, { align: 'center', maxChars: budget, color: '#ffffff' });
    });
  }

  private renderTitle(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const t = this.title!;
    const k = this.stepT;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const a = Math.min(1, k * 1.5);
    const big = t.text === 'AETHERFALL';
    drawText(ctx, t.text, W / 2, H / 2 - (big ? 22 : 14), {
      align: 'center',
      color: big ? UI.cyan : '#ffffff',
      scale: big ? 4 : 2,
      alpha: a,
      outline: big ? '#124e89' : undefined,
    });
    if (t.sub) {
      const a2 = Math.min(1, Math.max(0, (k - 0.5) * 1.5));
      ctx.fillStyle = UI.accent;
      ctx.globalAlpha = a2;
      const lw = Math.min(200, 60 + k * 120);
      ctx.fillRect(Math.round(W / 2 - lw / 2), H / 2 + 14, Math.round(lw), 1);
      ctx.globalAlpha = 1;
      drawText(ctx, t.sub, W / 2, H / 2 + 20, { align: 'center', color: UI.accent, alpha: a2 });
    }
  }
}

export function playCutscene(game: Game, id: string): Promise<void> {
  return new Promise((resolve) => {
    game.app.push(new CutsceneScene(game, id, resolve));
  });
}

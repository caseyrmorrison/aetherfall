/**
 * Ascend tab: choose an Ascendancy class after the first Trial of Ascension, then spend
 * the points each trial grants on that class's notables.
 */
import { audio } from '../../audio';
import {
  ASC_CLASS_INFO,
  ASC_CLASSES,
  ASC_NODE_COST,
  ASC_NODES,
  type AscNodeDef,
} from '../../data/ascendancy';
import { TRIALS } from '../../data/trials';
import { drawText, wrapText } from '../../engine/font';
import { pointInRect, type Rect } from '../../engine/math';
import { ascBlocker, ascPoints, ascUnspent, takeAscNode } from '../../game/ascendancy';
import { drawIcon, drawPanel, drawTooltip, ellipsize, UI } from '../../ui/widgets';
import { ConfirmScene } from '../confirm';
import type { MenuScene, TabView } from './menu';

const NODE_W = 96;
const NODE_H = 30;

export class AscendTab implements TabView {
  readonly label = 'Ascend';
  private pick = 0;
  private col = 0;
  private tier = 0;
  private rects: { r: Rect; a: number; b: number }[] = [];

  constructor(private menu: MenuScene) {}

  private get asc() {
    return this.menu.game.save.ascendancy;
  }

  visible(): boolean {
    return this.asc.trials > 0 || !!this.asc.cls;
  }

  badge(): boolean {
    return (this.asc.trials > 0 && !this.asc.cls) || ascUnspent(this.asc) >= ASC_NODE_COST;
  }

  private nodes(): AscNodeDef[] {
    return ASC_NODES.filter((n) => n.cls === this.asc.cls);
  }

  private node(tier: number, col: number): AscNodeDef | undefined {
    return this.nodes().find((n) => n.tier === tier && n.col === col);
  }

  update(): 'close' | void {
    const g = this.menu.game;
    const input = g.app.input;
    const m = input.mouse;
    let moved = false;
    let click = false;
    if (!this.asc.cls) {
      if (input.repeat('left')) moved = this.setPick(this.pick - 1);
      if (input.repeat('right')) moved = this.setPick(this.pick + 1) || moved;
      for (const c of this.rects) {
        if (!pointInRect(m.x, m.y, c.r)) continue;
        if (m.moved && c.a !== this.pick) moved = this.setPick(c.a);
        if (m.clicked) click = true;
      }
      if (moved) audio.playSfx('ui_move');
      if (input.pressed('confirm') || click) this.chooseClass();
      if (input.pressed('cancel')) return 'close';
      return;
    }
    const step = (dt: number, dc: number): boolean => {
      const tier = Math.max(0, Math.min(2, this.tier + dt));
      const col = Math.max(0, Math.min(1, this.col + dc));
      if (tier === this.tier && col === this.col) return false;
      this.tier = tier;
      this.col = col;
      return true;
    };
    if (input.repeat('left')) moved = step(0, -1);
    if (input.repeat('right')) moved = step(0, 1) || moved;
    if (input.repeat('up')) moved = step(-1, 0) || moved;
    if (input.repeat('down')) moved = step(1, 0) || moved;
    for (const c of this.rects) {
      if (!pointInRect(m.x, m.y, c.r)) continue;
      if (m.moved && (c.a !== this.tier || c.b !== this.col)) {
        this.tier = c.a;
        this.col = c.b;
        moved = true;
      }
      if (m.clicked) click = true;
    }
    if (moved) audio.playSfx('ui_move');
    if (input.pressed('confirm') || click) {
      const n = this.node(this.tier, this.col);
      if (!n) return;
      const why = takeAscNode(this.asc, n.id);
      if (why) {
        audio.playSfx('ui_error');
        g.toast(why, 'ui_lock', 0, UI.bad);
      } else {
        g.invalidateStats();
        this.menu.ws.world.player.syncFromSave(this.menu.ws.world);
        audio.playSfx('stinger_legendary');
        g.toast(`Notable learned: {gold}${n.name}{/}`, ASC_CLASS_INFO[n.cls].icon);
      }
    }
    if (input.pressed('cancel')) return 'close';
  }

  private setPick(i: number): boolean {
    const next = Math.max(0, Math.min(ASC_CLASSES.length - 1, i));
    if (next === this.pick) return false;
    this.pick = next;
    return true;
  }

  private chooseClass(): void {
    const g = this.menu.game;
    if (this.asc.trials <= 0) {
      audio.playSfx('ui_error');
      g.toast('Complete a Trial of Ascension at the town statue first.', 'ui_trial', 0, UI.bad);
      return;
    }
    const cls = ASC_CLASSES[this.pick];
    const info = ASC_CLASS_INFO[cls];
    g.app.push(
      new ConfirmScene(
        g,
        `Ascend as a {gold}${info.name}{/}? You can change later at the statue for gold.`,
        () => {
          this.asc.cls = cls;
          this.asc.nodes = [];
          this.tier = 0;
          this.col = 0;
          g.invalidateStats();
          audio.playSfx('stinger_levelup');
          g.banner = { title: 'ASCENDED', sub: info.name, t: 0, color: info.color };
        },
      ),
    );
  }

  hints(): [string, string][] {
    return [['confirm', this.asc.cls ? 'Learn' : 'Choose']];
  }

  render(ctx: CanvasRenderingContext2D, r: Rect): void {
    this.rects = [];
    if (!this.asc.cls) this.renderChoice(ctx, r);
    else this.renderTree(ctx, r);
  }

  private renderChoice(ctx: CanvasRenderingContext2D, r: Rect): void {
    drawText(ctx, '{gold}Choose your Ascendancy{/}', r.x + 2, r.y + 2);
    drawText(ctx, 'Each Trial of Ascension grants points to spend on its notables.', r.x + 2, r.y + 12, {
      color: UI.dim,
    });
    const n = ASC_CLASSES.length;
    const gap = 4;
    const cw = Math.floor((r.w - gap * (n - 1)) / n);
    const top = r.y + 26;
    ASC_CLASSES.forEach((cls, i) => {
      const info = ASC_CLASS_INFO[cls];
      const x = r.x + i * (cw + gap);
      const sel = i === this.pick;
      drawPanel(ctx, x, top, cw, r.h - 30, { border: sel ? UI.accent : info.color, alpha: sel ? 1 : 0.85 });
      drawIcon(ctx, info.icon, x + cw / 2 - 8, top + 6);
      drawText(ctx, info.name, x + cw / 2, top + 26, { align: 'center', color: info.color });
      drawText(ctx, `{gray}${info.weapon}{/}`, x + cw / 2, top + 36, { align: 'center' });
      let y = top + 50;
      for (const line of wrapText(info.blurb, cw - 10)) {
        drawText(ctx, line, x + 5, y);
        y += 10;
      }
      y += 4;
      for (const node of ASC_NODES.filter((nd) => nd.cls === cls)) {
        if (y > top + r.h - 44) break;
        drawText(ctx, `{gray}•{/} ${ellipsize(node.name, cw - 18)}`, x + 5, y, { color: UI.dim });
        y += 10;
      }
      this.rects.push({ r: { x, y: top, w: cw, h: r.h - 30 }, a: i, b: 0 });
    });
  }

  private renderTree(ctx: CanvasRenderingContext2D, r: Rect): void {
    const a = this.asc;
    const info = ASC_CLASS_INFO[a.cls!];
    drawIcon(ctx, info.icon, r.x + 2, r.y);
    drawText(ctx, info.name, r.x + 22, r.y + 1, { color: info.color });
    drawText(
      ctx,
      `Points: {cyan}${ascUnspent(a)}{/}{gray}/${ascPoints(a)} • Trials ${a.trials}/${TRIALS.length} • ${ASC_NODE_COST} per notable{/}`,
      r.x + 22,
      r.y + 10,
    );
    const treeW = Math.min(250, r.w - 150);
    const nodeW = Math.min(NODE_W, Math.floor((treeW - 16) / 2));
    const colX = [r.x + 4, r.x + treeW - nodeW - 4];
    const rowY = [r.y + 30, r.y + 30 + (r.h - 70) / 2, r.y + r.h - 40];
    const center = (t: number, c: number): [number, number] => [colX[c] + nodeW / 2, rowY[t] + NODE_H / 2];
    // connections
    ctx.lineWidth = 2;
    for (const n of this.nodes()) {
      for (const req of n.requires ?? []) {
        const from = ASC_NODES.find((o) => o.id === req)!;
        const [x1, y1] = center(from.tier, from.col);
        const [x2, y2] = center(n.tier, n.col);
        const lit = a.nodes.includes(req);
        ctx.strokeStyle = lit ? info.color : '#3a4466';
        ctx.beginPath();
        ctx.moveTo(x1, y1 + NODE_H / 2);
        ctx.lineTo(x2, y2 - NODE_H / 2);
        ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
    for (const n of this.nodes()) {
      const x = colX[n.col];
      const y = rowY[n.tier];
      const taken = a.nodes.includes(n.id);
      const can = !ascBlocker(a, n);
      const sel = this.tier === n.tier && this.col === n.col;
      ctx.fillStyle = sel ? UI.sel : taken ? '#262b44' : UI.bg;
      ctx.fillRect(x, y, nodeW, NODE_H);
      ctx.strokeStyle = sel ? UI.accent : taken ? info.color : can ? '#8b9bb4' : '#3a4466';
      ctx.strokeRect(x + 0.5, y + 0.5, nodeW - 1, NODE_H - 1);
      if (taken) {
        ctx.strokeStyle = info.color;
        ctx.strokeRect(x + 2.5, y + 2.5, nodeW - 5, NODE_H - 5);
      }
      const label = n.tier === 2 ? 'Capstone' : n.tier === 1 ? 'Notable' : 'Start';
      drawText(ctx, ellipsize(n.name, nodeW - 6), x + nodeW / 2, y + 5, {
        align: 'center',
        color: taken ? '#ffffff' : can ? '#c0cbdc' : UI.dim,
      });
      drawText(ctx, `{gray}${taken ? 'Learned' : label}{/}`, x + nodeW / 2, y + 16, { align: 'center' });
      this.rects.push({ r: { x, y, w: nodeW, h: NODE_H }, a: n.tier, b: n.col });
    }
    const n = this.node(this.tier, this.col);
    if (n) {
      const why = ascBlocker(a, n);
      const lines = [
        `{gold}${n.name}{/}`,
        `{gray}${info.name} notable • costs ${ASC_NODE_COST} points{/}`,
        '',
        n.desc,
      ];
      if (a.nodes.includes(n.id)) lines.push('', '{green}Learned{/}');
      else if (why) lines.push('', `{gray}${why}{/}`);
      drawTooltip(ctx, lines, r.x + treeW + 8, r.y + 24, r.w - treeW - 8);
    }
  }
}

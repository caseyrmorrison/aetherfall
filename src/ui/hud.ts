/** In-game heads-up display. */
import { drawPortrait } from '../art/anime';
import { getIcon } from '../art/pixel';
import { SKILLS } from '../data/skills';
import { QUESTS } from '../data/quests';
import { ZONES } from '../data/zones';
import { drawText, measureText } from '../engine/font';
import { angleTo, clamp, TAU } from '../engine/math';
import { STAMINA_MAX } from '../world/entities/player';
import { CELL, TILE } from '../world/mapdata';
import type { World } from '../world/world';
import { drawBar, drawIcon, drawKey, drawPanel, ellipsize, UI } from './widgets';

const STATUS_COLORS: Record<string, [string, string]> = {
  burn: ['#f77622', 'B'],
  poison: ['#63c74d', 'P'],
  slow: ['#0099db', 'S'],
  freeze: ['#2ce8f5', 'F'],
};

export class Hud {
  private ghostHp = 1;
  private ghostBoss = 1;
  private minimap: HTMLCanvasElement | null = null;
  private minimapKey = '';
  private minimapT = 0;
  zoneCard: { title: string; sub: string; t: number } | null = null;
  private t = 0;

  update(dt: number, world: World): void {
    this.t += dt;
    const p = world.player;
    const hpFrac = p.hp / p.maxHp;
    this.ghostHp = hpFrac > this.ghostHp ? hpFrac : Math.max(hpFrac, this.ghostHp - dt * 0.35);
    if (world.boss) {
      const bf = world.boss.hp / world.boss.maxHp;
      this.ghostBoss = bf > this.ghostBoss ? bf : Math.max(bf, this.ghostBoss - dt * 0.25);
    } else this.ghostBoss = 1;
    if (this.zoneCard) {
      this.zoneCard.t += dt;
      if (this.zoneCard.t > 3.5) this.zoneCard = null;
    }
    this.minimapT -= dt;
  }

  render(ctx: CanvasRenderingContext2D, world: World): void {
    const W = world.game.app.width;
    const H = world.game.app.height;
    this.drawVitals(ctx, world);
    this.drawSkills(ctx, world, W, H);
    this.drawMinimap(ctx, world, W);
    this.drawTracker(ctx, world, W);
    this.drawQuestArrow(ctx, world, W, H);
    if (world.boss && !world.boss.dead) this.drawBossBar(ctx, world, W, H);
    this.drawToasts(ctx, world, H);
    this.drawBanner(ctx, world, W, H);
    this.drawZoneCard(ctx, W, H);
    // XP bar along the bottom edge
    const g = world.game;
    ctx.fillStyle = UI.bg;
    ctx.fillRect(0, H - 3, W, 3);
    ctx.fillStyle = '#b55088';
    ctx.fillRect(0, H - 2, Math.round(W * g.xpProgress()), 2);
  }

  private drawVitals(ctx: CanvasRenderingContext2D, world: World): void {
    const g = world.game;
    const hero = g.save.hero;
    const p = world.player;
    const x = 4;
    const y = 4;
    // portrait
    drawPanel(ctx, x, y, 30, 30, { alpha: 0.85 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, 26, 26);
    ctx.clip();
    const expr =
      p.hp / p.maxHp < 0.3 ? 'hurt' : p.state === 'attack' || world.inCombat ? 'determined' : 'neutral';
    drawPortrait(ctx, 'kai', expr, x - 4, y - 2, 38, 44, { blink: Math.floor(this.t * 10) % 40 === 0 });
    ctx.restore();
    drawText(ctx, `${hero.level}`, x + 28, y + 22, { align: 'right', color: UI.accent, outline: UI.bg });

    const bx = x + 34;
    const bw = 96;
    drawBar(ctx, bx, y + 2, bw, 6, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff0044' : '#e43b44', {
      ghost: this.ghostHp,
    });
    drawText(ctx, `${Math.ceil(p.hp)}/${p.maxHp}`, bx + bw + 3, y + 1, { color: '#ffffff', outline: UI.bg });
    drawBar(ctx, bx, y + 11, Math.round(bw * 0.8), 4, p.mp / p.maxMp, UI.mana);
    drawText(ctx, `${Math.floor(p.mp)}`, bx + Math.round(bw * 0.8) + 3, y + 9, {
      color: '#2ce8f5',
      outline: UI.bg,
    });
    drawBar(
      ctx,
      bx,
      y + 18,
      Math.round(bw * 0.6),
      2,
      p.stamina / STAMINA_MAX,
      p.stamina < 28 ? '#8b9bb4' : '#63c74d',
      { shine: false },
    );

    // surge gauge
    if (hero.surgeUnlocked) {
      const full = hero.surge >= 100;
      const sx = bx;
      const sy = y + 23;
      const sw = Math.round(bw * 0.6);
      drawBar(
        ctx,
        sx,
        sy,
        sw,
        3,
        hero.surge / 100,
        full ? (Math.floor(this.t * 8) % 2 ? '#ffffff' : UI.cyan) : UI.cyan,
      );
      if (full)
        drawText(ctx, `[${world.input.label('ultimate')}] SURGE`, sx + sw + 3, sy - 3, {
          color: UI.cyan,
          outline: UI.bg,
        });
    }
    // statuses & buffs
    let sx = x;
    const sy = y + 34;
    for (const [k, s] of Object.entries(p.statuses)) {
      if (!s || s.t <= 0) continue;
      const [col, letter] = STATUS_COLORS[k] ?? ['#fff', '?'];
      ctx.fillStyle = UI.bg;
      ctx.fillRect(sx, sy, 10, 10);
      ctx.fillStyle = col;
      ctx.fillRect(sx + 1, sy + 1, 8, 8);
      drawText(ctx, letter, sx + 5, sy + 1, { align: 'center', color: UI.bg, shadow: false });
      sx += 12;
    }
    if (g.buffs.might > 0) {
      drawIcon(ctx, 'icon_potion_hp', sx - 2, sy - 3);
      sx += 14;
    }
    if (g.buffs.guard > 0) drawIcon(ctx, 'icon_potion_mp', sx - 2, sy - 3);
  }

  private drawSkills(ctx: CanvasRenderingContext2D, world: World, W: number, H: number): void {
    const g = world.game;
    const hero = g.save.hero;
    const p = world.player;
    const cell = 20;
    const gap = 3;
    const n = 4;
    const flaskW = 2 * (cell + gap) + 6;
    const total = n * (cell + gap) - gap + flaskW;
    let x = Math.round(W / 2 - total / 2);
    const y = H - cell - 8;
    // flasks
    const st = g.stats();
    const drawFlask = (
      icon: 'icon_potion_hp' | 'icon_potion_mp',
      count: number,
      max: number,
      action: 'potionHp' | 'potionMp',
    ): void => {
      ctx.fillStyle = UI.bg;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x, y, cell, cell);
      ctx.globalAlpha = 1;
      drawIcon(ctx, icon, x + 2, y + 2, 0, count > 0 ? 1 : 0.3);
      drawText(ctx, `${count}`, x + cell - 1, y + cell - 9, {
        align: 'right',
        color: count > 0 ? '#ffffff' : UI.bad,
        outline: UI.bg,
      });
      drawText(ctx, world.input.label(action), x + 1, y - 9, { color: UI.dim, outline: UI.bg });
      void max;
      x += cell + gap;
    };
    drawFlask('icon_potion_hp', hero.flaskHp, st.flaskHpMax, 'potionHp');
    drawFlask('icon_potion_mp', hero.flaskMp, st.flaskMpMax, 'potionMp');
    x += 6;
    for (let i = 0; i < n; i++) {
      const id = hero.slots[i];
      ctx.fillStyle = UI.bg;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x, y, cell, cell);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = UI.border;
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      if (id) {
        const def = SKILLS[id];
        const cd = p.cooldownFrac(id, world);
        const noMp = p.mp < def.mp;
        drawIcon(ctx, def.icon, x + 2, y + 2, 0, noMp ? 0.4 : 1);
        if (cd > 0) {
          ctx.fillStyle = 'rgba(24,20,37,0.75)';
          const h = Math.round((cell - 2) * cd);
          ctx.fillRect(x + 1, y + 1 + (cell - 2 - h), cell - 2, h);
          const secs = (p.cooldowns[id] ?? 0).toFixed(0);
          drawText(ctx, secs, x + cell / 2, y + 6, { align: 'center', color: '#ffffff', outline: UI.bg });
        } else if (noMp) {
          ctx.fillStyle = 'rgba(18,78,137,0.4)';
          ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
        }
      }
      drawText(ctx, world.input.label(`skill${i + 1}` as 'skill1'), x + 1, y - 9, {
        color: UI.dim,
        outline: UI.bg,
      });
      x += cell + gap;
    }
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, world: World, W: number): void {
    const size = 64;
    const x = W - size - 6;
    const y = 4;
    const d = world.data;
    // cache the explored map image (refresh a few times a second)
    const key = `${d.id}`;
    if (!this.minimap || this.minimapKey !== key || this.minimapT <= 0) {
      this.minimapT = 0.5;
      this.minimapKey = key;
      if (!this.minimap || this.minimap.width !== d.w || this.minimap.height !== d.h) {
        this.minimap = document.createElement('canvas');
        this.minimap.width = d.w;
        this.minimap.height = d.h;
      }
      const mc = this.minimap.getContext('2d')!;
      const img = mc.createImageData(d.w, d.h);
      for (let i = 0; i < d.w * d.h; i++) {
        if (!world.explored[i]) continue;
        const c = d.cells[i];
        const col =
          c === CELL.Floor || c === CELL.Bridge
            ? d.ground[i] === 2
              ? [184, 111, 80]
              : [90, 105, 136]
            : c === CELL.Liquid
              ? d.theme === 'volcano'
                ? [247, 118, 34]
                : [18, 78, 137]
              : [38, 43, 68];
        img.data[i * 4] = col[0];
        img.data[i * 4 + 1] = col[1];
        img.data[i * 4 + 2] = col[2];
        img.data[i * 4 + 3] = 255;
      }
      mc.putImageData(img, 0, 0);
    }
    drawPanel(ctx, x - 2, y - 2, size + 4, size + 4, { alpha: 0.85 });
    const p = world.player;
    const ptx = p.x / TILE;
    const pty = p.y / TILE;
    // 2px per tile, centered on the player
    const Z = 2;
    const span = size / Z;
    const sx = clamp(Math.round(ptx - span / 2), 0, Math.max(0, d.w - span));
    const sy = clamp(Math.round(pty - span / 2), 0, Math.max(0, d.h - span));
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(x, y, size, size);
    const vw = Math.min(span, d.w);
    const vh = Math.min(span, d.h);
    ctx.drawImage(this.minimap!, sx, sy, vw, vh, x, y, vw * Z, vh * Z);
    const dot = (wx: number, wy: number, color: string, s = 1): void => {
      const mx = Math.round((wx / TILE - sx) * Z);
      const my = Math.round((wy / TILE - sy) * Z);
      if (mx < 0 || my < 0 || mx >= size || my >= size) return;
      ctx.fillStyle = color;
      ctx.fillRect(x + mx - (s > 1 ? 1 : 0), y + my - (s > 1 ? 1 : 0), s, s);
    };
    for (const o of world.objects) {
      const k = o.obj.kind;
      const tile = Math.floor(o.y / TILE) * d.w + Math.floor(o.x / TILE);
      if (!world.explored[tile] && k !== 'crystal') continue;
      if (k === 'crystal') dot(o.x, o.y, UI.cyan, 2);
      else if (k === 'bossGate') dot(o.x, o.y, '#ff0044', 2);
      else if (k === 'chest' && !world.isChestOpen(o.obj.id)) dot(o.x, o.y, UI.accent);
    }
    for (const n of world.npcs) dot(n.x, n.y, '#fee761');
    for (const e of world.enemies) if (!e.dead && e.aggro) dot(e.x, e.y, '#e43b44');
    const tgt = this.questTargetPos(world);
    if (tgt && Math.floor(this.t * 3) % 2 === 0) dot(tgt.x, tgt.y, '#fee761', 3);
    if (Math.floor(this.t * 4) % 4 !== 0) dot(p.x, p.y, '#ffffff', 2);
    // name
    const zone = ZONES[d.id.replace(/_boss$/, '')];
    const name = ellipsize(d.name, 110);
    drawText(ctx, name, x + size, y + size + 4, { align: 'right', color: '#ffffff', outline: UI.bg });
    if (zone && d.id !== 'town')
      drawText(ctx, `Lv ${zone.levels[0]}-${zone.levels[1]}`, x + size, y + size + 14, {
        align: 'right',
        color: UI.dim,
        outline: UI.bg,
      });
    // gold
    const gold = `${world.game.save.hero.gold}`;
    const gw = measureText(gold);
    drawIcon(ctx, 'ui_coin', x - gw - 22, y - 1);
    drawText(ctx, gold, x - 5, y + 3, { align: 'right', color: UI.accent, outline: UI.bg });
  }

  questTargetPos(world: World): { x: number; y: number } | null {
    const t = world.quests.target();
    if (!t || t.map !== world.data.id) {
      // point toward the exit that leads to the target zone
      if (t && world.data.id === 'town') {
        const target = t.map.replace(/_boss$/, '');
        const warp = world.data.objects.find((o) => o.kind === 'warp' && o.to === target);
        if (warp && warp.kind === 'warp') return { x: warp.x + warp.w / 2, y: warp.y + warp.h / 2 };
        const portal = world.data.objects.find((o) => o.kind === 'portal' && o.to === target);
        if (portal) return { x: portal.x, y: portal.y - 16 };
      }
      if (t && world.data.id !== 'town' && !t.map.startsWith(world.data.id)) {
        const warp = world.data.objects.find((o) => o.kind === 'warp' && o.to === 'town');
        if (warp && warp.kind === 'warp') return { x: warp.x + warp.w / 2, y: warp.y + warp.h / 2 };
      }
      return null;
    }
    if (t.npc) {
      const n = world.npcs.find((x) => x.def.id === t.npc);
      return n ? { x: n.x, y: n.y - 20 } : null;
    }
    if (t.objectId) {
      const o = world.objects.find((x) => x.obj.id === t.objectId);
      return o ? { x: o.x, y: o.y - 20 } : null;
    }
    if (t.marker) {
      const o = world.objects.find((x) => x.obj.id === t.marker);
      return o ? { x: o.x, y: o.y - 12 } : null;
    }
    return null;
  }

  private drawQuestArrow(ctx: CanvasRenderingContext2D, world: World, W: number, H: number): void {
    const tgt = this.questTargetPos(world);
    if (!tgt) return;
    const sx = tgt.x - world.cam.rx;
    const sy = tgt.y - world.cam.ry;
    const margin = 14;
    const on = sx > margin && sx < W - margin && sy > margin && sy < H - margin;
    const bob = Math.sin(this.t * 5) * 2;
    if (on) {
      if (world.interactTarget) return;
      drawText(ctx, '▼', sx, sy - 8 + bob, { align: 'center', color: '#fee761', outline: UI.bg });
      return;
    }
    const cx = W / 2;
    const cy = H / 2;
    const a = angleTo(cx, cy, sx, sy);
    const ex = clamp(cx + Math.cos(a) * W, margin, W - margin);
    const ey = clamp(cy + Math.sin(a) * H, margin + 20, H - margin - 30);
    ctx.save();
    ctx.translate(Math.round(ex), Math.round(ey));
    ctx.rotate(a);
    ctx.fillStyle = UI.bg;
    ctx.beginPath();
    ctx.moveTo(8 + bob, 0);
    ctx.lineTo(-4, -6);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fee761';
    ctx.beginPath();
    ctx.moveTo(6 + bob, 0);
    ctx.lineTo(-3, -4);
    ctx.lineTo(-3, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawTracker(ctx: CanvasRenderingContext2D, world: World, W: number): void {
    const q = world.quests.tracked();
    let y = 96;
    const x = W - 6;
    if (q) {
      const def = QUESTS[q.id];
      const o = world.quests.objective(q);
      drawText(ctx, ellipsize(def.name, 150), x, y, {
        align: 'right',
        color: def.main ? UI.accent : '#ffffff',
        outline: UI.bg,
      });
      y += 10;
      if (o) {
        const prog = world.quests.progressText(q);
        drawText(ctx, ellipsize(`${o.text}${prog ? ` ${prog}` : ''}`, 160), x, y, {
          align: 'right',
          color: '#c0cbdc',
          outline: UI.bg,
        });
        y += 12;
      }
    }
    for (const b of world.game.save.bounties) {
      drawText(ctx, ellipsize(`Bounty: ${b.progress}/${b.count}`, 150), x, y, {
        align: 'right',
        color: '#b55088',
        outline: UI.bg,
      });
      y += 10;
    }
  }

  private drawBossBar(ctx: CanvasRenderingContext2D, world: World, W: number, H: number): void {
    const b = world.boss!;
    const bw = Math.min(260, W - 100);
    const x = Math.round(W / 2 - bw / 2);
    const y = H - 52;
    drawText(ctx, b.def.name.toUpperCase(), x, y - 11, { color: '#ffffff', outline: UI.bg });
    if (b.def.boss)
      drawText(ctx, b.def.boss.title, x + bw, y - 11, { align: 'right', color: UI.dim, outline: UI.bg });
    drawBar(ctx, x, y, bw, 5, b.hp / b.maxHp, '#a22633', { ghost: this.ghostBoss, border: UI.bg });
    // phase ticks
    for (const ph of b.def.boss?.phases.slice(1) ?? []) {
      ctx.fillStyle = UI.accent;
      ctx.fillRect(x + Math.round(bw * ph.at), y - 1, 1, 7);
    }
    drawText(ctx, `Lv ${b.level}`, x + bw / 2, y + 7, { align: 'center', color: UI.dim, outline: UI.bg });
  }

  private drawToasts(ctx: CanvasRenderingContext2D, world: World, H: number): void {
    const toasts = world.game.toasts;
    let y = H - 36;
    for (let i = toasts.length - 1; i >= 0; i--) {
      const t = toasts[i];
      const a = Math.min(1, t.t * 6, (4 - t.t) * 2);
      const slide = t.t < 0.15 ? (1 - t.t / 0.15) * -20 : 0;
      const x = 6 + slide;
      ctx.globalAlpha = a * 0.8;
      const tw = measureText(t.text) + (t.icon ? 20 : 8);
      ctx.fillStyle = UI.bg;
      ctx.fillRect(x, y - 2, tw, 14);
      ctx.globalAlpha = a;
      if (t.icon) ctx.drawImage(getIcon(t.icon, t.tier ?? 0), x + 1, y - 3);
      drawText(ctx, t.text, x + (t.icon ? 18 : 4), y + 1, { color: t.color ?? '#ffffff', alpha: a });
      ctx.globalAlpha = 1;
      y -= 15;
      if (y < 120) break;
    }
  }

  private drawBanner(ctx: CanvasRenderingContext2D, world: World, W: number, H: number): void {
    const b = world.game.banner;
    if (!b) return;
    const a = Math.min(1, b.t * 4, (3.2 - b.t) * 2);
    const y = Math.round(H * 0.36);
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = UI.bg;
    const bandH = b.sub ? 34 : 22;
    ctx.fillRect(0, y - 6, W, bandH);
    ctx.fillStyle = b.color ?? UI.accent;
    ctx.fillRect(0, y - 6, W, 1);
    ctx.fillRect(0, y - 6 + bandH, W, 1);
    ctx.globalAlpha = a;
    const pop = b.t < 0.12 ? 1 + (0.12 - b.t) * 8 : 1;
    drawText(ctx, b.title, W / 2, y - (pop - 1) * 4, {
      align: 'center',
      color: b.color ?? UI.accent,
      outline: UI.bg,
      scale: pop > 1.2 ? 3 : 2,
    });
    if (b.sub) drawText(ctx, b.sub, W / 2, y + 18, { align: 'center', color: '#ffffff', alpha: a });
    ctx.globalAlpha = 1;
    // sparkles
    if (b.t < 1) {
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + b.t * 3;
        ctx.fillStyle = b.color ?? UI.accent;
        ctx.globalAlpha = a * (1 - b.t);
        ctx.fillRect(
          Math.round(W / 2 + Math.cos(ang) * 60 * b.t * 2),
          Math.round(y + 6 + Math.sin(ang) * 20 * b.t * 2),
          2,
          2,
        );
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawZoneCard(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const z = this.zoneCard;
    if (!z) return;
    const a = Math.min(1, z.t * 2, (3.5 - z.t) * 1.5);
    const y = Math.round(H * 0.11);
    ctx.globalAlpha = a;
    const tw = measureText(z.title) * 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(W / 2 - tw / 2 - 10), y + 20, tw + 20, 1);
    drawText(ctx, z.title, W / 2, y, { align: 'center', color: '#ffffff', outline: UI.bg, scale: 2 });
    drawText(ctx, z.sub, W / 2, y + 25, { align: 'center', color: UI.accent, outline: UI.bg });
    ctx.globalAlpha = 1;
  }
}

/** Small helper for the "press key" style prompt used in several scenes. */
export function drawPressPrompt(
  ctx: CanvasRenderingContext2D,
  label: string,
  text: string,
  x: number,
  y: number,
): void {
  const w = drawKey(ctx, label, x, y);
  drawText(ctx, text, x + w + 3, y + 1, { color: '#ffffff', outline: UI.bg });
}

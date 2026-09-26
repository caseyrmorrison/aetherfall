/** Aether Crystal menu: fast travel between discovered crystals. */
import { audio } from '../audio';
import type { Scene } from '../engine/app';
import { drawText } from '../engine/font';
import type { Game } from '../game/game';
import { getMap } from '../world/maps';
import { drawHints, drawPanel, ListView, UI } from '../ui/widgets';
import type { WorldScene } from './world-scene';

interface Dest {
  id: string;
  map: string;
  name: string;
  x: number;
  y: number;
}

export class TravelScene implements Scene {
  readonly opaque = false;
  private list: ListView<Dest | null>;

  constructor(
    private game: Game,
    private ws: WorldScene,
    here: string,
  ) {
    const dests: (Dest | null)[] = [null];
    for (const id of game.save.discovered) {
      if (id === here) continue;
      // town crystals are named after their town; zone crystals are <zone>_crystal_a/b
      const map =
        id === 'town_crystal'
          ? 'town'
          : id === 'solenne_crystal'
            ? 'solenne'
            : id.replace(/_crystal_[ab]$/, '');
      try {
        const m = getMap(map);
        const o = m.objects.find((x) => x.id === id);
        if (o && o.kind === 'crystal') dests.push({ id, map, name: o.name, x: o.x, y: o.y + 14 });
      } catch {
        /* ignore unknown */
      }
    }
    this.list = new ListView(dests, 12, Math.min(10, dests.length), true);
  }

  update(): void {
    const r = this.list.update(this.game.app.input);
    if (r === 'cancel') {
      this.game.app.remove(this);
      return;
    }
    if (r !== 'confirm') return;
    const d = this.list.selected;
    this.game.app.remove(this);
    if (!d) return;
    audio.playSfx('teleport');
    this.ws.travelTo(d.map, { x: d.x, y: d.y }, () => {
      this.game.save.respawn = { map: d.map, x: d.x, y: d.y };
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const w = 200;
    const h = this.list.visibleRows * 12 + 34;
    const x = W - w - 10;
    const y = 40;
    drawPanel(ctx, x, y, w, h, { title: 'Aether Crystal — Travel' });
    this.list.draw(ctx, x + 4, y + 18, w - 12, (d, cx, cy, sel) => {
      drawText(ctx, d ? d.name : 'Stay here', cx + 2, cy, {
        color: sel ? UI.accent : d ? '#ffffff' : UI.dim,
      });
    });
    drawHints(
      ctx,
      this.game.app.input,
      [
        ['confirm', 'Travel'],
        ['cancel', 'Close'],
      ],
      x + w - 4,
      y + h + 4,
    );
  }
}

/** Save slot browser: load, delete, export and import saves. */
import { audio } from '../audio';
import { mapName } from '../data/zones';
import type { Scene } from '../engine/app';
import { drawText } from '../engine/font';
import type { Game } from '../game/game';
import { formatPlayTime, SLOT_COUNT, type SlotSummary } from '../game/saves';
import { drawHints, drawPanel, ListView, UI } from '../ui/widgets';
import { ConfirmScene } from './confirm';
import { continueGame } from './flow';

type Row = { kind: 'slot'; slot: number } | { kind: 'export' } | { kind: 'import' };

export class LoadScene implements Scene {
  readonly opaque = false;
  private list: ListView<Row>;
  private sums: (SlotSummary | null)[] = [];

  /**
   * mode 'load': pick a save to load.
   * mode 'pick': pick a slot for a new game (calls onPick).
   */
  constructor(
    private game: Game,
    private mode: 'load' | 'pick',
    private onPick?: (slot: number) => void,
  ) {
    const rows: Row[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) rows.push({ kind: 'slot', slot: i });
    if (mode === 'load') rows.push({ kind: 'export' }, { kind: 'import' });
    this.list = new ListView(rows, 30, rows.length, true);
    this.refresh();
  }

  private refresh(): void {
    this.sums = this.game.saves.summaries(mapName);
  }

  update(): void {
    const input = this.game.app.input;
    const r = this.list.update(input);
    if (r === 'cancel') {
      this.game.app.remove(this);
      return;
    }
    const row = this.list.selected;
    if (!row) return;
    if (r === 'confirm') {
      if (row.kind === 'slot') {
        const sum = this.sums[row.slot];
        if (this.mode === 'pick') {
          const pick = (): void => {
            this.game.app.remove(this);
            this.onPick?.(row.slot);
          };
          if (sum)
            this.game.app.push(
              new ConfirmScene(
                this.game,
                `Overwrite ${sum.name} (Lv ${sum.level}) in slot ${row.slot + 1}?`,
                pick,
              ),
            );
          else pick();
          return;
        }
        if (!sum) {
          audio.playSfx('ui_error');
          return;
        }
        const data = this.game.saves.load(row.slot);
        if (!data) {
          audio.playSfx('ui_error');
          this.game.toast('That save could not be read.', 'ui_lock', 0, UI.bad);
          return;
        }
        this.game.app.remove(this);
        continueGame(this.game, data);
      } else if (row.kind === 'export') this.exportSave();
      else this.importSave();
    }
    if (input.pressed('menuAlt') && row.kind === 'slot' && this.sums[row.slot] && this.mode === 'load') {
      const slot = row.slot;
      if (this.game.hasSave && this.game.save.slot === slot) {
        audio.playSfx('ui_error');
        return;
      }
      this.game.app.push(
        new ConfirmScene(this.game, `Permanently delete the save in slot ${slot + 1}?`, () => {
          this.game.saves.delete(slot);
          this.refresh();
        }),
      );
    }
  }

  private exportSave(): void {
    const slot = this.game.hasSave ? this.game.save.slot : this.game.saves.mostRecent();
    if (slot < 0) return;
    const json = this.game.saves.exportString(slot);
    if (!json) return;
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aetherfall-slot${slot + 1}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    this.game.toast(`Exported slot ${slot + 1}`, 'ui_save');
  }

  private importSave(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async (): Promise<void> => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      let slot = this.game.saves.firstEmpty();
      if (slot < 0) slot = SLOT_COUNT - 1;
      if (this.game.saves.importString(slot, text)) {
        this.refresh();
        this.game.toast(`Imported into slot ${slot + 1}`, 'ui_save');
      } else this.game.toast('That file is not a valid Aetherfall save.', 'ui_lock', 0, UI.bad);
    };
    input.click();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const W = this.game.app.width;
    const H = this.game.app.height;
    ctx.fillStyle = 'rgba(11,10,18,0.7)';
    ctx.fillRect(0, 0, W, H);
    const w = Math.min(W - 20, 300);
    const h = this.list.items.length * 30 + 44;
    const x = Math.round((W - w) / 2);
    const y = Math.round((H - h) / 2);
    drawPanel(ctx, x, y, w, h, { title: this.mode === 'load' ? 'Load Game' : 'Choose a Save Slot' });
    this.list.draw(ctx, x + 6, y + 18, w - 14, (row, rx, ry, sel) => {
      if (row.kind === 'export') {
        drawText(ctx, 'Export save to file', rx + 2, ry, { color: sel ? UI.accent : '#c0cbdc' });
        return;
      }
      if (row.kind === 'import') {
        drawText(ctx, 'Import save from file', rx + 2, ry, { color: sel ? UI.accent : '#c0cbdc' });
        return;
      }
      const s = this.sums[row.slot];
      if (!s) {
        drawText(ctx, `Slot ${row.slot + 1} — {gray}Empty{/}`, rx + 2, ry - 4, {
          color: sel ? UI.accent : '#ffffff',
        });
        return;
      }
      drawText(
        ctx,
        `Slot ${row.slot + 1}  {gold}${s.name}{/}  Lv ${s.level}${s.ngPlus ? ` NG+${s.ngPlus}` : ''}`,
        rx + 2,
        ry - 5,
        { color: sel ? UI.accent : '#ffffff' },
      );
      drawText(ctx, `${s.location} • ${formatPlayTime(s.playTime)} • ${s.difficulty}`, rx + 2, ry + 5, {
        color: UI.dim,
      });
    });
    const hints: [string, string][] = [['confirm', 'Select']];
    if (this.mode === 'load') hints.push(['menuAlt', 'Delete']);
    hints.push(['cancel', 'Back']);
    drawHints(ctx, this.game.app.input, hints, x + w - 4, y + h + 4);
  }
}

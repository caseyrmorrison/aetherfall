/** Aetherfall entry point. */
import './style.css';
import { audio } from './audio';
import { App } from './engine/app';
import { drawText } from './engine/font';
import { Game } from './game/game';
import { TitleScene } from './scenes/title';
import { TouchControls } from './ui/touch';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const app = new App(canvas);
const game = new Game(app);
const touch = new TouchControls(app, game);

app.preUpdate = (dt) => touch.update(dt);
app.postRender = (ctx) => {
  touch.render(ctx);
  if (app.screen.isPortrait && 'ontouchstart' in window) {
    ctx.fillStyle = 'rgba(11,10,18,0.85)';
    ctx.fillRect(0, app.height / 2 - 18, app.width, 36);
    drawText(ctx, 'Rotate your device to landscape', app.width / 2, app.height / 2 - 10, {
      align: 'center',
      color: '#feae34',
    });
    drawText(ctx, 'for the best experience', app.width / 2, app.height / 2 + 2, {
      align: 'center',
      color: '#c0cbdc',
    });
  }
  if (game.settings.showFps)
    drawText(ctx, `${app.fps} FPS`, app.width - 4, app.height - 12, {
      align: 'right',
      color: '#63c74d',
      outline: '#181425',
    });
};

document.addEventListener('visibilitychange', () => {
  audio.setSuspended(document.hidden);
  if (document.hidden) {
    app.input.releaseAll();
    if (game.hasSave) game.saveNow();
  }
});
window.addEventListener('beforeunload', () => {
  if (game.hasSave) game.saveNow();
});

// Surface crashes instead of freezing silently.
window.addEventListener('error', (e) => showFatal(e.message));
window.addEventListener('unhandledrejection', (e) => showFatal(String(e.reason)));
let fatalShown = false;
function showFatal(msg: string): void {
  console.error(msg);
  if (fatalShown) return;
  fatalShown = true;
  const div = document.createElement('div');
  div.style.cssText =
    'position:fixed;left:8px;bottom:8px;max-width:60ch;padding:8px 10px;background:#181425;color:#fff;border:1px solid #e43b44;font:12px monospace;z-index:10';
  div.textContent = `Something went wrong: ${msg}. Your progress auto-saves; reload the page to continue.`;
  document.body.appendChild(div);
}

// Debug/automation handle (dev server, or any build opened with ?debug).
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).__aether = { app, game };
  void import('./dev/driver').then((m) => m.installDriver(app, game));
}

app.reset(new TitleScene(game));
app.start();

// Offline support for the deployed build (skipped in dev so hot reload stays reliable).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener(
    'load',
    () => void navigator.serviceWorker.register('sw.js').catch(() => undefined),
  );
}

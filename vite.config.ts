import { mkdirSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Local-only helper: lets the in-game debug driver POST canvas screenshots to
 * docs/screenshots/<name>.png (used to produce README images). Never part of a build.
 */
function screenshotSaver(): Plugin {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void): void => {
    if (req.method !== 'POST' || !req.url?.startsWith('/__screenshot')) return next();
    let body = '';
    req.on('data', (c: Buffer) => (body += c.toString()));
    req.on('end', () => {
      try {
        const { name, data } = JSON.parse(body) as { name: string; data: string };
        if (!/^[a-z0-9-]{1,40}$/.test(name)) throw new Error('bad name');
        const dir = resolve(import.meta.dirname, 'docs/screenshots');
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, `${name}.png`), Buffer.from(data, 'base64'));
        res.statusCode = 204;
      } catch {
        res.statusCode = 400;
      }
      res.end();
    });
  };
  return {
    name: 'screenshot-saver',
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig({
  // Relative base so the build works on GitHub Pages (/<repo>/) and locally.
  base: './',
  plugins: [screenshotSaver()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    sourcemap: true,
  },
  server: {
    port: 5188,
    strictPort: true,
    // agent worktrees and editor state live under .claude; don't reload the game for them
    watch: { ignored: ['**/.claude/**'] },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

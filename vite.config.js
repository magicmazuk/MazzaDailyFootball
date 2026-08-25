import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

function apiShim() {
  return {
    name: 'api-shim',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const mount = ['/api/espn', '/api/bbc', '/api/news', '/api/wosfl', '/api/iplayer', '/api/dossier'].find(p => req.url.startsWith(p));
        if (!mount) return next();
        const file = `${mount.slice(1)}.js`; // api/espn.js
        if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('not built yet'); }
        const { default: handler } = await server.ssrLoadModule(`/${file}`);
        return handler(req, res);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiShim()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
    pool: 'forks',
    testTimeout: 15000,
  },
});

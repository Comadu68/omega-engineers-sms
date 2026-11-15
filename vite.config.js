import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function omegaDevBridgePlugin() {
  return {
    name: 'omega-dev-bridge',
    configureServer(server) {
      server.middlewares.use('/api/ipc', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end('Method Not Allowed');
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const { channel, args } = JSON.parse(body || '{}');
            const { handleIpc } = require('./scripts/dev_server_bridge.cjs');
            const result = await handleIpc(channel, args);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ result }));
          } catch (err) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'IPC error' }));
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), omegaDevBridgePlugin()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3847',
        changeOrigin: true,
        configure: (proxy) => {
          // Suppress noisy ECONNRESET/ECONNREFUSED logs when backend restarts during dev;
          // browser EventSource automatically reconnects once server is back up.
          proxy.removeAllListeners('error');
          proxy.on('error', (err, req, res) => {
            const code = (err as NodeJS.ErrnoException).code;
            const isSse = req.url?.startsWith('/api/inbox/stream');
            if (isSse && (code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'EPIPE')) {
              if (res && 'writableEnded' in res && !res.writableEnded) {
                res.end();
              }
              return;
            }
            console.error(`[vite proxy] ${req.url}: ${err.message}`);
          });
        },
      },
    },
  },
});

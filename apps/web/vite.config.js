import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appOrigins = [...new Set((process.env.APP_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173').split(',').map((entry) => {
  const input = entry.trim();
  let url;
  try { url = new URL(input); } catch { throw new Error('APP_ORIGINS must contain exact HTTP(S) origins.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || input.includes('*') || !/^https?:\/\/[^/?#]+\/?$/i.test(input)) {
    throw new Error('APP_ORIGINS must contain exact HTTP(S) origins without paths or wildcards.');
  }
  return url.origin;
}))];
const allowedHosts = [...new Set(appOrigins.map((origin) => new URL(origin).hostname))];
const allowedRequestHosts = new Set(appOrigins.map((origin) => new URL(origin).host));

export default defineConfig({
  plugins: [react(), {
    name: 'configured-app-hosts',
    configureServer(server) {
      // Vite permits IP hosts by default. Check exact configured hosts before
      // the proxy rewrites Host with changeOrigin, including for API reads/SSE.
      server.middlewares.use((req, res, next) => {
        if (allowedRequestHosts.has(req.headers.host?.toLowerCase())) return next();
        res.writeHead(403, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
        res.end('This app address is not configured in APP_ORIGINS.');
      });
    },
  }],
  server: {
    allowedHosts,
    proxy: {
      '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001', changeOrigin: true },
    },
    watch: {
      usePolling: process.env.VITE_USE_POLLING === 'true',
      interval: 250,
    },
  },
});

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { injectPwaHead, resolvePwaFlavor } from './src/pwa/pwaBranding.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const flavor = resolvePwaFlavor(env);
  return {
    plugins: [
      react(),
      {
        name: 'elevationpilot-dual-pwa-install',
        transformIndexHtml(html) {
          return injectPwaHead(html, flavor);
        },
      },
    ],
  };
});

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { projectDefaults } from './src/config/defaults';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const name = env.VITE_APP_NAME?.trim() || projectDefaults.name;
  const description = env.VITE_APP_DESCRIPTION?.trim() || projectDefaults.description;
  const base = env.BASE_URL?.trim() || '/';
  const apiProxyTarget = env.VITE_DEV_API_PROXY_TARGET?.trim() || 'http://localhost:3001';

  return {
    base,
    plugins: [
      react(),
      {
        name: 'personal-toolbox-html',
        transformIndexHtml(html) {
          return html
            .replaceAll('__APP_NAME__', escapeHtml(name))
            .replaceAll('__APP_DESCRIPTION__', escapeHtml(description));
        },
      },
    ],
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: true,
    },
  };
});

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_FIREBASE_API_URL || 'https://us-central1-deribi.cloudfunctions.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  base: '/', // Ważne dla SPA
});
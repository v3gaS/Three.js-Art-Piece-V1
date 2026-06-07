import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: false,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
});

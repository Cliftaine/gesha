import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base '/panel/': el build se sirve desde Express detrás del seam de auth.
// En dev, el server de Vite proxya la API y las cartas al Express local.
export default defineConfig({
  base: '/panel/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/carta': 'http://localhost:3000',
      '/assets': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});

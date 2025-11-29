import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        agenda: resolve(__dirname, 'agenda.html'),
        pointeuse: resolve(__dirname, 'pointeuse.html'),
      },
    },
  },
});

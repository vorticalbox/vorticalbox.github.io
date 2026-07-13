import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        trainSim: resolve(import.meta.dirname, 'train-sim/index.html'),
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  // En mode démo, tout est regroupé dans un seul fichier (publication en page autonome)
  build: process.env.VITE_DEMO === '1' ? { outDir: 'dist-demo', assetsInlineLimit: 100_000_000, rollupOptions: { output: { inlineDynamicImports: true } } } : {},
});

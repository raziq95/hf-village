import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative Pfade: die gebauten Dateien liegen im Plugin-Ordner und werden von
  // dort geladen, unabhängig von der WordPress-Installationsadresse.
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Feste Namen für Einstiegsdateien, damit das Plugin sie direkt einbinden kann.
    rollupOptions: {
      output: {
        entryFileNames: 'hf-village-hero.js',
        assetFileNames: assetInfo =>
          assetInfo.name && assetInfo.name.endsWith('.css')
            ? 'hf-village-hero.css'
            : 'assets/[name]-[hash][extname]'
      }
    }
  }
});

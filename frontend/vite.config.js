import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Frontend dev server runs on 5173; backend on 4000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});

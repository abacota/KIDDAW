import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: false, // Ensure HMR doesn't cause infinite reloads or errors as per platform rules
  }
});

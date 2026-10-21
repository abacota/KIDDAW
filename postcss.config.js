import { fileURLToPath } from 'node:url';

export default {
  plugins: {
    // Point at this folder's Tailwind settings, so styles work no matter which folder starts the server.
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
};

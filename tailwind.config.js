/** @type {import('tailwindcss').Config} */
export default {
  // Paths are relative to this file, so styles work no matter which folder starts the server.
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: { extend: {} },
  plugins: [],
};

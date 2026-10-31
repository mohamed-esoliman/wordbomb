/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': { target: serverUrl, ws: true },
      '/api': { target: serverUrl },
    },
  },
  test: {
    name: 'web',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});

import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    alias: [
      // Icon imports are `*.svg?react`, compiled by vite-plugin-svgr in the app.
      // The package's own test run has no such plugin, so point them at an inert
      // stub rather than adding a build plugin to every package that imports one.
      {
        // Anchored at both ends: a Vite alias regex replaces only the matched
        // span, so a partial match would splice the stub path into the middle
        // of the specifier instead of replacing it.
        find: /^.*\.svg\?react$/,
        replacement: fileURLToPath(new URL('./src/test/svg-stub.tsx', import.meta.url)),
      },
    ],
  },
});

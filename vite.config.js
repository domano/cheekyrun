import { defineConfig } from 'vite';

// Relative base so the build works whether it's served from a user/org
// Pages root (https://user.github.io/) or a project subpath
// (https://user.github.io/cheekyrun/).
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
});

import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.GITHUB_ACTIONS === 'true' ? '/matdog-virtual-lab/' : '/',
  build: { target: 'es2022' }
});
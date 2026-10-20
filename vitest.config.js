const { defineConfig } = require('vitest/config');
const react = require('@vitejs/plugin-react');
const { transformWithEsbuild } = require('vite');

const jsxSourceTransform = {
  name: 'onyx-jsx-source-transform',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.includes('/src/') || !id.endsWith('.js')) {
      return undefined;
    }

    return transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
  },
};

module.exports = defineConfig({
  plugins: [jsxSourceTransform, ...react({ include: /\.[jt]sx?$/ }).flat()],
  esbuild: {
    loader: 'jsx',
    include: /\.[jt]sx?$/,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    globals: true,
  },
});

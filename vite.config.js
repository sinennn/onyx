const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig(({ mode }) => ({
  plugins: [
    react({
      include: /\.(js|jsx)$/,
    }),
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  base: './',
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          jszip: ['jszip'],
        },
      },
    },
  },
}));

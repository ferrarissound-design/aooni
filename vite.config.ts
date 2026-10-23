import { defineConfig, Plugin } from 'vite';

/**
 * Makes dist/index.html work when opened straight from disk (file://).
 * Browsers block `type="module"` and CORS-tagged assets there, which leaves a blank page.
 * The bundle is a single IIFE, so a classic deferred script is equivalent.
 */
function fileProtocolFriendly(): Plugin {
  return {
    name: 'file-protocol-friendly',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
        .replace(/<link rel="stylesheet" crossorigin href="([^"]+)">/g, '<link rel="stylesheet" href="$1">');
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [fileProtocolFriendly()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  server: { host: true },
});

import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  root: "src",
  plugins: [
    viteStaticCopy({
      targets: [
        {
          // 1. Copy the manifest
          src: "manifest.json",
          dest: ".",
        },
        {
          // 2. Copy axe-core from node_modules
          src: "../node_modules/axe-core/axe.min.js",
          dest: "lib",
        },
      ],
    }),
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Entry Point 1: The Side Panel (HTML automatically pulls in the JS)
        sidepanel: resolve(__dirname, "src/sidepanel.html"),

        // Entry Point 2: The Service Worker (Required by Chrome)
        // NOTE: Ensure you have a file named src/background.js, even if empty!
        background: resolve(__dirname, "src/background.js"),
      },
      output: {
        // Keeps filenames clean: 'sidepanel.js' instead of 'sidepanel-83h2z.js'
        entryFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});

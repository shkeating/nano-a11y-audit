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
        // ,{
        //   // 2. Copy icons if you have them (e.g. src/icons/...)
        //   // If you don't have an icons folder yet, you can comment this out
        //   src: "icons/*",
        //   dest: "icons",
        // },
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

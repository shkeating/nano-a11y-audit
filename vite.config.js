// vite.config.js
import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import preact from "@preact/preset-vite";

export default defineConfig({
  root: "src",
  plugins: [
    preact(),
    viteStaticCopy({
      targets: [
        { src: "manifest.json", dest: "." },
        { src: "../node_modules/axe-core/axe.min.js", dest: "lib" },
      ],
    }),
  ],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Pointing to the HTML file is standard; Vite finds the script tag inside it
        sidepanel: resolve(__dirname, "src/sidepanel.html"),
        background: resolve(__dirname, "src/background.js"),
      },
      output: {
        entryFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});

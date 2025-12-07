// vite.config.js
import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import preact from "@preact/preset-vite";

export default defineConfig(({ mode }) => {
  // Check if we are running inside Storybook
  const isStorybook =
    process.env.STORYBOOK === "true" ||
    process.argv.some((arg) => arg.includes("storybook"));

  const plugins = [preact()];

  // Only run the Copy plugin when building the Extension (not Storybook)
  if (!isStorybook) {
    plugins.push(
      viteStaticCopy({
        targets: [
          { src: "manifest.json", dest: "." },
          { src: "../node_modules/axe-core/axe.min.js", dest: "lib" },
        ],
      })
    );
  }

  return {
    root: "src",
    plugins,
    resolve: {
      alias: {
        // Critical for Storybook MDX to work with Preact
        react: "preact/compat",
        "react-dom": "preact/compat",
        "react/jsx-runtime": "preact/jsx-runtime",
      },
    },
    build: {
      outDir: "../dist",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          sidepanel: resolve(__dirname, "src/sidepanel.html"),
          background: resolve(__dirname, "src/background.js"),
        },
        output: {
          entryFileNames: "[name].js",
          assetFileNames: "[name].[ext]",
        },
      },
    },
  };
});

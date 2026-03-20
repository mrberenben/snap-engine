import { defineConfig } from "tsup";

export const config = defineConfig({
  entry: {
    index: "packages/index.ts",
    animation: "packages/animation/index.ts",
    core: "packages/core/index.ts",
    dom: "packages/dom/index.ts",
    middleware: "packages/middleware/index.ts",
    react: "packages/react/index.ts",
    "react-native": "packages/react-native/index.ts"
  },
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: true,
  external: ["buffer", "crypto", "fs", "path", "react", "react-dom"],
  esbuildOptions(options) {
    options.platform = "neutral";
    options.alias = {
      "~": "./packages"
    };
  }
});

export default config;

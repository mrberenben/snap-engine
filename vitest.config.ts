import { defineConfig } from "vitest/config";
import { resolve } from "path";

export const config = defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules", "dist"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["packages/**/*.ts"],
      exclude: ["packages/**/*.d.ts", "packages/index.ts"],
    },
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "~": resolve(__dirname, "./packages"),
    },
  },
});

export default config;
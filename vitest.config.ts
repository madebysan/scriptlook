import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: [
      ...configDefaults.exclude,
      ".demo-prep/**",
      ".playwright-cli/**",
      "output/**",
      "playwright-report/**",
      "test-output/**",
      "test-results/**",
      "work/**",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["scripts/pdf-visual-qa.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});

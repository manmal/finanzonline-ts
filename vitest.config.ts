import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      lines: 90,
      functions: 90,
      branches: 90,
      statements: 90,
      reporter: ["text", "html"],
      exclude: [
        "dist/**",
        "src/cli.ts",
        "src/index.ts",
        "src/models/types.ts",
        "vitest.config.ts"
      ]
    }
  }
});

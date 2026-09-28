import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/server/http/server-only-stub.ts"),
    },
  },
  test: {
    passWithNoTests: true,
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "server/**/*.test.ts",
      "fixtures/**/*.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});

import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "convex/**/*.test.ts"],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws at bundle time inside client code. In
      // vitest there's no client/server boundary; map it to a no-op.
      "server-only": path.resolve(__dirname, "vitest.setup.ts"),
    },
  },
});

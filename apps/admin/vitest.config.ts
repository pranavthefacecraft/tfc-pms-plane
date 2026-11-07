import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "next/link": fileURLToPath(new URL("./app/compat/next/link.tsx", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./app/compat/next/navigation.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.tsx", "components/**/*.test.tsx"],
  },
});

import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    env: {
      NEXT_PUBLIC_SITE_DOMAIN: "shops.test",
      NEXT_PUBLIC_WHATSAPP_NUMBER: "919000000000",
      NEXT_PUBLIC_CONTACT_EMAIL: "hello@shops.test",
    },
  },
})

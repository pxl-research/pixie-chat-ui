import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Makes sure Vite listens on network of VM
    port: 3000,
    allowedHosts: [
      'cretskenspixie.westeurope.cloudapp.azure.com'
    ]
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true,
    globals: true,
    mockReset: true,
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});

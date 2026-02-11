import { defineConfig, devices } from "@playwright/test";

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
const webServerCommand =
  nodeMajor >= 20
    ? "npm run dev -- --host 127.0.0.1 --port 4173"
    : "npx -y node@20 ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.08,
      animations: "disabled",
    },
  },
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: webServerCommand,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      VITE_API_BASE_URL: "/api",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

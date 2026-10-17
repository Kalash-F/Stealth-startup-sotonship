import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// The cloud environment ships a Chromium build that may not match this Playwright version.
const bundled = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Smoke tests run against a production build: `npm run build && npm run test:e2e`.
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3300",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || (existsSync(bundled) ? bundled : undefined),
      args: ["--no-proxy-server"],
    },
  },
  webServer: {
    command: "npx next start -p 3300",
    url: "http://localhost:3300",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});

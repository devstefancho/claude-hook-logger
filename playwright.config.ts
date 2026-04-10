import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["html", { open: "never" }], ["github"]] : [["list"]],
  use: {
    baseURL: "http://localhost:7777",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npx tsx viewer/start.ts",
    url: "http://localhost:7777",
    reuseExistingServer: !isCI,
    timeout: 15000,
  },
});

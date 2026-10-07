import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // Multiplayer tests need sequential execution
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for multiplayer coordination
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 60000, // 60s per test

  use: {
    baseURL: "http://localhost:7272",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Narration plays real audio; keep test runs silent
    launchOptions: { args: ["--mute-audio"] },
  },

  projects: [
    {
      name: "chromium",
      // The installed Google Chrome, headless with its own temporary profile:
      // no Playwright browser download to keep in step with the package version
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:7272",
    reuseExistingServer: true,
    timeout: 120000,
  },
});

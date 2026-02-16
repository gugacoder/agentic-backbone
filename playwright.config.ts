import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  use: {
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "hub",
      testMatch: "hub/**/*.spec.ts",
      use: {
        baseURL: "http://localhost:7700",
        browserName: "chromium",
      },
    },
  ],
});

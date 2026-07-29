import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig } from "playwright/test"

const localBrowserLibraryPath = resolve(
  ".playwright-libs/root/usr/lib/x86_64-linux-gnu",
)

if (existsSync(localBrowserLibraryPath)) {
  process.env.LD_LIBRARY_PATH = [
    localBrowserLibraryPath,
    process.env.LD_LIBRARY_PATH,
  ]
    .filter(Boolean)
    .join(":")
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run mock:server",
      url: "http://127.0.0.1:5175/__mock/health",
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: "npm run dev:mock",
      url: "http://127.0.0.1:4175/__mock/health",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
})

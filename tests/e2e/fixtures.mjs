import { expect, test as base } from "playwright/test"

export { expect }

export const test = base.extend({
  failureDiagnostics: [async ({ page }, use, testInfo) => {
    const diagnostics = {
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
    }

    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.consoleErrors.push(message.text())
    })
    page.on("pageerror", (error) => {
      diagnostics.pageErrors.push(error.stack || error.message)
    })
    page.on("requestfailed", (request) => {
      diagnostics.failedRequests.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
        error: request.failure()?.errorText ?? "unknown",
      })
    })

    await use()

    await testInfo.attach("browser-diagnostics.json", {
      body: Buffer.from(JSON.stringify(diagnostics, null, 2)),
      contentType: "application/json",
    })

    if (testInfo.status !== testInfo.expectedStatus) {
      console.error(`[e2e diagnostics] ${JSON.stringify(diagnostics)}`)
    }
  }, { auto: true }],
})

import { writeFile } from "node:fs/promises"
import { chromium, request } from "playwright"

const frontendOrigin = process.env.MOCK_FRONTEND_ORIGIN
const apiOrigin = process.env.MOCK_API_ORIGIN
const outputPath = process.env.PERF_BROWSER_OUTPUT

if (!frontendOrigin || !apiOrigin || !outputPath) {
  throw new Error("MOCK_FRONTEND_ORIGIN, MOCK_API_ORIGIN, and PERF_BROWSER_OUTPUT are required")
}

const scenarios = ["single", "normal", "large"]
const measuredIterations = 5

function round(value, digits = 3) {
  return Number(value.toFixed(digits))
}

function stats(values) {
  const sorted = [...values].sort((left, right) => left - right)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  return {
    mean: round(mean),
    median: round(median),
    min: round(sorted[0]),
    max: round(sorted.at(-1)),
  }
}

async function setScenario(apiRequest, scenario) {
  const reset = await apiRequest.post("/__mock/reset")
  if (!reset.ok()) throw new Error(`reset failed: ${reset.status()}`)
  const selected = await apiRequest.post("/__mock/scenario", { data: { scenario } })
  if (!selected.ok()) throw new Error(`scenario failed: ${selected.status()}`)
}

async function clickFilter(page, label) {
  const button = page.getByRole("button", { name: new RegExp(`^${label}`) }).first()
  await button.waitFor({ state: "visible" })
  await button.click()
}

async function readMetrics(cdp) {
  const performanceMetrics = await cdp.send("Performance.getMetrics")
  const metricMap = Object.fromEntries(
    performanceMetrics.metrics.map((metric) => [metric.name, metric.value]),
  )
  const dom = await cdp.send("Memory.getDOMCounters")
  return {
    taskDurationMs: round((metricMap.TaskDuration ?? 0) * 1000),
    scriptDurationMs: round((metricMap.ScriptDuration ?? 0) * 1000),
    layoutDurationMs: round((metricMap.LayoutDuration ?? 0) * 1000),
    jsHeapUsedBytes: Math.round(metricMap.JSHeapUsedSize ?? 0),
    jsHeapTotalBytes: Math.round(metricMap.JSHeapTotalSize ?? 0),
    documents: dom.documents,
    nodes: dom.nodes,
    listeners: dom.jsEventListeners,
  }
}

async function measureIteration(browser, apiRequest, scenario) {
  await setScenario(apiRequest, scenario)
  const context = await browser.newContext({
    baseURL: frontendOrigin,
    viewport: { width: 1440, height: 900 },
    serviceWorkers: "block",
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send("Performance.enable")

  const requestCounts = new Map()
  let responseBytes = 0
  page.on("response", (response) => {
    const url = new URL(response.url())
    if (!url.pathname.startsWith("/api/")) return
    requestCounts.set(url.pathname, (requestCounts.get(url.pathname) ?? 0) + 1)
    const contentLength = Number(response.headers()["content-length"] ?? 0)
    if (Number.isFinite(contentLength)) responseBytes += contentLength
  })

  await page.goto("/common-anomaly", { waitUntil: "domcontentloaded" })
  await page.getByRole("heading", { name: /공통부 이상감지/ }).waitFor({ state: "visible" })
  await clickFilter(page, "RECIPE_TEST_001")
  await clickFilter(page, "ALL")

  const before = await readMetrics(cdp)
  const startedAt = await page.evaluate(() => performance.now())
  await clickFilter(page, "SENSOR_FLOW_001")
  await page.waitForFunction(() => document.querySelectorAll("main article").length > 0)
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  }))
  const finishedAt = await page.evaluate(() => performance.now())
  const after = await readMetrics(cdp)
  const articleCount = await page.locator("main article").count()
  const imageCount = await page.locator("main article img").count()

  const sample = {
    completionMs: round(finishedAt - startedAt),
    articleCount,
    imageCount,
    apiRequestCount: Array.from(requestCounts.values()).reduce((sum, value) => sum + value, 0),
    requestCounts: Object.fromEntries([...requestCounts].sort()),
    responseContentLengthBytes: responseBytes,
    taskDurationDeltaMs: round(after.taskDurationMs - before.taskDurationMs),
    scriptDurationDeltaMs: round(after.scriptDurationMs - before.scriptDurationMs),
    layoutDurationDeltaMs: round(after.layoutDurationMs - before.layoutDurationMs),
    jsHeapUsedBytes: after.jsHeapUsedBytes,
    jsHeapDeltaBytes: after.jsHeapUsedBytes - before.jsHeapUsedBytes,
    domNodes: after.nodes,
    domNodeDelta: after.nodes - before.nodes,
    eventListeners: after.listeners,
    eventListenerDelta: after.listeners - before.listeners,
  }

  await context.close()
  return sample
}

const apiRequest = await request.newContext({ baseURL: apiOrigin })
const browser = await chromium.launch({ headless: true })
const result = {
  metadata: {
    generatedAt: new Date().toISOString(),
    browser: `Chromium ${await browser.version()}`,
    viewport: "1440x900",
    scenarios,
    measuredIterations,
    warmupIterations: 1,
    cacheCondition: "new browser context per iteration; service workers blocked",
    timingScope: "sensor click through all common-anomaly cards committed plus two animation frames",
    memoryScope: "CDP process-local renderer metrics before and after final filter selection; explicit GC not forced",
    dataPolicy: "synthetic aggregate metrics only; origins and response bodies omitted",
  },
  scenarios: {},
}

try {
  for (const scenario of scenarios) {
    await measureIteration(browser, apiRequest, scenario)
    const samples = []
    for (let index = 0; index < measuredIterations; index += 1) {
      samples.push(await measureIteration(browser, apiRequest, scenario))
    }
    result.scenarios[scenario] = {
      samples,
      completionMs: stats(samples.map((sample) => sample.completionMs)),
      taskDurationDeltaMs: stats(samples.map((sample) => sample.taskDurationDeltaMs)),
      scriptDurationDeltaMs: stats(samples.map((sample) => sample.scriptDurationDeltaMs)),
      layoutDurationDeltaMs: stats(samples.map((sample) => sample.layoutDurationDeltaMs)),
      jsHeapUsedBytes: stats(samples.map((sample) => sample.jsHeapUsedBytes)),
      jsHeapDeltaBytes: stats(samples.map((sample) => sample.jsHeapDeltaBytes)),
      domNodes: stats(samples.map((sample) => sample.domNodes)),
      domNodeDelta: stats(samples.map((sample) => sample.domNodeDelta)),
      eventListeners: stats(samples.map((sample) => sample.eventListeners)),
      representativeArticleCount: samples.at(-1).articleCount,
      representativeImageCount: samples.at(-1).imageCount,
      representativeApiRequestCount: samples.at(-1).apiRequestCount,
      representativeRequestCounts: samples.at(-1).requestCounts,
      representativeResponseContentLengthBytes: samples.at(-1).responseContentLengthBytes,
    }
  }
} finally {
  await apiRequest.dispose()
  await browser.close()
}

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
console.log(JSON.stringify({
  output: "browser-benchmark.json",
  scenarios,
  measuredIterations,
  status: "completed",
}))

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test, before, after } from "node:test"

import { API_CONTRACTS, validateMockResponse } from "../../mock/contracts/api-contracts.mjs"
import {
  createChartPoints,
  createDashboardPayload,
  createFilterPayload,
} from "../../mock/generators/synthetic-data.mjs"
import { startMockApiServer } from "../../mock/server/index.mjs"
import { resolveScenarioEffect } from "../../mock/server/middleware/scenario.mjs"
import { createMockState, SCENARIOS } from "../../mock/state/store.mjs"
import { sanitizeMockFrontendSource } from "../../mock/utils/sanitize-source.mjs"

let instance
let baseUrl

const quietLogger = { info() {}, error() {} }

before(async () => {
  instance = await startMockApiServer({ port: 0, logger: quietLogger })
  baseUrl = `http://127.0.0.1:${instance.port}`
})

after(async () => {
  await instance.close()
})

function requestFor(contract, method) {
  const url = new URL(contract.path, baseUrl)
  const required = {
    line: "LINE_A",
    lineId: "LINE_A",
    pathSdwt: "PRODUCT_001",
    sdwt: "PRODUCT_001",
    path: "fixture://normal/contract/0001",
    eqp: "EQP_TEST_001.png",
    sensor: "SENSOR_FLOW_001",
    chStep: "U%10000",
  }
  for (const item of contract.query ?? []) {
    const key = item.replace("[]", "").replace("?", "")
    if (!item.endsWith("?") && required[key]) url.searchParams.append(key, required[key])
  }
  const options = { method, headers: { Accept: "application/json" } }
  if (method === "POST" || method === "DELETE") {
    options.headers["Content-Type"] = "application/json"
    options.body = JSON.stringify({
      lineId: "LINE_A",
      line: "LINE_A",
      filePath: "fixture://normal/contract/0001",
      execDate: "2026-01-15T12:00:00.000Z",
      app: "synthetic-contract",
      filePaths: ["fixture://normal/contract/0001"],
      pathSdwt: "PRODUCT_001",
      sdwt: "PRODUCT_001",
      prcGroup: "RECIPE_TEST_001",
      eqps: ["EQP_TEST_001"],
      periode: 30,
      knoxIds: ["USER_TEST_001"],
      sdwts: ["PRODUCT_001"],
    })
  }
  return { url, options }
}

test("health endpoint reports normal state", async () => {
  const response = await fetch(`${baseUrl}/__mock/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    service: "l0-spider-synthetic-mock",
    scenario: "normal",
  })
})

test("offline sanitizer endpoint is available without response data", async () => {
  const response = await fetch(`${baseUrl}/__mock/offline`)
  assert.equal(response.status, 204)
  assert.equal(await response.text(), "")
})

test("all required scenarios are registered", () => {
  assert.deepEqual(SCENARIOS, [
    "normal", "empty", "single", "partial", "large", "slow",
    "error-400", "error-401", "error-403", "error-404", "error-500", "error-502",
    "timeout", "race-condition", "inconsistent", "edge-values",
  ])
})

test("slow and race effects expose required delay classes without waiting", () => {
  const state = createMockState()
  const req = { method: "GET" }
  state.setScenario("slow")
  assert.equal(resolveScenarioEffect(
    state,
    req,
    new URL("http://127.0.0.1/api/dashboard-data"),
  ).delayMs, 1000)
  assert.equal(resolveScenarioEffect(
    state,
    req,
    new URL("http://127.0.0.1/api/self-equipment-data"),
  ).delayMs, 3000)
  assert.equal(resolveScenarioEffect(
    state,
    req,
    new URL("http://127.0.0.1/api/erd-scatter-data"),
  ).delayMs, 10_000)
  state.setScenario("race-condition")
  assert.equal(resolveScenarioEffect(
    state,
    req,
    new URL("http://127.0.0.1/api/dashboard-data?line=LINE_A"),
  ).delayMs, 3000)
  assert.equal(resolveScenarioEffect(
    state,
    req,
    new URL("http://127.0.0.1/api/dashboard-data?line=LINE_B"),
  ).delayMs, 300)
})

test("single, partial, large, inconsistent, and edge fixtures have their intended shape", () => {
  const single = createFilterPayload("single", { line: "LINE_A" })
  assert.equal(single.steps.length, 1)
  assert.equal(single.steps[0].equipmentCount, 1)
  const partial = createDashboardPayload("partial")
  assert.ok(partial.lineDashboard.summary.totalAbnormalCount > 0)
  assert.deepEqual(partial.lineDashboard.lineSummary, [])
  const largeA = createChartPoints("large")
  const largeB = createChartPoints("large")
  assert.equal(largeA.length, 2500)
  assert.deepEqual(largeA, largeB)
  const inconsistent = createDashboardPayload("inconsistent", ["LINE_A"])
  assert.ok(inconsistent.lineDashboard.lineSummary.some((row) => row.lineId === "LINE_C"))
  assert.notEqual(
    inconsistent.lineDashboard.summary.latestDate,
    inconsistent.lineDashboard.dailyTrend[0].date,
  )
  const edge = createChartPoints("edge-values")
  assert.ok(edge.some((point) => point.actTime === "invalid-date"))
  assert.ok(edge.some((point) => point.value === "NaN"))
  assert.ok(edge.some((point) => point.value === "Infinity"))
})

test("Mock-mode source sanitizer removes existing non-synthetic targets and defaults", async () => {
  const pageUrl = new URL(
    "../../src/features/fdc-trend/pages/SpiderFeaturePage.jsx",
    import.meta.url,
  )
  const pageSource = await readFile(pageUrl, "utf8")
  const transformedPage = sanitizeMockFrontendSource(pageSource, pageUrl.pathname)
  assert.equal(typeof transformedPage, "string")
  const existingUserLikeValues = pageSource.match(/\bt\d+\.[a-z]+\b/gi) ?? []
  assert.ok(existingUserLikeValues.length > 0)
  assert.ok(existingUserLikeValues.every((value) => !transformedPage.includes(value)))
  assert.match(transformedPage, /USER_TEST_001/)
  assert.match(transformedPage, /U%10000/)

  const homeUrl = new URL(
    "../../src/features/fdc-trend/pages/L0SpiderHomePage.jsx",
    import.meta.url,
  )
  const homeSource = await readFile(homeUrl, "utf8")
  const transformedHome = sanitizeMockFrontendSource(homeSource, homeUrl.pathname)
  assert.equal(typeof transformedHome, "string")
  const existingHosts = homeSource.match(
    /\b(?:[a-z0-9-]+\.)+(?:net|corp|internal)(?::\d+)?/gi,
  ) ?? []
  assert.ok(existingHosts.length > 0)
  assert.ok(existingHosts.every((value) => !transformedHome.includes(value)))
  assert.match(transformedHome, /127\.0\.0\.1:4175\/__mock\/offline/)
})

for (const contract of API_CONTRACTS) {
  for (const method of contract.methods) {
    test(`${method} ${contract.path} satisfies the frontend contract`, async () => {
      const { url, options } = requestFor(contract, method)
      const response = await fetch(url, options)
      assert.equal(response.status, 200)
      if (contract.response === "image") {
        assert.match(response.headers.get("content-type") ?? "", /^image\//)
        assert.ok((await response.text()).length > 20)
        return
      }
      const payload = await response.json()
      assert.deepEqual(validateMockResponse(contract, payload, method), [])
    })
  }
}

test("unsupported methods use the documented error shape", async () => {
  const response = await fetch(`${baseUrl}/api/dashboard-data`, { method: "POST" })
  assert.equal(response.status, 405)
  const payload = await response.json()
  assert.equal(payload.ok, false)
  assert.equal(typeof payload.error, "string")
})

test("empty scenario preserves valid empty collection shapes", async () => {
  await fetch(`${baseUrl}/__mock/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario: "empty" }),
  })
  const dashboard = await (await fetch(`${baseUrl}/api/dashboard-data`)).json()
  assert.deepEqual(dashboard.lineDashboard.lineSummary, [])
  assert.deepEqual(dashboard.lineDashboard.dailyTrend, [])
  assert.equal(dashboard.lineDashboard.summary.totalAbnormalCount, 0)
  const filtered = await (await fetch(
    `${baseUrl}/api/self-equipment-data?line=LINE_A&pathSdwt=PRODUCT_001&sdwt=PRODUCT_001`,
  )).json()
  assert.deepEqual(filtered.steps, [])
  assert.deepEqual(filtered.rows, [])
})

test("scenario errors have stable JSON status and fields", async () => {
  await fetch(`${baseUrl}/__mock/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario: "error-502" }),
  })
  const response = await fetch(`${baseUrl}/api/dashboard-data`)
  assert.equal(response.status, 502)
  const payload = await response.json()
  assert.deepEqual(Object.keys(payload).sort(), ["code", "error", "ok"])
  assert.equal(payload.ok, false)
})

test("route override controls status, delay, and response fixture", async () => {
  await fetch(`${baseUrl}/__mock/reset`, { method: "POST" })
  await fetch(`${baseUrl}/__mock/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route: "/api/dashboard-data",
      method: "GET",
      status: 403,
      delay_ms: 25,
    }),
  })
  const started = performance.now()
  const overridden = await fetch(`${baseUrl}/api/dashboard-data`)
  assert.equal(overridden.status, 403)
  assert.ok(performance.now() - started >= 20)

  await fetch(`${baseUrl}/__mock/reset`, { method: "POST" })
  await fetch(`${baseUrl}/__mock/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      route: "/api/dashboard-data",
      method: "GET",
      fixture: "empty",
    }),
  })
  const fixturePayload = await (await fetch(`${baseUrl}/api/dashboard-data`)).json()
  assert.deepEqual(fixturePayload.lineDashboard.lineSummary, [])
})

test("timeout scenario can be aborted by the client", async () => {
  await fetch(`${baseUrl}/__mock/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario: "timeout" }),
  })
  await assert.rejects(
    fetch(`${baseUrl}/api/dashboard-data`, { signal: AbortSignal.timeout(75) }),
    (error) => error.name === "TimeoutError",
  )
})

test("reset restores normal and removes overrides", async () => {
  const response = await fetch(`${baseUrl}/__mock/reset`, { method: "POST" })
  const payload = await response.json()
  assert.equal(payload.scenario, "normal")
  assert.deepEqual(payload.overrides, [])
  const dashboard = await (await fetch(`${baseUrl}/api/dashboard-data`)).json()
  assert.ok(dashboard.lineDashboard.lineSummary.length > 1)
})

test("Mock sources and responses contain only local or synthetic references", async () => {
  const dashboardText = await (await fetch(`${baseUrl}/api/dashboard-data`)).text()
  assert.doesNotMatch(dashboardText, /https?:\/\/(?!127\.0\.0\.1|localhost)/i)
  assert.doesNotMatch(dashboardText, /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d+\.\d+\b/)
  for (const relativePath of [
    "../../mock/server/index.mjs",
    "../../mock/server/routes/api.mjs",
    "../../mock/generators/synthetic-data.mjs",
  ]) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8")
    const networkTargets = source.match(/https?:\/\/[^\s"'`]+/g) ?? []
    assert.ok(networkTargets.every((target) => (
      target.startsWith("http://127.0.0.1")
      || target.startsWith("http://${host}")
      || target === "http://www.w3.org/2000/svg"
    )))
  }
})

test("server closes and returns its ephemeral port", async () => {
  const disposable = await startMockApiServer({ port: 0, logger: quietLogger })
  const url = `http://127.0.0.1:${disposable.port}/__mock/health`
  assert.equal((await fetch(url)).status, 200)
  await disposable.close()
  await assert.rejects(fetch(url))
})

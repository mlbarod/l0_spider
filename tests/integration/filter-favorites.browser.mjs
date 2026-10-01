// Run after npm run build. All API requests use synthetic data; no real DB is contacted.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"
import { chromium } from "playwright"

const pages = ["self-equipment", "common-anomaly", "matching-anomaly", "common-commonality-anomaly"]
const mapping = { line_mapping: { TEAM_A: "L1", TEAM_B: "L2", TEAM_C: "L2" }, sdwt_mapping: { TEAM_A: "SDWT A", TEAM_B: "SDWT B", TEAM_C: "SDWT C" } }
const notice = "기준정보가 변경되어 즐겨찾기 일부를 적용하지 못했습니다. 다시 등록해 주세요."
const dataPaths = new Set(["/api/self-equipment-data", "/api/common-anomaly-data", "/api/commonality-data", "/api/common-commonality-data"])
test("4개 App 복수 즐겨찾기, 전체 해제, 기본값 복원, 변경 안내 및 박스 외부 안내", async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
    const errors = []
    page.on("pageerror", error => errors.push(error.message))
    let favorites = { lines: [], sdwts: [] }
    let currentMapping = mapping
    let failRead = false, failWrite = false, delayRead = false, releaseRead
    let requests = [], writes = []
    await page.route("**/*", async route => {
      const url = new URL(route.request().url())
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/mapping-config") return json(currentMapping)
        if (url.pathname === "/api/current-user") return json({ ok: true, knoxId: "synthetic.user" })
        if (url.pathname === "/api/auth/session") return json({ ok: true, enabled: false })
        if (url.pathname === "/api/filter-favorites") {
          if (route.request().method() === "PUT") {
            if (failWrite) return json({ ok: false }, 503)
            const body = route.request().postDataJSON()
            writes.push(body)
            if (body.field === "line") {
              if (body.selected && !favorites.lines.includes(body.line)) favorites.lines.push(body.line)
              if (!body.selected) favorites.lines = favorites.lines.filter(line => line !== body.line)
            } else {
              const matches = item => item.line === body.line && item.sdwt === body.sdwt
              if (body.selected && !favorites.sdwts.some(matches)) favorites.sdwts.push({ line: body.line, sdwt: body.sdwt })
              if (!body.selected) favorites.sdwts = favorites.sdwts.filter(item => !matches(item))
            }
          } else {
            if (delayRead) await new Promise(resolve => { releaseRead = resolve })
            if (failRead) return json({ ok: false }, 503)
          }
          return json({ ok: true, favorites })
        }
        if (dataPaths.has(url.pathname)) requests.push({ line: url.searchParams.get("line"), sdwt: url.searchParams.get("pathSdwt") })
        return json({ ok: true, rows: [], steps: [], eqpChannels: [], sensors: [], chSteps: [], filters: {}, images: [], notices: [], registrations: [], records: [] })
      }
      if (url.origin !== "http://favorite.test") return route.abort()
      const file = url.pathname.startsWith("/assets/") ? url.pathname.slice(1) : "index.html"
      return route.fulfill({ body: await readFile(resolve("dist", file)), contentType: file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html" })
    })
    const star = (field, label) => page.locator(`button[aria-label^="${field} ${label} 즐겨찾기 "]`)
    async function open(path, line = "L1", sdwt = "TEAM_A") {
      requests = []
      await page.goto(`http://favorite.test/${path}`)
      await page.waitForFunction(() => document.querySelector('button[aria-label^="Line Name "][aria-pressed]:not(:disabled)'))
      for (let i = 0; !requests.length && i < 100; i++) await page.waitForTimeout(20)
      assert.deepEqual(requests.at(-1), { line, sdwt })
    }
    async function toggle(field, label, selected) {
      await star(field, label).click()
      await page.waitForFunction(({ field, label, selected }) => document.querySelector(`button[aria-label^="${field} ${label} 즐겨찾기 "]`)?.getAttribute("aria-pressed") === String(selected), { field, label, selected })
    }
    for (const path of pages) {
      favorites = { lines: [], sdwts: [] }
      await open(path)
      // Hint is outside and above the entire bordered Line card, at a readable size.
      const hint = page.getByText("을 클릭하여 즐겨찾기 등록", { exact: true })
      const hintBox = await hint.boundingBox()
      const lineCard = page.locator('[data-slot="card"]').filter({ hasText: "Line Name" }).first()
      const cardBox = await lineCard.boundingBox()
      assert.ok(hintBox.y + hintBox.height <= cardBox.y)
      assert.ok(await hint.evaluate(node => parseFloat(getComputedStyle(node).fontSize)) >= 13)
      await toggle("Line Name", "L2", true)
      await toggle("Line Name", "L1", true)
      assert.deepEqual(favorites.lines, ["L2", "L1"])
      assert.deepEqual(requests.at(-1), { line: "L1", sdwt: "TEAM_A" }, "별 클릭은 현재 조회 선택을 바꾸지 않음")
      await page.getByRole("button", { name: "L2", exact: true }).click()
      await toggle("SDWT", "SDWT C", true)
      await toggle("SDWT", "SDWT B", true)
      assert.equal(favorites.sdwts.length, 2)
      await open(path, "L2", "TEAM_C")
      assert.equal(await star("SDWT", "SDWT B").getAttribute("aria-pressed"), "true")
      await toggle("Line Name", "L2", false)
      await toggle("Line Name", "L1", false)
      assert.equal(favorites.sdwts.length, 2, "Line 해제는 SDWT 별을 변경하지 않음")
      await toggle("SDWT", "SDWT C", false)
      await toggle("SDWT", "SDWT B", false)
      assert.deepEqual(favorites, { lines: [], sdwts: [] })
      await open(path)
      assert.equal(await page.locator('button[aria-pressed="true"][aria-label*="즐겨찾기"]').count(), 0)
      assert.equal(await page.getByText(notice, { exact: true }).count(), 0)
    }
    favorites = { lines: ["OLD", "L2"], sdwts: [{ line: "L2", sdwt: "OLD_TEAM" }, { line: "L2", sdwt: "TEAM_C" }] }
    const savedSnapshot = structuredClone(favorites), before = writes.length
    for (const path of pages) {
      await open(path, "L2", "TEAM_C")
      await page.getByText(notice, { exact: true }).waitFor()
      assert.deepEqual(favorites, savedSnapshot)
      assert.equal(writes.length, before)
    }
    favorites = { lines: ["OLD"], sdwts: [] }
    await open("common-anomaly")
    await page.getByText(notice, { exact: true }).waitFor()
    for (const path of pages.slice(0, 3)) {
      await open(`${path}?line=L1&sdwt=TEAM_A`)
      assert.equal(await page.getByText(notice, { exact: true }).count(), 0)
    }
    favorites = { lines: ["L2"], sdwts: [{ line: "L2", sdwt: "TEAM_C" }] }
    currentMapping = { ...mapping, line_mapping: { ...mapping.line_mapping, TEAM_C: "L1" } }
    await open("common-anomaly", "L2", "TEAM_B")
    await page.getByText(notice, { exact: true }).waitFor()
    currentMapping = { ...mapping, sdwt_mapping: { ...mapping.sdwt_mapping, TEAM_C: "NEW LABEL" } }
    await open("common-anomaly", "L2", "TEAM_C")
    await page.getByRole("button", { name: "NEW LABEL", exact: true }).waitFor()
    assert.equal(await page.getByText(notice, { exact: true }).count(), 0)
    currentMapping = mapping
    failRead = true
    await open("common-anomaly")
    assert.equal(await page.getByText(notice, { exact: true }).count(), 0)
    failRead = false
    failWrite = true
    await open("common-anomaly", "L2", "TEAM_C")
    await star("SDWT", "SDWT C").click()
    await page.getByText("즐겨찾기를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", { exact: true }).waitFor()
    assert.equal(await star("SDWT", "SDWT C").getAttribute("aria-pressed"), "true")
    failWrite = false
    delayRead = true
    requests = []
    await page.goto("http://favorite.test/common-anomaly")
    await page.getByRole("button", { name: "L1", exact: true }).click()
    for (let i = 0; !releaseRead && i < 100; i++) await page.waitForTimeout(20)
    releaseRead()
    await page.waitForFunction(() => document.querySelector('button[aria-label^="Line Name "]:not(:disabled)'))
    assert.deepEqual(requests.at(-1), { line: "L1", sdwt: "TEAM_A" })
    assert.deepEqual(errors, [])
    await page.screenshot({ path: "/tmp/filter-favorites-browser.png" })
  } finally { await browser.close() }
})

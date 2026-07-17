import { spawn } from "node:child_process"
import { mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { chromium } from "playwright"

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outputDir = resolve(rootDir, "docs/user-manual/images")
const baseUrl = process.env.MANUAL_BASE_URL || "http://127.0.0.1:4173"
const shouldStartServer = !process.env.MANUAL_BASE_URL
const demoSdwt = "DEMO_SDWT"
const demoTeam = "DEMO_TEAM"
let serverProcess
let serverLogs = ""
let currentStage = "브라우저 초기화"

if (process.env.PLAYWRIGHT_LD_LIBRARY_PATH) {
  process.env.LD_LIBRARY_PATH = [process.env.PLAYWRIGHT_LD_LIBRARY_PATH, process.env.LD_LIBRARY_PATH]
    .filter(Boolean)
    .join(":")
}

function log(message) {
  process.stdout.write(`[user-manual] ${message}\n`)
}

async function waitForServer(url, timeoutMs = 60_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // 서버가 준비될 때까지 상태를 다시 확인한다.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250))
  }
  throw new Error(`웹서비스가 ${timeoutMs / 1000}초 안에 준비되지 않았습니다.\n${serverLogs}`)
}

function startServer() {
  serverProcess = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173"], {
    cwd: rootDir,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  })
  const appendLog = (chunk) => {
    serverLogs = `${serverLogs}${chunk}`.slice(-8_000)
  }
  serverProcess.stdout.on("data", appendLog)
  serverProcess.stderr.on("data", appendLog)
  serverProcess.on("error", (error) => appendLog(`\n${error.stack || error.message}`))
  serverProcess.on("exit", (code, signal) => appendLog(`\n개발 서버 종료: code=${code}, signal=${signal}`))
}

function stopServer() {
  if (!serverProcess || serverProcess.killed) return
  if (process.platform !== "win32") {
    try {
      process.kill(-serverProcess.pid, "SIGTERM")
      return
    } catch {
      // 프로세스 그룹 종료가 불가능하면 자식 프로세스를 직접 종료한다.
    }
  }
  serverProcess.kill("SIGTERM")
}

function json(route, payload, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json; charset=utf-8",
    body: JSON.stringify(payload),
  })
}

function svgImage(title, subtitle) {
  const escape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620">
      <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#e0f2fe"/><stop offset="1" stop-color="#bae6fd"/></linearGradient></defs>
      <rect width="1200" height="620" rx="24" fill="url(#g)"/>
      <path d="M70 430 C180 390 260 455 360 330 S560 390 680 245 S900 330 1130 125" fill="none" stroke="#0284c7" stroke-width="8"/>
      <g fill="#0369a1">${Array.from({ length: 12 }, (_, index) => `<circle cx="${80 + index * 95}" cy="${420 - index * 24 + Math.sin(index) * 45}" r="9"/>`).join("")}</g>
      <text x="70" y="90" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#0c4a6e">${escape(title)}</text>
      <text x="70" y="135" font-family="Arial, sans-serif" font-size="22" fill="#075985">${escape(subtitle)}</text>
      <text x="70" y="575" font-family="Arial, sans-serif" font-size="18" fill="#0369a1">MANUAL TEST DATA · NO PERSONAL OR PRODUCTION DATA</text>
    </svg>`
}

function selfPayload(url) {
  const desc = url.searchParams.get("desc") || ""
  const eqpCh = url.searchParams.get("eqpCh") || ""
  const sensor = url.searchParams.get("sensor") || ""
  const chStep = url.searchParams.get("chStep") || ""
  const hasDesc = desc === "MAIN ETCH"
  const hasEqp = hasDesc && ["EQP-DEMO.png", "ALL"].includes(eqpCh)
  const hasSensor = hasEqp && ["Chamber Pressure", "ALL"].includes(sensor)
  const hasChStep = hasSensor && ["10@001", "20@001", "ALL"].includes(chStep)
  const steps = [
    { desc: "MAIN ETCH", rowCount: 4, equipmentCount: 2 },
    { desc: "OVER ETCH", rowCount: 2, equipmentCount: 1 },
  ]
  const eqpChannels = hasDesc ? [
    { eqpCh: "EQP-DEMO.png", rowCount: 2 },
    { eqpCh: "EQP-DEMO-02.png", rowCount: 2 },
  ] : []
  const sensors = hasEqp ? [
    { sensor: "Chamber Pressure", rowCount: 2 },
    { sensor: "RF Power", rowCount: 2 },
  ] : []
  const chSteps = hasSensor ? [
    { step: "10@001", rowCount: 1, equipmentCount: 1 },
    { step: "20@001", rowCount: 1, equipmentCount: 1 },
  ] : []
  const selectedSteps = chStep === "ALL" ? ["10@001", "20@001"] : [chStep]
  const rows = hasChStep ? selectedSteps.map((step, index) => ({
    id: `self-${step}`,
    sdwt: demoSdwt,
    desc: "MAIN ETCH",
    ver: "V1",
    recipe_id: "PPID-DEMO",
    priority: index ? "B" : "A",
    sensor: "Chamber Pressure",
    step,
    eqp: "EQP-DEMO.png",
    file_path: `/appdata/abnormal_trend/pic/erd/2026-07-17/${demoSdwt}/MAIN ETCH/V1/PPID-DEMO/${index ? "B" : "A"}/Chamber Pressure/${step}/EQP-DEMO.png`,
    line_rev: "H1L",
  })) : []
  return {
    filters: {
      line: "H1L",
      pathSdwt: demoTeam,
      sdwt: demoSdwt,
      priorities: ["A", "B"],
      desc: hasDesc ? desc : "",
      eqpCh: hasEqp ? eqpCh : "",
      sensor: hasSensor ? sensor : "",
      chStep: hasChStep ? chStep : "",
    },
    counts: { filteredRows: 6, chartRows: rows.length },
    steps,
    eqpChannels,
    sensors,
    chSteps,
    rows,
  }
}

function scatterPayload(url) {
  const mode = url.searchParams.get("mode")
  const baseMs = Date.parse("2026-07-16T00:00:00+09:00")
  const points = Array.from({ length: 42 }, (_, index) => ({
    actTime: new Date(baseMs + index * 45 * 60 * 1000).toISOString(),
    actTimeMs: baseMs + index * 45 * 60 * 1000,
    value: Number((48 + Math.sin(index / 3) * 5 + index * 0.12).toFixed(2)),
    eqpId: "EQP-DEMO",
    dispName: "Chamber Pressure",
    waferId: `W${String((index % 25) + 1).padStart(2, "0")}`,
    rootLotId: `LOT-DEMO-${Math.floor(index / 10) + 1}`,
    lotId: `LOT-DEMO-${Math.floor(index / 10) + 1}`,
    isRecent: index >= 30,
  }))
  if (mode === "identity") {
    return {
      eqp: "EQP-DEMO",
      axisColumn: "Chamber Pressure_10@001",
      sourcePath: "/manual-test/data.parquet",
      groupCount: 3,
      pointCount: points.length * 3,
      groups: ["EQP-DEMO", "EQP-DEMO-02", "EQP-DEMO-03"].map((eqpCb, groupIndex) => ({
        eqpCb,
        isSelected: groupIndex === 0,
        pointCount: points.length,
        points: points.map((point) => ({ ...point, value: point.value + groupIndex * 4 })),
      })),
    }
  }
  return {
    eqp: "EQP-DEMO",
    axisColumn: "Chamber Pressure_10@001",
    sourcePath: "/manual-test/data.parquet",
    pointCount: points.length,
    points,
    changeHistory: [{ date: "2026-07-16 13:00:00", dateMs: baseMs + 18 * 45 * 60 * 1000, description: "정비 이력", url: "" }],
  }
}

function commonalityPayload(url) {
  const sensor = url.searchParams.get("sensor") || ""
  const chStep = url.searchParams.get("chStep") || ""
  const validSensor = sensor === "Chamber Pressure"
  const validStep = validSensor && ["10@001", "20@001", "ALL"].includes(chStep)
  const selectedSteps = chStep === "ALL" ? ["10@001", "20@001"] : [chStep]
  return {
    latest: { name: "동일성 최신날짜", path: "/manual-test/commonality", date: "2026-07-17 12:00:00" },
    filters: {
      line: "H1L",
      pathSdwt: demoTeam,
      sdwt: demoSdwt,
      folderSdwt: demoSdwt,
      sensor: validSensor ? sensor : "",
      chStep: validStep ? chStep : "",
    },
    sensors: ["Chamber Pressure", "RF Power"],
    chSteps: validSensor ? ["10@001", "20@001"] : [],
    counts: { indexedImages: 4, filteredImages: validStep ? selectedSteps.length : 0 },
    rows: validStep ? selectedSteps.map((step, index) => ({
      id: `matching-${step}`,
      latestDate: "2026-07-17 12:00:00",
      sdwt: demoSdwt,
      grade: index ? "B" : "A",
      stepSeq: "100",
      stepDesc: "MAIN ETCH",
      ppid: "PPID-DEMO",
      duplicatePpid: "PPID-DEMO",
      sensor: "Chamber Pressure",
      chStep: step,
      filePath: `/manual-test/commonality/${demoSdwt}/${index ? "B" : "A"}/100/MAIN ETCH/PPID-DEMO/PPID-DEMO/Chamber Pressure_${step}/img.png`,
    })) : [],
  }
}

function commonPayload(url) {
  const prcGroup = url.searchParams.get("prcGroup") || ""
  const eqp = url.searchParams.get("eqp") || ""
  const sensor = url.searchParams.get("sensor") || ""
  const hasPrc = prcGroup === "ETCH"
  const hasEqp = hasPrc && ["EQP-COMMON.png", "ALL"].includes(eqp)
  const hasSensor = hasEqp && sensor === "TEMP"
  const dataPath = `/appdata/abnormal_trend/pic/common/2026-07-17/${demoSdwt}/MAIN ETCH/A/TEMP/10@001/data.parquet`
  const imagePath = dataPath.replace("data.parquet", "EQP-COMMON.png")
  return {
    filters: {
      line: "H1L",
      pathSdwt: demoTeam,
      sdwt: demoSdwt,
      prcGroup: hasPrc ? prcGroup : "",
      eqp: hasEqp ? eqp : "",
      sensor: hasSensor ? sensor : "",
    },
    counts: { filteredRows: 3, chartRows: hasSensor ? 1 : 0 },
    prcGroups: [{ value: "ETCH", rowCount: 3 }, { value: "CVD", rowCount: 2 }],
    eqps: hasPrc ? [{ value: "EQP-COMMON.png", rowCount: 2 }, { value: "EQP-COMMON-02.png", rowCount: 1 }] : [],
    sensors: hasEqp ? [{ value: "TEMP", rowCount: 2 }, { value: "PRESSURE", rowCount: 1 }] : [],
    rows: hasSensor ? [{
      id: "common-1",
      file_path: imagePath,
      data_path: dataPath,
      image_path: imagePath,
      sdwt: demoSdwt,
      prc_group: "ETCH",
      date: "2026-07-17",
      priority: "A",
      sensor: "TEMP",
      step: "10@001",
      eqp: "EQP-COMMON.png",
      line_rev: "H1L",
    }] : [],
  }
}

async function installApiFixtures(page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith("/api/")) return route.continue()
    if (url.pathname === "/api/mapping-config") {
      return json(route, { line_mapping: { [demoTeam]: "H1L" }, sdwt_mapping: { [demoTeam]: demoSdwt } })
    }
    if (url.pathname === "/api/current-user") return json(route, { ok: true, knoxId: "manual.test" })
    if (url.pathname === "/api/self-equipment-data") return json(route, selfPayload(url))
    if (url.pathname === "/api/erd-scatter-data" || url.pathname === "/api/common-anomaly-scatter-data") return json(route, scatterPayload(url))
    if (url.pathname === "/api/commonality-data") return json(route, commonalityPayload(url))
    if (url.pathname === "/api/common-anomaly-data") return json(route, commonPayload(url))
    if (url.pathname === "/api/pass-history") return json(route, { ok: true, records: [] })
    if (["/api/clicked-category-history", "/api/hit-history"].includes(url.pathname)) return json(route, { ok: true, affectedRows: 1 })
    if (url.pathname === "/api/commonality-image" || url.pathname === "/api/common-anomaly-image") {
      return route.fulfill({ status: 200, contentType: "image/svg+xml", body: svgImage("ANOMALY RESULT IMAGE", "ACTUAL UI · SANITIZED MANUAL FIXTURE") })
    }
    return json(route, { ok: true })
  })
}

async function sanitizeVisibleText(page) {
  await page.evaluate(() => {
    const replacements = new Map([
      ["Lambda_H1L", "DEMO_TEAM"], ["Dreams_H1L", "DEMO_TEAM_02"], ["TERA_H1L", "DEMO_TEAM_03"],
      ["H1L", "LINE-01"], ["15L", "LINE-02"], ["16L", "LINE-03"], ["17L", "LINE-04"],
      ["P1F", "LINE-05"], ["P1D", "LINE-06"], ["P23F", "LINE-07"], ["P2D", "LINE-08"],
      ["P3D", "LINE-09"], ["P3D2", "LINE-10"],
    ])
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const nodes = []
    while (walker.nextNode()) nodes.push(walker.currentNode)
    nodes.forEach((node) => {
      let value = node.nodeValue
      replacements.forEach((replacement, source) => {
        value = value.replaceAll(source, replacement)
      })
      node.nodeValue = value
    })
    document.querySelectorAll("code").forEach((element) => {
      if (element.textContent?.includes("/appdata/")) element.textContent = "/manual-test/보안정보-마스킹"
    })
  })
}

async function addHighlights(page, locators) {
  await page.evaluate(() => document.querySelectorAll("[data-user-manual-overlay]").forEach((node) => node.remove()))
  for (let index = 0; index < locators.length; index += 1) {
    const locator = locators[index]
    if (!await locator.count()) continue
    const box = await locator.first().boundingBox()
    if (!box) continue
    await page.evaluate(({ boxValue, number }) => {
      const overlay = document.createElement("div")
      overlay.dataset.userManualOverlay = "true"
      Object.assign(overlay.style, {
        position: "absolute",
        left: `${boxValue.x + window.scrollX - 5}px`,
        top: `${boxValue.y + window.scrollY - 5}px`,
        width: `${boxValue.width + 10}px`,
        height: `${boxValue.height + 10}px`,
        border: "4px solid #ef4444",
        borderRadius: "10px",
        boxSizing: "border-box",
        pointerEvents: "none",
        zIndex: "9998",
      })
      const badge = document.createElement("div")
      badge.textContent = String(number)
      Object.assign(badge.style, {
        position: "absolute", right: "-14px", top: "-14px", width: "30px", height: "30px",
        borderRadius: "9999px", background: "#ef4444", color: "white", font: "700 17px/30px Arial",
        textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,.25)",
      })
      overlay.appendChild(badge)
      document.body.appendChild(overlay)
    }, { boxValue: box, number: index + 1 })
  }
}

async function capture(page, name, { highlights = [], fullPage = false, target } = {}) {
  currentStage = `화면 캡처: ${name}`
  await sanitizeVisibleText(page)
  await addHighlights(page, highlights)
  const path = resolve(outputDir, name)
  if (target) {
    await target.screenshot({ path })
  } else {
    await page.screenshot({ path, fullPage })
  }
  await page.evaluate(() => document.querySelectorAll("[data-user-manual-overlay]").forEach((node) => node.remove()))
  log(`캡처 완료: ${name}`)
}

async function goto(page, path, title) {
  currentStage = `화면 이동: ${title} (${path})`
  await page.goto(`${baseUrl}${path}`)
  await page.getByRole("heading", { name: title, exact: true }).first().waitFor({ state: "visible" })
}

async function clickFilter(page, text) {
  const button = page.getByRole("button", { name: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first()
  await button.waitFor({ state: "visible" })
  await button.click()
}

async function generateScreenshots() {
  await mkdir(outputDir, { recursive: true })
  if (shouldStartServer) {
    startServer()
    await waitForServer(baseUrl)
  }

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on("console", (message) => {
    if (message.type() === "error") log(`브라우저 오류: ${message.text()}`)
  })
  await installApiFixtures(page)

  try {
    await goto(page, "/", "SPIDER")
    await capture(page, "01-main-screen.png", { fullPage: true })
    await capture(page, "02-main-menu.png", {
      highlights: [
        page.getByRole("heading", { name: "자설비 이상감지" }),
        page.getByRole("heading", { name: "동일성 이상감지" }),
        page.getByRole("heading", { name: "공통부 이상감지" }),
      ],
    })

    await goto(page, "/self-equipment", "자설비 이상감지")
    await capture(page, "03-self-equipment-filters.png", { highlights: [page.getByText("Sensor Grade"), page.getByText("ch_step", { exact: true })] })
    await clickFilter(page, "MAIN ETCH")
    await clickFilter(page, "EQP-DEMO")
    await clickFilter(page, "Chamber Pressure")
    await clickFilter(page, "10")
    await page.getByText("Scatter chart", { exact: true }).scrollIntoViewIfNeeded()
    await page.getByText("42 매").waitFor({ state: "visible" })
    await capture(page, "04-self-equipment-chart.png", { highlights: [page.getByText("Scatter chart", { exact: true }), page.getByText("이상감지 data")] })
    const selfCard = page.locator("article").filter({ hasText: "EQP-DEMO" }).first()
    await capture(page, "05-self-equipment-actions.png", {
      target: selfCard,
      highlights: [selfCard.getByRole("button", { name: "SKIP", exact: true }), selfCard.getByRole("button", { name: "EQP ALL SKIP" }), selfCard.getByRole("button", { name: "동일성 차트" })],
    })
    await selfCard.getByRole("button", { name: "SKIP", exact: true }).click()
    await page.getByRole("dialog").waitFor({ state: "visible" })
    await capture(page, "06-self-equipment-skip-dialog.png", { target: page.getByRole("dialog"), highlights: [page.getByLabel("SKIP comment"), page.getByRole("button", { name: "OK" })] })
    await page.getByRole("button", { name: "취소" }).click()
    await selfCard.getByRole("button", { name: "동일성 차트" }).click()
    await page.getByRole("dialog").getByText("3개 EQP").waitFor({ state: "visible" })
    await capture(page, "07-self-equipment-identity-chart.png", { target: page.getByRole("dialog"), highlights: [page.getByRole("button", { name: "기준선 긋기" })] })
    await page.keyboard.press("Escape")

    await goto(page, "/matching-anomaly", "동일성 이상감지")
    await clickFilter(page, "Chamber Pressure")
    await clickFilter(page, "10@001")
    await page.getByText("MAIN ETCH", { exact: true }).last().waitFor({ state: "visible" })
    await capture(page, "08-matching-anomaly.png", { fullPage: true, highlights: [page.getByText("Sensor", { exact: true }), page.getByText("ch_step", { exact: true })] })

    await goto(page, "/common-anomaly", "공통부 이상감지")
    await clickFilter(page, "ETCH")
    await clickFilter(page, "EQP-COMMON")
    await clickFilter(page, "TEMP")
    await page.getByText("EQP-COMMON", { exact: true }).last().waitFor({ state: "visible" })
    await capture(page, "09-common-anomaly-filters.png", { highlights: [page.getByText("prc_group", { exact: true }), page.getByText("eqp", { exact: true }), page.getByText("sensor", { exact: true })] })
    const commonCard = page.locator("article").filter({ hasText: "EQP-COMMON" }).first()
    await capture(page, "10-common-anomaly-image.png", { target: commonCard, highlights: [commonCard.getByRole("button", { name: "SKIP", exact: true }), commonCard.getByRole("button", { name: "동일성 차트" })] })

    await goto(page, "/fdc-hard-limit", "FDC Hard Limit추천")
    await page.getByRole("button", { name: "추천SPEC 조회" }).waitFor({ state: "visible" })
    await page.getByRole("button", { name: "추천SPEC 조회" }).click()
    await page.getByText("그래프 그리기").waitFor({ state: "visible" })
    await capture(page, "11-fdc-hard-limit.png", { fullPage: true, highlights: [page.getByRole("button", { name: "추천SPEC 조회" }), page.getByRole("button", { name: "엑셀 다운로드" })] })

    await goto(page, "/yield-hard-limit", "수율기반 Hard Limit추천")
    await capture(page, "12-yield-hard-limit.png", { fullPage: true, highlights: [page.getByRole("button", { name: "조회" })] })

    await goto(page, "/history", "과거 이상감지 이력")
    await capture(page, "13-history.png", { fullPage: true })

    await goto(page, "/recipients", "이상감지 수신인 정비")
    await page.getByLabel("이메일").fill("manual.test")
    await capture(page, "14-recipients.png", { fullPage: true, highlights: [page.getByLabel("이메일"), page.getByRole("button", { name: "등록" }), page.getByRole("button", { name: "제거" })] })

    await goto(page, "/manual", "사용자 메뉴얼")
    await capture(page, "15-manual-status.png", { fullPage: true })
  } finally {
    await browser.close()
  }
}

try {
  await generateScreenshots()
  log("모든 화면 캡처를 생성했습니다.")
} catch (error) {
  console.error(`[user-manual] 캡처 실패 [${currentStage}]: ${error.stack || error.message}`)
  process.exitCode = 1
} finally {
  stopServer()
}

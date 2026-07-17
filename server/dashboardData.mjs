import { readdir, stat } from "node:fs/promises"
import { dirname } from "node:path"

import { asyncBufferFromFile, parquetReadObjects } from "hyparquet"
import { compressors } from "hyparquet-compressors"

import {
  SPIDER_DASHBOARD_COLUMNS,
  SPIDER_DATA_PATH_TEMPLATES,
  buildDashboardDetailPath,
  buildDashboardStatsPath,
  resolveLatestDateFile,
} from "../src/config/spiderDataPaths.mjs"

export const DASHBOARD_STATS_COLUMNS = SPIDER_DASHBOARD_COLUMNS.stats
export const DASHBOARD_DETAIL_COLUMNS = SPIDER_DASHBOARD_COLUMNS.detail

const DASHBOARD_PATH_ROOT = process.env.SPIDER_DASHBOARD_PATH_ROOT
  ?? dirname(SPIDER_DATA_PATH_TEMPLATES.dashboardDetail)
const parquetCache = new Map()

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizePriority(value) {
  return normalizeText(value).toUpperCase()
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return 0
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function sumColumn(rows, column) {
  return rows.reduce((sum, row) => sum + normalizeNumber(row[column]), 0)
}

function uniqueCount(rows, column) {
  return new Set(rows.map((row) => normalizeText(row[column])).filter(Boolean)).size
}

function gradeRows(statsRows, priorities) {
  const allowed = new Set(priorities)
  return statsRows.filter((row) => allowed.has(normalizePriority(row.priority)))
}

export function buildDashboardSummary(statsRows, detailRows, source = {}) {
  const tlRows = gradeRows(statsRows, ["TL"])
  const abRows = gradeRows(statsRows, ["A", "B", "A/B"])
  const dRows = gradeRows(statsRows, ["D"])
  const nRows = gradeRows(statsRows, ["N"])
  const mRows = gradeRows(statsRows, ["M"])
  const anomalyRows = [...abRows, ...dRows, ...nRows, ...mRows]
  const detectedPpidRows = anomalyRows.filter((row) => normalizeNumber(row.ng) > 0)

  return {
    latestDate: source.latestDate ?? "",
    metrics: {
      monitoringSensorTotal: sumColumn(tlRows, "total"),
      detectedPpidCount: uniqueCount(detectedPpidRows, "recipe_id"),
      totalAnomalyCount: sumColumn(anomalyRows, "ng"),
      abGradeCount: sumColumn(abRows, "ng"),
      dGradeCount: sumColumn(dRows, "ng"),
      nGradeCount: sumColumn(nRows, "ng"),
      mGradeCount: sumColumn(mRows, "ng"),
    },
    detailCounts: {
      rows: detailRows.length,
      sdwt: uniqueCount(detailRows, "sdwt"),
      steps: uniqueCount(detailRows, "desc"),
      recipeIds: uniqueCount(detailRows, "recipe_id"),
      sensors: uniqueCount(detailRows, "sensor"),
    },
    sourcePaths: {
      stats: source.statsPath ?? "",
      detail: source.detailPath ?? "",
    },
    columns: {
      stats: DASHBOARD_STATS_COLUMNS,
      detail: DASHBOARD_DETAIL_COLUMNS,
    },
  }
}

async function readParquetRows(filePath, columns) {
  const fileStat = await stat(filePath)
  const cached = parquetCache.get(filePath)
  if (cached?.mtimeMs === fileStat.mtimeMs && cached?.size === fileStat.size) {
    return cached.rows
  }

  const file = await asyncBufferFromFile(filePath)
  const rows = await parquetReadObjects({ file, columns, compressors })
  parquetCache.set(filePath, { mtimeMs: fileStat.mtimeMs, size: fileStat.size, rows })
  return rows
}

export async function getLatestDashboardDate(pathRoot = DASHBOARD_PATH_ROOT) {
  const entries = await readdir(pathRoot, { withFileTypes: true })
  const latestDate = resolveLatestDateFile(entries.map((entry) => entry.name))
  if (latestDate) return latestDate

  const error = new Error(
    `대시보드 최신날짜를 찾지 못했습니다: ${pathRoot} 아래에 YYYY-MM-DD hh:mm:ss 형식의 파일이 없습니다.`,
  )
  error.code = "DASHBOARD_LATEST_DATE_NOT_FOUND"
  throw error
}

export async function getDashboardSummary() {
  const latestDate = await getLatestDashboardDate()
  const statsPath = buildDashboardStatsPath(latestDate)
  const detailPath = buildDashboardDetailPath(latestDate)
  const [statsRows, detailRows] = await Promise.all([
    readParquetRows(statsPath, DASHBOARD_STATS_COLUMNS),
    readParquetRows(detailPath, DASHBOARD_DETAIL_COLUMNS),
  ])

  return buildDashboardSummary(statsRows, detailRows, { latestDate, statsPath, detailPath })
}

export async function handleDashboardDataRequest(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {
      Allow: "GET, HEAD",
      "Content-Type": "application/json; charset=utf-8",
    })
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }))
    return
  }

  try {
    const payload = await getDashboardSummary()
    if (req.method === "HEAD") {
      res.writeHead(200, { "Cache-Control": "no-store" })
      res.end()
      return
    }
    sendJson(res, 200, { ok: true, ...payload })
  } catch (error) {
    const statusCode = error.code === "DASHBOARD_LATEST_DATE_NOT_FOUND" ? 404 : 500
    if (req.method === "HEAD") {
      res.writeHead(statusCode, { "Cache-Control": "no-store" })
      res.end()
      return
    }
    sendJson(res, statusCode, {
      ok: false,
      error: `대시보드 데이터를 불러오지 못했습니다: ${error.message}`,
    })
  }
}

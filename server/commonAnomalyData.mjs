import { statSync } from "node:fs"
import { resolve, sep } from "node:path"

import { asyncBufferFromFile, parquetReadObjects } from "hyparquet"
import { compressors } from "hyparquet-compressors"

import { buildCommonAnomalyPath } from "../src/config/spiderDataPaths.mjs"

export const COMMON_ANOMALY_COLUMNS = Object.freeze([
  "file_path",
  "sdwt",
  "prc_group",
  "date",
  "priority",
  "sensor",
  "step",
  "eqp",
  "line_rev",
])

const COMMON_DATA_ROOT = "/appdata/abnormal_trend/pic/common"
const ALL_EQPS = "ALL"
const pathTableCache = new Map()
const scatterCache = new Map()
const scatterPending = new Map()

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

function normalizeText(value) {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().replace("T", " ").replace("Z", "")
  return String(value).trim()
}

function normalizeEqp(value) {
  return normalizeText(value).replace(/\.png$/i, "")
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseDateTimeMs(value) {
  const text = normalizeText(value)
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?)?/)
  if (!match) return null

  const [, year, month, day, hour = "0", minute = "0", second = "0", fraction = ""] = match
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(fraction.slice(0, 3).padEnd(3, "0")),
  )
}

function assertPathSegment(name, value) {
  if (!value || value.includes("/") || value.includes("\\") || value.includes("..")) {
    throw new Error(`${name} 값이 올바르지 않습니다.`)
  }
}

function normalizePathRow(row) {
  return Object.fromEntries(
    COMMON_ANOMALY_COLUMNS.map((column) => [column, normalizeText(row[column])]),
  )
}

async function readCommonPathRows({ line, pathSdwt }) {
  assertPathSegment("line", line)
  assertPathSegment("pathSdwt", pathSdwt)
  const filePath = buildCommonAnomalyPath({ line, sdwt: pathSdwt })
  const fileStat = statSync(filePath)
  const cached = pathTableCache.get(filePath)
  if (cached?.mtimeMs === fileStat.mtimeMs && cached?.size === fileStat.size) {
    return { filePath, rows: cached.rows }
  }

  const file = await asyncBufferFromFile(filePath)
  const rows = (await parquetReadObjects({
    file,
    columns: COMMON_ANOMALY_COLUMNS,
    compressors,
  })).map(normalizePathRow)
  pathTableCache.set(filePath, { mtimeMs: fileStat.mtimeMs, size: fileStat.size, rows })
  return { filePath, rows }
}

function aggregateValues(rows, column) {
  const counts = new Map()
  rows.forEach((row) => {
    if (!row[column]) return
    counts.set(row[column], (counts.get(row[column]) ?? 0) + 1)
  })
  return Array.from(counts, ([value, rowCount]) => ({ value, rowCount }))
    .sort((left, right) => (
      right.rowCount - left.rowCount
      || left.value.localeCompare(right.value, "ko", { numeric: true })
    ))
}

export function resolveCommonAnomalyDataPath(imagePath) {
  const normalizedImagePath = normalizeText(imagePath).replaceAll("pic_server2", "pic")
  if (!/\/[^/]+\.png$/i.test(normalizedImagePath)) {
    throw new Error("공통부 file_path의 마지막 파일명이 .png로 끝나지 않습니다.")
  }

  const dataPath = normalizedImagePath.replace(/\/[^/]+\.png$/i, "/data.parquet")
  const filePath = resolve(dataPath)
  if (!filePath.startsWith(`${COMMON_DATA_ROOT}${sep}`)) {
    throw new Error("허용되지 않은 공통부 이상감지 경로입니다.")
  }
  return filePath
}

export function buildCommonAnomalyPayload(rows, filters) {
  const baseRows = rows.filter((row) => (
    row.line_rev === filters.line && row.sdwt === filters.sdwt
  ))
  const prcGroups = aggregateValues(baseRows, "prc_group")
  const selectedPrcGroup = prcGroups.some((item) => item.value === filters.prcGroup)
    ? filters.prcGroup
    : ""
  const prcGroupRows = selectedPrcGroup
    ? baseRows.filter((row) => row.prc_group === selectedPrcGroup)
    : []
  const eqps = aggregateValues(prcGroupRows, "eqp")
  const selectedEqp = filters.eqp === ALL_EQPS && eqps.length
    ? ALL_EQPS
    : eqps.some((item) => item.value === filters.eqp)
    ? filters.eqp
    : ""
  const eqpRows = selectedEqp === ALL_EQPS
    ? prcGroupRows
    : selectedEqp
    ? prcGroupRows.filter((row) => row.eqp === selectedEqp)
    : []
  const sensors = aggregateValues(eqpRows, "sensor")
  const selectedSensor = sensors.some((item) => item.value === filters.sensor)
    ? filters.sensor
    : ""
  const chartRows = selectedSensor
    ? eqpRows.filter((row) => row.sensor === selectedSensor)
    : []

  return {
    filters: {
      line: filters.line,
      pathSdwt: filters.pathSdwt,
      sdwt: filters.sdwt,
      prcGroup: selectedPrcGroup,
      eqp: selectedEqp,
      sensor: selectedSensor,
    },
    counts: {
      filteredRows: baseRows.length,
      chartRows: chartRows.length,
    },
    prcGroups,
    eqps,
    sensors,
    rows: chartRows.map((row, index) => ({
      ...row,
      id: `${index}-${row.file_path}`,
      data_path: resolveCommonAnomalyDataPath(row.file_path),
    })),
  }
}

function readFilters(url) {
  return {
    line: normalizeText(url.searchParams.get("line")),
    pathSdwt: normalizeText(url.searchParams.get("pathSdwt")),
    sdwt: normalizeText(url.searchParams.get("sdwt")),
    prcGroup: normalizeText(url.searchParams.get("prcGroup")),
    eqp: normalizeText(url.searchParams.get("eqp")),
    sensor: normalizeText(url.searchParams.get("sensor")),
  }
}

export async function handleCommonAnomalyDataRequest(req, res, url) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  try {
    const filters = readFilters(url)
    if (!filters.line || !filters.pathSdwt || !filters.sdwt) {
      sendJson(res, 400, { ok: false, error: "line, pathSdwt, sdwt 조건이 필요합니다." })
      return
    }
    const { filePath, rows } = await readCommonPathRows(filters)
    sendJson(res, 200, {
      ...buildCommonAnomalyPayload(rows, filters),
      sourcePath: filePath,
    })
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `공통부 이상감지 경로 데이터를 불러오지 못했습니다: ${error.message}`,
    })
  }
}

async function readCommonScatterRows(filePath, sensor) {
  const fileStat = statSync(filePath)
  const cacheKey = `${filePath}\u0000${sensor}`
  const cached = scatterCache.get(cacheKey)
  if (cached?.mtimeMs === fileStat.mtimeMs && cached?.size === fileStat.size) return cached.rows
  if (scatterPending.has(cacheKey)) return scatterPending.get(cacheKey)

  const readPromise = (async () => {
    const file = await asyncBufferFromFile(filePath)
    const columns = Array.from(new Set([
      "eqp_id",
      "disp_name",
      "lotid",
      "wafer_id",
      "act_time",
      sensor,
      "eqp_cb",
    ]))
    const rows = await parquetReadObjects({ file, columns, compressors })
    scatterCache.set(cacheKey, { mtimeMs: fileStat.mtimeMs, size: fileStat.size, rows })
    return rows
  })()
  scatterPending.set(cacheKey, readPromise)
  try {
    return await readPromise
  } finally {
    scatterPending.delete(cacheKey)
  }
}

export function buildCommonScatterPayload(rows, { eqp, sensor, filePath }) {
  const normalizedEqp = normalizeEqp(eqp)
  const chartPoints = rows.flatMap((row) => {
    if (normalizeEqp(row.eqp_cb) !== normalizedEqp) return []
    const actTime = normalizeText(row.act_time)
    const actTimeMs = parseDateTimeMs(actTime)
    const value = normalizeNumber(row[sensor])
    if (!actTime || actTimeMs === null || value === null) return []
    return [{
      actTime,
      actTimeMs,
      value,
      eqpId: normalizeText(row.eqp_id),
      dispName: normalizeText(row.disp_name),
      lotId: normalizeText(row.lotid),
      waferId: normalizeText(row.wafer_id),
    }]
  }).sort((left, right) => left.actTimeMs - right.actTimeMs)
  const mostRecentActTimeMs = chartPoints.at(-1)?.actTimeMs ?? null
  const recentThresholdMs = mostRecentActTimeMs === null
    ? null
    : mostRecentActTimeMs - 26 * 60 * 60 * 1000
  const points = chartPoints.map((point) => ({
    ...point,
    isRecent: recentThresholdMs !== null && point.actTimeMs >= recentThresholdMs,
  }))

  return {
    eqp: normalizedEqp,
    axisColumn: sensor,
    sourcePath: filePath,
    mostRecentActTimeMs,
    recentThresholdMs,
    pointCount: points.length,
    points,
    changeHistory: [],
  }
}

export async function handleCommonAnomalyScatterRequest(req, res, url) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  let sourcePath = ""
  try {
    const imagePath = normalizeText(url.searchParams.get("path"))
    const eqp = normalizeText(url.searchParams.get("eqp"))
    const sensor = normalizeText(url.searchParams.get("sensor"))
    if (!imagePath || !eqp || !sensor) {
      sendJson(res, 400, { ok: false, error: "path, eqp, sensor 조건이 필요합니다." })
      return
    }
    assertPathSegment("eqp", normalizeEqp(eqp))
    assertPathSegment("sensor", sensor)
    sourcePath = resolveCommonAnomalyDataPath(imagePath)
    const rows = await readCommonScatterRows(sourcePath, sensor)
    sendJson(res, 200, buildCommonScatterPayload(rows, { eqp, sensor, filePath: sourcePath }))
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `공통부 이상감지 데이터를 불러오지 못했습니다: ${error.message}`,
      sourcePath,
    })
  }
}

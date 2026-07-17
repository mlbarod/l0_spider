import { statSync } from "node:fs"
import { basename, resolve, sep } from "node:path"

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

function canonicalEqp(value) {
  return normalizeEqp(value).toLocaleUpperCase("en-US")
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(typeof value === "string" ? value.replaceAll(",", "").trim() : value)
  return Number.isFinite(number) ? number : null
}

function parseDateTimeMs(value) {
  if (value instanceof Date) {
    const milliseconds = value.getTime()
    return Number.isFinite(milliseconds) ? milliseconds : null
  }

  const text = normalizeText(value)
  if (text && Number.isFinite(Number(text))) {
    const numericValue = Number(text)
    if (!Number.isFinite(numericValue)) return null
    const absoluteValue = Math.abs(numericValue)
    if (absoluteValue >= 1e17) return numericValue / 1e6
    if (absoluteValue >= 1e14) return numericValue / 1e3
    if (absoluteValue < 1e11) return numericValue * 1e3
    return numericValue
  }

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

function isDelimitedEqpPrefix(shorter, longer) {
  return longer.startsWith(shorter) && /^[-_@:#/\\]/.test(longer.slice(shorter.length))
}

function eqpIdentifiersMatch(left, right) {
  if (!left || !right) return false
  if (left === right) return true
  return isDelimitedEqpPrefix(left, right) || isDelimitedEqpPrefix(right, left)
}

function resolveEqpMatches(rows, candidates) {
  const candidateKeys = Array.from(new Set(candidates.map(canonicalEqp).filter(Boolean)))
  const availableEqps = Array.from(new Set(
    rows.map((row) => normalizeEqp(row.eqp_cb)).filter(Boolean),
  )).sort((left, right) => left.localeCompare(right, "ko", { numeric: true }))
  const exactMatches = availableEqps.filter((value) => candidateKeys.includes(canonicalEqp(value)))
  let matchedEqps = exactMatches.length
    ? exactMatches
    : availableEqps.filter((value) => candidateKeys.some((candidate) => (
        eqpIdentifiersMatch(candidate, canonicalEqp(value))
      )))
  let matchStrategy = exactMatches.length
    ? "eqp_cb-exact"
    : matchedEqps.length
    ? "eqp_cb-prefix"
    : "none"

  const availableEqpIds = Array.from(new Set(
    rows.map((row) => normalizeEqp(row.eqp_id)).filter(Boolean),
  )).sort((left, right) => left.localeCompare(right, "ko", { numeric: true }))
  let matchedEqpIdKeys = new Set()
  if (!matchedEqps.length) {
    matchedEqpIdKeys = new Set(availableEqpIds
      .filter((value) => candidateKeys.some((candidate) => (
        eqpIdentifiersMatch(candidate, canonicalEqp(value))
      )))
      .map(canonicalEqp))
    matchedEqps = Array.from(new Set(rows
      .filter((row) => matchedEqpIdKeys.has(canonicalEqp(row.eqp_id)))
      .map((row) => normalizeEqp(row.eqp_cb))
      .filter(Boolean)))
    if (matchedEqps.length) matchStrategy = "eqp_id"
  }

  if (!matchedEqps.length && availableEqps.length === 1) {
    matchedEqps = availableEqps
    matchStrategy = "single-eqp-cb"
  }

  return {
    availableEqps,
    availableEqpIds,
    candidateKeys,
    matchedEqps,
    matchStrategy,
    matchedKeys: new Set(matchedEqps.map(canonicalEqp)),
    matchedEqpIdKeys,
  }
}

function rowMatchesEqp(row, eqpMatch) {
  return eqpMatch.matchStrategy === "eqp_id"
    ? eqpMatch.matchedEqpIdKeys.has(canonicalEqp(row.eqp_id))
    : eqpMatch.matchedKeys.has(canonicalEqp(row.eqp_cb))
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
  const dataPath = /\/data\.parquet$/i.test(normalizedImagePath)
    ? normalizedImagePath
    : /\/[^/]+\.png$/i.test(normalizedImagePath)
    ? normalizedImagePath.replace(/\/[^/]+\.png$/i, "/data.parquet")
    : ""
  if (!dataPath) {
    throw new Error("공통부 경로의 마지막 파일명이 .png 또는 data.parquet이 아닙니다.")
  }

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

async function readCommonScatterRows(filePath, axisColumn) {
  const fileStat = statSync(filePath)
  const cacheKey = `${filePath}\u0000${axisColumn}`
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
      axisColumn,
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

function buildCommonPoint(row, axisColumn) {
  const actTime = normalizeText(row.act_time)
  const actTimeMs = parseDateTimeMs(row.act_time)
  const value = normalizeNumber(row[axisColumn])
  if (!actTime || actTimeMs === null || value === null) return null
  const lotId = normalizeText(row.lotid)
  return {
    actTime,
    actTimeMs,
    value,
    eqpId: normalizeText(row.eqp_id),
    dispName: normalizeText(row.disp_name),
    lotId,
    rootLotId: lotId,
    waferId: normalizeText(row.wafer_id),
  }
}

export function buildCommonScatterPayload(rows, {
  eqp,
  sensor,
  chStep = "",
  filePath,
  imagePath = "",
}) {
  const normalizedEqp = normalizeEqp(eqp)
  const axisColumn = chStep ? `${sensor}_${chStep}` : sensor
  const eqpMatch = resolveEqpMatches(rows, [eqp, basename(imagePath)])
  let invalidActTimeRows = 0
  let invalidValueRows = 0
  const chartPoints = rows.flatMap((row) => {
    if (!rowMatchesEqp(row, eqpMatch)) return []
    const actTimeMs = parseDateTimeMs(row.act_time)
    if (!normalizeText(row.act_time) || actTimeMs === null) {
      invalidActTimeRows += 1
      return []
    }
    const value = normalizeNumber(row[axisColumn])
    if (value === null) {
      invalidValueRows += 1
      return []
    }
    return [buildCommonPoint(row, axisColumn)]
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
    axisColumn,
    sourcePath: filePath,
    mostRecentActTimeMs,
    recentThresholdMs,
    pointCount: points.length,
    points,
    changeHistory: [],
    diagnostics: {
      totalRows: rows.length,
      eqpMatchedRows: rows.filter((row) => rowMatchesEqp(row, eqpMatch)).length,
      invalidActTimeRows,
      invalidValueRows,
      requestedEqps: eqpMatch.candidateKeys,
      matchedEqpCbs: eqpMatch.matchedEqps,
      availableEqpCbs: eqpMatch.availableEqps.slice(0, 20),
      availableEqpIds: eqpMatch.availableEqpIds.slice(0, 20),
      matchStrategy: eqpMatch.matchStrategy,
    },
  }
}

export function buildCommonIdentityPayload(rows, {
  eqp,
  sensor,
  chStep,
  filePath,
  imagePath = "",
}) {
  const normalizedEqp = normalizeEqp(eqp)
  const axisColumn = `${sensor}_${chStep}`
  const eqpMatch = resolveEqpMatches(rows, [eqp, basename(imagePath)])
  const groups = new Map()

  rows.forEach((row) => {
    const eqpCb = normalizeEqp(row.eqp_cb)
    const point = buildCommonPoint(row, axisColumn)
    if (!eqpCb || !point) return
    const group = groups.get(eqpCb) ?? { eqpCb, isSelected: false, points: [] }
    group.isSelected ||= rowMatchesEqp(row, eqpMatch)
    group.points.push(point)
    groups.set(eqpCb, group)
  })

  const eqpGroups = Array.from(groups.values()).map((group) => ({
    ...group,
    pointCount: group.points.length,
    points: group.points.sort((left, right) => left.actTimeMs - right.actTimeMs),
  })).sort((left, right) => (
    Number(right.isSelected) - Number(left.isSelected)
    || left.eqpCb.localeCompare(right.eqpCb, "ko", { numeric: true })
  ))

  return {
    eqp: normalizedEqp,
    axisColumn,
    sourcePath: filePath,
    groupCount: eqpGroups.length,
    pointCount: eqpGroups.reduce((total, group) => total + group.pointCount, 0),
    groups: eqpGroups,
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
    const chStep = normalizeText(url.searchParams.get("chStep"))
    const mode = normalizeText(url.searchParams.get("mode")) || "scatter"
    if (!imagePath || !eqp || !sensor || !chStep) {
      sendJson(res, 400, { ok: false, error: "path, eqp, sensor, chStep 조건이 필요합니다." })
      return
    }
    assertPathSegment("eqp", normalizeEqp(eqp))
    assertPathSegment("sensor", sensor)
    assertPathSegment("chStep", chStep)
    sourcePath = resolveCommonAnomalyDataPath(imagePath)
    const axisColumn = `${sensor}_${chStep}`
    const rows = await readCommonScatterRows(sourcePath, axisColumn)
    if (mode === "identity") {
      sendJson(res, 200, buildCommonIdentityPayload(rows, {
        eqp,
        sensor,
        chStep,
        filePath: sourcePath,
        imagePath,
      }))
      return
    }
    sendJson(res, 200, buildCommonScatterPayload(rows, {
      eqp,
      sensor,
      chStep,
      filePath: sourcePath,
      imagePath,
    }))
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `공통부 이상감지 데이터를 불러오지 못했습니다: ${error.message}`,
      sourcePath,
    })
  }
}

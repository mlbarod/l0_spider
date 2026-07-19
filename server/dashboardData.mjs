import { readdir, stat } from "node:fs/promises"
import { dirname, join } from "node:path"

import { asyncBufferFromFile, parquetReadObjects } from "hyparquet"
import { compressors } from "hyparquet-compressors"

import {
  LATEST_DATE_FILE_PATTERN,
  SPIDER_DASHBOARD_COLUMNS,
  SPIDER_DATA_PATH_TEMPLATES,
  buildDashboardStatsPath,
} from "../src/config/spiderDataPaths.mjs"
import { getLruEntry, setLruEntry } from "./boundedCache.mjs"
import { mappingConfigPath, readLineMapping } from "./mappingConfig.mjs"

export const DASHBOARD_STATS_COLUMNS = SPIDER_DASHBOARD_COLUMNS.stats
export const DASHBOARD_DETAIL_COLUMNS = SPIDER_DASHBOARD_COLUMNS.detail
export const LINE_ANOMALY_ID_COLUMNS = Object.freeze(["desc", "recipe_id", "priority", "sensor", "eqp"])

const DASHBOARD_PATH_ROOT = process.env.SPIDER_DASHBOARD_PATH_ROOT
  ?? dirname(SPIDER_DATA_PATH_TEMPLATES.dashboardDetail)
const READ_CONCURRENCY = 1
const PARQUET_CACHE_MAX_ENTRIES = 1
const DASHBOARD_AGGREGATE_CACHE_MAX_ENTRIES = 32
const parquetCache = new Map()
const parquetPending = new Map()
const dashboardAggregateCache = new Map()
const dashboardAggregatePending = new Map()
const dashboardFileListCache = new Map()
let mappingCache = null

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

function uniqueCombinationCount(rows, columns) {
  return new Set(rows.map((row) => (
    columns.map((column) => normalizeText(row[column])).join("\u0000")
  ))).size
}

function gradeRows(rows, priorities) {
  const allowed = new Set(priorities)
  return rows.filter((row) => allowed.has(normalizePriority(row.priority)))
}

function createDashboardError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function parseDateParts(dateText) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText)
  if (!match) return null
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null
  return { year, month, day, date }
}

function isValidDateTimeFileName(fileName) {
  if (!LATEST_DATE_FILE_PATTERN.test(fileName)) return false
  const dateParts = parseDateParts(fileName.slice(0, 10))
  const timeMatch = /^(\d{2}):(\d{2}):(\d{2})$/.exec(fileName.slice(11))
  if (!dateParts || !timeMatch) return false
  const [, hour, minute, second] = timeMatch.map(Number)
  return hour <= 23 && minute <= 59 && second <= 59
}

function formatUtcDate(date) {
  return date.toISOString().slice(0, 10)
}

function compareDateTexts(left, right) {
  const leftDate = parseDateParts(left.slice(0, 10))?.date.getTime() ?? Number.NaN
  const rightDate = parseDateParts(right.slice(0, 10))?.date.getTime() ?? Number.NaN
  if (leftDate !== rightDate) return leftDate - rightDate
  return left.slice(11).localeCompare(right.slice(11))
}

function shiftDate(dateText, days) {
  const parsed = parseDateParts(dateText)
  if (!parsed) return null
  parsed.date.setUTCDate(parsed.date.getUTCDate() + days)
  return formatUtcDate(parsed.date)
}

export function getPreviousDashboardDateTime(dateTime) {
  if (!isValidDateTimeFileName(dateTime)) return null
  const previousDate = shiftDate(dateTime.slice(0, 10), -1)
  return previousDate ? `${previousDate} ${dateTime.slice(11)}` : null
}

export function selectPreviousDashboardFileAtSameTime(dateFiles, latestDateTime) {
  const previousDateTime = getPreviousDashboardDateTime(latestDateTime)
  if (!previousDateTime) return null
  const previousDate = previousDateTime.slice(0, 10)
  const sameHourMinute = previousDateTime.slice(11, 16)
  return dateFiles
    .filter((file) => (
      isValidDateTimeFileName(file.dateTime)
      && file.dateTime.slice(0, 10) === previousDate
      && file.dateTime.slice(11, 16) === sameHourMinute
    ))
    .sort((left, right) => compareDateTexts(left.dateTime, right.dateTime))
    .at(-1) ?? null
}

function enumerateDates(startDate, endDate) {
  const start = parseDateParts(startDate)?.date
  const end = parseDateParts(endDate)?.date
  if (!start || !end) return []
  const dates = []
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dates.push(formatUtcDate(cursor))
  }
  return dates
}

function compareLineIds(left, right) {
  return left.localeCompare(right, "ko", { numeric: true })
}

export function resolveDashboardDateRange(dateTimes, requested = {}) {
  const availableDates = Array.from(new Set(
    dateTimes.filter(isValidDateTimeFileName).map((dateTime) => dateTime.slice(0, 10)),
  )).sort(compareDateTexts)

  if (!availableDates.length) {
    throw createDashboardError(
      "DASHBOARD_LATEST_DATE_NOT_FOUND",
      "YYYY-MM-DD hh:mm:ss 형식의 대시보드 세부 파일이 없습니다.",
    )
  }

  const minDate = availableDates[0]
  const maxDate = availableDates.at(-1)
  const defaultEndDate = maxDate
  const defaultStartDate = maxDate
  const startDate = requested.startDate || defaultStartDate
  const endDate = requested.endDate || defaultEndDate

  if (!parseDateParts(startDate) || !parseDateParts(endDate)) {
    throw createDashboardError(
      "DASHBOARD_INVALID_FILTER",
      "조회 시작일과 종료일은 YYYY-MM-DD 형식이어야 합니다.",
    )
  }
  if (startDate > endDate) {
    throw createDashboardError(
      "DASHBOARD_INVALID_FILTER",
      "조회 시작일은 종료일보다 늦을 수 없습니다.",
    )
  }

  return { startDate, endDate, minDate, maxDate, defaultStartDate, defaultEndDate }
}

function buildSdwtLineLookup(mappingConfig) {
  const lineMapping = mappingConfig?.line_mapping ?? {}
  const sdwtMapping = mappingConfig?.sdwt_mapping ?? {}
  const lookup = new Map()

  Object.entries(lineMapping).forEach(([sdwtKey, lineValue]) => {
    const key = normalizeText(sdwtKey)
    const line = normalizeText(lineValue)
    if (!key || !line) return
    lookup.set(key, line)
    const displaySdwt = normalizeText(sdwtMapping[sdwtKey])
    if (displaySdwt) lookup.set(displaySdwt, line)
  })

  return lookup
}

function getKnownLines(mappingConfig) {
  return new Set(
    Object.values(mappingConfig?.line_mapping ?? {}).map(normalizeText).filter(Boolean),
  )
}

function validateRequestedLines(lines, mappingConfig) {
  const knownLines = getKnownLines(mappingConfig)
  const requestedLines = Array.from(new Set(lines.map(normalizeText).filter(Boolean)))
  const invalidLine = requestedLines.find((line) => !knownLines.has(line))
  if (invalidLine) {
    throw createDashboardError(
      "DASHBOARD_INVALID_FILTER",
      `기준정보에 존재하지 않는 라인입니다: ${invalidLine}`,
    )
  }
  return requestedLines
}

function buildDashboardDetailSummary(detailRows) {
  const abRows = gradeRows(detailRows, ["A", "B"])
  const dRows = gradeRows(detailRows, ["D"])
  const nRows = gradeRows(detailRows, ["N"])
  const mRows = gradeRows(detailRows, ["M"])

  return {
    metrics: {
      detectedPpidCount: uniqueCount(detailRows, "recipe_id"),
      totalAnomalyCount: uniqueCombinationCount(detailRows, LINE_ANOMALY_ID_COLUMNS),
      abGradeCount: uniqueCombinationCount(abRows, LINE_ANOMALY_ID_COLUMNS),
      dGradeCount: uniqueCombinationCount(dRows, LINE_ANOMALY_ID_COLUMNS),
      nGradeCount: uniqueCombinationCount(nRows, LINE_ANOMALY_ID_COLUMNS),
      mGradeCount: uniqueCombinationCount(mRows, LINE_ANOMALY_ID_COLUMNS),
    },
    detailCounts: {
      rows: detailRows.length,
      sdwt: uniqueCount(detailRows, "sdwt"),
      steps: uniqueCount(detailRows, "desc"),
      recipeIds: uniqueCount(detailRows, "recipe_id"),
      sensors: uniqueCount(detailRows, "sensor"),
    },
  }
}

function buildDashboardSummaryFromDetailSummary(statsRows, detailSummary, source = {}) {
  const tlRows = gradeRows(statsRows, ["TL"])
  return {
    latestDate: source.latestDate ?? "",
    metrics: {
      monitoringSensorTotal: sumColumn(tlRows, "total"),
      ...detailSummary.metrics,
    },
    detailCounts: detailSummary.detailCounts,
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

export function buildDashboardSummary(statsRows, detailRows, source = {}) {
  return buildDashboardSummaryFromDetailSummary(
    statsRows,
    buildDashboardDetailSummary(detailRows),
    source,
  )
}

function aggregateDashboardLineRows(rows, sdwtLineLookup) {
  const combinationsByLine = new Map()
  const combinationsByLineGrade = new Map()
  const actualLines = new Set()
  let unmappedRows = 0

  rows.forEach((row) => {
    const lineId = sdwtLineLookup.get(normalizeText(row.sdwt))
    if (!lineId) {
      unmappedRows += 1
      return
    }
    actualLines.add(lineId)
    const combinationKey = LINE_ANOMALY_ID_COLUMNS
      .map((column) => normalizeText(row[column]))
      .join("\u0000")
    const combinations = combinationsByLine.get(lineId) ?? new Set()
    combinations.add(combinationKey)
    combinationsByLine.set(lineId, combinations)

    const priority = normalizePriority(row.priority)
    const gradeKey = `${lineId}\u0000${priority}`
    const gradeCombinations = combinationsByLineGrade.get(gradeKey) ?? new Set()
    gradeCombinations.add(combinationKey)
    combinationsByLineGrade.set(gradeKey, gradeCombinations)
  })

  const countsByLine = new Map(
    Array.from(combinationsByLine, ([lineId, combinations]) => [lineId, combinations.size]),
  )
  const gradeCountsByLine = new Map()
  combinationsByLineGrade.forEach((combinations, gradeKey) => {
    const [lineId, priority] = gradeKey.split("\u0000")
    const counts = gradeCountsByLine.get(lineId) ?? new Map()
    counts.set(priority, combinations.size)
    gradeCountsByLine.set(lineId, counts)
  })

  return { countsByLine, gradeCountsByLine, actualLines, unmappedRows }
}

function buildLineDashboardPayloadFromAggregates(
  datedAggregates,
  comparisonAggregate,
  mappingConfig,
  filters,
) {
  const requestedLines = validateRequestedLines(filters.lines ?? [], mappingConfig)
  const actualLines = new Set()
  const aggregatesByDate = new Map()
  datedAggregates.forEach((aggregate) => {
    aggregate.actualLines.forEach((lineId) => actualLines.add(lineId))
    const date = normalizeText(aggregate.dateTime).slice(0, 10)
    if (parseDateParts(date)) aggregatesByDate.set(date, aggregate)
  })

  const comparisonDateTime = normalizeText(filters.comparisonDateTime)
  const hasPreviousData = isValidDateTimeFileName(comparisonDateTime)
  if (hasPreviousData && comparisonAggregate) {
    comparisonAggregate.actualLines.forEach((lineId) => actualLines.add(lineId))
  }

  const availableLines = Array.from(actualLines).sort(compareLineIds)
  const selectedLines = requestedLines.length ? requestedLines : availableLines
  const dates = enumerateDates(filters.startDate, filters.endDate)
  const getCount = (date, lineId) => aggregatesByDate.get(date)?.countsByLine.get(lineId) ?? 0
  const getGradeCount = (date, lineId, priorities) => priorities.reduce((sum, priority) => (
    sum + (aggregatesByDate.get(date)?.gradeCountsByLine.get(lineId)?.get(priority) ?? 0)
  ), 0)
  const latestDateTime = datedAggregates
    .map((item) => item.dateTime)
    .filter(isValidDateTimeFileName)
    .sort(compareDateTexts)
    .at(-1) ?? null
  const latestDate = latestDateTime?.slice(0, 10) ?? null
  const previousDate = hasPreviousData ? comparisonDateTime.slice(0, 10) : null

  const lineSummary = selectedLines.map((lineId) => {
    const totalCount = dates.reduce((sum, date) => sum + getCount(date, lineId), 0)
    const abGradeCount = dates.reduce((sum, date) => (
      sum + getGradeCount(date, lineId, ["A", "B"])
    ), 0)
    const latestDateCount = latestDate ? getCount(latestDate, lineId) : 0
    const previousDateCount = hasPreviousData
      ? (comparisonAggregate?.countsByLine.get(lineId) ?? 0)
      : null
    const lastAbnormalDate = [...dates].reverse().find((date) => getCount(date, lineId) > 0) ?? null
    return {
      lineId,
      totalCount,
      abGradeCount,
      latestDateCount,
      previousDateCount,
      changeCount: previousDateCount === null ? null : latestDateCount - previousDateCount,
      lastAbnormalDate,
      ratio: 0,
    }
  })

  const totalAbnormalCount = lineSummary.reduce((sum, row) => sum + row.totalCount, 0)
  lineSummary.forEach((row) => {
    row.ratio = totalAbnormalCount ? Number(((row.totalCount / totalAbnormalCount) * 100).toFixed(2)) : 0
  })
  lineSummary.sort((left, right) => right.totalCount - left.totalCount || compareLineIds(left.lineId, right.lineId))

  const latestDateCount = lineSummary.reduce((sum, row) => sum + row.latestDateCount, 0)
  const previousDateCount = hasPreviousData
    ? lineSummary.reduce((sum, row) => sum + row.previousDateCount, 0)
    : null
  const topLineRow = lineSummary.find((row) => row.totalCount > 0) ?? null
  const sumGradeCount = (priorities) => dates.reduce((dateSum, date) => (
    dateSum + selectedLines.reduce((lineSum, lineId) => (
      lineSum + getGradeCount(date, lineId, priorities)
    ), 0)
  ), 0)
  const dailyTrend = dates.flatMap((date) => (
    lineSummary.map((row) => ({
      date,
      lineId: row.lineId,
      abnormalCount: getCount(date, row.lineId),
    }))
  ))

  return {
    filters: {
      startDate: filters.startDate,
      endDate: filters.endDate,
      lines: requestedLines,
    },
    options: {
      lines: availableLines,
      minDate: filters.minDate,
      maxDate: filters.maxDate,
      defaultStartDate: filters.defaultStartDate,
      defaultEndDate: filters.defaultEndDate,
    },
    summary: {
      totalAbnormalCount,
      abnormalLineCount: lineSummary.filter((row) => row.totalCount > 0).length,
      latestDate,
      latestDateTime,
      latestDateCount,
      topLine: topLineRow?.lineId ?? null,
      topLineCount: topLineRow?.totalCount ?? 0,
      previousDate: hasPreviousData ? previousDate : null,
      previousDateTime: hasPreviousData ? comparisonDateTime : null,
      changeFromPreviousDay: previousDateCount === null ? null : latestDateCount - previousDateCount,
      monitoringSensorTotal: normalizeNumber(filters.monitoringSensorTotal),
      abGradeCount: sumGradeCount(["A", "B"]),
      dGradeCount: sumGradeCount(["D"]),
      nGradeCount: sumGradeCount(["N"]),
      mGradeCount: sumGradeCount(["M"]),
    },
    lineSummary,
    dailyTrend,
    meta: {
      filesRead: datedAggregates.length,
      comparisonFileRead: hasPreviousData,
      unmappedRows: datedAggregates.reduce((sum, item) => sum + item.unmappedRows, 0),
    },
  }
}

export function buildLineDashboardPayload(datedRows, mappingConfig, filters) {
  const sdwtLineLookup = buildSdwtLineLookup(mappingConfig)
  const rowsByDate = new Map()
  datedRows.forEach(({ dateTime, rows }) => {
    const date = normalizeText(dateTime).slice(0, 10)
    if (!parseDateParts(date)) return
    const item = rowsByDate.get(date) ?? { dateTime, rows: [] }
    item.rows.push(...rows)
    if (compareDateTexts(item.dateTime, dateTime) < 0) item.dateTime = dateTime
    rowsByDate.set(date, item)
  })

  const comparisonDateTime = normalizeText(filters.comparisonDateTime)
  const datedAggregates = Array.from(rowsByDate.values(), ({ dateTime, rows }) => ({
    dateTime,
    ...aggregateDashboardLineRows(rows, sdwtLineLookup),
  }))
  const comparisonAggregate = isValidDateTimeFileName(comparisonDateTime)
    ? aggregateDashboardLineRows(filters.comparisonRows ?? [], sdwtLineLookup)
    : null
  return buildLineDashboardPayloadFromAggregates(
    datedAggregates,
    comparisonAggregate,
    mappingConfig,
    filters,
  )
}

async function readParquetRows(filePath, columns) {
  const fileStat = await stat(filePath)
  const cached = getLruEntry(parquetCache, filePath)
  if (cached?.mtimeMs === fileStat.mtimeMs && cached?.size === fileStat.size) {
    return cached.rows
  }
  if (parquetPending.has(filePath)) return parquetPending.get(filePath)

  const pending = (async () => {
    const file = await asyncBufferFromFile(filePath)
    const rows = await parquetReadObjects({ file, columns, compressors })
    setLruEntry(
      parquetCache,
      filePath,
      { mtimeMs: fileStat.mtimeMs, size: fileStat.size, rows },
      PARQUET_CACHE_MAX_ENTRIES,
    )
    return rows
  })()
  parquetPending.set(filePath, pending)
  try {
    return await pending
  } finally {
    parquetPending.delete(filePath)
  }
}

async function readDashboardAggregate(fileInfo, mappingConfig, includeDetailSummary) {
  const fileStat = await stat(fileInfo.filePath)
  const cached = getLruEntry(dashboardAggregateCache, fileInfo.filePath)
  if (
    cached?.mtimeMs === fileStat.mtimeMs
    && cached?.size === fileStat.size
    && cached?.mappingConfig === mappingConfig
    && (!includeDetailSummary || cached.detailSummary)
  ) {
    return cached.aggregate
  }

  const pendingKey = `${fileInfo.filePath}\u0000${includeDetailSummary ? "detail" : "line"}`
  if (dashboardAggregatePending.has(pendingKey)) {
    return dashboardAggregatePending.get(pendingKey)
  }

  const pending = (async () => {
    const parquetFile = await asyncBufferFromFile(fileInfo.filePath)
    const rows = await parquetReadObjects({
      file: parquetFile,
      columns: DASHBOARD_DETAIL_COLUMNS,
      compressors,
    })
    const aggregate = {
      dateTime: fileInfo.dateTime,
      ...aggregateDashboardLineRows(rows, buildSdwtLineLookup(mappingConfig)),
      detailSummary: includeDetailSummary ? buildDashboardDetailSummary(rows) : null,
    }
    setLruEntry(
      dashboardAggregateCache,
      fileInfo.filePath,
      {
        mtimeMs: fileStat.mtimeMs,
        size: fileStat.size,
        mappingConfig,
        detailSummary: aggregate.detailSummary,
        aggregate,
      },
      DASHBOARD_AGGREGATE_CACHE_MAX_ENTRIES,
    )
    return aggregate
  })()
  dashboardAggregatePending.set(pendingKey, pending)
  try {
    return await pending
  } finally {
    dashboardAggregatePending.delete(pendingKey)
  }
}

async function mapWithConcurrency(items, mapper, concurrency = READ_CONCURRENCY) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return results
}

export async function listDashboardDateFiles(pathRoot = DASHBOARD_PATH_ROOT) {
  const rootStat = await stat(pathRoot)
  const cached = dashboardFileListCache.get(pathRoot)
  if (cached?.mtimeMs === rootStat.mtimeMs) return cached.files

  const entries = await readdir(pathRoot, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile() && isValidDateTimeFileName(entry.name))
    .map((entry) => ({ dateTime: entry.name, filePath: join(pathRoot, entry.name) }))
    .sort((left, right) => compareDateTexts(left.dateTime, right.dateTime))
  dashboardFileListCache.set(pathRoot, { mtimeMs: rootStat.mtimeMs, files })
  return files
}

export function selectLatestDashboardFilePerDate(dateFiles, startDate, endDate) {
  const latestByDate = new Map()
  dateFiles.forEach((file) => {
    const date = file.dateTime.slice(0, 10)
    if (date < startDate || date > endDate) return
    const current = latestByDate.get(date)
    if (!current || compareDateTexts(current.dateTime, file.dateTime) < 0) {
      latestByDate.set(date, file)
    }
  })
  return Array.from(latestByDate.values())
    .sort((left, right) => compareDateTexts(left.dateTime, right.dateTime))
}

async function readDashboardMapping() {
  const fileStat = await stat(mappingConfigPath)
  if (mappingCache?.mtimeMs === fileStat.mtimeMs && mappingCache?.size === fileStat.size) {
    return mappingCache.value
  }
  const value = await readLineMapping()
  mappingCache = { mtimeMs: fileStat.mtimeMs, size: fileStat.size, value }
  return value
}

export async function getLatestDashboardDate(pathRoot = DASHBOARD_PATH_ROOT) {
  const files = await listDashboardDateFiles(pathRoot)
  const latestDate = files.at(-1)?.dateTime
  if (latestDate) return latestDate
  throw createDashboardError(
    "DASHBOARD_LATEST_DATE_NOT_FOUND",
    `${pathRoot} 아래에 YYYY-MM-DD hh:mm:ss 형식의 파일이 없습니다.`,
  )
}

export async function getDashboardSummary(requestedFilters = {}) {
  const dateFiles = await listDashboardDateFiles()
  const dateRange = resolveDashboardDateRange(
    dateFiles.map((file) => file.dateTime),
    requestedFilters,
  )
  const selectedFiles = selectLatestDashboardFilePerDate(
    dateFiles,
    dateRange.startDate,
    dateRange.endDate,
  )
  const latestFile = selectedFiles.at(-1) ?? null
  const comparisonFile = latestFile
    ? selectPreviousDashboardFileAtSameTime(dateFiles, latestFile.dateTime)
    : null
  const filesToRead = Array.from(new Map(
    [...selectedFiles, ...(comparisonFile ? [comparisonFile] : [])]
      .map((file) => [file.dateTime, file]),
  ).values())
  const statsPath = latestFile ? buildDashboardStatsPath(latestFile.dateTime) : ""

  const mappingConfig = await readDashboardMapping()
  const [statsRows, fileAggregates] = await Promise.all([
    latestFile ? readParquetRows(statsPath, DASHBOARD_STATS_COLUMNS) : [],
    mapWithConcurrency(filesToRead, (file) => readDashboardAggregate(
      file,
      mappingConfig,
      file.dateTime === latestFile?.dateTime,
    )),
  ])

  const aggregatesByDateTime = new Map(
    fileAggregates.map((aggregate) => [aggregate.dateTime, aggregate]),
  )
  const emptyDetailSummary = buildDashboardDetailSummary([])
  const latestAggregate = latestFile ? aggregatesByDateTime.get(latestFile.dateTime) : null
  const datedAggregates = selectedFiles
    .map((file) => aggregatesByDateTime.get(file.dateTime))
    .filter(Boolean)
  const comparisonAggregate = comparisonFile
    ? aggregatesByDateTime.get(comparisonFile.dateTime) ?? null
    : null
  const requestedLines = requestedFilters.lines ?? []
  const baseSummary = buildDashboardSummaryFromDetailSummary(
    statsRows,
    latestAggregate?.detailSummary ?? emptyDetailSummary,
    {
    latestDate: latestFile?.dateTime ?? "",
    statsPath,
    detailPath: latestFile?.filePath ?? "",
    },
  )

  return {
    ...baseSummary,
    lineDashboard: buildLineDashboardPayloadFromAggregates(
      datedAggregates,
      comparisonAggregate,
      mappingConfig,
      {
        ...dateRange,
        lines: requestedLines,
        monitoringSensorTotal: baseSummary.metrics.monitoringSensorTotal,
        comparisonDateTime: comparisonFile?.dateTime ?? "",
      },
    ),
    sourcePaths: {
      ...baseSummary.sourcePaths,
      historyRoot: DASHBOARD_PATH_ROOT,
      mapping: mappingConfig.source_path,
    },
  }
}

function parseRequestFilters(url) {
  return {
    startDate: normalizeText(url.searchParams.get("startDate")),
    endDate: normalizeText(url.searchParams.get("endDate")),
    lines: url.searchParams.getAll("line").map(normalizeText).filter(Boolean),
  }
}

export async function handleDashboardDataRequest(req, res, requestUrl) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {
      Allow: "GET, HEAD",
      "Content-Type": "application/json; charset=utf-8",
    })
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }))
    return
  }

  try {
    const url = requestUrl ?? new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
    const payload = await getDashboardSummary(parseRequestFilters(url))
    if (req.method === "HEAD") {
      res.writeHead(200, { "Cache-Control": "no-store" })
      res.end()
      return
    }
    sendJson(res, 200, { ok: true, ...payload })
  } catch (error) {
    const statusCode = error.code === "DASHBOARD_LATEST_DATE_NOT_FOUND"
      ? 404
      : error.code === "DASHBOARD_INVALID_FILTER" ? 400 : 500
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

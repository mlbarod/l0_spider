import { createReadStream, existsSync, statSync } from "node:fs"
import { dirname, join, relative, resolve, sep } from "node:path"

import { asyncBufferFromFile, parquetReadObjects } from "hyparquet"
import { compressors } from "hyparquet-compressors"

import { buildTeamErdPath } from "../src/config/spiderDataPaths.mjs"

export const TEAM_ERD_COLUMNS = Object.freeze([
  "sdwt",
  "desc",
  "ver",
  "recipe_id",
  "priority",
  "sensor",
  "step",
  "eqp",
  "file_path",
  "line_rev",
])

const ERD_FILE_ROOT = "/appdata/abnormal_trend/pic/erd"
const ERD_BACKUP_ROOT = "/appdata/abnormal_trend/pic/backup"
const parquetCache = new Map()
const erdScatterCache = new Map()
const erdScatterPending = new Map()

const imageMimeTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

function assertPathSegment(name, value) {
  if (!value || value.includes("/") || value.includes("\\") || value.includes("..")) {
    throw new Error(`${name} 값이 올바르지 않습니다.`)
  }
}

function normalizeRow(row) {
  return Object.fromEntries(
    TEAM_ERD_COLUMNS.map((column) => {
      const value = row[column]
      return [column, value === null || value === undefined ? "" : String(value)]
    }),
  )
}

async function readTeamErdRows({ line, pathSdwt }) {
  assertPathSegment("line", line)
  assertPathSegment("pathSdwt", pathSdwt)

  const filePath = buildTeamErdPath({ line, sdwt: pathSdwt })
  const fileStat = statSync(filePath)
  const cached = parquetCache.get(filePath)

  if (cached?.mtimeMs === fileStat.mtimeMs && cached?.size === fileStat.size) {
    return { filePath, rows: cached.rows }
  }

  const file = await asyncBufferFromFile(filePath)
  const rows = (await parquetReadObjects({
    file,
    columns: TEAM_ERD_COLUMNS,
    compressors,
  })).map(normalizeRow)
  parquetCache.set(filePath, { mtimeMs: fileStat.mtimeMs, size: fileStat.size, rows })

  return { filePath, rows }
}

function uniqueCount(rows, column) {
  return new Set(rows.map((row) => row[column]).filter(Boolean)).size
}

function aggregateBy(rows, column, createRow) {
  const groups = new Map()

  rows.forEach((row) => {
    const value = row[column]
    if (!value) return
    const group = groups.get(value) ?? []
    group.push(row)
    groups.set(value, group)
  })

  return Array.from(groups, ([value, groupRows]) => createRow(value, groupRows))
}

function sortByRowCount(items, labelColumn) {
  return items.sort((left, right) => (
    right.rowCount - left.rowCount
    || left[labelColumn].localeCompare(right[labelColumn], "ko", { numeric: true })
  ))
}

function sortByLabel(items, labelColumn) {
  return items.sort((left, right) => (
    left[labelColumn].localeCompare(right[labelColumn], "ko", { numeric: true })
  ))
}

export function buildSelfEquipmentPayload(rows, filters) {
  const priorities = new Set(filters.priorities)
  const baseRows = rows.filter((row) => (
    row.line_rev === filters.line
    && row.sdwt === filters.sdwt
    && priorities.has(row.priority)
  ))
  const steps = sortByLabel(aggregateBy(baseRows, "desc", (desc, stepRows) => ({
    desc,
    rowCount: stepRows.length,
    equipmentCount: uniqueCount(stepRows, "eqp"),
  })), "desc")
  const selectedDesc = steps.some((item) => item.desc === filters.desc)
    ? filters.desc
    : ""
  const stepRows = selectedDesc
    ? baseRows.filter((row) => row.desc === selectedDesc)
    : []
  const sensors = sortByRowCount(aggregateBy(stepRows, "sensor", (sensor, sensorRows) => ({
    sensor,
    rowCount: sensorRows.length,
  })), "sensor")
  const selectedSensor = sensors.some((item) => item.sensor === filters.sensor)
    ? filters.sensor
    : ""
  const sensorRows = selectedSensor
    ? stepRows.filter((row) => row.sensor === selectedSensor)
    : []
  const chSteps = sortByRowCount(aggregateBy(sensorRows, "step", (step, chStepRows) => ({
    step,
    rowCount: chStepRows.length,
    equipmentCount: uniqueCount(chStepRows, "eqp"),
  })), "step")
  const selectedChStep = chSteps.some((item) => item.step === filters.chStep)
    ? filters.chStep
    : ""
  const chartRows = selectedChStep
    ? sensorRows.filter((row) => row.step === selectedChStep)
    : []

  return {
    filters: {
      line: filters.line,
      pathSdwt: filters.pathSdwt,
      sdwt: filters.sdwt,
      priorities: filters.priorities,
      desc: selectedDesc,
      sensor: selectedSensor,
      chStep: selectedChStep,
    },
    counts: {
      filteredRows: baseRows.length,
      chartRows: chartRows.length,
    },
    steps,
    sensors,
    chSteps,
    rows: chartRows.map((row, index) => ({ ...row, id: `${index}-${row.file_path}` })),
  }
}

function readFilters(url) {
  return {
    line: url.searchParams.get("line")?.trim() ?? "",
    pathSdwt: url.searchParams.get("pathSdwt")?.trim() ?? "",
    sdwt: url.searchParams.get("sdwt")?.trim() ?? "",
    priorities: url.searchParams.getAll("priority").map((value) => value.trim()).filter(Boolean),
    desc: url.searchParams.get("desc")?.trim() ?? "",
    sensor: url.searchParams.get("sensor")?.trim() ?? "",
    chStep: url.searchParams.get("chStep")?.trim() ?? "",
  }
}

export async function handleSelfEquipmentDataRequest(req, res, url) {
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

    const { filePath, rows } = await readTeamErdRows(filters)
    const payload = buildSelfEquipmentPayload(rows, filters)
    sendJson(res, 200, { ...payload, sourcePath: filePath })
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `분임조별 ERD 이상감지 경로 데이터를 불러오지 못했습니다: ${error.message}`,
    })
  }
}

export function resolveErdDataFilePath(imagePath) {
  const normalizedImagePath = imagePath.replaceAll("/pic_server2/", "/pic/")
  const resolvedInputPath = resolve(normalizedImagePath)
  const isDirectErdPath = resolvedInputPath.startsWith(`${ERD_FILE_ROOT}/`)
  const isBackupPath = resolvedInputPath.startsWith(`${ERD_BACKUP_ROOT}/`)

  if (!isDirectErdPath && !isBackupPath) {
    throw new Error("허용되지 않은 ERD 이미지 경로입니다.")
  }

  const pathSegments = isDirectErdPath
    ? relative(ERD_FILE_ROOT, resolvedInputPath).split(sep)
    : []

  return {
    filePath: join(dirname(resolvedInputPath), "data.parquet"),
    latestDate: pathSegments[0] ?? "",
    sensor: pathSegments[pathSegments.length - 3] ?? "",
    chStep: pathSegments[pathSegments.length - 2] ?? "",
  }
}

async function readErdScatterRows(filePath, axisColumn) {
  const fileStat = statSync(filePath)
  const cacheKey = `${filePath}\u0000${axisColumn}`
  const cached = erdScatterCache.get(cacheKey)

  if (cached?.mtimeMs === fileStat.mtimeMs && cached?.size === fileStat.size) {
    return cached.rows
  }

  if (erdScatterPending.has(cacheKey)) return erdScatterPending.get(cacheKey)

  const readPromise = (async () => {
    const file = await asyncBufferFromFile(filePath)
    const columns = ["act_time", "eqp_cb", "eqp_id", "disp_name", "wafer_id", axisColumn]
    const rows = await parquetReadObjects({ file, columns, compressors })
    erdScatterCache.set(cacheKey, { mtimeMs: fileStat.mtimeMs, size: fileStat.size, rows })
    return rows
  })()
  erdScatterPending.set(cacheKey, readPromise)

  try {
    return await readPromise
  } finally {
    erdScatterPending.delete(cacheKey)
  }
}

function normalizeText(value) {
  if (value === null || value === undefined) return ""
  if (value instanceof Date) return value.toISOString().replace("T", " ").replace("Z", "")
  return String(value)
}

function normalizeEqp(value) {
  return normalizeText(value).trim().replace(/\.png$/i, "")
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function buildErdScatterPayload(rows, { eqp, axisColumn, filePath, latestDate }) {
  const normalizedEqp = normalizeEqp(eqp)
  const points = rows.flatMap((row) => {
    if (normalizeEqp(row.eqp_cb) !== normalizedEqp) return []
    const actTime = normalizeText(row.act_time)
    const value = normalizeNumber(row[axisColumn])
    if (!actTime || value === null) return []

    return [{
      actTime,
      value,
      eqpId: normalizeText(row.eqp_id),
      dispName: normalizeText(row.disp_name),
      waferId: normalizeText(row.wafer_id),
    }]
  }).sort((left, right) => left.actTime.localeCompare(right.actTime))

  return {
    eqp: normalizedEqp,
    latestDate,
    axisColumn,
    sourcePath: filePath,
    pointCount: points.length,
    points,
  }
}

export async function handleErdScatterDataRequest(req, res, url) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  let sourcePath = ""

  try {
    const imagePath = url.searchParams.get("path")?.trim() ?? ""
    const eqp = url.searchParams.get("eqp")?.trim() ?? ""
    if (!imagePath || !eqp) {
      sendJson(res, 400, { ok: false, error: "path와 eqp 조건이 필요합니다." })
      return
    }

    const requestedSensor = url.searchParams.get("sensor")?.trim() ?? ""
    const requestedChStep = url.searchParams.get("chStep")?.trim() ?? ""
    const {
      filePath,
      latestDate,
      sensor: pathSensor,
      chStep: pathChStep,
    } = resolveErdDataFilePath(imagePath)
    sourcePath = filePath
    const sensor = requestedSensor || pathSensor
    const chStep = requestedChStep || pathChStep
    assertPathSegment("sensor", sensor)
    assertPathSegment("chStep", chStep)
    const axisColumn = `${sensor}_${chStep}`
    const rows = await readErdScatterRows(filePath, axisColumn)
    sendJson(res, 200, buildErdScatterPayload(rows, { eqp, axisColumn, filePath, latestDate }))
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: `ERD 이상감지 데이터를 불러오지 못했습니다: ${error.message}`,
      sourcePath,
    })
  }
}

export function handleErdFileRequest(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  const requestedPath = url.searchParams.get("path") ?? ""
  const filePath = resolve(requestedPath)
  const extension = filePath.slice(filePath.lastIndexOf(".")).toLowerCase()

  if (!filePath.startsWith(`${ERD_FILE_ROOT}/`) || !imageMimeTypes[extension]) {
    sendJson(res, 403, { ok: false, error: "허용되지 않은 ERD 이미지 경로입니다." })
    return
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    sendJson(res, 404, { ok: false, error: "ERD 이미지 파일이 없습니다." })
    return
  }

  res.writeHead(200, {
    "Content-Type": imageMimeTypes[extension],
    "Cache-Control": "no-cache",
  })

  if (req.method === "HEAD") {
    res.end()
    return
  }

  createReadStream(filePath).pipe(res)
}

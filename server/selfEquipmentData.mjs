import { createReadStream, existsSync, statSync } from "node:fs"
import { resolve } from "node:path"

import { asyncBufferFromFile, parquetReadObjects } from "hyparquet"

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
const parquetCache = new Map()

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
  const rows = (await parquetReadObjects({ file, columns: TEAM_ERD_COLUMNS })).map(normalizeRow)
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

export function buildSelfEquipmentPayload(rows, filters) {
  const priorities = new Set(filters.priorities)
  const baseRows = rows.filter((row) => (
    row.line_rev === filters.line
    && row.sdwt === filters.sdwt
    && priorities.has(row.priority)
  ))
  const steps = aggregateBy(baseRows, "desc", (desc, stepRows) => ({
    desc,
    rowCount: stepRows.length,
    equipmentCount: uniqueCount(stepRows, "eqp"),
  }))
  const selectedDesc = steps.some((item) => item.desc === filters.desc)
    ? filters.desc
    : (steps[0]?.desc ?? "")
  const stepRows = selectedDesc
    ? baseRows.filter((row) => row.desc === selectedDesc)
    : []
  const sensors = aggregateBy(stepRows, "sensor", (sensor, sensorRows) => ({
    sensor,
    rowCount: sensorRows.length,
  }))
  const selectedSensor = sensors.some((item) => item.sensor === filters.sensor)
    ? filters.sensor
    : (sensors[0]?.sensor ?? "")
  const chartRows = selectedSensor
    ? stepRows.filter((row) => row.sensor === selectedSensor)
    : []

  return {
    filters: {
      line: filters.line,
      pathSdwt: filters.pathSdwt,
      sdwt: filters.sdwt,
      priorities: filters.priorities,
      desc: selectedDesc,
      sensor: selectedSensor,
    },
    counts: {
      filteredRows: baseRows.length,
      chartRows: chartRows.length,
    },
    steps,
    sensors,
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

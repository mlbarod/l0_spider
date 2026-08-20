import { createReadStream } from "node:fs"
import { readdir, stat } from "node:fs/promises"
import { join, relative, resolve, sep } from "node:path"

import { getLatestCommonCommonalityPath } from "./latestCommonCommonalityPath.mjs"
import { createSafeApiError } from "./safeApiError.mjs"
import { excludeSensorRows, readSensorExclusionConfig } from "./sensorExclusionConfig.mjs"

const INDEX_CACHE_TTL_MS = 5 * 60 * 1000
const DIRECTORY_READ_CONCURRENCY = 64
const ALL_SENSORS = "ALL"
const ALL_CH_STEPS = "ALL"
const commonCommonalityIndexCache = new Map()
const commonCommonalityIndexPending = new Map()

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

function assertPathSegment(name, value) {
  if (!value || value.includes("/") || value.includes("\\") || value.includes("..")) {
    throw new Error(`${name} 값이 올바르지 않습니다.`)
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  if (!items.length) return []

  const results = new Array(items.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}

async function readChildDirectories(nodes, propertyName) {
  const childGroups = await mapWithConcurrency(
    nodes,
    DIRECTORY_READ_CONCURRENCY,
    async (node) => (await readdir(node.path, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        ...node,
        [propertyName]: entry.name,
        path: join(node.path, entry.name),
      })),
  )
  return childGroups.flat()
}

async function isRegularFile(filePath) {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

function splitSensorChStep(folderName) {
  const delimiterIndex = folderName.indexOf("@")
  if (delimiterIndex <= 0 || delimiterIndex === folderName.length - 1) return null
  return {
    sensor: folderName.slice(0, delimiterIndex),
    chStep: folderName.slice(delimiterIndex + 1),
  }
}

export async function collectCommonCommonalityRows(sdwtPath, latestPath, sdwt) {
  let nodes = [{ path: sdwtPath }]
  nodes = await readChildDirectories(nodes, "eqpModel")
  nodes = await readChildDirectories(nodes, "grade")
  nodes = await readChildDirectories(nodes, "sensorChStep")

  return nodes.flatMap((node) => {
    const parsed = splitSensorChStep(node.sensorChStep)
    if (!parsed) return []
    const filePath = join(node.path, "img.png")
    return [{
      id: relative(latestPath.path, filePath).split(sep).join("/"),
      latestDate: latestPath.date,
      sdwt,
      eqpModel: node.eqpModel,
      grade: node.grade,
      sensor: parsed.sensor,
      chStep: parsed.chStep,
      filePath,
    }]
  })
}

async function resolveSdwtPath(latestPath, pathSdwt, displaySdwt) {
  const candidates = Array.from(new Set([pathSdwt, displaySdwt].map(normalizeText).filter(Boolean)))
  for (const candidate of candidates) {
    assertPathSegment("SDWT", candidate)
    const candidatePath = join(latestPath.path, candidate)
    try {
      if ((await stat(candidatePath)).isDirectory()) {
        return { sdwtPath: candidatePath, folderSdwt: candidate }
      }
    } catch {
      // 다음 SDWT 후보를 확인한다.
    }
  }

  const error = new Error(
    `선택한 SDWT의 공통부 동일성 이상감지 폴더를 찾지 못했습니다: ${candidates.join(" 또는 ")}`,
  )
  error.code = "COMMON_COMMONALITY_SDWT_DIRECTORY_NOT_FOUND"
  throw error
}

async function getCommonCommonalityIndex({ pathSdwt, sdwt }, { rootPath } = {}) {
  const latestPath = rootPath
    ? await getLatestCommonCommonalityPath(rootPath)
    : await getLatestCommonCommonalityPath()
  const { sdwtPath, folderSdwt } = await resolveSdwtPath(latestPath, pathSdwt, sdwt)
  const cacheKey = `${latestPath.path}\u0000${sdwtPath}`
  const cached = commonCommonalityIndexCache.get(cacheKey)
  if (cached?.expiresAt > Date.now()) {
    return { latestPath, folderSdwt, rows: cached.rows }
  }

  if (commonCommonalityIndexPending.has(cacheKey)) {
    const rows = await commonCommonalityIndexPending.get(cacheKey)
    return { latestPath, folderSdwt, rows }
  }

  const indexPromise = collectCommonCommonalityRows(sdwtPath, latestPath, folderSdwt)
  commonCommonalityIndexPending.set(cacheKey, indexPromise)
  try {
    const rows = await indexPromise
    commonCommonalityIndexCache.forEach((entry, key) => {
      if (entry.expiresAt <= Date.now()) commonCommonalityIndexCache.delete(key)
    })
    commonCommonalityIndexCache.set(cacheKey, {
      rows,
      expiresAt: Date.now() + INDEX_CACHE_TTL_MS,
    })
    return { latestPath, folderSdwt, rows }
  } finally {
    commonCommonalityIndexPending.delete(cacheKey)
  }
}

function sortValues(values) {
  return Array.from(new Set(values.filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, "ko", { numeric: true }))
}

export function buildCommonCommonalityFilterPayload(index, filters) {
  const eqpModels = sortValues(index.rows.map((row) => row.eqpModel))
  const selectedEqpModel = eqpModels.includes(filters.eqpModel) ? filters.eqpModel : ""
  const eqpModelRows = selectedEqpModel
    ? index.rows.filter((row) => row.eqpModel === selectedEqpModel)
    : []
  const sensors = sortValues(eqpModelRows.map((row) => row.sensor))
  const selectedSensor = filters.sensor === ALL_SENSORS && sensors.length
    ? ALL_SENSORS
    : sensors.includes(filters.sensor) ? filters.sensor : ""
  const sensorRows = selectedSensor === ALL_SENSORS
    ? eqpModelRows
    : selectedSensor
    ? eqpModelRows.filter((row) => row.sensor === selectedSensor)
    : []
  const sensorChSteps = sortValues(sensorRows.map((row) => row.chStep))
  const chSteps = selectedSensor === ALL_SENSORS && sensorChSteps.length
    ? [ALL_CH_STEPS]
    : sensorChSteps
  const selectedChStep = filters.chStep === ALL_CH_STEPS && sensorChSteps.length
    ? ALL_CH_STEPS
    : selectedSensor !== ALL_SENSORS && sensorChSteps.includes(filters.chStep)
    ? filters.chStep
    : ""
  const rows = selectedChStep === ALL_CH_STEPS
    ? sensorRows
    : selectedChStep
    ? sensorRows.filter((row) => row.chStep === selectedChStep)
    : []

  return {
    latest: index.latestPath,
    filters: {
      line: filters.line,
      pathSdwt: filters.pathSdwt,
      sdwt: filters.sdwt,
      folderSdwt: index.folderSdwt,
      eqpModel: selectedEqpModel,
      sensor: selectedSensor,
      chStep: selectedChStep,
    },
    eqpModels,
    sensors,
    chSteps,
    counts: {
      indexedImages: index.rows.length,
      filteredImages: rows.length,
    },
    rows,
  }
}

export async function handleCommonCommonalityDataRequest(req, res, url, options = {}) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  try {
    const filters = {
      line: normalizeText(url.searchParams.get("line")),
      pathSdwt: normalizeText(url.searchParams.get("pathSdwt")),
      sdwt: normalizeText(url.searchParams.get("sdwt")),
      eqpModel: normalizeText(url.searchParams.get("eqpModel")),
      sensor: normalizeText(url.searchParams.get("sensor")),
      chStep: normalizeText(url.searchParams.get("chStep")),
    }
    if (!filters.line || !filters.pathSdwt || !filters.sdwt) {
      sendJson(res, 400, { ok: false, error: "line, pathSdwt, sdwt 조건이 필요합니다." })
      return
    }

    const [index, sensorExclusionConfig] = await Promise.all([
      getCommonCommonalityIndex(filters, options),
      readSensorExclusionConfig(),
    ])
    const sensorExclusion = excludeSensorRows(
      index.rows,
      sensorExclusionConfig,
      "commonCommonalityAnomaly",
    )
    const payload = buildCommonCommonalityFilterPayload(
      { ...index, rows: sensorExclusion.rows },
      filters,
    )
    sendJson(res, 200, {
      ...payload,
      counts: {
        ...payload.counts,
        indexedImages: index.rows.length,
        excludedSensorImages: sensorExclusion.excludedCount,
      },
    })
  } catch (error) {
    const latestDateNotFound = error.code === "COMMONALITY_DATE_DIRECTORY_NOT_FOUND"
    const sdwtNotFound = error.code === "COMMON_COMMONALITY_SDWT_DIRECTORY_NOT_FOUND"
    const statusCode = latestDateNotFound || sdwtNotFound ? 404 : 500
    sendJson(res, statusCode, createSafeApiError({
      code: latestDateNotFound
        ? "COMMON_COMMONALITY_LATEST_DATE_NOT_FOUND"
        : sdwtNotFound
        ? "COMMON_COMMONALITY_SDWT_NOT_FOUND"
        : "COMMON_COMMONALITY_DATA_LOAD_FAILED",
      message: latestDateNotFound
        ? "공통부 동일성 최신날짜 폴더를 찾지 못했습니다."
        : sdwtNotFound
        ? "선택한 SDWT의 공통부 동일성 폴더를 찾지 못했습니다."
        : "공통부 동일성 데이터를 불러오지 못했습니다.",
      scope: "common-commonality-data",
    }))
  }
}

export async function handleCommonCommonalityImageRequest(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  const requestedPath = normalizeText(url.searchParams.get("path"))
  try {
    const latestPath = await getLatestCommonCommonalityPath()
    const resolvedPath = resolve(requestedPath)
    if (!resolvedPath.startsWith(`${latestPath.path}${sep}`) || !resolvedPath.endsWith(`${sep}img.png`)) {
      sendJson(res, 403, { ok: false, error: "허용되지 않은 공통부 동일성 이미지 경로입니다." })
      return
    }
    if (!await isRegularFile(resolvedPath)) {
      sendJson(res, 404, createSafeApiError({
        code: "COMMON_COMMONALITY_IMAGE_NOT_FOUND",
        message: "공통부 동일성 이미지 파일을 찾지 못했습니다.",
        scope: "common-commonality-image",
      }))
      return
    }

    res.writeHead(200, {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    })
    if (req.method === "HEAD") {
      res.end()
      return
    }
    createReadStream(resolvedPath).pipe(res)
  } catch {
    sendJson(res, 500, createSafeApiError({
      code: "COMMON_COMMONALITY_IMAGE_LOAD_FAILED",
      message: "공통부 동일성 이미지를 불러오지 못했습니다.",
      scope: "common-commonality-image",
    }))
  }
}

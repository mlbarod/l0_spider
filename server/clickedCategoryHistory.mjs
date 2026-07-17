import { spawn } from "node:child_process"
import { relative, resolve, sep } from "node:path"
import { fileURLToPath, URL } from "node:url"

import { getRemoteIp, resolveCurrentUser } from "./currentUser.mjs"
import { parsePassHistoryPath } from "./passHistory.mjs"

const COMMON_FILE_ROOT = "/appdata/abnormal_trend/pic/common"
const helperPath = fileURLToPath(new URL("../scripts/clicked_category_history.py", import.meta.url))
const SUPPORTED_APPS = new Set(["self", "commonality", "common"])

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

function uniqueValues(values) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)))
}

function formatList(values) {
  return `[${values.map((value) => `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`).join(", ")}]`
}

function formatCategory(values, alwaysList = false) {
  const unique = uniqueValues(values)
  if (!unique.length) throw new Error("클릭이력 카테고리 값을 찾지 못했습니다.")
  return alwaysList || unique.length > 1 ? formatList(unique) : unique[0]
}

function parseCommonPath(filePath) {
  const normalizedPath = normalizeText(filePath).replaceAll("pic_server2", "pic")
  const resolvedPath = resolve(normalizedPath)
  if (!resolvedPath.startsWith(`${COMMON_FILE_ROOT}${sep}`)) {
    throw new Error("허용되지 않은 공통부 Drawing 경로입니다.")
  }
  const segments = relative(COMMON_FILE_ROOT, resolvedPath).split(sep)
  if (segments.length !== 7 || segments.at(-1) !== "data.parquet") {
    throw new Error("공통부 Drawing 경로 형식이 올바르지 않습니다.")
  }
  const [, sdwt, , grade, sensor] = segments
  return { sdwt, grade, sensor }
}

function parseCommonalityPath(filePath) {
  const segments = resolve(normalizeText(filePath)).split(sep).filter(Boolean)
  if (segments.length < 8 || segments.at(-1) !== "img.png") {
    throw new Error("동일성 Drawing 경로 형식이 올바르지 않습니다.")
  }
  const [sdwt, grade, , , ppid, duplicatePpid, sensorChStep] = segments.slice(-8, -1)
  if (ppid !== duplicatePpid) throw new Error("동일성 Drawing 경로의 PPID가 올바르지 않습니다.")
  const delimiterIndex = sensorChStep.lastIndexOf("_")
  if (delimiterIndex <= 0) throw new Error("동일성 Drawing 경로에서 sensor를 찾지 못했습니다.")
  return { sdwt, grade, sensor: sensorChStep.slice(0, delimiterIndex) }
}

function parseDrawingPath(app, filePath) {
  if (app === "self") {
    const values = parsePassHistoryPath(filePath)
    return { sdwt: values.sdwt, grade: values.priority, sensor: values.sensor }
  }
  return app === "common" ? parseCommonPath(filePath) : parseCommonalityPath(filePath)
}

export function buildClickedCategoryHistoryRecord({
  app,
  lineId,
  filePaths,
  grades = [],
  clickedAt = "",
  knoxId,
}) {
  const normalizedApp = normalizeText(app)
  const normalizedLineId = normalizeText(lineId)
  const paths = uniqueValues(Array.isArray(filePaths) ? filePaths : [])
  if (!SUPPORTED_APPS.has(normalizedApp)) throw new Error("클릭이력 App 구분값이 올바르지 않습니다.")
  if (!normalizedLineId) throw new Error("Line Name이 필요합니다.")
  if (!paths.length) throw new Error("Chart Drawing 경로가 필요합니다.")

  const pathValues = paths.map((filePath) => parseDrawingPath(normalizedApp, filePath))
  const suffix = normalizedApp === "commonality" ? "(g)" : normalizedApp === "common" ? "(c)" : ""
  const requestedGrades = normalizedApp === "self" && Array.isArray(grades) && grades.length
    ? grades
    : pathValues.map((values) => values.grade)

  return {
    lineId: `${normalizedLineId}${suffix}`,
    sdwt: formatCategory(pathValues.map((values) => values.sdwt)),
    grade: formatCategory(requestedGrades, normalizedApp === "self"),
    sensor: formatCategory(pathValues.map((values) => values.sensor)),
    updateDate: normalizeText(clickedAt),
    knoxId: normalizeText(knoxId),
  }
}

async function readJsonBody(req) {
  let body = ""
  for await (const chunk of req) {
    body += chunk
    if (body.length > 2 * 1024 * 1024) throw new Error("요청 데이터가 너무 큽니다.")
  }
  if (!body.trim()) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new Error("요청 JSON이 올바르지 않습니다.")
  }
}

function runHelper(payload) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("python3", ["-B", helperPath], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => child.kill("SIGTERM"), 10_000)
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", () => {
      clearTimeout(timeout)
      let result
      try {
        result = JSON.parse(stdout.trim())
      } catch {
        reject(new Error(stderr.trim() || "클릭이력 응답을 해석하지 못했습니다."))
        return
      }
      if (!result.ok) {
        if (stderr.trim()) console.error(`[clicked-category-history] ${stderr.trim()}`)
        reject(new Error(result.error || "클릭이력을 저장하지 못했습니다."))
        return
      }
      resolvePromise(result)
    })
    child.stdin.end(JSON.stringify(payload))
  })
}

export async function handleClickedCategoryHistoryRequest(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }
  try {
    const remoteIp = getRemoteIp(req)
    if (!remoteIp) {
      sendJson(res, 400, { ok: false, error: "접속자 IP를 확인하지 못했습니다." })
      return
    }
    const [body, currentUser] = await Promise.all([readJsonBody(req), resolveCurrentUser(remoteIp)])
    const record = buildClickedCategoryHistoryRecord({ ...body, knoxId: currentUser.knoxId })
    sendJson(res, 200, await runHelper(record))
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message })
  }
}

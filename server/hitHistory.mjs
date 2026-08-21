import { spawn } from "node:child_process"
import { isAbsolute, relative, resolve, sep } from "node:path"
import { fileURLToPath, URL } from "node:url"

import { getRemoteIp, resolveCurrentUser } from "./currentUser.mjs"
import { commonCommonalityRootPath } from "./latestCommonCommonalityPath.mjs"
import { commonalityRootPath } from "./latestCommonalityPath.mjs"
import { parsePassHistoryPath } from "./passHistory.mjs"
import { createSafeApiError } from "./safeApiError.mjs"

const helperPath = fileURLToPath(new URL("../scripts/hit_history.py", import.meta.url))

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

const COMMON_ANOMALY_ROOT = "/appdata/abnormal_trend/pic/common"
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

function isValidDateParts(match) {
  if (!match) return false
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ))
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day)
    && date.getUTCHours() === Number(hour)
    && date.getUTCMinutes() === Number(minute)
    && date.getUTCSeconds() === Number(second)
}

function isValidDateOnly(value) {
  return isValidDateParts(normalizeText(value).match(DATE_ONLY_PATTERN))
}

function isValidDateTime(value) {
  return isValidDateParts(normalizeText(value).match(DATE_TIME_PATTERN))
}

function assertSafeAbsolutePath(filePath) {
  if (!isAbsolute(filePath)) throw new Error("Chart 파일 경로는 절대 경로여야 합니다.")
  if (filePath.slice(1).split(/[\\/]/).some((segment) => segment === "")) {
    throw new Error("Chart 파일 경로에 빈 segment가 있습니다.")
  }
  if (filePath.split(/[\\/]/).some((segment) => segment === "." || segment === "..")) {
    throw new Error("Chart 파일 경로에 허용되지 않은 segment가 있습니다.")
  }
}

function hasRequiredSegments(segments) {
  return segments.every((segment) => normalizeText(segment))
}

function parsePathSegments(filePath, rootPath) {
  const normalizedRoot = resolve(normalizeText(rootPath).replaceAll("/pic_server2/", "/pic/"))
  const normalizedFile = resolve(filePath)
  if (!normalizedFile.startsWith(`${normalizedRoot}${sep}`)) return null
  return relative(normalizedRoot, normalizedFile).split(sep).filter(Boolean)
}

export function parseHitHistoryPath(filePath, {
  commonalityRoot = commonalityRootPath,
  commonCommonalityRoot = commonCommonalityRootPath,
} = {}) {
  const originalPath = normalizeText(filePath)
  assertSafeAbsolutePath(originalPath)
  const normalizedPath = originalPath.replaceAll("/pic_server2/", "/pic/")

  const commonSegments = parsePathSegments(normalizedPath, COMMON_ANOMALY_ROOT)
  if (commonSegments) {
    const imageName = commonSegments.at(-1) ?? ""
    if (commonSegments.length !== 7
      || !hasRequiredSegments(commonSegments)
      || (!isValidDateOnly(commonSegments[0]) && !isValidDateTime(commonSegments[0]))
      || !imageName.toLowerCase().endsWith(".png")
      || imageName.slice(0, -".png".length).trim() === "") {
      throw new Error("공통부 이상감지 결과 경로에서 HIT 이력 정보를 찾지 못했습니다.")
    }
    return { updateDate: commonSegments[0], sdwt: commonSegments[1] }
  }

  const commonalitySegments = parsePathSegments(normalizedPath, commonalityRoot)
  if (commonalitySegments) {
    const sensorChStep = commonalitySegments[7] ?? ""
    const delimiterIndex = sensorChStep.lastIndexOf("_")
    if (commonalitySegments.length !== 9
      || !hasRequiredSegments(commonalitySegments)
      || !isValidDateTime(commonalitySegments[0])
      || commonalitySegments[6] !== commonalitySegments[5]
      || delimiterIndex <= 0
      || delimiterIndex === sensorChStep.length - 1
      || commonalitySegments.at(-1) !== "img.png") {
      throw new Error("동일성 이상감지 결과 경로에서 HIT 이력 정보를 찾지 못했습니다.")
    }
    return { updateDate: commonalitySegments[0], sdwt: commonalitySegments[1] }
  }

  const commonCommonalitySegments = parsePathSegments(normalizedPath, commonCommonalityRoot)
  if (commonCommonalitySegments) {
    const sensorChStep = commonCommonalitySegments[4] ?? ""
    const delimiterIndex = sensorChStep.indexOf("@")
    if (commonCommonalitySegments.length !== 6
      || !hasRequiredSegments(commonCommonalitySegments)
      || !isValidDateOnly(commonCommonalitySegments[0])
      || delimiterIndex <= 0
      || delimiterIndex === sensorChStep.length - 1
      || commonCommonalitySegments.at(-1) !== "img.png") {
      throw new Error("공통부 동일성 이상감지 결과 경로에서 HIT 이력 정보를 찾지 못했습니다.")
    }
    return { updateDate: commonCommonalitySegments[0], sdwt: commonCommonalitySegments[1] }
  }

  const { updateDate, sdwt } = parsePassHistoryPath(normalizedPath)
  if (!isValidDateOnly(updateDate) && !isValidDateTime(updateDate)) {
    throw new Error("ERD 차트 경로의 날짜가 올바르지 않습니다.")
  }
  return { updateDate, sdwt }
}

async function readJsonBody(req) {
  let body = ""
  for await (const chunk of req) {
    body += chunk
    if (body.length > 64 * 1024) throw new Error("요청 데이터가 너무 큽니다.")
  }
  if (!body.trim()) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new Error("요청 JSON이 올바르지 않습니다.")
  }
}

function runHitHistoryHelper(payload) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("python3", ["-B", helperPath], {
      env: process.env,
      stdio: ["pipe", "pipe", "ignore"],
    })
    let stdout = ""
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, 10_000)

    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", () => {
      clearTimeout(timeout)
      if (timedOut) {
        reject(new Error("HIT 이력 저장 시간이 초과되었습니다."))
        return
      }

      let result
      try {
        result = JSON.parse(stdout.trim())
      } catch {
        reject(new Error("HIT 이력 응답을 해석하지 못했습니다."))
        return
      }
      if (!result.ok) {
        reject(new Error(result.error || "HIT 이력을 저장하지 못했습니다."))
        return
      }
      resolvePromise(result)
    })

    child.stdin.end(JSON.stringify(payload))
  })
}

export function buildHitHistoryRecord({
  lineId,
  filePath,
  knoxId,
  execDate = "",
}) {
  const normalizedLineId = normalizeText(lineId)
  const originalFilePath = normalizeText(filePath)
  if (!normalizedLineId) throw new Error("Line Name이 필요합니다.")
  if (!originalFilePath) throw new Error("Chart 파일 경로가 필요합니다.")

  const parsedPath = parseHitHistoryPath(originalFilePath)
  return {
    updateDate: parsedPath.updateDate,
    lineId: normalizedLineId,
    sdwt: parsedPath.sdwt,
    filePath: originalFilePath.replaceAll("/", "#"),
    knoxId: normalizeText(knoxId),
    execDate: normalizeText(execDate),
  }
}

export async function handleHitHistoryRequest(req, res) {
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
    const [body, currentUser] = await Promise.all([
      readJsonBody(req),
      resolveCurrentUser(remoteIp),
    ])
    const record = buildHitHistoryRecord({
      ...body,
      knoxId: currentUser.knoxId,
    })
    const result = await runHitHistoryHelper(record)
    sendJson(res, 200, result)
  } catch {
    sendJson(res, 500, createSafeApiError({
      code: "HIT_HISTORY_REQUEST_FAILED",
      message: "HIT 이력 요청을 처리하지 못했습니다.",
      scope: "hit-history",
    }))
  }
}

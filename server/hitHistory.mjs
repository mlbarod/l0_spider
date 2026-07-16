import { spawn } from "node:child_process"
import { fileURLToPath, URL } from "node:url"

import { getRemoteIp, resolveCurrentUser } from "./currentUser.mjs"
import { parsePassHistoryPath } from "./passHistory.mjs"

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
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, 10_000)

    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
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
        reject(new Error(stderr.trim() || "HIT 이력 응답을 해석하지 못했습니다."))
        return
      }
      if (!result.ok) {
        if (stderr.trim()) console.error(`[hit-history] ${stderr.trim()}`)
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

  const parsedPath = parsePassHistoryPath(originalFilePath)
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
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message })
  }
}

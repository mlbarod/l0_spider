import { spawn } from "node:child_process"
import { relative, resolve, sep } from "node:path"
import { fileURLToPath, URL } from "node:url"

import { getRemoteIp, resolveCurrentUser } from "./currentUser.mjs"

const ERD_FILE_ROOT = "/appdata/abnormal_trend/pic/erd"
const helperPath = fileURLToPath(new URL("../scripts/pass_history.py", import.meta.url))

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

function normalizeEqp(value) {
  return normalizeText(value).replace(/\.png$/i, "")
}

export function parsePassHistoryPath(filePath) {
  const normalizedPath = normalizeText(filePath).replaceAll("/pic_server2/", "/pic/")
  const resolvedPath = resolve(normalizedPath)
  if (!resolvedPath.startsWith(`${ERD_FILE_ROOT}/`)) {
    throw new Error("허용되지 않은 ERD 차트 경로입니다.")
  }

  const segments = relative(ERD_FILE_ROOT, resolvedPath).split(sep)
  if (segments.length < 9) throw new Error("ERD 차트 경로에서 PASS 이력 정보를 찾지 못했습니다.")

  const [updateDate, sdwt, desc, ver, recipeId, priority, sensor, step] = segments
  const eqp = normalizeEqp(segments.at(-1))
  const required = { updateDate, sdwt, desc, ver, recipeId, priority, sensor, step, eqp }
  if (Object.values(required).some((value) => !value)) {
    throw new Error("ERD 차트 경로의 PASS 이력 정보가 올바르지 않습니다.")
  }

  return required
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

function runPassHistoryHelper(action, payload) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("python3", ["-B", helperPath, action], {
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
        reject(new Error("PASS 이력 처리 시간이 초과되었습니다."))
        return
      }

      let result
      try {
        result = JSON.parse(stdout.trim())
      } catch {
        reject(new Error(stderr.trim() || "PASS 이력 응답을 해석하지 못했습니다."))
        return
      }
      if (!result.ok) {
        if (stderr.trim()) console.error(`[pass-history] ${stderr.trim()}`)
        reject(new Error(result.error || "PASS 이력을 처리하지 못했습니다."))
        return
      }
      resolvePromise(result)
    })

    child.stdin.end(JSON.stringify(payload))
  })
}

function buildRecord({ lineId, filePath, knoxId, comment = "", execDate = "" }) {
  const normalizedLineId = normalizeText(lineId)
  if (!normalizedLineId) throw new Error("Line Name이 필요합니다.")

  return {
    lineId: normalizedLineId,
    ...parsePassHistoryPath(filePath),
    knoxId: normalizeText(knoxId),
    execDate: normalizeText(execDate),
    comment: String(comment ?? ""),
  }
}

export async function handlePassHistoryRequest(req, res, url) {
  try {
    const remoteIp = getRemoteIp(req)
    if (!remoteIp) {
      sendJson(res, 400, { ok: false, error: "접속자 IP를 확인하지 못했습니다." })
      return
    }
    const currentUser = await resolveCurrentUser(remoteIp)

    if (req.method === "GET") {
      const lineId = normalizeText(url.searchParams.get("lineId"))
      if (!lineId) {
        sendJson(res, 400, { ok: false, error: "Line Name이 필요합니다." })
        return
      }
      const result = await runPassHistoryHelper("list", {
        lineId,
        sdwt: normalizeText(url.searchParams.get("sdwt")),
        desc: normalizeText(url.searchParams.get("desc")),
      })
      sendJson(res, 200, result)
      return
    }

    if (req.method === "POST" || req.method === "DELETE") {
      const body = await readJsonBody(req)
      const record = buildRecord({ ...body, knoxId: currentUser.knoxId })
      const result = await runPassHistoryHelper(req.method === "POST" ? "insert" : "delete", record)
      sendJson(res, 200, result)
      return
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message })
  }
}

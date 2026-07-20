import { spawn } from "node:child_process"
import { fileURLToPath, URL } from "node:url"

const helperPath = fileURLToPath(new URL("../scripts/mailing_registration.py", import.meta.url))
const MAX_KNOX_ID_LENGTH = 128
const MAX_SDWT_COUNT = 500
const MAX_SDWT_LENGTH = 160

export const MAILING_PRIORITIES = Object.freeze(["A", "B", "D", "M", "N"])

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

function uniqueTextValues(values) {
  if (!Array.isArray(values)) return []
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)))
}

function normalizeKnoxId(value) {
  const text = normalizeText(value)
  const knoxId = text.includes("@") ? text.slice(0, text.indexOf("@")) : text
  if (!knoxId) throw new Error("knox_id를 입력해야 합니다.")
  if (knoxId.length > MAX_KNOX_ID_LENGTH || !/^[A-Za-z0-9._-]+$/.test(knoxId)) {
    throw new Error("knox_id 형식이 올바르지 않습니다.")
  }
  return knoxId
}

async function readJsonBody(req) {
  let body = ""
  for await (const chunk of req) {
    body += chunk
    if (body.length > 1024 * 1024) throw new Error("요청 데이터가 너무 큽니다.")
  }
  if (!body.trim()) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new Error("요청 JSON이 올바르지 않습니다.")
  }
}

export function buildMailingRegistrationPayload(body) {
  const knoxId = normalizeKnoxId(body?.knoxId)
  const sdwts = uniqueTextValues(body?.sdwts)

  if (!sdwts.length || sdwts.length > MAX_SDWT_COUNT) {
    throw new Error(`SDWT는 1개 이상 ${MAX_SDWT_COUNT}개 이하로 선택해야 합니다.`)
  }
  if (sdwts.some((sdwt) => sdwt.length > MAX_SDWT_LENGTH)) {
    throw new Error(`SDWT 값은 ${MAX_SDWT_LENGTH}자 이하여야 합니다.`)
  }

  return {
    knoxId,
    sdwts,
    priorities: [...MAILING_PRIORITIES],
  }
}

export function buildMailingDeletePayload(body) {
  const payload = buildMailingRegistrationPayload(body)
  const line = normalizeText(body?.line)
  if (!line) throw new Error("삭제할 Line Name이 필요합니다.")
  return { ...payload, line }
}

export function normalizeMailingRecords(records) {
  if (!Array.isArray(records)) return []

  return records.map((record, index) => ({
    id: `${normalizeText(record?.email)}-${index}`,
    knoxId: normalizeText(record?.email),
    sdwts: uniqueTextValues(record?.sdwt),
    priorities: uniqueTextValues(record?.priority),
  })).filter((record) => record.knoxId && record.sdwts.length && record.priorities.length)
}

export function buildMailingDebugRow(payload) {
  return {
    email: payload.knoxId,
    sdwt: JSON.stringify(payload.sdwts),
    priority: JSON.stringify(payload.priorities),
  }
}

function runMailingHelper(action, payload) {
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
    }, 15_000)

    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", () => {
      clearTimeout(timeout)
      if (timedOut) {
        reject(new Error("Mailing 기준정보 처리 시간이 초과되었습니다."))
        return
      }

      let result
      try {
        result = JSON.parse(stdout.trim())
      } catch {
        reject(new Error(stderr.trim() || "Mailing DB 응답을 해석하지 못했습니다."))
        return
      }
      if (!result.ok) {
        if (stderr.trim()) console.error(`[mailing-registration] ${stderr.trim()}`)
        const error = new Error(result.error || "Mailing 기준정보를 처리하지 못했습니다.")
        error.dbErrorCode = result.dbErrorCode
        error.dbErrorDetail = result.dbErrorDetail
        reject(error)
        return
      }
      resolvePromise(result)
    })
    child.stdin.end(JSON.stringify(payload))
  })
}

export async function handleMailingRegistrationRequest(req, res, url) {
  if (!new Set(["GET", "POST", "DELETE"]).has(req.method)) {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  let debugRow = null
  try {
    if (req.method === "GET") {
      const knoxId = normalizeKnoxId(url.searchParams.get("knoxId"))
      const result = await runMailingHelper("list", { knoxId })
      sendJson(res, 200, {
        ok: true,
        registrations: normalizeMailingRecords(result.records),
      })
      return
    }

    const body = await readJsonBody(req)
    if (req.method === "DELETE") {
      const payload = buildMailingDeletePayload(body)
      const result = await runMailingHelper("delete_line", payload)
      sendJson(res, 200, result)
      return
    }

    const payload = buildMailingRegistrationPayload(body)
    debugRow = buildMailingDebugRow(payload)
    const result = await runMailingHelper("insert", payload)
    sendJson(res, 200, {
      ...result,
      registration: {
        knoxId: payload.knoxId,
        sdwts: payload.sdwts,
        priorities: payload.priorities,
      },
    })
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message,
      table: "email",
      debugRow,
      dbErrorCode: error.dbErrorCode,
      dbErrorDetail: error.dbErrorDetail,
    })
  }
}

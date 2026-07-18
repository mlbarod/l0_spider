import { spawn } from "node:child_process"
import { fileURLToPath, URL } from "node:url"

import { getRemoteIp, resolveCurrentUser } from "./currentUser.mjs"

const helperPath = fileURLToPath(new URL("../scripts/my_eqp_registration.py", import.meta.url))
const MAX_EQP_COUNT = 500
const MAX_COMMENT_LENGTH = 90

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

function formatDatabaseTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0")
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function normalizeDatabaseTimestamp(value) {
  const text = normalizeText(value)
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/)
  return match ? `${match[1]} ${match[2]}` : text
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

export function buildMyEqpRegistrationPayload(body, knoxId) {
  const line = normalizeText(body?.line)
  const sdwt = normalizeText(body?.sdwt)
  const prcGroup = normalizeText(body?.prcGroup)
  const eqps = uniqueTextValues(body?.eqps)
  const periode = Number(body?.periode)
  const normalizedKnoxId = normalizeText(knoxId)
  const comment = String(body?.comment ?? "").trim()

  if (!line) throw new Error("Line Name이 필요합니다.")
  if (!sdwt) throw new Error("SDWT가 필요합니다.")
  if (!prcGroup) throw new Error("PRC Group이 필요합니다.")
  if (!eqps.length || eqps.length > MAX_EQP_COUNT) {
    throw new Error(`EQP는 1개 이상 ${MAX_EQP_COUNT}개 이하로 선택해야 합니다.`)
  }
  if (!Number.isInteger(periode) || periode < 1) {
    throw new Error("모니터링 기간은 1 이상의 정수여야 합니다.")
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment는 ${MAX_COMMENT_LENGTH}자 이내로 입력해야 합니다.`)
  }
  if (!normalizedKnoxId) throw new Error("접속자 정보를 확인하지 못했습니다.")

  return {
    line,
    sdwt,
    prcGroup,
    eqps,
    execDate: formatDatabaseTimestamp(),
    periode,
    comment,
    knoxId: normalizedKnoxId,
  }
}

export function buildMyEqpDebugRows(payload) {
  return payload.eqps.map((eqp) => ({
    line: payload.line,
    sdwt: payload.sdwt,
    prc_group: payload.prcGroup,
    eqp,
    exec_date: payload.execDate,
    periode: payload.periode,
    comment: payload.comment,
    knox_id: payload.knoxId,
  }))
}

export function groupMyEqpRegistrationRecords(records, nowMs = Date.now()) {
  const groups = new Map()

  records.forEach((record) => {
    const normalized = {
      line: normalizeText(record?.line),
      sdwt: normalizeText(record?.sdwt),
      prcGroup: normalizeText(record?.prc_group),
      eqp: normalizeText(record?.eqp),
      execDate: normalizeDatabaseTimestamp(record?.exec_date),
      periode: Number(record?.periode),
      comment: String(record?.comment ?? ""),
      knoxId: normalizeText(record?.knox_id),
    }
    if (!normalized.line || !normalized.sdwt || !normalized.prcGroup || !normalized.eqp) return

    const groupKey = [
      normalized.line,
      normalized.sdwt,
      normalized.prcGroup,
      normalized.execDate,
      normalized.periode,
      normalized.comment,
      normalized.knoxId,
    ].join("\u0000")
    const group = groups.get(groupKey) ?? { ...normalized, eqps: [] }
    if (!group.eqps.includes(normalized.eqp)) group.eqps.push(normalized.eqp)
    groups.set(groupKey, group)
  })

  return Array.from(groups.values()).map((group) => {
    group.eqps.sort((left, right) => left.localeCompare(right, "ko", { numeric: true }))
    const execDateMs = Date.parse(group.execDate.replace(" ", "T"))
    const expiresAtMs = execDateMs + group.periode * 24 * 60 * 60 * 1000
    return {
      id: [group.line, group.sdwt, group.prcGroup, group.execDate, group.comment].join("|"),
      line: group.line,
      sdwt: group.sdwt,
      prcGroup: group.prcGroup,
      eqps: group.eqps,
      execDate: group.execDate,
      periode: group.periode,
      comment: group.comment,
      expiresAt: Number.isFinite(expiresAtMs) ? formatDatabaseTimestamp(new Date(expiresAtMs)) : "",
      active: Number.isFinite(expiresAtMs) && expiresAtMs > nowMs,
    }
  }).sort((left, right) => right.execDate.localeCompare(left.execDate))
}

export async function resolveRegistrationUserId(remoteIp, resolver = resolveCurrentUser) {
  try {
    const currentUser = await resolver(remoteIp)
    return normalizeText(currentUser?.knoxId) || remoteIp
  } catch {
    return remoteIp
  }
}

function runRegistrationHelper(action, payload) {
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
        reject(new Error("My EQP 기준정보 저장 시간이 초과되었습니다."))
        return
      }

      let result
      try {
        result = JSON.parse(stdout.trim())
      } catch {
        reject(new Error(stderr.trim() || "My EQP 저장 응답을 해석하지 못했습니다."))
        return
      }
      if (!result.ok) {
        if (stderr.trim()) console.error(`[my-eqp-registration] ${stderr.trim()}`)
        reject(new Error(result.error || "My EQP 기준정보를 저장하지 못했습니다."))
        return
      }
      resolvePromise(result)
    })
    child.stdin.end(JSON.stringify(payload))
  })
}

export async function listMyEqpRegistrationRecords({ line, knoxId, activeOnly = false }) {
  const result = await runRegistrationHelper("list", {
    line: normalizeText(line),
    knoxId: normalizeText(knoxId),
    activeOnly: Boolean(activeOnly),
  })
  return Array.isArray(result.records) ? result.records : []
}

export async function handleMyEqpRegistrationRequest(req, res, url) {
  if (!new Set(["GET", "POST", "DELETE"]).has(req.method)) {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  let debugRows = []
  try {
    const remoteIp = getRemoteIp(req)
    if (!remoteIp) {
      sendJson(res, 400, { ok: false, error: "접속자 IP를 확인하지 못했습니다." })
      return
    }

    const userId = await resolveRegistrationUserId(remoteIp)

    if (req.method === "GET") {
      const line = normalizeText(url.searchParams.get("line"))
      if (!line) {
        sendJson(res, 400, { ok: false, error: "Line Name이 필요합니다." })
        return
      }
      const activeOnly = url.searchParams.get("activeOnly") === "true"
      const records = await listMyEqpRegistrationRecords({ line, knoxId: userId, activeOnly })
      sendJson(res, 200, {
        ok: true,
        registrations: groupMyEqpRegistrationRecords(records),
      })
      return
    }

    const body = await readJsonBody(req)
    if (req.method === "DELETE") {
      const payload = buildMyEqpRegistrationPayload({
        ...body,
        eqps: body.eqps,
        periode: body.periode,
      }, userId)
      payload.execDate = normalizeDatabaseTimestamp(body.execDate)
      if (!payload.execDate) throw new Error("등록 시점 정보가 필요합니다.")
      const result = await runRegistrationHelper("delete", payload)
      sendJson(res, 200, result)
      return
    }

    const payload = buildMyEqpRegistrationPayload(body, userId)
    debugRows = buildMyEqpDebugRows(payload)
    const result = await runRegistrationHelper("insert", payload)
    sendJson(res, 200, { ...result, knoxId: userId })
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error.message,
      table: "myeqp_regist",
      debugRows,
    })
  }
}

import { spawn } from "node:child_process"
import { fileURLToPath, URL } from "node:url"

import {
  MAPPING_CONFIG_UNAVAILABLE_CODE,
  MAPPING_SCOPE_MISMATCH_CODE,
  assertKnownMappingSdwts,
  readLineMapping,
  requireLineMapping,
} from "./mappingConfig.mjs"
import { createSafeApiError } from "./safeApiError.mjs"

const helperPath = fileURLToPath(new URL("../scripts/mailing_registration.py", import.meta.url))
const MAX_KNOX_ID_LENGTH = 128
const MAX_KNOX_ID_COUNT = 100
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
  const requestedKnoxIds = Array.isArray(body?.knoxIds) && body.knoxIds.length
    ? body.knoxIds
    : [body?.knoxId]
  if (requestedKnoxIds.length > MAX_KNOX_ID_COUNT) {
    throw new Error(`knox_id는 ${MAX_KNOX_ID_COUNT}명 이하로 등록해야 합니다.`)
  }
  const knoxIds = Array.from(new Set(requestedKnoxIds.map(normalizeKnoxId)))
  const sdwts = uniqueTextValues(body?.sdwts)

  if (!sdwts.length || sdwts.length > MAX_SDWT_COUNT) {
    throw new Error(`SDWT는 1개 이상 ${MAX_SDWT_COUNT}개 이하로 선택해야 합니다.`)
  }
  if (sdwts.some((sdwt) => sdwt.length > MAX_SDWT_LENGTH)) {
    throw new Error(`SDWT 값은 ${MAX_SDWT_LENGTH}자 이하여야 합니다.`)
  }

  return {
    knoxId: knoxIds[0],
    knoxIds,
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

export function buildMailingRecipientPayloads(payload) {
  const { knoxIds, ...sharedPayload } = payload
  return knoxIds.map((knoxId) => ({
    ...sharedPayload,
    knoxId,
  }))
}

function runMailingHelper(action, payload) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("python3", ["-B", helperPath, action], {
      env: process.env,
      stdio: ["pipe", "pipe", "ignore"],
    })
    let stdout = ""
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, 15_000)

    child.stdout.on("data", (chunk) => { stdout += chunk })
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
        reject(new Error("Mailing DB 응답을 해석하지 못했습니다."))
        return
      }
      if (!result.ok) {
        reject(new Error("Mailing 기준정보를 처리하지 못했습니다."))
        return
      }
      resolvePromise(result)
    })
    child.stdin.end(JSON.stringify(payload))
  })
}

export async function handleMailingRegistrationRequest(
  req,
  res,
  url,
  { mappingReader = readLineMapping } = {},
) {
  if (!new Set(["GET", "POST", "DELETE"]).has(req.method)) {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  try {
    const mapping = await requireLineMapping(mappingReader)
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
      assertKnownMappingSdwts(mapping, { line: payload.line, sdwts: payload.sdwts })
      const result = await runMailingHelper("delete_line", payload)
      sendJson(res, 200, result)
      return
    }

    const payload = buildMailingRegistrationPayload(body)
    assertKnownMappingSdwts(mapping, { sdwts: payload.sdwts })
    const recipientPayloads = buildMailingRecipientPayloads(payload)
    const results = []
    for (const recipientPayload of recipientPayloads) {
      results.push(await runMailingHelper("insert", recipientPayload))
    }
    const result = {
      ok: true,
      affectedRows: results.reduce((sum, item) => sum + Number(item.affectedRows ?? 0), 0),
      requestedRows: results.reduce((sum, item) => sum + Number(item.requestedRows ?? 0), 0),
      storage: results[0]?.storage,
    }
    sendJson(res, 200, {
      ...result,
      registration: {
        knoxId: payload.knoxId,
        knoxIds: payload.knoxIds,
        sdwts: payload.sdwts,
        priorities: payload.priorities,
      },
    })
  } catch (error) {
    const mappingUnavailable = error.code === MAPPING_CONFIG_UNAVAILABLE_CODE
    const mappingMismatch = error.code === MAPPING_SCOPE_MISMATCH_CODE
    sendJson(res, mappingUnavailable ? 503 : mappingMismatch ? 400 : 500, createSafeApiError({
      code: mappingUnavailable
        ? MAPPING_CONFIG_UNAVAILABLE_CODE
        : mappingMismatch ? MAPPING_SCOPE_MISMATCH_CODE : "MAILING_REGISTRATION_REQUEST_FAILED",
      message: mappingUnavailable
        ? "기준정보 매핑을 사용할 수 없어 Mailing 요청을 중단했습니다."
        : mappingMismatch
          ? "선택한 Line과 SDWT가 기준정보와 일치하지 않습니다."
          : "Mailing 기준정보 요청을 처리하지 못했습니다.",
      scope: "mailing-registration",
    }))
  }
}

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

const MAILING_DB_ERRORS = new Map([
  ["MAILING_DB_SINGLE_ROW_LIMIT", {
    code: "MAILING_DB_SINGLE_ROW_LIMIT",
    status: 409,
    message: "현재 DB는 수신인당 한 행만 허용하여 SDWT·Grade별 조건을 나누어 저장할 수 없습니다. email 테이블의 고유키 구조 변경이 필요합니다.",
  }],
  [1062, {
    code: "MAILING_DB_DUPLICATE_KEY",
    status: 409,
    message: "등록 조건을 나누어 저장하는 과정에서 DB 중복 제한에 걸렸습니다. email 테이블의 고유키 구성을 확인해 주세요.",
  }],
  [1406, {
    code: "MAILING_DB_COLUMN_TOO_SHORT",
    status: 500,
    message: "Mailing 등록 조건을 저장할 DB 컬럼 길이가 부족합니다. email 테이블의 컬럼 길이를 확인해 주세요.",
  }],
  [1364, {
    code: "MAILING_DB_REQUIRED_COLUMN",
    status: 500,
    message: "등록 조건을 나누어 저장할 때 DB의 필수 컬럼 값이 누락되었습니다. email 테이블의 기본값 설정을 확인해 주세요.",
  }],
])

export function createMailingHelperError(result) {
  const failure = MAILING_DB_ERRORS.get(result?.dbErrorCode) ?? MAILING_DB_ERRORS.get(result?.code)
  const error = new Error("Mailing 기준정보를 처리하지 못했습니다.")
  // Only allowlisted codes cross the helper boundary; never copy raw DB details.
  if (failure) error.code = failure.code
  return error
}

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
  const priorities = body?.priorities === undefined
    ? [...MAILING_PRIORITIES]
    : uniqueTextValues(body.priorities).map((value) => value.toUpperCase())
  if (!priorities.length || priorities.some((value) => !MAILING_PRIORITIES.includes(value))) {
    throw new Error("Grade는 A, B, D, M, N 중 1개 이상 선택해야 합니다.")
  }

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
    priorities: MAILING_PRIORITIES.filter((value) => priorities.includes(value)),
  }
}

export function buildMailingDeletePayload(body) {
  const payload = buildMailingRegistrationPayload(body)
  // A legacy Line deletion removes every grade, including historical values.
  if (body?.priorities === undefined) delete payload.priorities
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
        reject(createMailingHelperError(result))
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
  { mappingReader = readLineMapping, helperRunner = runMailingHelper } = {},
) {
  if (!new Set(["GET", "POST", "DELETE"]).has(req.method)) {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  try {
    const mapping = await requireLineMapping(mappingReader)
    if (req.method === "GET") {
      const knoxId = normalizeKnoxId(url.searchParams.get("knoxId"))
      const result = await helperRunner("list", { knoxId })
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
      const result = await helperRunner("delete_line", payload)
      sendJson(res, 200, result)
      return
    }

    const payload = buildMailingRegistrationPayload(body)
    assertKnownMappingSdwts(mapping, { sdwts: payload.sdwts })
    const recipientPayloads = buildMailingRecipientPayloads(payload)
    const results = []
    for (const recipientPayload of recipientPayloads) {
      results.push(await helperRunner("insert", recipientPayload))
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
    const databaseFailure = Array.from(MAILING_DB_ERRORS.values()).find((failure) => failure.code === error.code)
    sendJson(res, mappingUnavailable ? 503 : mappingMismatch ? 400 : databaseFailure?.status ?? 500, createSafeApiError({
      code: mappingUnavailable
        ? MAPPING_CONFIG_UNAVAILABLE_CODE
        : mappingMismatch ? MAPPING_SCOPE_MISMATCH_CODE : databaseFailure?.code ?? "MAILING_REGISTRATION_REQUEST_FAILED",
      message: mappingUnavailable
        ? "기준정보 매핑을 사용할 수 없어 Mailing 요청을 중단했습니다."
        : mappingMismatch
          ? "선택한 Line과 SDWT가 기준정보와 일치하지 않습니다."
          : databaseFailure?.message ?? "Mailing 기준정보 요청을 처리하지 못했습니다.",
      scope: "mailing-registration",
    }))
  }
}

import { spawn } from "node:child_process"
import { fileURLToPath, URL } from "node:url"

import { createSafeApiError } from "./safeApiError.mjs"

const lookupScriptPath = fileURLToPath(new URL("../scripts/my_eqp_reference.py", import.meta.url))
const CACHE_TTL_MS = 5 * 60 * 1000
let cachedPayload = null
let pendingLookup = null

export function referenceLookupErrorMessage(dbErrno, missingColumn) {
  const allowedColumns = new Set([
    "erdtsum_info.main",
    ...["eqp_id", "sdwt_code", "fdc_model", "eqp_model", "eqp_prc_group"]
      .map((name) => `edisn.m_equipment.${name}`),
  ])
  if (dbErrno === 1054 && allowedColumns.has(missingColumn)) {
    return `My EQP 기준정보 조회 실패: ${missingColumn} 컬럼이 존재하지 않습니다. (DB 1054)`
  }
  const reasons = {
    1044: "DB 접근 권한을 확인해 주세요.",
    1045: "DB 인증 정보를 확인해 주세요.",
    1054: "조회 컬럼이 실제 테이블에 존재하지 않습니다.",
    1142: "기준정보 테이블의 SELECT 권한이 없습니다.",
    1146: "기준정보 테이블이 존재하지 않습니다.",
    1267: "두 테이블의 문자열 비교 설정(collation)이 서로 다릅니다.",
    1271: "두 테이블의 UNION 문자열 설정(collation)이 서로 다릅니다.",
  }
  const reason = Number.isInteger(dbErrno) ? reasons[dbErrno] : null
  return reason
    ? `My EQP 기준정보 조회 실패: ${reason} (DB ${dbErrno})`
    : "My EQP 기준정보를 불러오지 못했습니다."
}

function sendJson(res, statusCode, payload, method = "GET") {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": statusCode === 200 ? "private, max-age=60" : "no-store",
  })
  res.end(method === "HEAD" ? undefined : JSON.stringify(payload))
}

export function normalizeMyEqpReferenceRows(rows) {
  if (!Array.isArray(rows)) return []

  return rows.map((row) => ({
    main: String(row?.main ?? "").trim(),
    disp_name: String(row?.disp_name ?? "").trim(),
    sdwt_prod: String(row?.sdwt_prod ?? "").trim(),
    prc_group: String(row?.prc_group ?? "").trim(),
  })).filter((row) => row.main && row.disp_name && row.sdwt_prod && row.prc_group)
}

export function readMyEqpReferenceRows() {
  const now = Date.now()
  if (cachedPayload?.expiresAt > now) return Promise.resolve(cachedPayload.rows)
  if (pendingLookup) return pendingLookup

  pendingLookup = new Promise((resolve, reject) => {
    const child = spawn("python3", ["-B", lookupScriptPath], {
      env: process.env,
      stdio: ["ignore", "pipe", "ignore"],
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
        reject(Object.assign(new Error("기준정보 조회 시간 초과"), { referenceTimeout: true }))
        return
      }

      let payload
      try {
        payload = JSON.parse(stdout.trim())
      } catch {
        reject(new Error("erdtsum_info 기준정보 응답을 해석하지 못했습니다."))
        return
      }

      if (!payload.ok) {
        reject(Object.assign(new Error("기준정보 조회 실패"), {
          dbErrno: payload.db_errno,
          missingColumn: payload.missing_column,
        }))
        return
      }

      const rows = normalizeMyEqpReferenceRows(payload.rows)
      cachedPayload = { rows, expiresAt: Date.now() + CACHE_TTL_MS }
      resolve(rows)
    })
  }).finally(() => { pendingLookup = null })

  return pendingLookup
}

export async function handleMyEqpReferenceRequest(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {
      Allow: "GET, HEAD",
      "Content-Type": "application/json; charset=utf-8",
    })
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }))
    return
  }

  try {
    const rows = await readMyEqpReferenceRows()
    sendJson(res, 200, { ok: true, rows }, req.method)
  } catch (error) {
    sendJson(res, 500, createSafeApiError({
      code: "MY_EQP_REFERENCE_LOAD_FAILED",
      message: error?.referenceTimeout
        ? "My EQP 기준정보 조회 시간이 15초를 초과했습니다."
        : referenceLookupErrorMessage(error?.dbErrno, error?.missingColumn),
      scope: "my-eqp-reference",
    }), req.method)
  }
}

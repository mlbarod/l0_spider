import { spawn } from "node:child_process"
import { fileURLToPath, URL } from "node:url"

import { getRemoteIp, resolveCurrentUser } from "./currentUser.mjs"
import { createSafeApiError } from "./safeApiError.mjs"

const helperPath = fileURLToPath(new URL("../scripts/notices.py", import.meta.url))
const MAX_BODY_BYTES = 64 * 1024
const MAX_TITLE_LENGTH = 200
const MAX_NOTICE_BODY_LENGTH = 10_000
const SAFE_NOTICE_DB_ERRORS = new Map([
  ["NOTICE_DB_CONFIG_NOT_FOUND", "공지 DB 설정 파일을 찾을 수 없습니다."],
  ["NOTICE_DB_DRIVER_MISSING", "공지 DB 드라이버를 사용할 수 없습니다."],
  ["NOTICE_DB_TABLE_NOT_FOUND", "site_notices 테이블을 확인할 수 없습니다."],
  ["NOTICE_DB_SCHEMA_MISMATCH", "site_notices 테이블 구조를 확인해 주세요."],
  ["NOTICE_DB_ACCESS_DENIED", "공지 DB 계정 권한을 확인해 주세요."],
  ["NOTICE_DB_CONNECTION_FAILED", "공지 DB에 연결하지 못했습니다."],
  ["NOTICE_DB_OPERATION_FAILED", "공지사항 DB 작업에 실패했습니다."],
])

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

export function normalizeKnoxId(value) {
  return normalizeText(value).toLowerCase()
}

export function parseNoticeAdminKnoxIds(value) {
  return new Set(String(value ?? "")
    .split(",")
    .map(normalizeKnoxId)
    .filter(Boolean))
}

export function resolveNoticeAdminKnoxIds(...values) {
  return values.map(normalizeText).find(Boolean) ?? ""
}

export function isNoticeAdmin(
  knoxId,
  configuredKnoxIds = resolveNoticeAdminKnoxIds(
    process.env.NOTICE_ADMIN_KNOX_IDS,
    process.env.NOTICE_ADMIN_KNOX_ID,
  ),
) {
  return parseNoticeAdminKnoxIds(configuredKnoxIds).has(normalizeKnoxId(knoxId))
}

export function buildNoticePermissions(knoxId, configuredKnoxIds) {
  const adminKnoxIds = parseNoticeAdminKnoxIds(configuredKnoxIds)
  return {
    canManage: adminKnoxIds.has(normalizeKnoxId(knoxId)),
    adminConfigured: adminKnoxIds.size > 0,
    adminCount: adminKnoxIds.size,
  }
}

export function buildNoticeCreatePayload(value, createdBy) {
  const title = normalizeText(value?.title)
  const body = normalizeText(value?.body)
  const normalizedCreatedBy = normalizeKnoxId(createdBy)

  if (!title) throw new Error("공지 제목을 입력해 주세요.")
  if (title.length > MAX_TITLE_LENGTH) throw new Error(`공지 제목은 ${MAX_TITLE_LENGTH}자 이하여야 합니다.`)
  if (!body) throw new Error("공지 본문을 입력해 주세요.")
  if (body.length > MAX_NOTICE_BODY_LENGTH) {
    throw new Error(`공지 본문은 ${MAX_NOTICE_BODY_LENGTH.toLocaleString()}자 이하여야 합니다.`)
  }
  if (!normalizedCreatedBy) throw new Error("등록자 정보를 확인하지 못했습니다.")

  return { title, body, createdBy: normalizedCreatedBy }
}

export function buildNoticeCompletePayload(value, completedBy) {
  const noticeId = Number(value?.noticeId)
  const normalizedCompletedBy = normalizeKnoxId(completedBy)
  if (!Number.isSafeInteger(noticeId) || noticeId <= 0) throw new Error("공지 번호가 올바르지 않습니다.")
  if (!normalizedCompletedBy) throw new Error("완료 처리자를 확인하지 못했습니다.")
  return { noticeId, completedBy: normalizedCompletedBy }
}

function normalizeNotice(row) {
  return {
    noticeId: Number(row?.noticeId),
    title: normalizeText(row?.title),
    body: normalizeText(row?.body),
    status: normalizeText(row?.status).toUpperCase(),
    createdBy: normalizeText(row?.createdBy),
    createdAt: normalizeText(row?.createdAt),
    updatedBy: normalizeText(row?.updatedBy),
    updatedAt: normalizeText(row?.updatedAt),
    completedBy: normalizeText(row?.completedBy),
    completedAt: normalizeText(row?.completedAt),
  }
}

async function readJsonBody(req) {
  let body = ""
  for await (const chunk of req) {
    body += chunk
    if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
      throw new Error("공지 요청 데이터가 너무 큽니다.")
    }
  }
  if (!body.trim()) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new Error("요청 JSON이 올바르지 않습니다.")
  }
}

export function runNoticesHelper(payload) {
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
        reject(new Error("공지사항 DB 요청 시간이 초과되었습니다."))
        return
      }

      let result
      try {
        result = JSON.parse(stdout.trim())
      } catch {
        reject(new Error("공지사항 DB 응답을 해석하지 못했습니다."))
        return
      }
      if (!result.ok) {
        const error = new Error(result.error || "공지사항 DB 작업을 처리하지 못했습니다.")
        error.code = result.code
        reject(error)
        return
      }
      resolvePromise(result)
    })

    child.stdin.end(JSON.stringify(payload))
  })
}

async function resolveRequestUser(req, { remoteIpReader, userResolver }) {
  const remoteIp = remoteIpReader(req)
  if (!remoteIp) throw new Error("접속자 IP를 확인하지 못했습니다.")
  return userResolver(remoteIp)
}

function sendForbidden(res) {
  sendJson(res, 403, {
    ok: false,
    code: "NOTICE_ADMIN_REQUIRED",
    error: "공지사항 관리 권한이 없습니다.",
  })
}

export async function handleNoticesRequest(req, res, url, dependencies = {}) {
  const helper = dependencies.helper ?? runNoticesHelper
  const remoteIpReader = dependencies.remoteIpReader ?? getRemoteIp
  const userResolver = dependencies.userResolver ?? resolveCurrentUser
  const configuredAdminKnoxIds = resolveNoticeAdminKnoxIds(
    dependencies.configuredAdminKnoxIds,
    dependencies.configuredAdminKnoxId,
    process.env.NOTICE_ADMIN_KNOX_IDS,
    process.env.NOTICE_ADMIN_KNOX_ID,
  )
  const pathname = url?.pathname ?? "/api/notices"
  const manageRequest = pathname === "/api/notices/manage"
  const permissionRequest = pathname === "/api/notices/permissions"

  if ((manageRequest || permissionRequest) && req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }
  if (!manageRequest && !["GET", "POST", "PATCH"].includes(req.method)) {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  try {
    if (permissionRequest) {
      const currentUser = await resolveRequestUser(req, { remoteIpReader, userResolver })
      sendJson(res, 200, {
        ok: true,
        permissions: buildNoticePermissions(currentUser.knoxId, configuredAdminKnoxIds),
      })
      return
    }

    if (req.method === "GET" && !manageRequest) {
      const [result, currentUser] = await Promise.all([
        helper({ action: "list-active" }),
        resolveRequestUser(req, { remoteIpReader, userResolver }).catch(() => null),
      ])
      sendJson(res, 200, {
        ok: true,
        notices: (result.notices ?? []).map(normalizeNotice),
        permissions: buildNoticePermissions(currentUser?.knoxId, configuredAdminKnoxIds),
      })
      return
    }

    const currentUser = await resolveRequestUser(req, { remoteIpReader, userResolver })
    if (!isNoticeAdmin(currentUser.knoxId, configuredAdminKnoxIds)) {
      sendForbidden(res)
      return
    }

    if (manageRequest) {
      const result = await helper({ action: "list-all" })
      sendJson(res, 200, {
        ok: true,
        notices: (result.notices ?? []).map(normalizeNotice),
      })
      return
    }

    const body = await readJsonBody(req)
    if (req.method === "POST") {
      const result = await helper({
        action: "create",
        ...buildNoticeCreatePayload(body, currentUser.knoxId),
      })
      sendJson(res, 201, {
        ok: true,
        notice: normalizeNotice(result.notice),
      })
      return
    }

    const result = await helper({
      action: "complete",
      ...buildNoticeCompletePayload(body, currentUser.knoxId),
    })
    if (Number(result.affectedRows) !== 1) {
      sendJson(res, 409, {
        ok: false,
        code: "NOTICE_ALREADY_COMPLETED",
        error: "이미 완료되었거나 존재하지 않는 공지사항입니다.",
      })
      return
    }
    sendJson(res, 200, { ok: true, affectedRows: 1 })
  } catch (error) {
    const validationError = error instanceof Error && [
      "공지 제목을 입력해 주세요.",
      `공지 제목은 ${MAX_TITLE_LENGTH}자 이하여야 합니다.`,
      "공지 본문을 입력해 주세요.",
      `공지 본문은 ${MAX_NOTICE_BODY_LENGTH.toLocaleString()}자 이하여야 합니다.`,
      "공지 번호가 올바르지 않습니다.",
      "요청 JSON이 올바르지 않습니다.",
      "공지 요청 데이터가 너무 큽니다.",
    ].includes(error.message)
    if (validationError) {
      sendJson(res, 400, { ok: false, code: "NOTICE_VALIDATION_FAILED", error: error.message })
      return
    }
    const databaseErrorMessage = SAFE_NOTICE_DB_ERRORS.get(error?.code)
    if (databaseErrorMessage) {
      sendJson(res, 500, createSafeApiError({
        code: error.code,
        message: databaseErrorMessage,
        scope: "notices",
      }))
      return
    }
    sendJson(res, 500, createSafeApiError({
      code: "NOTICE_REQUEST_FAILED",
      message: "공지사항 요청을 처리하지 못했습니다.",
      scope: "notices",
    }))
  }
}

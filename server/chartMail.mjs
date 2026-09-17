import { createHash } from "node:crypto"
import { getSsoCurrentUser, sendSsoAuthenticationError } from "./currentUser.mjs"
import { prepareKnoxMailRequest } from "./knoxMailConfig.mjs"
import { createChartMailStore } from "./chartMailStore.mjs"
import { createSafeApiError } from "./safeApiError.mjs"
import { CHART_MAIL_COMMENTS, MAX_CHART_IMAGE_BYTES, parseMailRecipients } from "../src/features/fdc-trend/utils/chartMail.mjs"

const maxBase64Length = 4 * Math.ceil(MAX_CHART_IMAGE_BYTES / 3)
const maxRequestBytes = maxBase64Length + 65536
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const hash = (value) => createHash("sha256").update(value).digest("hex")
const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char])

function textField(value, limit, name) {
  if (typeof value !== "string" || !value.trim() || value.length > limit || [...value].some((char) => {
    const code = char.charCodeAt(0)
    return (code < 32 && ![9, 10, 13].includes(code)) || code === 127
  })) {
    throw new TypeError(`${name} 내용을 확인해 주세요.`)
  }
  return value
}

export function buildChartMail(input, sender) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("메일 요청을 확인해 주세요.")
  if (typeof input.requestId !== "string" || !idPattern.test(input.requestId)) throw new TypeError("메일 요청 ID를 확인해 주세요.")
  const subject = textField(input.title, 300, "제목")
  if (/[\r\n]/.test(subject)) throw new TypeError("제목은 한 줄로 입력해 주세요.")
  const details = textField(input.details, 10000, "차트 정보")
  if (!CHART_MAIL_COMMENTS.includes(input.comment)) throw new TypeError("코멘트를 선택해 주세요.")
  let recipients
  try { recipients = parseMailRecipients(input.recipients) } catch (error) { throw new TypeError(error.message) }
  const prefix = "data:image/png;base64,"
  if (typeof input.image !== "string" || !input.image.startsWith(prefix)) throw new TypeError("PNG 차트 이미지가 필요합니다.")
  const base64 = input.image.slice(prefix.length)
  if (!base64.length || base64.length > maxBase64Length || base64.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) throw new TypeError("차트 이미지의 Base64 형식 또는 5MB 제한을 확인해 주세요.")
  const png = Buffer.from(base64, "base64")
  if (png.length > MAX_CHART_IMAGE_BYTES || png.toString("base64") !== base64
    || png.length < 45 || png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
    || png.readUInt32BE(8) !== 13 || png.toString("ascii", 12, 16) !== "IHDR"
    || !png.readUInt32BE(16) || !png.readUInt32BE(20)
    || png.subarray(-12).toString("hex") !== "0000000049454e44ae426082") throw new TypeError("PNG 차트 이미지를 확인해 주세요.")
  // 사용자 요청에 따라 Base64 data URL 지원을 가정한다. 실제 수신 호환성은 별도 확인한다.
  const contents = `<html lang="ko"><body style="font-family:Arial,sans-serif;color:#172033;"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(details).replace(/\r?\n/g, "<br>")}</p><p>${escapeHtml(input.comment)}</p><p>차트 전체 범위</p><img src="${prefix}${base64}" alt="전체 범위 차트" style="max-width:100%;height:auto;"></body></html>`
  return { subject, docSecuType: "PERSONAL", contents, contentType: "HTML", sender,
    recipients: recipients.map((id) => ({ emailAddress: `${id}@samsung.com`, recipientType: "TO" })) }
}

async function readBody(req) {
  if (String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new TypeError("JSON 요청이 필요합니다.")
  if (Number(req.headers["content-length"]) > maxRequestBytes) throw new TypeError("메일 요청이 너무 큽니다.")
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk)
    if (size > maxRequestBytes) throw new TypeError("메일 요청이 너무 큽니다.")
    chunks.push(Buffer.from(chunk))
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { throw new TypeError("JSON 요청을 확인해 주세요.") }
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify(payload))
}

function sendOutcome(res, state) {
  if (state === "accepted") return json(res, 200, { ok: true, status: "accepted" })
  if (state === "pending") return json(res, 409, { ok: false, code: "MAIL_IN_PROGRESS", error: "이미 처리 중이거나 결과 확인이 필요한 요청입니다. 수신 여부를 먼저 확인해 주세요." })
  if (state === "rejected") return json(res, 502, { ok: false, code: "MAIL_REJECTED", error: "메일 API가 요청을 거절했습니다. 설정을 확인한 뒤 작성창을 새로 열어 주세요." })
  return json(res, 502, { ok: false, code: "MAIL_RESULT_UNKNOWN", error: "발송 결과를 확인하지 못했습니다. 중복 발송을 피하려면 수신 여부를 먼저 확인해 주세요." })
}

export function createChartMailHandler({ env = process.env, fetchImpl = globalThis.fetch, store = createChartMailStore(), logger } = {}) {
  return async function handle(req, res) {
    try {
      getSsoCurrentUser(req)
      if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "지원하지 않는 요청입니다." })
      let prepared
      try { prepared = prepareKnoxMailRequest(req, env) } catch {
        const reason = "메일 인증 설정 또는 발신자 Knox ID를 확인해 주세요."
        return json(res, req.method === "GET" ? 200 : 503, req.method === "GET"
          ? { ok: true, ready: false, reason }
          : { ok: false, code: "MAIL_TRANSPORT_NOT_CONFIGURED", error: reason })
      }
      if (req.method === "GET") return json(res, 200, { ok: true, ready: Boolean(prepared), ...(!prepared ? { reason: "메일 발송이 비활성화되어 있습니다." } : {}) })
      if (!prepared) return json(res, 503, { ok: false, code: "MAIL_TRANSPORT_NOT_CONFIGURED", error: "메일 발송이 비활성화되어 있습니다." })
      const input = await readBody(req)
      const payload = buildChartMail(input, prepared.sender)
      const body = JSON.stringify(payload)
      const fingerprint = hash(body)
      const key = hash(`${prepared.sender.emailAddress}\0${input.requestId.toLowerCase()}`)
      const previous = store.claim(key, fingerprint)
      if (previous) {
        if (previous.fingerprint !== fingerprint) return json(res, 409, { ok: false, code: "MAIL_REQUEST_CONFLICT", error: "이미 사용한 요청 ID입니다. 작성창을 새로 열어 주세요." })
        return sendOutcome(res, previous.state)
      }
      let state = "unknown"
      try {
        const response = await fetchImpl(prepared.url, { method: prepared.method, headers: prepared.headers,
          redirect: prepared.redirect, signal: AbortSignal.timeout(prepared.timeoutMs), body })
        // 응답 본문 계약은 미확인. HTTP 접수와 실제 메일 도착을 구분한다.
        state = response.ok ? "accepted" : response.status >= 400 && response.status < 500 && response.status !== 408 ? "rejected" : "unknown"
        try { await response.body?.cancel() } catch { /* 응답 본문과 원격 오류는 기록하지 않는다. */ }
      } catch { /* 타임아웃·연결 유실은 결과 불명으로 보관하며 자동 재시도하지 않는다. */ }
      try { store.finish(key, state) } catch {
        return sendOutcome(res, "unknown")
      }
      return sendOutcome(res, state)
    } catch (error) {
      if (sendSsoAuthenticationError(error, res)) return
      if (error instanceof TypeError) return json(res, 400, { ok: false, code: "INVALID_CHART_MAIL", error: error.message })
      return json(res, 500, createSafeApiError({ code: "MAIL_REQUEST_STORAGE_ERROR", message: "메일 요청 기록을 저장하거나 읽지 못했습니다. 발송하지 않았습니다.", scope: "chart-mail", logger }))
    }
  }
}

export const handleChartMailRequest = createChartMailHandler()

import { createHash, randomUUID } from "node:crypto"
import { getSsoCurrentUser, sendSsoAuthenticationError } from "./currentUser.mjs"
import { prepareKnoxMailRequest } from "./knoxMailConfig.mjs"
import { createChartMailStore } from "./chartMailStore.mjs"
import { createChartMailBoardDb } from "./chartMailBoardDb.mjs"
import { isChartMailBoardEnabled } from "./chartMailBoard.mjs"
import { inspectMailResponse, mailFailureHint, mailNetworkCode, safeMailDiagnostics } from "./chartMailDiagnostics.mjs"
import { MAX_CHART_MAIL_COMMENT_LENGTH, MAX_CHART_IMAGE_BYTES, parseMailRecipients } from "../src/features/fdc-trend/utils/chartMail.mjs"

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

function chartMailButtons(value, expectedOrigin) {
  if (value === undefined) return ""
  let url
  try { url = new URL(textField(value, 16000, "차트 링크")) } catch { throw new TypeError("차트 링크를 확인해 주세요.") }
  if (/\s/.test(value) || !["http:", "https:"].includes(url.protocol) || url.username || url.password
    || !/^\/(?:fdc_trend\/)?(?:self-equipment|matching-anomaly|common-anomaly)$/.test(url.pathname)
    || (expectedOrigin && url.origin !== expectedOrigin)) throw new TypeError("차트 링크를 확인해 주세요.")
  const links = [[url.href, "차트 링크"], [new URL("/", url).href, "SPIDER 접속"]]
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>${links.map(([href, label]) => `<td style="padding-right:12px;"><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer" style="display:inline-block;padding:12px 20px;background-color:#0071e3;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">${label}</a></td>`).join("")}</tr></table>`
}

export function buildChartMail(input, sender, expectedOrigin) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("메일 요청을 확인해 주세요.")
  if (typeof input.requestId !== "string" || !idPattern.test(input.requestId)) throw new TypeError("메일 요청 ID를 확인해 주세요.")
  const subject = textField(input.title, 300, "제목")
  if (/[\r\n]/.test(subject)) throw new TypeError("제목은 한 줄로 입력해 주세요.")
  const details = textField(input.details, 10000, "차트 정보")
  const comment = textField(input.comment, MAX_CHART_MAIL_COMMENT_LENGTH, "코멘트")
  const buttons = chartMailButtons(input.chartUrl, expectedOrigin)
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
  const imageWidth = png.readUInt32BE(16)
  const contents = `<html lang="ko"><body style="font-family:Arial,sans-serif;color:#172033;"><h2>${escapeHtml(subject)}</h2><p>${escapeHtml(details).replace(/\r?\n/g, "<br>")}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:60px 0;font-size:14px;line-height:20px;overflow-wrap:anywhere;">${escapeHtml(comment).replace(/\r\n|\r|\n/g, "<br>")}</td></tr></table><p>차트 전체 범위</p><img src="${prefix}${base64}" alt="전체 범위 차트" width="${imageWidth}" style="width:${imageWidth}px;max-width:100%;height:auto;">${buttons}</body></html>`
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

function sendOutcome(res, state, details, boardPostId) {
  const diagnostics = safeMailDiagnostics(details)
  const metadata = { requestId: diagnostics.requestId, diagnostics, ...(boardPostId ? { boardPostId } : {}) }
  if (state === "accepted") return json(res, 200, { ok: true, status: "accepted", deliveryVerified: false, ...metadata })
  if (state === "pending") return json(res, 409, { ok: false, code: "MAIL_IN_PROGRESS", error: "이미 처리 중이거나 결과 확인이 필요한 요청입니다. 수신 여부를 먼저 확인해 주세요.", ...metadata })
  const hint = mailFailureHint(diagnostics)
  if (state === "rejected") return json(res, 502, { ok: false, code: "MAIL_REJECTED", error: `${hint} 설정 확인 후 작성창을 새로 열어 주세요.`, ...metadata })
  return json(res, 502, { ok: false, code: "MAIL_RESULT_UNKNOWN", error: `${hint} 중복 발송을 피하려면 수신 여부를 먼저 확인해 주세요.`, ...metadata })
}

export function createChartMailHandler({ env = process.env, fetchImpl = globalThis.fetch, store = createChartMailStore(), board = createChartMailBoardDb(), logger = console.info } = {}) {
  return async function handle(req, res) {
    const startedAt = Date.now()
    const diagnostics = { requestId: randomUUID() }
    const log = (event, details = diagnostics) => {
      try { logger(`[chart-mail] ${JSON.stringify({ at: new Date().toISOString(), event, ...safeMailDiagnostics(details) })}`) } catch { /* 로그 출력 실패로 발송 상태를 바꾸지 않는다. */ }
    }
    let stage = "request"
    let boardPostId
    try {
      const actor = getSsoCurrentUser(req).knoxId.trim().toLowerCase()
      if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "지원하지 않는 요청입니다." })
      if (req.method === "POST") log("request_received")
      stage = "configuration"
      let prepared
      try { prepared = prepareKnoxMailRequest(req, env) } catch (error) {
        Object.assign(diagnostics, safeMailDiagnostics({ configField: error?.mailField }))
        log("configuration_invalid")
        const reason = diagnostics.configField ? `메일 환경변수 ${diagnostics.configField} 설정을 확인해 주세요.` : "메일 발신자 Knox ID를 확인해 주세요."
        return json(res, req.method === "GET" ? 200 : 503, req.method === "GET"
          ? { ok: true, ready: false, reason, requestId: diagnostics.requestId }
          : { ok: false, code: "MAIL_TRANSPORT_NOT_CONFIGURED", error: reason, requestId: diagnostics.requestId })
      }
      if (!prepared) {
        log("disabled")
        const reason = "메일 발송이 비활성화되어 있습니다. 서버의 KNOX_MAIL_ENABLED 설정을 확인해 주세요."
        return json(res, req.method === "GET" ? 200 : 503, req.method === "GET"
          ? { ok: true, ready: false, reason, requestId: diagnostics.requestId }
          : { ok: false, code: "MAIL_TRANSPORT_NOT_CONFIGURED", error: reason, requestId: diagnostics.requestId })
      }
      if (req.method === "GET") return json(res, 200, { ok: true, ready: true })
      stage = "validation"
      const input = await readBody(req)
      const payload = buildChartMail(input, prepared.sender, req.headers.origin)
      const body = JSON.stringify(payload)
      const fingerprint = hash(body)
      const key = hash(`${prepared.sender.emailAddress}\0${input.requestId.toLowerCase()}`)
      stage = "storage"
      const previous = store.claim(key, fingerprint, diagnostics)
      if (previous) {
        if (previous.fingerprint !== fingerprint) {
          log("request_conflict")
          return json(res, 409, { ok: false, code: "MAIL_REQUEST_CONFLICT", error: "이미 사용한 요청 ID입니다. 작성창을 새로 열어 주세요.", requestId: diagnostics.requestId })
        }
        const previousDiagnostics = { ...diagnostics, ...safeMailDiagnostics(previous.diagnostics) }
        log("duplicate_suppressed", previousDiagnostics)
        return sendOutcome(res, previous.state, previousDiagnostics)
      }
      if (isChartMailBoardEnabled(env)) {
        stage = "board"
        const chartUrl = input.chartUrl ?? ""
        const saved = await board.begin({
          id: key, fingerprint, actor,
          title: input.title, details: input.details, comment: input.comment,
          chartUrl, app: chartUrl ? new URL(chartUrl).pathname.split("/").at(-1) : "",
          recipients: payload.recipients.map(({ emailAddress }) => emailAddress.slice(0, -"@samsung.com".length)),
          imageBase64: input.image.slice("data:image/png;base64,".length),
          diagnostics: safeMailDiagnostics(diagnostics),
        })
        boardPostId = key
        if (!saved.created) {
          // The DB's unique key also suppresses duplicates from another Node process.
          const previousDiagnostics = { ...diagnostics, ...safeMailDiagnostics(saved.diagnostics) }
          store.finish(key, saved.state, previousDiagnostics)
          log("duplicate_suppressed", previousDiagnostics)
          return sendOutcome(res, saved.state, previousDiagnostics, boardPostId)
        }
      }
      stage = "transport"
      let state = "unknown"
      diagnostics.timeoutMs = prepared.timeoutMs
      const signal = AbortSignal.timeout(prepared.timeoutMs)
      log("sending")
      try {
        const response = await fetchImpl(prepared.url, { method: prepared.method, headers: prepared.headers,
          redirect: prepared.redirect, signal, body })
        diagnostics.upstreamStatus = response.status
        diagnostics.responseKind = "unreadable"
        // 2xx는 HTTP 응답 확인일 뿐이다. Knox 고유 응답 코드의 성공값은 추측하지 않는다.
        state = response.ok ? "accepted" : response.status >= 400 && response.status < 500 && response.status !== 408 ? "rejected" : "unknown"
        Object.assign(diagnostics, await inspectMailResponse(response))
        if (response.ok && (diagnostics.apiReportedFailure || ["non_json", "too_large"].includes(diagnostics.responseKind))) state = "unknown"
      } catch (error) {
        diagnostics.networkCode = mailNetworkCode(error, signal)
        if (state !== "rejected") state = "unknown"
      }
      diagnostics.durationMs = Date.now() - startedAt
      log(state === "accepted" ? "http_response_unverified" : state === "rejected" ? "rejected" : "result_unknown")
      let storageFailed = false
      try { store.finish(key, state, diagnostics) } catch { storageFailed = true }
      if (boardPostId) {
        try { await board.finish({ id: boardPostId, actor, state, diagnostics: safeMailDiagnostics(diagnostics) }) }
        catch { storageFailed = true }
      }
      if (storageFailed) {
        log("result_storage_failed")
        return sendOutcome(res, "unknown", diagnostics, boardPostId)
      }
      return sendOutcome(res, state, diagnostics, boardPostId)
    } catch (error) {
      if (sendSsoAuthenticationError(error, res)) return
      if (stage === "validation" && error instanceof TypeError) {
        log("validation_failed")
        return json(res, 400, { ok: false, code: "INVALID_CHART_MAIL", error: error.message, requestId: diagnostics.requestId })
      }
      if (stage === "transport") {
        log("unexpected_transport_error")
        return sendOutcome(res, "unknown", diagnostics)
      }
      if (stage === "board") {
        log("board_storage_failed")
        const conflict = error.code === "MAIL_REQUEST_CONFLICT"
        return json(res, conflict ? 409 : 500, { ok: false,
          code: conflict ? "MAIL_REQUEST_CONFLICT" : "BOARD_STORAGE_ERROR",
          error: conflict ? "이미 사용한 요청 ID입니다. 작성창을 새로 열어 주세요." : "게시판과 이미지를 DB에 저장하지 못해 발송하지 않았습니다. 관리자 확인 후 작성창을 새로 열어 주세요.",
          requestId: diagnostics.requestId,
        })
      }
      log("request_storage_failed")
      return json(res, 500, { ok: false, code: "MAIL_REQUEST_STORAGE_ERROR", error: "메일 요청을 준비하거나 기록하지 못했습니다. 발송하지 않았습니다.", requestId: diagnostics.requestId })
    }
  }
}

export const handleChartMailRequest = createChartMailHandler()

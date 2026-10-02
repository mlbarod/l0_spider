import { createHash, randomUUID } from "node:crypto"
import { getSsoCurrentUser, sendSsoAuthenticationError } from "./currentUser.mjs"
import { prepareKnoxMailRequest } from "./knoxMailConfig.mjs"
import { createChartMailStore } from "./chartMailStore.mjs"
import { createChartMailBoardDb } from "./chartMailBoardDb.mjs"
import { isChartMailBoardEnabled } from "./chartMailBoard.mjs"
import { inspectMailResponse, mailFailureHint, mailNetworkCode, safeMailDiagnostics } from "./chartMailDiagnostics.mjs"
import { buildChartMail, readChartMailBody } from "./chartMailPayload.mjs"
export { buildChartMail } from "./chartMailPayload.mjs"

const hash = (value) => createHash("sha256").update(value).digest("hex")

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
      const input = await readChartMailBody(req)
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

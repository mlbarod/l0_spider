import { prepareKnoxMailRequest } from "./knoxMailConfig.mjs"
import { inspectMailResponse, mailNetworkCode, safeMailDiagnostics } from "./chartMailDiagnostics.mjs"
import { escapeMailHtml, richHtmlToMailHtml } from "./voeMailHtml.mjs"

function emailAddress(id) {
  const value = String(id ?? "").trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(value)) throw new TypeError("Knox ID 형식 확인")
  return `${value}@samsung.com`
}

export function buildVoeMail({ action, post, actor, masterUserIds, sender, portalUrl }) {
  if (!["create", "reply"].includes(action) || !post || post.hidden
    || !Number.isSafeInteger(post.questionId) || post.questionId < 1) throw new TypeError("메일 대상 게시글 확인")
  const link = new URL("/voe", portalUrl)
  if (!["http:", "https:"].includes(link.protocol) || link.username || link.password) throw new TypeError("게시판 주소 확인")
  link.searchParams.set("questionId", String(post.questionId))
  const reply = action === "reply"
  // 저장 트랜잭션에서 마지막에 추가된 답변만 사용한다. 요청 본문이나 재조회 결과는 사용하지 않는다.
  const message = reply ? post.messages?.at(-1) : null
  if (reply && (!message || message.hidden || message.authorUserId !== actor.userId)) throw new TypeError("새 답변 확인")
  const recipients = [...masterUserIds, ...(reply ? [post.authorUserId] : [])]
  const category = post.category || "기타"
  const contents = [
    '<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#ffffff;">',
    '<div style="font-family:Arial,\'Malgun Gothic\',sans-serif;font-size:11pt;line-height:1.8;color:#263b4a;text-align:left;overflow-wrap:break-word;">',
    `<p style="margin:0 0 16px;">작성자: ${escapeMailHtml(actor.displayName)}<br>구분: ${escapeMailHtml(category)}</p>`,
    `<p style="margin:0 0 24px;">게시글 바로가기:<br><a href="${escapeMailHtml(link.href)}" target="_blank" rel="noopener noreferrer" style="color:#0673bc;text-decoration:underline;overflow-wrap:anywhere;">${escapeMailHtml(link.href)}</a></p>`,
    '<h2 style="margin:0 0 16px;font-size:18px;color:#172c3c;">질문 본문</h2>',
    `<div>${richHtmlToMailHtml(post.content, link.href)}</div>`,
  ]
  if (reply) contents.push(
    '<hr style="margin:32px 0 24px;border:0;border-top:3px solid #6c91aa;">',
    '<h2 style="margin:0 0 16px;font-size:18px;color:#172c3c;">추가 답변</h2>',
    `<div style="font-size:11pt;line-height:1.65;color:#454a4f;">${richHtmlToMailHtml(message.content, link.href)}</div>`,
  )
  contents.push("</div></body></html>")
  return {
    subject: `[SPIDER VOE] ${reply ? "답변: " : ""}${category}-${String(post.title).replace(/[\r\n]+/g, " ")}`,
    docSecuType: "PERSONAL", contents: contents.join("\n"), contentType: "HTML", sender,
    recipients: [...new Set(recipients.map(emailAddress))].map(address => ({ emailAddress: address, recipientType: "TO" })),
  }
}

export function createVoeMailNotifier({ env = process.env, getMasterUserIds = () => { throw new Error("마스터 목록 조회 필요") }, fetchImpl = globalThis.fetch, logger = console.info } = {}) {
  return async function notify({ req, action, actor, post }) {
    const log = (event, details = {}) => {
      try {
        logger(`[voe-mail] ${JSON.stringify({ event, action, questionId: post?.questionId, ...safeMailDiagnostics(details) })}`)
      } catch { /* 로그 실패가 게시글 저장 결과에 영향을 주지 않는다. */ }
    }
    let prepared, payload
    try {
      prepared = prepareKnoxMailRequest(req, env)
      if (!prepared) { log("disabled"); return }
      payload = buildVoeMail({ action, actor, post, sender: prepared.sender,
        masterUserIds: await getMasterUserIds(), portalUrl: env.SSO_REDIRECT_URI })
      if (!payload.recipients.length) { log("skipped_no_recipients"); return }
    } catch (error) {
      log("preparation_failed", { configField: error?.mailField })
      return
    }
    const diagnostics = { timeoutMs: prepared.timeoutMs }
    const signal = AbortSignal.timeout(prepared.timeoutMs)
    try {
      const response = await fetchImpl(prepared.url, { method: prepared.method, headers: prepared.headers,
        redirect: prepared.redirect, signal, body: JSON.stringify(payload) })
      diagnostics.upstreamStatus = response.status
      Object.assign(diagnostics, await inspectMailResponse(response))
      // Chart Mailing과 동일하게 HTTP 접수와 실제 수신 성공을 구분한다.
      const accepted = response.ok && !diagnostics.apiReportedFailure && ["empty", "json"].includes(diagnostics.responseKind)
      log(accepted ? "http_response_unverified" : "result_unknown_or_rejected", diagnostics)
    } catch (error) {
      log("result_unknown", { ...diagnostics, networkCode: mailNetworkCode(error, signal) })
    }
    // 응답 유실 시 중복 메일이 생기지 않도록 자동 재전송하지 않는다.
  }
}

import { MAX_CHART_MAIL_COMMENT_LENGTH, MAX_CHART_IMAGE_BYTES, parseMailRecipients } from "../src/features/fdc-trend/utils/chartMail.mjs"

const maxBase64Length = 4 * Math.ceil(MAX_CHART_IMAGE_BYTES / 3)
const maxRequestBytes = maxBase64Length + 65536
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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

function chartMailButtons(value, expectedOrigin, allowHistoryApp) {
  if (value === undefined) return ""
  let url
  try { url = new URL(textField(value, 16000, "차트 링크")) } catch { throw new TypeError("차트 링크를 확인해 주세요.") }
  if (/\s/.test(value) || !["http:", "https:"].includes(url.protocol) || url.username || url.password
    || !(allowHistoryApp
      ? /^\/(?:fdc_trend\/)?(?:self-equipment|matching-anomaly|common-anomaly|common-commonality-anomaly)$/
      : /^\/(?:fdc_trend\/)?(?:self-equipment|matching-anomaly|common-anomaly)$/).test(url.pathname)
    || (expectedOrigin && url.origin !== expectedOrigin)) throw new TypeError("차트 링크를 확인해 주세요.")
  const links = [[url.href, "차트 링크"], [new URL("/", url).href, "SPIDER 접속"], [new URL("/chart-mail-board", url).href, "메일보내기 이력 및 이력저장 게시판"]]
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>${links.map(([href, label]) => `<td style="padding-right:12px;"><a href="${escapeHtml(href)}" target="_blank" rel="noreferrer" style="display:inline-block;padding:12px 20px;background-color:#0071e3;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:bold;">${label}</a></td>`).join("")}</tr></table>`
}

export function buildChartMail(input, sender, expectedOrigin, { allowHistoryApp = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("메일 요청을 확인해 주세요.")
  if (typeof input.requestId !== "string" || !idPattern.test(input.requestId)) throw new TypeError("메일 요청 ID를 확인해 주세요.")
  const subject = textField(input.title, 300, "제목")
  if (/[\r\n]/.test(subject)) throw new TypeError("제목은 한 줄로 입력해 주세요.")
  const details = textField(input.details, 10000, "차트 정보")
  const comment = textField(input.comment, MAX_CHART_MAIL_COMMENT_LENGTH, "코멘트")
  const buttons = chartMailButtons(input.chartUrl, expectedOrigin, allowHistoryApp)
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

export async function readChartMailBody(req) {
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


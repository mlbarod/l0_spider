const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const networkCodes = new Set([
  "TIMEOUT", "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ENETUNREACH", "EHOSTUNREACH",
  "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT",
  "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID",
  "NETWORK_ERROR",
])
const responseKinds = new Set(["empty", "json", "non_json", "too_large", "unreadable"])
const configFields = new Set(["KNOX_MAIL_TOKEN", "KNOX_MAIL_SYSTEM_ID", "KNOX_MAIL_TIMEOUT_MS"])

// 응답 원문·메시지·주소·자격정보는 진단 정보에도 포함하지 않는다.
export function safeMailDiagnostics(value = {}) {
  const result = {}
  if (typeof value?.requestId === "string" && uuidPattern.test(value.requestId)) result.requestId = value.requestId
  if (Number.isInteger(value?.upstreamStatus) && value.upstreamStatus >= 100 && value.upstreamStatus <= 599) result.upstreamStatus = value.upstreamStatus
  if (networkCodes.has(value?.networkCode)) result.networkCode = value.networkCode
  if (responseKinds.has(value?.responseKind)) result.responseKind = value.responseKind
  if (value?.apiReportedFailure === true) result.apiReportedFailure = true
  if (configFields.has(value?.configField)) result.configField = value.configField
  if (Number.isInteger(value?.durationMs) && value.durationMs >= 0) result.durationMs = value.durationMs
  if (Number.isInteger(value?.timeoutMs) && value.timeoutMs >= 100 && value.timeoutMs <= 30000) result.timeoutMs = value.timeoutMs
  return result
}

export function mailNetworkCode(error, signal) {
  if (signal?.aborted || error?.name === "TimeoutError") return "TIMEOUT"
  const code = error?.cause?.code ?? error?.code
  return networkCodes.has(code) ? code : "NETWORK_ERROR"
}

export async function inspectMailResponse(response) {
  if (!response.body) return { responseKind: "empty" }
  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 16384) return { responseKind: "too_large" }
      chunks.push(Buffer.from(value))
    }
  } finally {
    // 큰/중단된 응답을 끝까지 내려받거나 저장하지 않는다.
    reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  const text = Buffer.concat(chunks).toString("utf8").trim()
  if (!text) return { responseKind: "empty" }
  let data
  try { data = JSON.parse(text) } catch { return { responseKind: "non_json" } }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { responseKind: "json" }
  // Knox 고유 코드의 성공값을 추측하지 않는다. 명시적 실패 표시는 보수적으로 결과 확인 대상으로 둔다.
  const candidates = [data, data.result, data.data].filter((item) => item && typeof item === "object" && !Array.isArray(item))
  const apiReportedFailure = candidates.some((item) => item.ok === false || item.success === false
    || ["error", "failed", "failure"].includes(typeof item.status === "string" ? item.status.toLowerCase() : "")
    || (typeof item.error === "string" && Boolean(item.error.trim()))
    || (item.error && typeof item.error === "object" && Object.keys(item.error).length > 0))
  return { responseKind: "json", ...(apiReportedFailure ? { apiReportedFailure: true } : {}) }
}

export function mailFailureHint(value) {
  const diagnostics = safeMailDiagnostics(value)
  const status = diagnostics.upstreamStatus
  const hints = {
    400: "메일 API가 요청 형식을 거절했습니다. 본문·수신인·Base64 이미지 규격을 확인해야 합니다.",
    401: "메일 API 인증이 거절되었습니다. 발급 토큰과 만료 여부를 확인해 주세요.",
    403: "메일 API 접근이 거절되었습니다. System-ID·토큰 권한과 발신자 사용 권한을 확인해 주세요.",
    404: "메일 API 주소 또는 경로를 확인해 주세요.",
    413: "메일 API가 요청 크기를 거절했습니다. 이미지와 전체 본문 크기를 확인해 주세요.",
    415: "메일 API가 전송 형식을 거절했습니다.",
    429: "메일 API 호출 제한에 걸렸습니다.",
  }
  if (hints[status]) return `HTTP ${status}: ${hints[status]}`
  if (diagnostics.networkCode) {
    const code = diagnostics.networkCode
    if (code === "UND_ERR_CONNECT_TIMEOUT") {
      return "메일 API와의 연결을 제한 시간 안에 맺지 못했습니다 (UND_ERR_CONNECT_TIMEOUT). 전체 요청 제한 시간과 별도로 연결 단계에서 먼저 중단될 수 있습니다. 서버의 사내 API 연결 경로·프록시·방화벽을 확인해 주세요."
    }
    if (code === "UND_ERR_HEADERS_TIMEOUT") return "메일 API의 HTTP 응답 헤더를 기다리다 제한 시간을 초과했습니다 (UND_ERR_HEADERS_TIMEOUT). 전체 요청 제한과 별도의 대기 제한입니다."
    if (code === "UND_ERR_BODY_TIMEOUT") return "메일 API의 응답 본문을 읽다가 제한 시간을 초과했습니다 (UND_ERR_BODY_TIMEOUT). 전체 요청 제한과 별도의 대기 제한입니다."
    if (code.includes("TIMEOUT") || code === "ETIMEDOUT") {
      const limit = diagnostics.timeoutMs ? ` 설정된 전체 제한 시간은 ${diagnostics.timeoutMs / 1000}초입니다.` : ""
      return `메일 API 연결 또는 응답 대기 중 시간이 초과되었습니다 (${code}).${limit}`
    }
    if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return `서버에서 메일 API 주소를 찾지 못했습니다 (${code}).`
    if (/CERT|SELF_SIGNED|ISSUER|VERIFY/.test(code)) return `메일 API의 TLS 인증서 확인에 실패했습니다 (${code}).`
    return `서버와 메일 API 사이의 연결에 실패했습니다 (${code}).`
  }
  if (diagnostics.apiReportedFailure) return `HTTP ${status}: 응답 본문에 실패 표시가 있어 발송 여부를 확인해야 합니다.`
  if (status) return `HTTP ${status}: 메일 API의 발송 결과를 확인하지 못했습니다.`
  return "발송 결과를 확인하지 못했습니다."
}

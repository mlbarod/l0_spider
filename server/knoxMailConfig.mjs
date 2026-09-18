import { getSsoCurrentUser } from "./currentUser.mjs"

const endpoint = "https://openapi.samsung.net/mail/api/v2.0/mails/send"

function configError(field) {
  return Object.assign(new Error(`메일 환경변수 확인: ${field}`), { mailField: field })
}

export function loadKnoxMailConfig(env = process.env) {
  if (env.KNOX_MAIL_ENABLED !== "true") return null
  const required = (key) => {
    const raw = env[key] ?? ""
    if (!raw.trim() || /[\r\n]/.test(raw)) throw configError(key)
    return raw.trim()
  }
  const token = required("KNOX_MAIL_TOKEN")
  const systemId = required("KNOX_MAIL_SYSTEM_ID")
  const timeoutMs = Number(env.KNOX_MAIL_TIMEOUT_MS || 30000)
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) {
    throw configError("KNOX_MAIL_TIMEOUT_MS")
  }
  return { token, systemId, timeoutMs }
}

// 이미지 전송 규격 연결을 위한 요청 준비 함수. 외부 호출이나 본문 생성은 하지 않는다.
// 반환값에는 인증정보가 있으므로 로그나 HTTP 응답에 포함하지 않는다.
export function prepareKnoxMailRequest(req, env = process.env) {
  const { knoxId } = getSsoCurrentUser(req)
  const userId = knoxId.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(userId)) {
    throw new Error("발신자 Knox ID 형식을 확인해 주세요.")
  }
  const config = loadKnoxMailConfig(env)
  if (!config) return null
  const url = new URL(endpoint)
  url.searchParams.set("userId", userId)
  return {
    url: url.href,
    method: "POST",
    redirect: "error",
    headers: {
      accept: "*/*",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
      "System-ID": config.systemId,
    },
    sender: { emailAddress: `${userId}@samsung.com` },
    timeoutMs: config.timeoutMs,
  }
}

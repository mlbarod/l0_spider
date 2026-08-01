import { randomUUID } from "node:crypto"

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/
const ERROR_SCOPE_PATTERN = /^[a-z0-9-]{2,63}$/

export function createSafeApiError({ code, message, scope, logger = console.error }) {
  if (!ERROR_CODE_PATTERN.test(code)) throw new Error("안전한 API 오류 code 형식이 올바르지 않습니다.")
  if (!ERROR_SCOPE_PATTERN.test(scope)) throw new Error("안전한 API 오류 scope 형식이 올바르지 않습니다.")
  const safeMessage = String(message ?? "").trim()
  if (!safeMessage) throw new Error("안전한 API 오류 message가 필요합니다.")

  const requestId = randomUUID()
  logger(`[api-error] scope=${scope} code=${code} requestId=${requestId}`)
  return {
    ok: false,
    code,
    error: safeMessage,
    requestId,
  }
}

const REDACTED_PATH_TEXT = "[파일 경로 숨김]"

const QUOTED_ABSOLUTE_PATH = /(["'`])(?:file:\/\/\/?|[A-Za-z]:[\\/]|\/)[^"'`\r\n]*\1/g
const WINDOWS_ABSOLUTE_PATH = /(?:^|[\s(])([A-Za-z]:[\\/][^\s,;)"'`]+)/g
const UNIX_ABSOLUTE_PATH = /(?:^|[\s(])((?:\/[^/\s,;:)"'`]+){2,})/g
const RELATIVE_FILE_PATH = /(?:^|[\s("'`])((?:\.\.?[\\/]|(?:[\w.-]+[\\/])+)[^\s,;:)"'`]+\.[A-Za-z0-9]{1,10})/g
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/

export function sanitizeErrorMessage(message, fallback = "요청을 처리하지 못했습니다.") {
  const text = String(message ?? "").trim()
  if (!text) return fallback

  return text
    .replace(QUOTED_ABSOLUTE_PATH, REDACTED_PATH_TEXT)
    .replace(WINDOWS_ABSOLUTE_PATH, (match, path) => match.replace(path, REDACTED_PATH_TEXT))
    .replace(UNIX_ABSOLUTE_PATH, (match, path) => match.replace(path, REDACTED_PATH_TEXT))
    .replace(RELATIVE_FILE_PATH, (match, path) => match.replace(path, REDACTED_PATH_TEXT))
}

export function getApiErrorMessage(payload, fallback) {
  const message = sanitizeErrorMessage(payload?.error, fallback)
  const requestId = String(payload?.requestId ?? "").trim()
  return SAFE_REQUEST_ID_PATTERN.test(requestId)
    ? `${message} [문의 코드: ${requestId}]`
    : message
}

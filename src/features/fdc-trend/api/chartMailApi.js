import { getApiErrorMessage } from "./errorMessage.js"

async function request(path, { method = "GET", body } = {}) {
  let response
  try {
    response = await fetch(path, {
      method,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    const error = new Error(method === "POST" && path === "/api/chart-mail"
      ? "발송 결과를 확인하지 못했습니다. 중복 발송을 피하려면 수신 여부를 먼저 확인해 주세요."
      : "서버에 연결하지 못했습니다.")
    error.code = "NETWORK_ERROR"
    throw error
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok !== true) {
    const error = new Error(getApiErrorMessage(payload, "요청 결과를 확인하지 못했습니다."))
    error.code = payload.code ?? "UNKNOWN_RESPONSE"
    throw error
  }
  return payload
}

export const fetchMailRecipientGroups = () => request("/api/mail-recipient-groups")
export const saveMailRecipientGroup = (body) => request("/api/mail-recipient-groups", { method: "POST", body })
export const deleteMailRecipientGroup = (id) => request("/api/mail-recipient-groups", { method: "DELETE", body: { id } })
export const fetchChartMailStatus = () => request("/api/chart-mail")
export const sendChartMail = (body) => request("/api/chart-mail", { method: "POST", body })

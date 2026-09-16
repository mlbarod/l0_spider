import { getSsoCurrentUser, sendSsoAuthenticationError } from "./currentUser.mjs"

// Inline PNG delivery is user-confirmed, but the actual image payload and HTML
// reference format have not been supplied. Do not guess a Knox request format.
const reason = "본문 이미지 발송 연동에 필요한 템플릿·API 전송 규격을 확인 중입니다."

export async function handleChartMailRequest(req, res) {
  const json = (status, payload) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
    res.end(JSON.stringify(payload))
  }
  try {
    getSsoCurrentUser(req)
    if (req.method === "GET") return json(200, { ok: true, ready: false, reason })
    if (req.method === "POST") return json(503, { ok: false, code: "MAIL_TRANSPORT_NOT_CONFIGURED", error: reason })
    return json(405, { ok: false, error: "지원하지 않는 요청입니다." })
  } catch (error) {
    if (!sendSsoAuthenticationError(error, res)) throw error
  }
}

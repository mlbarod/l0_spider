import { createHash, timingSafeEqual } from "node:crypto"
import { handleDashboardDataRequest } from "./dashboardData.mjs"

const endpoint = "/api/mailing-report/dashboard-data"
const keyPattern = /^[A-Za-z0-9_-]{32,256}$/
const digest = (value) => createHash("sha256").update(value).digest()

function reject(req, res, status, code, error, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  })
  res.end(req.method === "HEAD" ? undefined : JSON.stringify({ ok: false, code, error }))
  return true
}

// This credential grants read access to the full dashboard, not a browser identity.
// Only this exact route may terminate before SSO and user access-control checks.
export function createMailingReportDataHandler({
  env = process.env,
  ssoConfig,
  dashboardHandler = handleDashboardDataRequest,
}) {
  const key = env.MAILING_REPORT_API_KEY ?? ""
  const expectedDigest = keyPattern.test(key) ? digest(key) : null

  return async function handleMailingReportData(req, res) {
    const url = new URL(req.url ?? "/", "http://localhost")
    if (url.pathname !== endpoint) return false

    if (!expectedDigest) {
      return reject(req, res, 503, "MAILING_REPORT_API_DISABLED", "메일 보고서 데이터 API가 설정되지 않았습니다.")
    }

    // Keep the production HTTPS/trusted-proxy boundary used by SSO. A service key
    // replaces the interactive session, not the transport protection.
    if (ssoConfig.enabled) {
      const peer = String(req.socket?.remoteAddress ?? "").replace(/^::ffff:/, "")
      if (!ssoConfig.trustedProxies.includes(peer) || req.headers["x-forwarded-proto"] !== "https") {
        return reject(req, res, 400, "SSO_PROXY_REQUIRED", "HTTPS 프록시 설정을 확인해 주세요.")
      }
    }

    const authorizationCount = (req.rawHeaders ?? []).filter((value, index) => (
      index % 2 === 0 && value.toLowerCase() === "authorization"
    )).length
    const token = /^Bearer ([A-Za-z0-9_-]{32,256})$/i.exec(req.headers.authorization ?? "")?.[1]
    if (authorizationCount > 1 || !token || !timingSafeEqual(digest(token), expectedDigest)) {
      return reject(req, res, 401, "MAILING_REPORT_AUTHENTICATION_REQUIRED", "메일 보고서 API 인증이 필요합니다.", {
        "WWW-Authenticate": "Bearer",
      })
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      return reject(req, res, 405, "METHOD_NOT_ALLOWED", "조회 요청만 허용됩니다.", { Allow: "GET, HEAD" })
    }

    res.setHeader("Cache-Control", "no-store")
    await dashboardHandler(req, res, url)
    return true
  }
}

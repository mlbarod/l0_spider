import { createOidcLoginRequest, hashOpaqueToken, loadCertificatePublicKey, loadOidcConfig, mapIdentityClaims, normalizeReturnTo, verifyIdToken, randomOpaqueToken } from "./oidcService.mjs"

const SESSION_COOKIE = "__Host-l0_spider_session"
const CORRELATION_COOKIE = "__Secure-l0_spider_oidc"

function cookie(name, value, seconds, correlation = false) {
  return `${name}=${value}; Path=${correlation ? "/auth/callback" : "/"}; HttpOnly; Secure; SameSite=${correlation ? "None" : "Lax"}; Max-Age=${Math.max(0, Math.floor(seconds))}`
}

function cookies(req) {
  const result = new Map()
  for (const part of String(req.headers.cookie ?? "").split(";")) {
    const offset = part.indexOf("=")
    if (offset < 1) continue
    const name = part.slice(0, offset).trim()
    // Ambiguous credentials must not authenticate.
    result.set(name, result.has(name) ? "" : part.slice(offset + 1).trim())
  }
  return result
}

function json(res, status, code, error) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify({ ok: false, code, error }))
  return true
}

function redirect(res, location, setCookies = []) {
  res.writeHead(303, { Location: location, "Cache-Control": "no-store", "Set-Cookie": setCookies })
  res.end()
  return true
}

function trustedOrigin(req, origin) {
  try {
    const source = req.headers.origin ?? req.headers.referer
    return new URL(source).origin === origin
  } catch {
    return false
  }
}

async function readForm(req) {
  if (String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new Error("Invalid form")
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 24 * 1024) throw new Error("Form too large")
    chunks.push(chunk)
  }
  const form = new URLSearchParams(Buffer.concat(chunks).toString("utf8"))
  for (const key of ["state", "code", "id_token", "error"]) {
    if (form.getAll(key).length > 1) throw new Error("Duplicate field")
  }
  return form
}

// Single-process, bounded server-side storage. A restart revokes all sessions.
// No application DB/schema changes or browser-stored identity/token are needed.
export function createSsoAuth({ config = loadOidcConfig(), publicKey, now = Date.now } = {}) {
  if (!config.enabled) return { enabled: false, async handle() { return false } }
  const key = publicKey ?? loadCertificatePublicKey(config.certificatePath)
  if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails?.modulusLength < 2048) {
    throw new Error("SSO 인증서는 2048비트 이상의 RSA 공개키여야 합니다.")
  }
  const origin = new URL(config.redirectUri).origin
  const sessions = new Map()
  const transactions = new Map()
  const hash = (value) => hashOpaqueToken(value, config.sessionSecret)
  const clearSession = () => cookie(SESSION_COOKIE, "", 0)
  const clearCorrelation = () => cookie(CORRELATION_COOKIE, "", 0, true)
  let nextCleanup = 0

  function cleanup(time) {
    if (time < nextCleanup) return
    for (const [id, entry] of sessions) {
      if (entry.expiresAt <= time || entry.idleExpiresAt <= time) sessions.delete(id)
    }
    for (const [id, entry] of transactions) {
      if (entry.expiresAt <= time) transactions.delete(id)
    }
    nextCleanup = time + 30_000
  }

  return {
    enabled: true,
    async handle(req, res) {
      req.ssoRequired = true
      req.auth = null
      res.setHeader("Cache-Control", "no-store")
      res.setHeader("Referrer-Policy", "no-referrer")
      const url = new URL(req.url ?? "/", origin)
      const peer = String(req.socket?.remoteAddress ?? "").replace(/^::ffff:/, "")
      // node:http has no Express `trust proxy`. Trust only the configured peer,
      // and require Nginx to overwrite X-Forwarded-Proto with a single https value.
      if (!config.trustedProxies.includes(peer) || req.headers["x-forwarded-proto"] !== "https") {
        return json(res, 400, "SSO_PROXY_REQUIRED", "HTTPS 프록시 설정을 확인해 주세요.")
      }
      const time = now()
      cleanup(time)
      const requestCookies = cookies(req)
      const rawSession = requestCookies.get(SESSION_COOKIE) ?? ""
      const sessionHash = rawSession ? hash(rawSession) : ""
      const session = sessions.get(sessionHash)
      if (session && session.expiresAt > time && session.idleExpiresAt > time) {
        req.auth = session.identity
      } else if (session) {
        sessions.delete(sessionHash)
      }

      if (url.pathname === "/auth/logged-out") {
        if (!["GET", "HEAD"].includes(req.method)) return json(res, 405, "METHOD_NOT_ALLOWED", "GET 요청만 허용됩니다.")
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        res.end(req.method === "HEAD" ? "" : '<!doctype html><html lang="ko"><meta charset="utf-8"><title>로그아웃</title><p>로그아웃되었습니다.</p><a href="/auth/login">다시 로그인</a></html>')
        return true
      }

      if (url.pathname === "/auth/login") {
        if (req.method !== "GET") return json(res, 405, "METHOD_NOT_ALLOWED", "GET 요청만 허용됩니다.")
        if (transactions.size >= config.maxEntries) return json(res, 503, "SSO_BUSY", "잠시 후 다시 로그인해 주세요.")
        const login = createOidcLoginRequest(config, { returnTo: normalizeReturnTo(url.searchParams.get("returnTo")) })
        transactions.set(hash(login.state), {
          correlation: hash(login.correlation), nonce: login.nonce, returnTo: login.returnTo,
          expiresAt: time + config.loginTransactionSeconds * 1000,
          previousSession: sessionHash,
        })
        return redirect(res, login.url, [cookie(CORRELATION_COOKIE, login.correlation, config.loginTransactionSeconds, true)])
      }

      if (url.pathname === "/auth/callback") {
        if (req.method !== "POST") return json(res, 405, "METHOD_NOT_ALLOWED", "POST 요청만 허용됩니다.")
        res.setHeader("Set-Cookie", clearCorrelation())
        try {
          const form = await readForm(req)
          const stateHash = hash(form.get("state") ?? "")
          const transaction = transactions.get(stateHash)
          const correlation = requestCookies.get(CORRELATION_COOKIE)
          if (!transaction || !correlation || transaction.correlation !== hash(correlation)) throw new Error("Invalid state")
          // Consume synchronously before verification: concurrent replay cannot win.
          transactions.delete(stateHash)
          const callbackTime = now()
          if (transaction.expiresAt <= callbackTime || form.has("error")) throw new Error("Expired or denied")
          const claims = verifyIdToken(form.get("id_token"), {
            publicKey: key, clientId: config.clientId, issuer: config.expectedIssuer,
            nonce: transaction.nonce, code: form.get("code"),
            clockToleranceSeconds: config.clockToleranceSeconds,
            nowSeconds: Math.floor(callbackTime / 1000),
          })
          const identity = Object.freeze(mapIdentityClaims(claims, config))
          const expiresAt = Math.min(claims.exp * 1000, callbackTime + config.absoluteSeconds * 1000)
          if (expiresAt <= callbackTime) throw new Error("Expired token")
          if (sessions.size >= config.maxEntries) return json(res, 503, "SSO_BUSY", "잠시 후 다시 로그인해 주세요.")
          const token = randomOpaqueToken()
          sessions.delete(transaction.previousSession)
          sessions.delete(sessionHash)
          sessions.set(hash(token), { identity, expiresAt, idleExpiresAt: Math.min(expiresAt, callbackTime + config.idleSeconds * 1000) })
          return redirect(res, transaction.returnTo, [clearCorrelation(), cookie(SESSION_COOKIE, token, (expiresAt - callbackTime) / 1000)])
        } catch {
          // Never log callback bodies, claims, codes, tokens or secrets.
          return json(res, 401, "SSO_CALLBACK_FAILED", "SSO 응답 검증에 실패했습니다. /auth/login에서 다시 로그인해 주세요.")
        }
      }

      if (url.pathname === "/auth/logout") {
        if (req.method !== "POST") return json(res, 405, "METHOD_NOT_ALLOWED", "POST 요청만 허용됩니다.")
        if (!trustedOrigin(req, origin)) return json(res, 403, "SSO_ORIGIN_DENIED", "요청 출처를 확인해 주세요.")
        sessions.delete(sessionHash)
        // In-flight login must not resurrect a session after logout.
        for (const [id, transaction] of transactions) {
          if (sessionHash && transaction.previousSession === sessionHash) transactions.delete(id)
        }
        return redirect(res, config.signoutUrl, [clearSession(), clearCorrelation()])
      }

      if (url.pathname.startsWith("/auth/")) return json(res, 404, "NOT_FOUND", "존재하지 않는 인증 경로입니다.")
      if (!req.auth) {
        if (url.pathname === "/api" || url.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(req.method)) {
          return json(res, 401, "SSO_AUTHENTICATION_REQUIRED", "SSO 로그인이 필요합니다.")
        }
        return redirect(res, `/auth/login?returnTo=${encodeURIComponent(normalizeReturnTo(`${url.pathname}${url.search}`))}`)
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && !trustedOrigin(req, origin)) {
        return json(res, 403, "SSO_ORIGIN_DENIED", "요청 출처를 확인해 주세요.")
      }
      // Polling the session status must not keep an idle browser logged in forever.
      if (url.pathname !== "/api/auth/session") {
        session.idleExpiresAt = Math.min(session.expiresAt, time + config.idleSeconds * 1000)
      }
      return false
    },
  }
}

export function handleSsoSessionRequest(req, res, enabled) {
  if (req.method !== "GET") return json(res, 405, "METHOD_NOT_ALLOWED", "GET 요청만 허용됩니다.")
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify({ ok: true, enabled }))
}

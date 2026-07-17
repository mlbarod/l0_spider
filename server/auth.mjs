import {
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as verifySignature,
  X509Certificate,
} from "node:crypto"
import { readFileSync } from "node:fs"

const DEFAULT_SESSION_AGE_SECONDS = 24 * 60 * 60
const SESSION_COOKIE_NAME = "l0_spider_sessionid"
const sessions = new Map()

const AUTH_PATHS = new Set([
  "/api/v1/auth/",
  "/api/v1/auth/config",
  "/api/v1/auth/login",
  "/api/v1/auth/logout",
  "/api/v1/auth/me",
  "/api/v1/auth/callback",
  "/auth/google/callback",
  "/auth/google/callback/",
])

class AuthError extends Error {
  constructor(message, code, statusCode = 400) {
    super(message)
    this.name = "AuthError"
    this.code = code
    this.statusCode = statusCode
  }
}

function envBoolean(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase())
}

function envPositiveInteger(value, fallback) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function firstHeaderValue(value) {
  return String(value ?? "").split(",")[0].trim()
}

export function getRequestOrigin(req) {
  const forwardedProto = firstHeaderValue(req.headers?.["x-forwarded-proto"])
  const forwardedHost = firstHeaderValue(req.headers?.["x-forwarded-host"])
  const protocol = forwardedProto || (req.socket?.encrypted ? "https" : "http")
  const host = forwardedHost || firstHeaderValue(req.headers?.host) || "localhost"
  return `${protocol}://${host}`
}

export function getAuthConfig(req, env = process.env) {
  const requestOrigin = getRequestOrigin(req)
  const frontendBaseUrl = String(env.FRONTEND_BASE_URL || requestOrigin).replace(/\/+$/, "")
  const clientId = String(env.OIDC_CLIENT_ID || env.ADFS_CLIENT_ID || "").trim()
  const issuer = String(env.OIDC_ISSUER || env.ADFS_ISSUER || "").trim()
  const authorizationUrl = String(env.ADFS_AUTH_URL || "").trim()
  const logoutUrl = String(env.ADFS_LOGOUT_URL || frontendBaseUrl).trim()
  const redirectUri = String(
    env.OIDC_REDIRECT_URI
      || env.ADFS_REDIRECT_URI
      || `${requestOrigin}/auth/google/callback/`,
  ).trim()
  const certificatePath = String(env.ADFS_CER_PATH || "").trim()
  const publicKey = String(env.OIDC_PUBLIC_KEY || "").replaceAll("\\n", "\n").trim()
  const verifyToken = envBoolean(env.OIDC_VERIFY_TOKEN, true)
  const sessionAgeSeconds = envPositiveInteger(env.SESSION_COOKIE_AGE, DEFAULT_SESSION_AGE_SECONDS)

  const allowedRedirectHosts = new Set(
    String(env.ALLOWED_REDIRECT_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  )
  for (const candidate of [frontendBaseUrl, requestOrigin]) {
    try {
      allowedRedirectHosts.add(new URL(candidate).host.toLowerCase())
    } catch {
      // Invalid optional origins are handled by redirect resolution.
    }
  }

  return {
    authorizationUrl,
    certificatePath,
    clientId,
    frontendBaseUrl,
    issuer,
    logoutUrl,
    publicKey,
    redirectUri,
    requestOrigin,
    allowedRedirectHosts,
    allowHttp: envBoolean(env.OIDC_ALLOW_HTTP, requestOrigin.startsWith("http://")),
    cookieName: String(env.SESSION_COOKIE_NAME || SESSION_COOKIE_NAME).trim() || SESSION_COOKIE_NAME,
    cookieSameSite: String(env.SESSION_COOKIE_SAMESITE || "").trim(),
    cookieSecure: env.SESSION_COOKIE_SECURE == null
      ? requestOrigin.startsWith("https://")
      : envBoolean(env.SESSION_COOKIE_SECURE, true),
    sessionAgeSeconds,
    verifyToken,
    clockToleranceSeconds: envPositiveInteger(env.OIDC_CLOCK_TOLERANCE_SECONDS, 60),
    providerConfigured: Boolean(
      authorizationUrl
      && clientId
      && issuer
      && redirectUri
      && (!verifyToken || certificatePath || publicKey),
    ),
  }
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  })
  res.end(JSON.stringify(payload))
}

function sendText(res, statusCode, message, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  })
  res.end(message)
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store", ...headers })
  res.end()
}

function parseCookies(req) {
  const result = {}
  for (const part of String(req.headers?.cookie || "").split(";")) {
    const separator = part.indexOf("=")
    if (separator < 0) continue
    const name = part.slice(0, separator).trim()
    if (!name) continue
    try {
      result[name] = decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      result[name] = part.slice(separator + 1).trim()
    }
  }
  return result
}

function serializeSessionCookie(sessionId, config, { clear = false } = {}) {
  const sameSite = config.cookieSameSite
    || (config.cookieSecure ? "None" : "Lax")
  const parts = [
    `${config.cookieName}=${clear ? "" : encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${sameSite}`,
    `Max-Age=${clear ? 0 : config.sessionAgeSeconds}`,
  ]
  if (config.cookieSecure) parts.push("Secure")
  return parts.join("; ")
}

function cleanupSessions(now = Date.now()) {
  for (const [sessionId, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(sessionId)
  }
}

function findSession(req, config) {
  cleanupSessions()
  const sessionId = parseCookies(req)[config.cookieName]
  if (!sessionId) return { sessionId: null, session: null }
  const session = sessions.get(sessionId)
  if (!session) return { sessionId, session: null }
  return { sessionId, session }
}

function createSession(config, values = {}) {
  const sessionId = randomBytes(32).toString("base64url")
  const session = {
    nonce: null,
    user: null,
    ...values,
    expiresAt: Date.now() + (config.sessionAgeSeconds * 1000),
  }
  sessions.set(sessionId, session)
  return { sessionId, session }
}

function getOrCreateSession(req, config) {
  const existing = findSession(req, config)
  if (existing.session) return { ...existing, created: false }
  return { ...createSession(config), created: true }
}

function base64UrlEncode(value) {
  return Buffer.from(String(value), "utf8").toString("base64url")
}

function base64UrlDecode(value) {
  return Buffer.from(String(value), "base64url").toString("utf8")
}

function safeStringEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false
  const leftBytes = Buffer.from(left)
  const rightBytes = Buffer.from(right)
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
}

export function resolveSafeRedirectTarget(target, config) {
  let fallback
  try {
    fallback = new URL(config.frontendBaseUrl)
  } catch {
    fallback = new URL(config.requestOrigin)
  }

  let resolved
  try {
    resolved = new URL(String(target || "/"), fallback)
  } catch {
    return fallback.toString()
  }

  const allowedSchemes = config.allowHttp ? new Set(["http:", "https:"]) : new Set(["https:"])
  if (!allowedSchemes.has(resolved.protocol)) return fallback.toString()
  if (!config.allowedRedirectHosts.has(resolved.host.toLowerCase())) return fallback.toString()
  return resolved.toString()
}

function decodeStateTarget(state, config) {
  try {
    return resolveSafeRedirectTarget(base64UrlDecode(state), config)
  } catch {
    return resolveSafeRedirectTarget(null, config)
  }
}

function parseJwtJson(segment, label) {
  try {
    const value = JSON.parse(Buffer.from(segment, "base64url").toString("utf8"))
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error()
    return value
  } catch {
    throw new AuthError(`OIDC ${label}을 해석하지 못했습니다.`, "invalid_token")
  }
}

function loadVerificationKey(config) {
  if (config.publicKey) return createPublicKey(config.publicKey)
  if (!config.certificatePath) {
    throw new AuthError("OIDC 공개 인증서가 설정되지 않았습니다.", "certificate_not_configured", 500)
  }

  try {
    const certificateBytes = readFileSync(config.certificatePath)
    try {
      return new X509Certificate(certificateBytes).publicKey
    } catch {
      return createPublicKey(certificateBytes)
    }
  } catch (error) {
    throw new AuthError(`OIDC 공개 인증서를 읽지 못했습니다: ${error.message}`, "certificate_unavailable", 500)
  }
}

function audienceMatches(audience, clientId) {
  return Array.isArray(audience) ? audience.includes(clientId) : audience === clientId
}

export function verifyIdToken(rawToken, config, nowSeconds = Math.floor(Date.now() / 1000)) {
  const parts = String(rawToken || "").split(".")
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new AuthError("OIDC id_token 형식이 올바르지 않습니다.", "invalid_token")
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts
  const header = parseJwtJson(encodedHeader, "header")
  const claims = parseJwtJson(encodedPayload, "payload")

  if (header.alg !== "RS256") {
    throw new AuthError("OIDC id_token 알고리즘이 올바르지 않습니다.", "invalid_token")
  }

  if (config.verifyToken) {
    const isValidSignature = verifySignature(
      "RSA-SHA256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      loadVerificationKey(config),
      Buffer.from(encodedSignature, "base64url"),
    )
    if (!isValidSignature) {
      throw new AuthError("OIDC id_token 서명이 올바르지 않습니다.", "invalid_token")
    }

    const tolerance = config.clockToleranceSeconds || 0
    if (Number.isFinite(Number(claims.exp)) && nowSeconds > Number(claims.exp) + tolerance) {
      throw new AuthError("OIDC id_token이 만료되었습니다.", "token_expired")
    }
    if (Number.isFinite(Number(claims.nbf)) && nowSeconds + tolerance < Number(claims.nbf)) {
      throw new AuthError("OIDC id_token이 아직 유효하지 않습니다.", "invalid_token")
    }
    if (claims.iss !== config.issuer) {
      throw new AuthError("OIDC issuer가 일치하지 않습니다.", "invalid_iss")
    }
    if (!audienceMatches(claims.aud, config.clientId)) {
      throw new AuthError("OIDC audience가 일치하지 않습니다.", "invalid_aud")
    }
  }

  return claims
}

export function extractUserFromClaims(claims) {
  const claimMap = {
    loginid: "knoxId",
    userid: "avatarid",
    sabun: "sabun",
    username: "username",
    username_en: "usernameEn",
    first_name: "firstName",
    last_name: "lastName",
    givenname: "givenName",
    surname: "surname",
    deptname: "department",
    deptid: "departmentId",
    mail: "email",
    grdName: "gradeName",
    grdname_en: "gradeNameEn",
    busname: "businessName",
    intcode: "internationalCode",
    intname: "internationalName",
    origincomp: "originCompany",
    employeetype: "employeeType",
  }
  const user = {}
  for (const [claimName, fieldName] of Object.entries(claimMap)) {
    const value = claims?.[claimName]
    user[fieldName] = value == null ? null : String(value).trim() || null
  }

  if (!user.sabun) throw new AuthError("SSO 응답에 sabun이 없습니다.", "missing_sabun")
  if (!user.knoxId) throw new AuthError("SSO 응답에 loginid가 없습니다.", "missing_loginid")

  user.username = user.username || user.usernameEn || user.knoxId
  return {
    ...user,
    id: user.sabun,
    usr_id: user.knoxId,
    knox_id: user.knoxId,
  }
}

export function getAuthenticatedUser(req) {
  const config = getAuthConfig(req)
  return findSession(req, config).session?.user || null
}

export function requireAuthenticatedUser(req) {
  const user = getAuthenticatedUser(req)
  if (user?.knoxId) return user
  throw new AuthError("SSO 로그인이 필요합니다.", "unauthorized", 401)
}

async function readFormBody(req) {
  let body = ""
  for await (const chunk of req) {
    body += chunk
    if (body.length > 2 * 1024 * 1024) {
      throw new AuthError("SSO callback 요청이 너무 큽니다.", "invalid_request", 413)
    }
  }
  return new URLSearchParams(body)
}

function appendError(target, errorCode) {
  const url = new URL(target)
  url.searchParams.set("error", errorCode)
  return url.toString()
}

function publicAuthConfig(config) {
  return {
    issuer: config.issuer,
    clientId: config.clientId,
    loginUrl: "/api/v1/auth/login",
    logoutUrl: "/api/v1/auth/logout",
    meUrl: "/api/v1/auth/me",
    callbackUrl: config.redirectUri,
    responseMode: "form_post",
    responseType: "id_token",
    frontendRedirect: config.frontendBaseUrl,
    sessionMaxAgeSeconds: config.sessionAgeSeconds,
    providerConfigured: config.providerConfigured,
    locale: "ko-KR",
    timeZone: "Asia/Seoul",
  }
}

async function handleLogin(req, res, url, config) {
  if (req.method !== "GET") {
    sendJson(res, 405, { detail: "method not allowed" })
    return
  }
  if (!config.providerConfigured) {
    sendText(res, 400, "oidc not configured")
    return
  }

  const target = resolveSafeRedirectTarget(
    url.searchParams.get("target") || url.searchParams.get("next"),
    config,
  )
  const nonce = randomBytes(24).toString("hex")
  const { sessionId, session } = getOrCreateSession(req, config)
  session.nonce = nonce
  session.expiresAt = Date.now() + (config.sessionAgeSeconds * 1000)

  const authorizeUrl = new URL(config.authorizationUrl)
  authorizeUrl.searchParams.set("client_id", config.clientId)
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri)
  authorizeUrl.searchParams.set("response_mode", "form_post")
  authorizeUrl.searchParams.set("response_type", "id_token")
  authorizeUrl.searchParams.set("scope", "openid profile email")
  authorizeUrl.searchParams.set("nonce", nonce)
  authorizeUrl.searchParams.set("state", base64UrlEncode(target))

  redirect(res, authorizeUrl.toString(), {
    "Set-Cookie": serializeSessionCookie(sessionId, config),
  })
}

async function handleCallback(req, res, config) {
  if (req.method !== "POST") {
    sendText(res, 400, "form_post only")
    return
  }
  if (!config.providerConfigured) {
    sendText(res, 400, "oidc not configured")
    return
  }

  const form = await readFormBody(req)
  const rawToken = form.get("id_token")
  const state = form.get("state")
  if (!rawToken || !state) {
    sendText(res, 400, "missing id_token/state")
    return
  }

  const target = decodeStateTarget(state, config)
  const { sessionId, session } = findSession(req, config)
  const expectedNonce = session?.nonce
  if (session) session.nonce = null

  try {
    const claims = verifyIdToken(rawToken, config)
    if (!safeStringEqual(String(claims.nonce || ""), String(expectedNonce || ""))) {
      throw new AuthError("OIDC nonce가 일치하지 않습니다.", "invalid_nonce")
    }
    const user = extractUserFromClaims(claims)

    if (sessionId) sessions.delete(sessionId)
    const authenticatedSession = createSession(config, { user })
    redirect(res, target, {
      "Set-Cookie": serializeSessionCookie(authenticatedSession.sessionId, config),
    })
  } catch (error) {
    const code = error instanceof AuthError ? error.code : "invalid_token"
    redirect(res, appendError(target, code))
  }
}

async function handleMe(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { detail: "method not allowed" })
    return
  }
  const user = getAuthenticatedUser(req)
  if (!user) {
    sendJson(res, 401, { detail: "unauthorized" })
    return
  }
  sendJson(res, 200, user)
}

async function handleLogout(req, res, config) {
  if (req.method !== "GET" && req.method !== "POST") {
    sendJson(res, 405, { detail: "method not allowed" })
    return
  }
  const { sessionId } = findSession(req, config)
  if (sessionId) sessions.delete(sessionId)
  const headers = {
    "Set-Cookie": serializeSessionCookie("", config, { clear: true }),
  }
  if (req.method === "POST") {
    sendJson(res, 200, { logoutUrl: config.logoutUrl }, headers)
    return
  }
  redirect(res, config.logoutUrl, headers)
}

export function isAuthPath(pathname) {
  return AUTH_PATHS.has(pathname)
}

export async function handleAuthRequest(req, res, url) {
  const config = getAuthConfig(req)
  switch (url.pathname) {
    case "/api/v1/auth/config":
      sendJson(res, 200, publicAuthConfig(config))
      return
    case "/api/v1/auth/login":
      await handleLogin(req, res, url, config)
      return
    case "/auth/google/callback":
    case "/auth/google/callback/":
    case "/api/v1/auth/callback":
      await handleCallback(req, res, config)
      return
    case "/api/v1/auth/me":
      await handleMe(req, res)
      return
    case "/api/v1/auth/logout":
      await handleLogout(req, res, config)
      return
    case "/api/v1/auth/": {
      const target = resolveSafeRedirectTarget(url.searchParams.get("next"), config)
      redirect(res, target)
      return
    }
    default:
      sendJson(res, 404, { detail: "not found" })
  }
}

export function clearAuthSessionsForTests() {
  sessions.clear()
}

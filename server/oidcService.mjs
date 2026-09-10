// Adapted from mlbarod/sso_template, commit 814ed66e69b15c9f4cffe692338f3bb9579714b1.
import {
  X509Certificate,
  createHash,
  createHmac,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from "node:crypto"
import { readFileSync } from "node:fs"
import { isIP } from "node:net"

const DEFAULT_LOGIN_TRANSACTION_SECONDS = 300
const DEFAULT_IDLE_SECONDS = 1800
const DEFAULT_ABSOLUTE_SECONDS = 28800
const DEFAULT_CLOCK_TOLERANCE_SECONDS = 60

function text(environment, name, { required = false } = {}) {
  const value = environment[name]?.trim()
  if (required && !value) throw new Error(`SSO 환경변수가 필요합니다: ${name}`)
  return value ?? ""
}

function boolean(environment, name, fallback = false) {
  const value = text(environment, name).toLowerCase()
  if (!value) return fallback
  if (value === "true" || value === "1") return true
  if (value === "false" || value === "0") return false
  throw new Error(`${name}은 true 또는 false여야 합니다.`)
}

function positiveInteger(environment, name, fallback, { min = 1, max = 86_400 } = {}) {
  const source = text(environment, name)
  if (!source) return fallback
  if (!/^\d+$/.test(source)) throw new Error(`${name}은 정수여야 합니다.`)
  const value = Number(source)
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name}은 ${min}~${max} 범위여야 합니다.`)
  }
  return value
}

function absoluteUrl(value, name) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${name}은 유효한 절대 URL이어야 합니다.`)
  }
  if (url.username || url.password || url.hash) throw new Error(`${name}에 사용자정보나 fragment를 넣을 수 없습니다.`)
  if (url.protocol !== "https:") throw new Error(`${name}은 https URL이어야 합니다.`)
  return url.toString()
}

export function loadOidcConfig(environment = process.env) {
  const enabled = boolean(environment, "SSO_ENABLED", false)
  if (!enabled) return { enabled: false }

  const clientId = text(environment, "SSO_CLIENT_ID", { required: true })
  const redirectUri = absoluteUrl(text(environment, "SSO_REDIRECT_URI", { required: true }), "SSO_REDIRECT_URI")
  const authorizeUrl = absoluteUrl(text(environment, "SSO_AUTHORIZE_URL", { required: true }), "SSO_AUTHORIZE_URL")
  const signoutUrl = absoluteUrl(text(environment, "SSO_SIGNOUT_URL", { required: true }), "SSO_SIGNOUT_URL")
  const certificatePath = text(environment, "SSO_CERTIFICATE_PATH", { required: true })
  const sessionSecret = text(environment, "SSO_SESSION_SECRET", { required: true })
  if (Buffer.byteLength(sessionSecret, "utf8") < 32) {
    throw new Error("SSO_SESSION_SECRET은 32바이트 이상이어야 합니다.")
  }

  const expectedIssuer = text(environment, "SSO_EXPECTED_ISSUER", { required: true })
  const userIdClaim = text(environment, "SSO_USER_ID_CLAIM", { required: true })
  const callback = new URL(redirectUri)
  if (callback.pathname !== "/auth/callback" || callback.search) {
    throw new Error("SSO_REDIRECT_URI 경로는 /auth/callback이어야 합니다.")
  }
  const trustedProxies = text(environment, "SSO_TRUSTED_PROXY_IPS", { required: true })
    .split(",").map((value) => value.trim())
  if (trustedProxies.some((value) => !isIP(value))) {
    throw new Error("SSO_TRUSTED_PROXY_IPS에는 Nginx의 정확한 IP만 지정하세요.")
  }
  if (boolean(environment, "SSO_SECURE_COOKIES", true) !== true) {
    throw new Error("SSO 쿠키는 HTTPS 전용이어야 합니다.")
  }

  return {
    enabled: true,
    clientId,
    redirectUri,
    authorizeUrl,
    signoutUrl,
    certificatePath,
    sessionSecret,
    expectedIssuer,
    userIdClaim,
    trustedProxies,
    loginTransactionSeconds: positiveInteger(environment, "SSO_LOGIN_TRANSACTION_SECONDS", DEFAULT_LOGIN_TRANSACTION_SECONDS, { max: 900 }),
    idleSeconds: positiveInteger(environment, "SSO_SESSION_IDLE_SECONDS", DEFAULT_IDLE_SECONDS),
    absoluteSeconds: positiveInteger(environment, "SSO_SESSION_ABSOLUTE_SECONDS", DEFAULT_ABSOLUTE_SECONDS, { max: 604_800 }),
    clockToleranceSeconds: positiveInteger(environment, "SSO_CLOCK_TOLERANCE_SECONDS", DEFAULT_CLOCK_TOLERANCE_SECONDS, { min: 0, max: 300 }),
    maxEntries: positiveInteger(environment, "SSO_MAX_SESSIONS", 10000, { max: 100000 }),
  }
}

function decodeBase64Url(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`${label} 형식이 올바르지 않습니다.`)
  return Buffer.from(value, "base64url")
}

function parseJsonSegment(value, label) {
  try {
    const parsed = JSON.parse(decodeBase64Url(value, label).toString("utf8"))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error()
    return parsed
  } catch {
    throw new Error(`${label} 형식이 올바르지 않습니다.`)
  }
}

function constantTimeTextEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual))
  const expectedBuffer = Buffer.from(String(expected))
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

export function hashOpaqueToken(value, secret) {
  return createHmac("sha256", secret).update(value).digest("hex")
}

export function randomOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url")
}

export function createOidcLoginRequest(config, { returnTo = "/" } = {}) {
  const state = randomOpaqueToken()
  const nonce = randomOpaqueToken()
  const correlation = randomOpaqueToken()
  const url = new URL(config.authorizeUrl)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_mode", "form_post")
  url.searchParams.set("response_type", "code id_token")
  url.searchParams.set("scope", "openid profile")
  url.searchParams.set("nonce", nonce)
  url.searchParams.set("state", state)
  return { url: url.toString(), state, nonce, correlation, returnTo }
}

export function loadCertificatePublicKey(
  certificatePath,
  readFile = readFileSync,
  Certificate = X509Certificate,
) {
  const certificate = new Certificate(readFile(certificatePath))
  return certificate.publicKey
}

export function verifyIdToken(idToken, {
  publicKey,
  clientId,
  issuer,
  nonce,
  code,
  clockToleranceSeconds = DEFAULT_CLOCK_TOLERANCE_SECONDS,
  nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > 16_384) {
    throw new Error("ID token 형식이 올바르지 않습니다.")
  }
  const segments = idToken.split(".")
  if (segments.length !== 3) throw new Error("ID token 형식이 올바르지 않습니다.")
  const [encodedHeader, encodedPayload, encodedSignature] = segments
  const header = parseJsonSegment(encodedHeader, "ID token header")
  const claims = parseJsonSegment(encodedPayload, "ID token payload")
  if (header.crit !== undefined) throw new Error("지원하지 않는 ID token 확장입니다.")
  if (header.alg !== "RS256") throw new Error("허용하지 않는 ID token 서명 알고리즘입니다.")

  const verifier = createVerify("RSA-SHA256")
  verifier.update(`${encodedHeader}.${encodedPayload}`)
  verifier.end()
  if (!verifier.verify(publicKey, decodeBase64Url(encodedSignature, "ID token signature"))) {
    throw new Error("ID token 서명이 올바르지 않습니다.")
  }

  if (typeof claims.iss !== "string" || claims.iss.length === 0) throw new Error("ID token 발급자가 올바르지 않습니다.")
  if (!issuer || claims.iss !== issuer) throw new Error("ID token 발급자가 올바르지 않습니다.")
  if (typeof claims.sub !== "string" || claims.sub.length === 0 || claims.sub.length > 255) throw new Error("ID token subject가 올바르지 않습니다.")
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (audiences.length === 0 || audiences.some((audience) => typeof audience !== "string")) throw new Error("ID token 대상이 올바르지 않습니다.")
  if (!audiences.some((audience) => constantTimeTextEqual(audience ?? "", clientId))) {
    throw new Error("ID token 대상이 올바르지 않습니다.")
  }
  if ((audiences.length > 1 || claims.azp !== undefined) && claims.azp !== clientId) throw new Error("ID token authorized party가 올바르지 않습니다.")
  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds - clockToleranceSeconds) throw new Error("ID token이 만료되었습니다.")
  if (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > nowSeconds + clockToleranceSeconds)) throw new Error("ID token의 사용 시작 시각이 올바르지 않습니다.")
  if (!Number.isFinite(claims.iat) || claims.iat > nowSeconds + clockToleranceSeconds) throw new Error("ID token 발급 시각이 올바르지 않습니다.")
  if (typeof claims.nonce !== "string" || !constantTimeTextEqual(claims.nonce, nonce)) throw new Error("ID token nonce가 올바르지 않습니다.")
  if (typeof code !== "string" || code.length === 0) throw new Error("Authorization code가 없습니다.")
  const expectedCodeHash = createHash("sha256").update(code).digest().subarray(0, 16).toString("base64url")
  if (typeof claims.c_hash !== "string" || !constantTimeTextEqual(claims.c_hash, expectedCodeHash)) {
    throw new Error("ID token c_hash가 올바르지 않습니다.")
  }
  return claims
}

export function mapIdentityClaims(claims, config) {
  const value = claims[config.userIdClaim]
  // Keep the exact Knox ID; do not infer an ID from email, subject or IP.
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(value.trim())) {
    throw new Error("SSO_USER_ID_CLAIM은 기존 Knox ID여야 합니다.")
  }
  return { knoxId: value.trim() }
}

export function normalizeReturnTo(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || [...value].some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return "/"
  try {
    const url = new URL(value, "https://sso-template.invalid")
    if (url.origin !== "https://sso-template.invalid") return "/"
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/"
  }
}

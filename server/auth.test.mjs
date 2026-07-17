import assert from "node:assert/strict"
import { generateKeyPairSync, sign } from "node:crypto"
import { after, before, test } from "node:test"

import {
  clearAuthSessionsForTests,
  extractUserFromClaims,
  handleAuthRequest,
  isAuthPath,
  resolveSafeRedirectTarget,
  verifyIdToken,
} from "./auth.mjs"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" })
const baseUrl = "http://spider.example.test"
const environmentKeys = [
  "ADFS_AUTH_URL",
  "ADFS_LOGOUT_URL",
  "ALLOWED_REDIRECT_HOSTS",
  "FRONTEND_BASE_URL",
  "OIDC_CLIENT_ID",
  "OIDC_ISSUER",
  "OIDC_PUBLIC_KEY",
  "OIDC_REDIRECT_URI",
  "OIDC_VERIFY_TOKEN",
  "SESSION_COOKIE_SECURE",
  "SESSION_COOKIE_SAMESITE",
]
const originalEnv = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]))

function createToken(claims, signingKey = privateKey) {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  const signature = sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), signingKey).toString("base64url")
  return `${header}.${payload}.${signature}`
}

before(() => {
  Object.assign(process.env, {
    ADFS_AUTH_URL: "https://idp.example.test/authorize",
    ADFS_LOGOUT_URL: "https://idp.example.test/logout",
    ALLOWED_REDIRECT_HOSTS: "spider.example.test",
    FRONTEND_BASE_URL: baseUrl,
    OIDC_CLIENT_ID: "spider-client",
    OIDC_ISSUER: "https://idp.example.test/adfs",
    OIDC_PUBLIC_KEY: publicKeyPem,
    OIDC_REDIRECT_URI: `${baseUrl}/auth/google/callback/`,
    OIDC_VERIFY_TOKEN: "1",
    SESSION_COOKIE_SECURE: "0",
    SESSION_COOKIE_SAMESITE: "Lax",
  })
})

after(() => {
  clearAuthSessionsForTests()
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
})

async function authRequest(path, { method = "GET", headers = {}, body = "" } = {}) {
  const request = {
    method,
    headers: { host: "spider.example.test", ...headers },
    socket: { encrypted: false },
    async *[Symbol.asyncIterator]() {
      if (body) yield Buffer.from(body)
    },
  }
  const response = {
    body: "",
    headers: {},
    status: 0,
    writeHead(status, responseHeaders = {}) {
      this.status = status
      this.headers = responseHeaders
    },
    end(payload = "") {
      this.body = String(payload)
    },
  }
  const url = new URL(path, baseUrl)
  assert.equal(isAuthPath(url.pathname), true)
  await handleAuthRequest(request, response, url)
  return response
}

test("SSO login callback creates a session containing knoxId and username", async () => {
  const beforeLogin = await authRequest("/api/v1/auth/me")
  assert.equal(beforeLogin.status, 401)

  const loginResponse = await authRequest("/api/v1/auth/login?next=/self-equipment")
  assert.equal(loginResponse.status, 302)
  const loginCookie = loginResponse.headers["Set-Cookie"].split(";", 1)[0]
  const authorizeUrl = new URL(loginResponse.headers.Location)
  assert.equal(authorizeUrl.searchParams.get("response_mode"), "form_post")
  assert.equal(authorizeUrl.searchParams.get("response_type"), "id_token")

  const now = Math.floor(Date.now() / 1000)
  const token = createToken({
    aud: "spider-client",
    exp: now + 300,
    iss: "https://idp.example.test/adfs",
    loginid: "hong.gildong",
    nonce: authorizeUrl.searchParams.get("nonce"),
    sabun: "S123456",
    username: "홍길동",
  })
  const callbackResponse = await authRequest("/auth/google/callback/", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: loginCookie,
    },
    body: new URLSearchParams({
      id_token: token,
      state: authorizeUrl.searchParams.get("state"),
    }).toString(),
  })
  assert.equal(callbackResponse.status, 302)
  assert.equal(callbackResponse.headers.Location, `${baseUrl}/self-equipment`)

  const authenticatedCookie = callbackResponse.headers["Set-Cookie"].split(";", 1)[0]
  const meResponse = await authRequest("/api/v1/auth/me", {
    headers: { cookie: authenticatedCookie },
  })
  assert.equal(meResponse.status, 200)
  const user = JSON.parse(meResponse.body)
  assert.equal(user.knoxId, "hong.gildong")
  assert.equal(user.knox_id, "hong.gildong")
  assert.equal(user.username, "홍길동")
  assert.equal(user.id, "S123456")
})

test("token validation rejects an invalid signature", () => {
  const otherKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
  const now = Math.floor(Date.now() / 1000)
  const token = createToken({
    aud: "spider-client",
    exp: now + 300,
    iss: "https://idp.example.test/adfs",
  }, otherKey)

  assert.throws(() => verifyIdToken(token, {
    clientId: "spider-client",
    issuer: "https://idp.example.test/adfs",
    publicKey: publicKeyPem,
    verifyToken: true,
    clockToleranceSeconds: 60,
  }), (error) => error.code === "invalid_token")
})

test("claim mapping follows template2 loginid and username fields", () => {
  const user = extractUserFromClaims({
    loginid: "kim.user",
    sabun: "S000001",
    username: "김사용",
    userid: "U-1",
  })
  assert.equal(user.knoxId, "kim.user")
  assert.equal(user.username, "김사용")
  assert.equal(user.avatarid, "U-1")
})

test("redirect targets outside the allowlist fall back to the frontend", () => {
  const target = resolveSafeRedirectTarget("https://attacker.example/path", {
    allowHttp: true,
    allowedRedirectHosts: new Set(["spider.example"]),
    frontendBaseUrl: "https://spider.example",
    requestOrigin: "https://spider.example",
  })
  assert.equal(target, "https://spider.example/")
})

import assert from "node:assert/strict"
import { createHash, generateKeyPairSync, sign } from "node:crypto"
import { Readable } from "node:stream"
import test from "node:test"
import { createSsoAuth } from "./ssoAuth.mjs"
import { loadOidcConfig, mapIdentityClaims, normalizeReturnTo, verifyIdToken } from "./oidcService.mjs"
import { getSsoCurrentUser, handleCurrentUserRequest, resolveRequestCurrentUser } from "./currentUser.mjs"
import { handleNoticesRequest } from "./notices.mjs"

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })
const environment = {
  SSO_ENABLED: "true", SSO_CLIENT_ID: "synthetic-client",
  SSO_REDIRECT_URI: "https://spider.example/auth/callback",
  SSO_AUTHORIZE_URL: "https://idp.example/authorize",
  SSO_SIGNOUT_URL: "https://idp.example/logout?post_logout_redirect_uri=https%3A%2F%2Fspider.example%2Fauth%2Flogged-out",
  SSO_CERTIFICATE_PATH: "/synthetic/unused.cer", SSO_SESSION_SECRET: "synthetic-not-a-real-secret-value-32-bytes",
  SSO_EXPECTED_ISSUER: "https://idp.example", SSO_USER_ID_CLAIM: "knox_id", SSO_TRUSTED_PROXY_IPS: "127.0.0.1,::1",
}
const config = loadOidcConfig(environment)
const initialTime = 2_000_000_000_000

function token(claims, header = { alg: "RS256" }, signingKey = privateKey) {
  const input = [header, claims].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".")
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), signingKey).toString("base64url")}`
}
function claims(nonce, overrides = {}) {
  return {
    iss: config.expectedIssuer, sub: "synthetic-subject", aud: config.clientId,
    exp: initialTime / 1000 + 3600, iat: initialTime / 1000, nonce,
    c_hash: createHash("sha256").update("synthetic-code").digest().subarray(0, 16).toString("base64url"),
    knox_id: "user01", ...overrides,
  }
}
function response() {
  return { statusCode: 200, headers: {}, body: "",
    setHeader(name, value) { this.headers[name.toLowerCase()] = value },
    writeHead(status, headers = {}) { this.statusCode = status; for (const [name, value] of Object.entries(headers)) this.setHeader(name, value) },
    end(body = "") { this.body = body },
  }
}
function harness(overrides = {}) {
  let time = initialTime
  const auth = createSsoAuth({ config: { ...config, ...overrides }, publicKey, now: () => time })
  async function request(path, { method = "GET", cookie, body = "", headers = {}, peer = "127.0.0.1" } = {}) {
    const req = Readable.from(body ? [Buffer.from(body)] : [])
    Object.assign(req, { url: path, method, headers: { "x-forwarded-proto": "https", ...(cookie ? { cookie } : {}), ...headers }, socket: { remoteAddress: peer } })
    const res = response()
    const handled = await auth.handle(req, res)
    return { req, res, handled }
  }
  async function begin(returnTo = "/") {
    const { res } = await request(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
    assert.equal(res.statusCode, 303)
    const url = new URL(res.headers.location)
    assert.equal(url.searchParams.get("response_type"), "code id_token")
    assert.equal(url.searchParams.get("response_mode"), "form_post")
    const cookie = res.headers["set-cookie"][0].split(";")[0]
    const form = new URLSearchParams({ state: url.searchParams.get("state"), code: "synthetic-code", id_token: token(claims(url.searchParams.get("nonce"))) })
    return { cookie, form, res }
  }
  async function finish(login) {
    return request("/auth/callback", { method: "POST", cookie: login.cookie, body: login.form.toString(), headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://idp.example" } })
  }
  async function login(returnTo) {
    const result = await finish(await begin(returnTo))
    assert.equal(result.res.statusCode, 303)
    return { ...result, cookie: result.res.headers["set-cookie"][1].split(";")[0] }
  }
  return { auth, request, begin, finish, login, advance(ms) { time += ms } }
}

test("환경설정은 명시적 활성화, 필수값, HTTPS, exact proxy IP, 비밀 길이를 검증한다", () => {
  assert.deepEqual(loadOidcConfig({}), { enabled: false })
  for (const key of Object.keys(environment).filter(key => key !== "SSO_ENABLED")) {
    assert.throws(() => loadOidcConfig({ ...environment, [key]: "" }), new RegExp(key))
  }
  for (const override of [
    { SSO_ENABLED: "typo" }, { SSO_SESSION_SECRET: "short" }, { SSO_SECURE_COOKIES: "false" },
    { SSO_TRUSTED_PROXY_IPS: "true" }, { SSO_TRUSTED_PROXY_IPS: "0.0.0.0/0" },
    { SSO_REDIRECT_URI: "http://spider.example/auth/callback" }, { SSO_REDIRECT_URI: "https://spider.example/other" },
    { SSO_REDIRECT_URI: "https://spider.example/auth/callback?a=b" }, { SSO_AUTHORIZE_URL: "https://user:password@idp.example" },
  ]) assert.throws(() => loadOidcConfig({ ...environment, ...override }))
})

test("서명, issuer/audience/azp, expiry/nbf/iat, nonce와 code hash 위조를 거부한다", () => {
  const options = { publicKey, clientId: config.clientId, issuer: config.expectedIssuer, nonce: "nonce", code: "synthetic-code", nowSeconds: initialTime / 1000 }
  assert.equal(verifyIdToken(token(claims("nonce")), options).knox_id, "user01")
  for (const override of [
    { iss: "https://evil.example" }, { sub: "" }, { aud: "other" }, { aud: [config.clientId, "other"] }, { azp: "other" },
    { exp: initialTime / 1000 - 120 }, { exp: "3000000000" }, { nbf: initialTime / 1000 + 120 }, { nbf: "bad" },
    { iat: initialTime / 1000 + 120 }, { nonce: "other" }, { c_hash: "other" },
  ]) assert.throws(() => verifyIdToken(token(claims("nonce", override)), options))
  for (const header of [{ alg: "none" }, { alg: "HS256" }, { alg: "RS256", crit: ["other"] }]) {
    assert.throws(() => verifyIdToken(token(claims("nonce"), header), options))
  }
  const wrongKey = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
  assert.throws(() => verifyIdToken(token(claims("nonce"), { alg: "RS256" }, wrongKey), options))
})

test("Knox ID는 명시한 claim만 사용하며 이메일/subject fallback과 외부 returnTo를 거부한다", () => {
  assert.deepEqual(mapIdentityClaims({ knox_id: " User.One " }, config), { knoxId: "User.One" })
  for (const value of [undefined, "", "user@example.com", "DOMAIN\\user", ["user01"]]) {
    assert.throws(() => mapIdentityClaims({ sub: "user01", knox_id: value }, config))
  }
  for (const value of ["//evil.example", "https://evil.example", "/\\evil.example", "/\n/evil.example", "/\t/evil.example"]) assert.equal(normalizeReturnTo(value), "/")
  assert.equal(normalizeReturnTo("/my-eqp?line=A#chart"), "/my-eqp?line=A#chart")
})

test("모든 API와 React/static 접근은 인증이 필요하며 위조 헤더로 우회할 수 없다", async () => {
  const h = harness()
  for (const path of ["/api", "/api/current-user", "/api/dashboard-data", "/api/notices", "/api/unknown"]) {
    const { res, handled } = await h.request(path, { headers: { "x-knox-id": "admin", "x-forwarded-for": "1.2.3.4" } })
    assert.equal(handled, true); assert.equal(res.statusCode, 401)
    assert.equal(JSON.parse(res.body).code, "SSO_AUTHENTICATION_REQUIRED")
  }
  for (const path of ["/", "/assets/client.js", "/some/deep/link"]) assert.equal((await h.request(path)).res.statusCode, 303)
  for (const opts of [{ peer: "192.0.2.4" }, { headers: { "x-forwarded-proto": "http" } }, { headers: { "x-forwarded-proto": "https,http" } }]) {
    assert.equal((await h.request("/auth/login", opts)).res.statusCode, 400)
  }
})

test("form_post 로그인, Secure 쿠키, current-user 계약 및 콜백 동시 재사용 차단", async () => {
  const h = harness()
  const start = await h.begin("/my-eqp?line=A")
  assert.match(start.res.headers["set-cookie"][0], /HttpOnly; Secure; SameSite=None/)
  const results = await Promise.all([h.finish(start), h.finish(start)])
  assert.deepEqual(results.map(r => r.res.statusCode).sort(), [303, 401])
  const result = results.find(r => r.res.statusCode === 303)
  assert.equal(result.res.headers.location, "/my-eqp?line=A")
  const sessionCookie = result.res.headers["set-cookie"][1]
  assert.match(sessionCookie, /^__Host-l0_spider_session=/)
  assert.match(sessionCookie, /Path=\/; HttpOnly; Secure; SameSite=Lax/)
  assert.doesNotMatch(sessionCookie, /user01|id_token|Domain=/)
  const current = await h.request("/api/current-user", { cookie: sessionCookie.split(";")[0], headers: { "x-knox-id": "admin" } })
  assert.equal(current.handled, false)
  await handleCurrentUserRequest(current.req, current.res)
  assert.deepEqual(JSON.parse(current.res.body), { ok: true, knoxId: "user01" })
})

test("correlation 불일치·로그인 만료·IdP 오류·중복 필드·손상 토큰은 세션을 만들지 않는다", async () => {
  const h = harness()
  const start = await h.begin()
  assert.equal((await h.finish({ ...start, cookie: "__Secure-l0_spider_oidc=wrong" })).res.statusCode, 401)
  assert.equal((await h.finish(start)).res.statusCode, 303)
  const expired = await h.begin(); h.advance(301_000)
  assert.equal((await h.finish(expired)).res.statusCode, 401)
  for (const mutate of [form => form.set("error", "denied"), form => form.append("state", "duplicate"), form => form.set("id_token", "broken")]) {
    const start = await h.begin(); mutate(start.form)
    const { res } = await h.finish(start)
    assert.equal(res.statusCode, 401)
    assert.doesNotMatch(JSON.stringify(res.headers), /__Host-l0_spider_session=/)
  }
})

test("인증 후에도 변경 요청은 동일 출처만 허용하고 로그아웃 세션은 재사용할 수 없다", async () => {
  const h = harness(); const { cookie } = await h.login()
  for (const origin of [undefined, "https://evil.example", "null"]) {
    assert.equal((await h.request("/api/hit-history", { cookie, method: "POST", headers: { origin } })).res.statusCode, 403)
    assert.equal((await h.request("/auth/logout", { cookie, method: "POST", headers: { origin } })).res.statusCode, 403)
  }
  assert.equal((await h.request("/api/hit-history", { cookie, method: "POST", headers: { origin: "https://spider.example" } })).handled, false)
  assert.equal((await h.request("/auth/logout", { cookie })).res.statusCode, 405)
  const logout = await h.request("/auth/logout", { cookie, method: "POST", headers: { origin: "https://spider.example" } })
  assert.equal(logout.res.statusCode, 303)
  assert.equal(logout.res.headers.location, config.signoutUrl)
  assert.equal((await h.request("/api/current-user", { cookie })).res.statusCode, 401)
  assert.equal((await h.request("/auth/logged-out")).res.statusCode, 200)
})

test("idle/absolute/ID token 만료와 재시작은 세션을 끝내며 상태 polling은 idle을 연장하지 않는다", async () => {
  const idle = harness({ idleSeconds: 10 }); const a = await idle.login()
  idle.advance(9000); assert.equal((await idle.request("/api/auth/session", { cookie: a.cookie })).handled, false)
  idle.advance(1001); assert.equal((await idle.request("/api/current-user", { cookie: a.cookie })).res.statusCode, 401)
  const absolute = harness({ idleSeconds: 100, absoluteSeconds: 10 }); const b = await absolute.login()
  absolute.advance(9000); assert.equal((await absolute.request("/api/current-user", { cookie: b.cookie })).handled, false)
  absolute.advance(1001); assert.equal((await absolute.request("/api/current-user", { cookie: b.cookie })).res.statusCode, 401)
  const expiry = harness({ idleSeconds: 10000 }); const c = await expiry.login()
  expiry.advance(3_600_000); assert.equal((await expiry.request("/api/current-user", { cookie: c.cookie })).res.statusCode, 401)
  assert.equal((await harness().request("/api/current-user", { cookie: c.cookie })).res.statusCode, 401)
})

test("세션 개수는 제한되고 재로그인 시 이전 세션을 폐기한다", async () => {
  const limited = harness({ maxEntries: 1 })
  await limited.begin()
  assert.equal((await limited.request("/auth/login")).res.statusCode, 503)
  const h = harness(); const first = await h.login()
  const start = await h.request("/auth/login", { cookie: first.cookie })
  const url = new URL(start.res.headers.location)
  const form = new URLSearchParams({ state: url.searchParams.get("state"), code: "synthetic-code", id_token: token(claims(url.searchParams.get("nonce"))) })
  await h.finish({ cookie: start.res.headers["set-cookie"][0].split(";")[0], form })
  assert.equal((await h.request("/api/current-user", { cookie: first.cookie })).res.statusCode, 401)
})

test("SSO 신원은 공지 관리자·작성자에 연결되며 IP 기반 관리자 위조는 실패한다", async () => {
  for (const [knoxId, expected] of [["user01", 403], ["notice.admin", 201]]) {
    const req = Readable.from([Buffer.from(JSON.stringify({ title: "synthetic", body: "synthetic", createdBy: "forged" }))])
    Object.assign(req, { method: "POST", ssoRequired: true, auth: { knoxId }, headers: {} })
    const res = response()
    const dependencies = {
      envLoader: () => {}, envReader: () => ({ exists: false, values: {} }), configuredAdminKnoxIds: "notice.admin",
      remoteIpReader: () => { throw new Error("SSO must not consult IP") },
      userResolver: () => { throw new Error("SSO must not consult IP") },
      helper: async payload => { assert.equal(payload.createdBy, "notice.admin"); return { notice: {} } },
    }
    await handleNoticesRequest(req, res, new URL("https://spider.example/api/notices"), dependencies)
    assert.equal(res.statusCode, expected)
  }
  assert.throws(() => getSsoCurrentUser({ ssoRequired: true, headers: { "x-knox-id": "admin" } }))
  assert.throws(() => resolveRequestCurrentUser({ ssoRequired: true }))
  assert.equal(getSsoCurrentUser({ auth: { knoxId: "forged" } }), null)
})

test("SSO 비활성화는 기존 요청을 그대로 통과시킨다", async () => {
  const auth = createSsoAuth({ config: { enabled: false } })
  assert.equal(await auth.handle({}, response()), false)
})

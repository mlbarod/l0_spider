import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { createHash, sign } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { once } from "node:events"
import test from "node:test"

// Runs the real entrypoint against synthetic authentication only. No business DB writes.
// Prerequisites: npm ci, npm run build, openssl.
test("실제 Node 진입점의 전체 API/React 보호, 로그인, 사용자, 로그아웃, 비활성화 복구", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "l0-sso-test-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const certificate = join(directory, "synthetic.cer")
  const keyPath = join(directory, "synthetic.key")
  const generated = spawnSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyPath, "-out", certificate, "-days", "1", "-subj", "/CN=synthetic.invalid"], { stdio: "ignore" })
  assert.equal(generated.status, 0, "synthetic certificate generation needs openssl")
  const privateKey = await readFile(keyPath)
  const port = 49000 + Math.floor(Math.random() * 10000)
  const base = `http://127.0.0.1:${port}`
  const mailingKey = "synthetic-mailing-report-server-test-key"
  const mailingPath = "/api/mailing-report/dashboard-data"
  const dashboardRoot = join(directory, "empty-dashboard")
  await mkdir(dashboardRoot)
  const environment = {
    ...process.env, HOST: "127.0.0.1", PORT: String(port), LIVE_RELOAD: "0", BUILD_ON_START: "0",
    SSO_ENABLED: "true", SSO_CLIENT_ID: "synthetic-client", SSO_REDIRECT_URI: "https://spider.example/auth/callback",
    SSO_AUTHORIZE_URL: "https://idp.example/authorize", SSO_SIGNOUT_URL: "https://idp.example/logout",
    SSO_CERTIFICATE_PATH: certificate, SSO_SESSION_SECRET: "synthetic-not-a-real-secret-value-32-bytes",
    SSO_EXPECTED_ISSUER: "https://idp.example", SSO_USER_ID_CLAIM: "knox_id",
    SSO_SAFE_CLAIM_TRACE: "false", SSO_DISPLAY_NAME_CLAIM: "full_name", SSO_DEPARTMENT_CLAIM: "org_name", SSO_TRUSTED_PROXY_IPS: "127.0.0.1",
    SSO_ACCESS_CONTROL_FILE: join(directory, "access.json"), SSO_BOOTSTRAP_MASTER_USER_IDS: "user01",
    MAILING_REPORT_API_KEY: mailingKey, SPIDER_DASHBOARD_PATH_ROOT: dashboardRoot,
  }
  async function start(overrides = {}) {
    const child = spawn(process.execPath, ["server.mjs"], { env: { ...environment, ...overrides }, stdio: ["ignore", "pipe", "pipe"] })
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) { const exited = once(child, "exit"); child.kill("SIGTERM"); await exited }
    })
    let errorCode = "unknown"
    child.stderr.on("data", chunk => {
      errorCode = chunk.toString().match(/(?:code: ['"])([A-Z_0-9]+)/)?.[1] ?? errorCode
    })
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("server startup timeout")), 20000)
      child.once("exit", (code, signal) => { clearTimeout(timeout); reject(new Error(`server exited before readiness: ${errorCode}, exit=${code}, signal=${signal}`)) })
      child.once("error", error => { clearTimeout(timeout); reject(error) })
      child.stdout.on("data", chunk => {
        if (chunk.toString().includes("server listening")) { clearTimeout(timeout); resolve() }
      })
      child.stderr.resume() // Do not print process environment or unrelated operational errors.
    })
    return child
  }
  async function request(path, options = {}) {
    return fetch(base + path, { redirect: "manual", ...options, headers: { "x-forwarded-proto": "https", ...options.headers } })
  }
  const server = await start()
  const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8")
  const paths = new Set([...source.matchAll(/"(\/api\/[^"?]+)"/g)].map(match => match[1]))
  assert.ok(paths.size > 20)
  for (const path of paths) {
    const response = await request(path, { headers: { "x-knox-id": "notice.admin", "x-forwarded-for": "198.51.100.2" } })
    assert.equal(response.status, 401, path)
    assert.equal((await response.json()).code, "SSO_AUTHENTICATION_REQUIRED")
  }
  // The machine credential only reaches the dedicated read endpoint. Use an
  // empty synthetic data directory so this never reads operational dashboard data.
  const deniedMail = await request(mailingPath)
  assert.equal(deniedMail.status, 401)
  assert.equal((await deniedMail.json()).code, "MAILING_REPORT_AUTHENTICATION_REQUIRED")
  const mailHeaders = { authorization: `Bearer ${mailingKey}` }
  const mailData = await request(mailingPath, { headers: mailHeaders })
  assert.equal(mailData.status, 404)
  assert.equal((await mailData.json()).code, "DASHBOARD_LATEST_DATE_NOT_FOUND")
  assert.equal(mailData.headers.get("cache-control"), "no-store")
  for (const path of ["/api/dashboard-data", "/api/current-user", "/api/chart-mail"]) {
    const response = await request(path, { headers: mailHeaders })
    assert.equal(response.status, 401)
    assert.equal((await response.json()).code, "SSO_AUTHENTICATION_REQUIRED")
  }
  assert.equal((await request(mailingPath, { headers: { ...mailHeaders, "x-forwarded-proto": "http" } })).status, 400)
  assert.equal((await request(mailingPath, { method: "POST", headers: mailHeaders })).status, 405)
  const entry = await request("/deep/link?line=A")
  assert.equal(entry.status, 303)
  const login = await request(entry.headers.get("location"))
  const authorize = new URL(login.headers.get("location"))
  const nonce = authorize.searchParams.get("nonce")
  const correlation = login.headers.getSetCookie()[0].split(";")[0]
  const current = Math.floor(Date.now() / 1000)
  const code = "synthetic-code"
  const claims = { iss: "https://idp.example", sub: "synthetic-user", aud: "synthetic-client", iat: current, exp: current + 3600, nonce, knox_id: "user01", full_name: "홍길동", org_name: "품질관리", c_hash: createHash("sha256").update(code).digest().subarray(0, 16).toString("base64url") }
  const signingInput = [{ alg: "RS256" }, claims].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".")
  const idToken = `${signingInput}.${sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url")}`
  const callback = await request("/auth/callback", { method: "POST", headers: { cookie: correlation, "content-type": "application/x-www-form-urlencoded", origin: "https://idp.example" }, body: new URLSearchParams({ state: authorize.searchParams.get("state"), code, id_token: idToken }) })
  assert.equal(callback.status, 303)
  assert.equal(callback.headers.get("location"), "/deep/link?line=A")
  const cookie = callback.headers.getSetCookie().find(value => value.startsWith("__Host-")).split(";")[0]
  const user = await request("/api/current-user", { headers: { cookie } })
  assert.equal(user.status, 200)
  assert.deepEqual(await user.json(), { ok: true, knoxId: "user01" })
  assert.deepEqual(await (await request("/api/auth/session", { headers: { cookie } })).json(), { ok: true, enabled: true, role: "master", user: { userId: "user01", displayName: "홍길동", department: "품질관리" } })
  const html = await request("/", { headers: { cookie } })
  assert.equal(html.status, 200)
  assert.equal(html.headers.get("cache-control"), "private, no-store")
  const content = await html.text()
  assert.match(content, /<div id="root">/)
  const asset = content.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1]
  assert.ok(asset)
  assert.equal((await request(asset)).status, 303)
  assert.equal((await request(asset, { headers: { cookie } })).status, 200)
  const permissions = await request("/api/access-control", { headers: { cookie } })
  assert.equal(permissions.status, 200)
  assert.deepEqual((await permissions.json()).masters.map(master => master.userId), ["user01"])
  const mutation = { method: "POST", headers: { cookie, "content-type": "application/json", origin: "https://spider.example" }, body: JSON.stringify({ target: "rule", field: "department", matchType: "contains", matchValue: "품질" }) }
  assert.equal((await request("/api/access-control", { ...mutation, headers: { ...mutation.headers, origin: "https://evil.example" } })).status, 403)
  assert.equal((await request("/api/access-control", mutation)).status, 200)
  // A second, genuinely signed SSO login exercises the complete authorization chain.
  async function loginAs(userId, department) {
    const begin = await request("/auth/login")
    const target = new URL(begin.headers.get("location"))
    const input = [{ alg: "RS256" }, { ...claims, knox_id: userId, org_name: department, nonce: target.searchParams.get("nonce") }].map(value => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".")
    const token = `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`
    const finish = await request("/auth/callback", { method: "POST", headers: { cookie: begin.headers.getSetCookie()[0].split(";")[0], "content-type": "application/x-www-form-urlencoded", origin: "https://idp.example" }, body: new URLSearchParams({ state: target.searchParams.get("state"), code, id_token: token }) })
    assert.equal(finish.status, 303)
    return finish.headers.getSetCookie().find(value => value.startsWith("__Host-")).split(";")[0]
  }
  const generalCookie = await loginAs("user02", "품질관리")
  assert.equal((await request("/", { headers: { cookie: generalCookie } })).status, 200)
  assert.equal((await (await request("/api/auth/session", { headers: { cookie: generalCookie } })).json()).role, "general")
  assert.equal((await request("/api/access-control", { headers: { cookie: generalCookie } })).status, 403)
  assert.equal((await request("/api/access-control", { ...mutation, headers: { ...mutation.headers, cookie: generalCookie } })).status, 403)
  const savedRule = (await (await request("/api/access-control", { headers: { cookie } })).json()).rules[0]
  assert.equal((await request("/api/access-control", { ...mutation, method: "DELETE", body: JSON.stringify({ target: "rule", ruleId: savedRule.ruleId }) })).status, 200)
  for (const path of ["/", asset, "/api/auth/session", "/api/current-user", "/api/dashboard-data", "/deep/link"]) {
    assert.equal((await request(path, { headers: { cookie: generalCookie, "x-knox-id": "user01" } })).status, 403, path)
  }
  assert.equal((await request("/auth/logout", { method: "POST", headers: { cookie: generalCookie, origin: "https://spider.example" } })).status, 303)
  assert.equal((await request("/api/hit-history", { method: "POST", headers: { cookie, origin: "https://evil.example" }, body: "{}" })).status, 403)
  assert.equal((await request("/auth/logout", { method: "POST", headers: { cookie, origin: "https://spider.example" } })).status, 303)
  assert.equal((await request("/api/current-user", { headers: { cookie } })).status, 401)
  const exited = once(server, "exit"); server.kill("SIGTERM"); await exited
  await start({ SSO_ENABLED: "false" })
  assert.equal((await request("/")).status, 200)
  assert.deepEqual(await (await request("/api/auth/session")).json(), { ok: true, enabled: false })
  assert.equal((await request("/api/access-control")).status, 404)
})

import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import test from "node:test"
import { createAccessControl, createAccessStore, resolveAccessRole } from "./accessControl.mjs"

const master = { knoxId: "Master.One", department: "품질관리" }
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "l0-access-test-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const filePath = join(directory, "access.json")
  const store = createAccessStore({ filePath, bootstrapUserIds: ["Master.One", "master.one"] })
  const gate = createAccessControl({ enabled: true, store, environment: { SSO_REDIRECT_URI: "https://spider.example/auth/callback" } })
  async function request({ identity = master, method = "GET", path = "/api/access-control", input, raw, origin = "https://spider.example", type = "application/json", afterRead } = {}) {
    const data = raw ?? (input ? JSON.stringify(input) : "")
    const req = Readable.from((async function* () { if (afterRead) afterRead(); if (data) yield Buffer.from(data) })())
    Object.assign(req, { auth: identity, url: path, method, headers: { origin, "content-type": type } })
    const res = { status: 200, body: "", headers: {}, writeHead(status, headers) { this.status = status; this.headers = headers }, end(value) { this.body = value } }
    const handled = await gate.handle(req, res)
    return { ...res, handled, role: req.accessRole }
  }
  return { filePath, store, request }
}

test("최초 마스터 설정, 중복 제거, 재시작 영속화와 재초기화 방지", t => {
  const { filePath, store } = fixture(t)
  assert.deepEqual(store.read().masters.map(value => value.userId), ["master.one"])
  assert.equal(statSync(filePath).mode & 0o777, 0o600)
  store.mutate(master, "POST", { target: "master", userId: "second" })
  const reopened = createAccessStore({ filePath, bootstrapUserIds: ["unexpected"] })
  assert.deepEqual(reopened.read().masters.map(value => value.userId), ["master.one", "second"])
  assert.throws(() => createAccessStore({ filePath: join(filePath, "..", "new.json") }), /SSO_BOOTSTRAP_MASTER_USER_IDS/)
  writeFileSync(filePath, "broken")
  assert.throws(() => createAccessStore({ filePath, bootstrapUserIds: ["unexpected"] }), /파일/)
  assert.equal(readFileSync(filePath, "utf8"), "broken")
})

test("유저ID 직접 일치와 소속부서 직접 일치·포함, OR 및 마스터 우선", t => {
  const { store } = fixture(t)
  const role = identity => resolveAccessRole(identity, store.read())
  assert.equal(role(master), "master")
  assert.equal(role({ knoxId: "user01", department: "품질관리" }), "blocked")
  store.mutate(master, "POST", { target: "rule", field: "user_id", matchType: "exact", matchValue: " User01 " })
  assert.equal(role({ knoxId: "USER01" }), "general")
  assert.equal(role({ knoxId: "user010" }), "blocked")
  store.mutate(master, "POST", { target: "rule", field: "department", matchType: "exact", matchValue: "품질관리" })
  assert.equal(role({ knoxId: "user02", department: "품질관리" }), "general")
  assert.equal(role({ knoxId: "user02", department: "품질관리팀" }), "blocked")
  store.mutate(master, "POST", { target: "rule", field: "department", matchType: "contains", matchValue: "공정" })
  assert.equal(role({ knoxId: "user03", department: "메모리 공정기술팀" }), "general")
  assert.equal(role({ knoxId: "user03" }), "blocked")
  assert.equal(role({ department: "공정" }), "blocked")
})

test("규칙 검증·수정·삭제와 마지막 마스터 보호", t => {
  const { store } = fixture(t)
  for (const input of [
    { field: "user_id", matchType: "contains", matchValue: "user" },
    { field: "department", matchType: "contains", matchValue: " " },
    { field: "role", matchType: "exact", matchValue: "master" },
    { field: "user_id", matchType: "exact", matchValue: "user@example.com" },
  ]) assert.throws(() => store.mutate(master, "POST", { target: "rule", ...input }), TypeError)
  const input = { target: "rule", field: "department", matchType: "contains", matchValue: "품질" }
  store.mutate(master, "POST", input)
  assert.throws(() => store.mutate(master, "POST", input), /이미 등록/)
  const ruleId = store.read().rules[0].ruleId
  store.mutate(master, "PATCH", { ...input, ruleId, matchType: "exact", matchValue: "공정" })
  assert.equal(store.read().rules[0].matchValue, "공정")
  store.mutate(master, "DELETE", { target: "rule", ruleId })
  assert.equal(store.read().rules.length, 0)
  assert.throws(() => store.mutate(master, "DELETE", { target: "master", userId: master.knoxId }), /마지막/)
  store.mutate(master, "POST", { target: "master", userId: "second" })
  store.mutate(master, "DELETE", { target: "master", userId: master.knoxId })
  assert.equal(store.mutate(master, "POST", input), false)
})

test("관리 API 인증·권한·출처 검사 및 요청 크기 제한", async t => {
  const { store, request } = fixture(t)
  assert.equal((await request({ identity: null })).status, 401)
  assert.equal((await request({ identity: { knoxId: "other" } })).status, 403)
  const input = { target: "rule", field: "user_id", matchType: "exact", matchValue: "general" }
  for (const origin of [undefined, "null", "https://evil.example"]) {
    // Explicit missing source represented by an invalid header string.
    assert.equal((await request({ method: "POST", input, origin: origin ?? "" })).status, 403)
  }
  assert.equal((await request({ method: "POST", input, type: "text/plain" })).status, 400)
  assert.equal((await request({ method: "POST", raw: "{" })).status, 400)
  assert.equal((await request({ method: "POST", raw: "x".repeat(8193) })).status, 400)
  assert.equal((await request({ method: "POST", input })).status, 200)
  assert.equal((await request({ identity: { knoxId: "general" }, path: "/api/dashboard-data" })).handled, false)
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) assert.equal((await request({ identity: { knoxId: "general" }, method, input })).status, 403)
  assert.equal((await request({ method: "PUT" })).status, 405)
  const ruleId = store.read().rules[0].ruleId
  assert.equal((await request({ method: "DELETE", input: { target: "rule", ruleId } })).status, 200)
  for (const path of ["/", "/assets/app.js", "/deep/link", "/api/dashboard-data"]) assert.equal((await request({ identity: { knoxId: "general" }, path })).status, 403)
})

test("본문을 읽는 동안 회수된 마스터는 변경할 수 없다", async t => {
  const { store, request } = fixture(t)
  store.mutate(master, "POST", { target: "master", userId: "second" })
  const response = await request({ method: "POST", input: { target: "master", userId: "third" }, afterRead: () => store.mutate({ knoxId: "second" }, "DELETE", { target: "master", userId: master.knoxId }) })
  assert.equal(response.status, 403)
  assert.deepEqual(store.read().masters.map(value => value.userId), ["second"])
})

test("손상되거나 사라진 저장소는 접근 허용으로 우회하지 않는다", async t => {
  const { filePath, request } = fixture(t)
  writeFileSync(filePath, "broken")
  assert.equal((await request({ path: "/api/dashboard-data" })).status, 503)
  rmSync(filePath)
  assert.equal((await request({ path: "/" })).status, 503)
})

import assert from "node:assert/strict"
import test from "node:test"
import { randomUUID } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { createChartMailHandler } from "./chartMail.mjs"
import { createChartMailStore } from "./chartMailStore.mjs"
import { createChartMailBoardHandler } from "./chartMailBoard.mjs"
import { createChartMailBoardDb, runChartMailBoardHelper } from "./chartMailBoardDb.mjs"

const env = { CHART_MAIL_BOARD_ENABLED: "true", KNOX_MAIL_ENABLED: "true", KNOX_MAIL_TOKEN: "synthetic-token", KNOX_MAIL_SYSTEM_ID: "synthetic-system", KNOX_MAIL_TIMEOUT_MS: "100" }
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC6sAAAAASUVORK5CYII="
const draft = () => ({ requestId: randomUUID(), title: "Synthetic chart", details: "Line: TEST", comment: "확인 요청\n둘째 줄", recipients: ["reader.test", "READER.TEST@samsung.com"], image: `data:image/png;base64,${png}`, chartUrl: "https://spider.example/self-equipment?line=TEST" })
async function call(handler, { path = "/api/chart-mail", method = "GET", body, raw, user = "Sender.Test", authenticated = true, contentType = "application/json" } = {}) {
  const req = Readable.from([raw ?? (body ? JSON.stringify(body) : "")])
  Object.assign(req, { method, headers: { "content-type": contentType, origin: "https://spider.example" }, ssoRequired: authenticated, auth: { knoxId: user } })
  const response = {}
  await handler(req, { writeHead(status, headers) { response.status = status; response.headers = headers }, end(data) { response.body = Buffer.isBuffer(data) ? data : JSON.parse(data) } }, new URL(path, "https://spider.example"))
  return response
}
function fakeBoard() {
  const posts = new Map()
  return {
    posts,
    async begin(input) {
      const old = posts.get(input.id)
      if (old && old.fingerprint !== input.fingerprint) throw Object.assign(new Error("conflict"), { code: "MAIL_REQUEST_CONFLICT" })
      if (old) return { created: false, state: old.state, diagnostics: old.diagnostics }
      posts.set(input.id, { ...structuredClone(input), state: "pending" })
      return { created: true }
    },
    async finish(input) { Object.assign(posts.get(input.id), structuredClone(input)) },
  }
}
function fixture(t, { board = fakeBoard(), fetchImpl, store, ...options } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "chart-board-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const sends = [], logs = []
  const storage = store ?? createChartMailStore({ filePath: join(dir, "requests.json") })
  const handler = createChartMailHandler({ env, store: storage, board, logger: line => logs.push(line), fetchImpl: fetchImpl ?? (async (...args) => { sends.push(args); return new Response(null, { status: 202 }) }), ...options })
  return { handler, board, sends, logs, store: storage }
}

test("save the exact PNG, SSO sender and recipients before transport; new user action creates a new post", async t => {
  const board = fakeBoard()
  let calls = 0
  const input = draft()
  const f = fixture(t, { board, fetchImpl: async (_, options) => {
    calls++
    assert.equal(board.posts.size, calls)
    const post = [...board.posts.values()].at(-1)
    assert.equal(post.state, "pending")
    assert.equal(post.imageBase64, png)
    assert.equal(post.actor, "sender.test")
    assert.deepEqual(post.recipients, ["reader.test"])
    assert.equal(post.comment, input.comment)
    assert.ok(JSON.parse(options.body).contents.includes(input.image))
    return new Response(null, { status: 202 })
  } })
  const result = await call(f.handler, { method: "POST", body: { ...input, actor: "spoofed" } })
  assert.equal(result.body.status, "accepted")
  assert.match(result.body.boardPostId, /^[a-f0-9]{64}$/)
  assert.equal(board.posts.get(result.body.boardPostId).state, "accepted")
  assert.equal((await call(f.handler, { method: "POST", body: input })).body.status, "accepted")
  assert.equal(calls, 1)
  await call(f.handler, { method: "POST", body: { ...input, requestId: randomUUID() } })
  assert.equal(calls, 2)
  assert.doesNotMatch(JSON.stringify(f.logs), /iVBOR|reader.test|sender.test|synthetic-token/)
})

test("DB failure prevents sending; failed and uncertain sends retain their snapshots", async t => {
  const failed = fixture(t, { board: { async begin() { throw new Error("private DB token") } } })
  const result = await call(failed.handler, { method: "POST", body: draft() })
  assert.equal(result.body.code, "BOARD_STORAGE_ERROR")
  assert.equal(failed.sends.length, 0)
  assert.doesNotMatch(JSON.stringify([result, failed.logs]), /private DB token/)
  for (const status of [400, 500]) {
    const f = fixture(t, { fetchImpl: async () => new Response(null, { status }) })
    const input = draft()
    const response = await call(f.handler, { method: "POST", body: input })
    assert.equal(f.board.posts.size, 1)
    assert.equal([...f.board.posts.values()][0].state, status === 400 ? "rejected" : "unknown")
    assert.equal((await call(f.handler, { method: "POST", body: input })).body.code, response.body.code)
  }
})

test("a separate local store cannot send an already registered DB request again", async t => {
  const board = fakeBoard(), input = draft()
  let release, started
  const gate = new Promise(resolve => { release = resolve })
  const began = new Promise(resolve => { started = resolve })
  const first = fixture(t, { board, fetchImpl: async () => { started(); await gate; return new Response(null, { status: 202 }) } })
  const pending = call(first.handler, { method: "POST", body: input })
  await began
  const second = fixture(t, { board })
  try {
    assert.equal((await call(second.handler, { method: "POST", body: input })).body.code, "MAIL_IN_PROGRESS")
    assert.equal(second.sends.length, 0)
  } finally { release() }
  await pending
  const restarted = fixture(t, { board })
  assert.equal((await call(restarted.handler, { method: "POST", body: input })).body.status, "accepted")
  assert.equal(restarted.sends.length, 0)
  const conflict = fixture(t, { board })
  assert.equal((await call(conflict.handler, { method: "POST", body: { ...input, title: "changed" } })).body.code, "MAIL_REQUEST_CONFLICT")
  assert.equal(conflict.sends.length, 0)
})

test("post-transport persistence failures do not retry mail, and both result stores are attempted", async t => {
  const board = fakeBoard()
  board.finish = async () => { throw new Error("private DB") }
  const f = fixture(t, { board })
  const input = draft()
  assert.equal((await call(f.handler, { method: "POST", body: input })).body.code, "MAIL_RESULT_UNKNOWN")
  assert.equal([...board.posts.values()][0].state, "pending")
  assert.equal(f.sends.length, 1)
  await call(f.handler, { method: "POST", body: input })
  assert.equal(f.sends.length, 1)
  const base = fixture(t)
  const second = fixture(t, { store: { claim: base.store.claim, finish() { throw new Error("private disk") } } })
  assert.equal((await call(second.handler, { method: "POST", body: draft() })).body.code, "MAIL_RESULT_UNKNOWN")
  assert.equal([...second.board.posts.values()][0].state, "accepted")
})

test("board API requires login for list, image and writes; all logged-in users use SSO identity", async () => {
  const calls = [], id = "a".repeat(64)
  const db = createChartMailBoardDb({ run: async (action, payload) => {
    calls.push({ action, payload })
    return { ok: true, posts: [], total: 0, post: { id }, imageBase64: png }
  } })
  const handler = createChartMailBoardHandler({ db, env })
  for (const [path, method] of [["/api/chart-mail-board", "GET"], [`/api/chart-mail-board/${id}/image`, "GET"], [`/api/chart-mail-board/${id}`, "PATCH"]]) {
    assert.equal((await call(handler, { path, method, authenticated: false })).status, 401)
  }
  assert.equal(calls.length, 0)
  const list = await call(handler, { path: "/api/chart-mail-board?page=2&status=COMPLETED&search=test", user: "Other.User" })
  assert.equal(list.status, 200)
  assert.deepEqual(calls.at(-1), { action: "list", payload: { actor: "other.user", page: 2, status: "COMPLETED", search: "test" } })
  const image = await call(handler, { path: `/api/chart-mail-board/${id}/image` })
  assert.deepEqual(image.body, Buffer.from(png, "base64"))
  assert.equal(image.headers["Content-Type"], "image/png")
  assert.equal(image.headers["X-Content-Type-Options"], "nosniff")
  assert.equal((await call(handler, { path: `/api/chart-mail-board/${id}`, method: "PATCH", body: { actor: "forged", status: "COMPLETED", version: 1, comment: "done" } })).status, 200)
  assert.equal(calls.at(-1).payload.actor, "sender.test")
  assert.equal((await call(handler, { path: `/api/chart-mail-board/${id}`, method: "DELETE" })).status, 405)
  assert.equal((await call(handler, { path: "/api/chart-mail-board", method: "POST", body: {} })).status, 405)
  for (const query of ["page=0", "page=2.5", "status=SKIP", `search=${"a".repeat(201)}`]) assert.equal((await call(handler, { path: `/api/chart-mail-board?${query}` })).status, 400)
  for (const body of [{ status: "SKIP", version: 1 }, { status: "COMPLETED", version: 0 }, { status: "COMPLETED", version: 1, comment: "a".repeat(1001) }]) assert.equal((await call(handler, { path: `/api/chart-mail-board/${id}`, method: "PATCH", body })).status, 400)
  assert.equal((await call(handler, { path: `/api/chart-mail-board/${id}`, method: "PATCH", raw: "x".repeat(8193) })).status, 400)
  const disabled = createChartMailBoardHandler({ db, env: {} })
  assert.equal((await call(disabled, { path: "/api/chart-mail-board" })).body.code, "BOARD_NOT_CONFIGURED")
})

test("storage errors do not reveal DB details and status conflicts return 409", async () => {
  for (const [code, status] of [["BOARD_CONFLICT", 409], ["BOARD_NOT_FOUND", 404], ["BOARD_STORAGE_ERROR", 500]]) {
    const logs = []
    const handler = createChartMailBoardHandler({ env, logger: line => logs.push(line), db: { async detail() { throw Object.assign(new Error("private token SQL"), { code }) } } })
    const result = await call(handler, { path: `/api/chart-mail-board/${"a".repeat(64)}` })
    assert.equal(result.status, status)
    assert.doesNotMatch(JSON.stringify([result, logs]), /private|token|SQL/)
  }
})

test("Python bridge passes parameters via stdin and masks process errors", async () => {
  let stdin
  const execute = (_command, args, options, done) => {
    assert.equal(args[0], "-B")
    assert.equal(options.maxBuffer, 8 * 1024 * 1024)
    queueMicrotask(() => done(null, JSON.stringify({ ok: true, posts: [] })))
    return { stdin: { on() {}, end(value) { stdin = JSON.parse(value) } } }
  }
  await runChartMailBoardHelper("list", { actor: "test.user" }, { execute })
  assert.equal(stdin.actor, "test.user")
  await assert.rejects(runChartMailBoardHelper("list", {}, { execute: (_c, _a, _o, done) => {
    queueMicrotask(() => done(new Error("private secret")))
    return { stdin: { on() {}, end() {} } }
  } }), error => error.code === "BOARD_STORAGE_ERROR" && !error.message.includes("secret"))
})

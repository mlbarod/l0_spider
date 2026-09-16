import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Readable } from "node:stream"
import { createMailRecipientGroupStore, createMailRecipientGroupsHandler } from "./mailRecipientGroups.mjs"
import { handleChartMailRequest } from "./chartMail.mjs"
import { parseMailRecipients } from "../src/features/fdc-trend/utils/chartMail.mjs"

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "spider-mail-groups-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const filePath = join(directory, "groups.json")
  return { filePath, store: createMailRecipientGroupStore({ filePath }) }
}

async function call(handler, { method = "GET", user = "test.owner", body, authenticated = true, raw, contentType = "application/json" } = {}) {
  const request = Readable.from([raw ?? (body ? JSON.stringify(body) : "")])
  Object.assign(request, { method, headers: { "content-type": contentType }, ssoRequired: authenticated, auth: { knoxId: user } })
  const result = {}
  const response = { writeHead(status, headers) { result.status = status; result.headers = headers }, end(value) { result.body = JSON.parse(value) } }
  await handler(request, response)
  return result
}

test("recipient normalization deduplicates corporate addresses and rejects other domains", () => {
  assert.deepEqual(parseMailRecipients("TEST.USER, test.user@samsung.com; second.user"), ["test.user", "second.user"])
  for (const value of ["other@example.com", "user@samsung.com.evil", "a<b", "", Array(101).fill(0).map((_, i) => `test${i}`)]) assert.throws(() => parseMailRecipients(value))
})

test("groups persist across store instances and isolate owners for list, update and delete", (t) => {
  const { store, filePath } = fixture(t)
  const group = store.save("owner.a", { owner: "owner.b", name: "담당자", recipients: ["a.test", "A.TEST@samsung.com"] })
  assert.deepEqual(group.recipients, ["a.test"])
  assert.equal(group.owner, undefined)
  assert.deepEqual(store.list("owner.b"), [])
  assert.throws(() => store.save("owner.b", { ...group, name: "도용" }))
  assert.throws(() => store.remove("owner.b", group.id))
  assert.deepEqual(createMailRecipientGroupStore({ filePath }).list("owner.a"), [group])
  assert.equal(statSync(filePath).mode & 0o777, 0o600)
  const edited = store.save("owner.a", { id: group.id, name: "새 이름", recipients: ["b.test"] })
  assert.equal(edited.id, group.id)
  assert.equal(store.list("owner.a").length, 1)
  store.remove("owner.a", group.id)
  assert.deepEqual(store.list("owner.a"), [])
})

test("invalid, duplicate and excessive groups do not alter stored records", (t) => {
  const { store, filePath } = fixture(t)
  const input = { name: "Group", recipients: ["test.user"] }
  store.save("owner", input)
  const before = readFileSync(filePath, "utf8")
  for (const invalid of [{ ...input, name: "group" }, { ...input, name: "\nBad" }, { ...input, recipients: ["a@evil.com"] }, { ...input, id: "missing" }]) assert.throws(() => store.save("owner", invalid))
  assert.equal(readFileSync(filePath, "utf8"), before)
  for (let i = 1; i < 50; i += 1) store.save("owner", { ...input, name: `Group ${i}` })
  assert.throws(() => store.save("owner", { ...input, name: "Group 51" }))
})

test("corrupt storage is never silently overwritten", (t) => {
  const { store, filePath } = fixture(t)
  writeFileSync(filePath, "broken-store")
  assert.throws(() => store.save("owner", { name: "test", recipients: ["a"] }))
  assert.equal(readFileSync(filePath, "utf8"), "broken-store")
})

test("API derives owner only from SSO and protects all group operations", async (t) => {
  const { store } = fixture(t)
  const handler = createMailRecipientGroupsHandler({ store })
  for (const method of ["GET", "POST", "DELETE"]) assert.equal((await call(handler, { method, authenticated: false })).status, 401)
  const created = await call(handler, { method: "POST", body: { owner: "other", knoxId: "other", name: "담당자", recipients: ["synthetic.user"] } })
  assert.equal(created.status, 200)
  assert.equal((await call(handler)).body.groups.length, 1)
  assert.deepEqual((await call(handler, { user: "other" })).body.groups, [])
  assert.equal((await call(handler, { user: "other", method: "DELETE", body: { id: created.body.group.id } })).status, 400)
  assert.equal((await call(handler, { method: "POST", raw: "{" })).status, 400)
  assert.equal((await call(handler, { method: "POST", raw: "x".repeat(33000) })).status, 400)
  assert.equal((await call(handler, { method: "POST", contentType: "text/plain", body: {} })).status, 400)
  assert.equal((await call(handler, { method: "DELETE", body: { id: created.body.group.id } })).status, 200)
})

test("storage errors expose no file details or recipients", async () => {
  const logs = []
  const handler = createMailRecipientGroupsHandler({ store: { list() { throw new Error("/private/group.json secret recipient") } }, logger: (line) => logs.push(line) })
  const response = await call(handler)
  assert.equal(response.status, 500)
  assert.equal(response.body.code, "MAIL_GROUP_STORAGE_ERROR")
  assert.ok(response.body.requestId)
  assert.doesNotMatch(JSON.stringify([response, logs]), /private|secret|recipient"/)
})

test("unconfirmed mail transport stays unavailable and cannot report send success", async () => {
  assert.equal((await call(handleChartMailRequest, { authenticated: false })).status, 401)
  const status = await call(handleChartMailRequest)
  assert.equal(status.body.ready, false)
  const response = await call(handleChartMailRequest, { method: "POST", body: { sender: "spoofed" } })
  assert.equal(response.status, 503)
  assert.equal(response.body.ok, false)
  assert.equal(response.body.code, "MAIL_TRANSPORT_NOT_CONFIGURED")
})

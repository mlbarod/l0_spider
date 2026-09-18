import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { getSsoCurrentUser, sendSsoAuthenticationError } from "./currentUser.mjs"
import { createSafeApiError } from "./safeApiError.mjs"
import { createMailRecipientGroupDbStore } from "./mailRecipientGroupsDb.mjs"
import { parseMailRecipients } from "../src/features/fdc-trend/utils/chartMail.mjs"

const defaultPath = fileURLToPath(new URL("../.local/mail-recipient-groups.json", import.meta.url))
const idPattern = /^[0-9a-f-]{36}$/

function inputGroup(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("그룹 내용을 확인해 주세요.")
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80 || [...input.name].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new TypeError("그룹 이름은 1~80자로 입력해 주세요.")
  let recipients
  try { recipients = parseMailRecipients(input.recipients) } catch (error) { throw new TypeError(error.message) }
  return { name: input.name.trim(), recipients }
}

// Legacy file store retained for existing files/tests. HTTP requests use the DB
// store below; they never import, overwrite or fall back to this file.
export function createMailRecipientGroupStore({ filePath = process.env.MAIL_RECIPIENT_GROUPS_PATH || defaultPath } = {}) {
  const path = resolve(filePath)
  function read() {
    let state
    try { state = JSON.parse(readFileSync(path, "utf8")) } catch (error) {
      if (error.code === "ENOENT") return { version: 1, groups: [] }
      throw new Error("수신인 그룹 저장소를 읽지 못했습니다.")
    }
    if (state?.version !== 1 || !Array.isArray(state.groups)) throw new Error("수신인 그룹 저장소 형식이 올바르지 않습니다.")
    for (const group of state.groups) {
      if (!group || !idPattern.test(group.id) || typeof group.owner !== "string" || !group.owner) throw new Error("수신인 그룹 저장소 형식이 올바르지 않습니다.")
      try { inputGroup(group) } catch { throw new Error("수신인 그룹 저장소 형식이 올바르지 않습니다.") }
    }
    return state
  }
  function write(state) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      writeFileSync(temporary, JSON.stringify(state) + "\n", { mode: 0o600, flag: "wx" })
      renameSync(temporary, path)
    } finally {
      try { unlinkSync(temporary) } catch { /* Atomic rename already removed the temporary file. */ }
    }
  }
  function publicGroup({ owner: _owner, ...group }) { return group }
  return {
    list(owner) { return read().groups.filter((group) => group.owner === owner).map(publicGroup) },
    save(owner, input) {
      const normalized = inputGroup(input)
      const state = read()
      const own = state.groups.filter((group) => group.owner === owner)
      const existing = input.id ? own.find((group) => group.id === input.id) : null
      if (input.id && !existing) throw new TypeError("수정할 그룹을 찾을 수 없습니다.")
      if (!existing && own.length >= 50) throw new TypeError("개인 수신인 그룹은 최대 50개까지 저장할 수 있습니다.")
      if (own.some((group) => group.id !== input.id && group.name.toLowerCase() === normalized.name.toLowerCase())) throw new TypeError("같은 이름의 그룹이 있습니다.")
      const group = { id: existing?.id ?? randomUUID(), owner, ...normalized, updatedAt: new Date().toISOString() }
      if (existing) state.groups[state.groups.indexOf(existing)] = group
      else state.groups.push(group)
      write(state)
      return publicGroup(group)
    },
    remove(owner, id) {
      const state = read()
      const index = state.groups.findIndex((group) => group.owner === owner && group.id === id)
      if (index === -1) throw new TypeError("삭제할 그룹을 찾을 수 없습니다.")
      state.groups.splice(index, 1)
      write(state)
    },
  }
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify(payload))
}

async function readBody(req) {
  if (String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new TypeError("JSON 요청이 필요합니다.")
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk)
    if (size > 32768) throw new TypeError("그룹 요청이 너무 큽니다.")
    chunks.push(Buffer.from(chunk))
  }
  let body
  try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { throw new TypeError("JSON 요청을 확인해 주세요.") }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TypeError("그룹 내용을 확인해 주세요.")
  return body
}

export function createMailRecipientGroupsHandler({ store = createMailRecipientGroupDbStore(), logger } = {}) {
  return async function handle(req, res) {
    try {
      const owner = getSsoCurrentUser(req).knoxId.trim().toLowerCase()
      if (req.method === "GET") return json(res, 200, { ok: true, groups: await store.list(owner) })
      if (!["POST", "DELETE"].includes(req.method)) return json(res, 405, { ok: false, error: "지원하지 않는 요청입니다." })
      const input = await readBody(req)
      if (req.method === "POST") {
        const normalized = inputGroup(input)
        if (input.id && (typeof input.id !== "string" || !idPattern.test(input.id))) throw new TypeError("그룹 ID를 확인해 주세요.")
        const group = await store.save(owner, { ...normalized, ...(input.id ? { id: input.id } : {}) })
        return json(res, 200, { ok: true, group })
      }
      if (typeof input.id !== "string" || !idPattern.test(input.id)) throw new TypeError("그룹 ID를 확인해 주세요.")
      await store.remove(owner, input.id)
      return json(res, 200, { ok: true })
    } catch (error) {
      if (sendSsoAuthenticationError(error, res)) return
      if (error instanceof TypeError) return json(res, 400, { ok: false, code: "INVALID_MAIL_GROUP", error: error.message })
      return json(res, 500, createSafeApiError({ code: "MAIL_GROUP_STORAGE_ERROR", message: "수신인 그룹을 저장하거나 불러오지 못했습니다.", scope: "mail-recipient-groups", logger }))
    }
  }
}

export const handleMailRecipientGroupsRequest = createMailRecipientGroupsHandler()

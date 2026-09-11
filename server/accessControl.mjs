import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, writeFileSync, unlinkSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const API = "/api/access-control"
const defaultPath = fileURLToPath(new URL("../.local/sso-access.json", import.meta.url))

function requiredText(value, label, max = 200) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || [...value].some(character => character.charCodeAt(0) < 32)) {
    throw new TypeError(`${label} 값을 확인해 주세요.`)
  }
  return value.trim()
}

function userId(value) {
  const id = requiredText(value, "유저ID", 100).toLowerCase()
  if (/[\s@\\/]/.test(id)) throw new TypeError("유저ID에는 이메일이나 도메인을 포함할 수 없습니다.")
  return id
}

function ruleInput(input) {
  if (!["user_id", "department"].includes(input.field)) throw new TypeError("기준 항목을 확인해 주세요.")
  if (!["exact", "contains"].includes(input.matchType) || (input.field === "user_id" && input.matchType !== "exact")) {
    throw new TypeError("유저ID는 직접 일치만 사용할 수 있습니다.")
  }
  return { field: input.field, matchType: input.matchType, matchValue: input.field === "user_id" ? userId(input.matchValue) : requiredText(input.matchValue, "조건 값") }
}

export function resolveAccessRole(identity, state) {
  const id = String(identity?.knoxId ?? "").trim().toLowerCase()
  if (!id) return "blocked"
  if (state.masters.some(master => master.userId === id)) return "master"
  return state.rules.some(rule => {
    const actual = rule.field === "user_id" ? id : identity.department
    return typeof actual === "string" && (rule.matchType === "exact" ? actual === rule.matchValue : actual.includes(rule.matchValue))
  }) ? "general" : "blocked"
}

// Like the existing SSO session store, this is for a single Node process.
// Synchronous read/modify/atomic rename keeps authorization and mutation together.
export function createAccessStore({ filePath = defaultPath, bootstrapUserIds = [] } = {}) {
  const path = resolve(filePath)
  function read() {
    try {
      const state = JSON.parse(readFileSync(path, "utf8"))
      if (state.version !== 1 || !Array.isArray(state.masters) || !state.masters.length || !Array.isArray(state.rules)) throw new Error("Invalid access store")
      for (const master of state.masters) if (userId(master.userId) !== master.userId) throw new Error("Invalid master")
      for (const rule of state.rules) {
        requiredText(rule.ruleId, "규칙 ID", 36)
        const normalized = ruleInput(rule)
        if (normalized.matchValue !== rule.matchValue) throw new Error("Invalid rule")
      }
      return state
    } catch (error) {
      if (error.code === "ENOENT") throw error
      throw new Error("접근 권한 파일을 읽을 수 없습니다.")
    }
  }
  function save(state) {
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      writeFileSync(temporary, JSON.stringify(state, null, 2) + "\n", { mode: 0o600, flag: "wx" })
      renameSync(temporary, path)
    } finally {
      try { unlinkSync(temporary) } catch { /* Preserve the original write error; never use a partial file. */ }
    }
  }
  try { read() } catch (error) {
    if (error.code !== "ENOENT") throw new Error("접근 권한 파일을 읽을 수 없습니다. 파일을 확인해 주세요.")
    const ids = [...new Set(bootstrapUserIds.map(userId))]
    if (!ids.length) throw new Error("최초 마스터 유저ID를 SSO_BOOTSTRAP_MASTER_USER_IDS에 설정하세요.")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    writeFileSync(path, JSON.stringify({ version: 1, masters: ids.map(id => ({ userId: id, createdAt: new Date().toISOString() })), rules: [] }, null, 2) + "\n", { mode: 0o600, flag: "wx" })
  }
  return {
    read,
    mutate(identity, method, input) {
      const state = read()
      if (resolveAccessRole(identity, state) !== "master") return false
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("요청 내용을 확인해 주세요.")
      if (input.target === "master") {
        const id = userId(input.userId)
        const index = state.masters.findIndex(master => master.userId === id)
        if (method === "POST") {
          if (index !== -1) throw new TypeError("이미 등록된 마스터입니다.")
          state.masters.push({ userId: id, createdAt: new Date().toISOString() })
        } else if (method === "DELETE") {
          if (index === -1) throw new TypeError("마스터를 찾을 수 없습니다.")
          if (state.masters.length <= 1) throw new TypeError("마지막 마스터 권한은 회수할 수 없습니다.")
          state.masters.splice(index, 1)
        } else throw new TypeError("지원하지 않는 변경입니다.")
      } else if (input.target === "rule") {
        const index = state.rules.findIndex(rule => rule.ruleId === input.ruleId)
        if (method !== "POST" && index === -1) throw new TypeError("규칙을 찾을 수 없습니다.")
        if (method === "DELETE") state.rules.splice(index, 1)
        else {
          const rule = ruleInput(input)
          if (state.rules.some(existing => existing.ruleId !== (method === "PATCH" ? input.ruleId : null) && existing.field === rule.field && existing.matchType === rule.matchType && existing.matchValue === rule.matchValue)) throw new TypeError("이미 등록된 규칙입니다.")
          if (method === "POST") state.rules.push({ ...rule, ruleId: randomUUID(), createdAt: new Date().toISOString() })
          else if (method === "PATCH") state.rules[index] = { ...state.rules[index], ...rule }
          else throw new TypeError("지원하지 않는 변경입니다.")
        }
      } else throw new TypeError("변경 대상을 확인해 주세요.")
      save(state)
      return true
    },
  }
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify(payload))
  return true
}

async function body(req) {
  if (String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new TypeError("JSON 요청이 필요합니다.")
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 8192) throw new TypeError("요청이 너무 큽니다.")
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { throw new TypeError("JSON 요청을 확인해 주세요.") }
}

export function createAccessControl({ enabled, environment = process.env, store } = {}) {
  if (!enabled) return { async handle(req, res) {
    return new URL(req.url, "http://localhost").pathname === API ? json(res, 404, { ok: false, error: "SSO에서만 사용할 수 있습니다." }) : false
  } }
  const origin = new URL(environment.SSO_REDIRECT_URI).origin
  const repository = store ?? createAccessStore({ filePath: environment.SSO_ACCESS_CONTROL_FILE || defaultPath, bootstrapUserIds: String(environment.SSO_BOOTSTRAP_MASTER_USER_IDS ?? "").split(",").map(id => id.trim()).filter(Boolean) })
  return { async handle(req, res) {
    const url = new URL(req.url, origin)
    if (!req.auth?.knoxId) return json(res, 401, { ok: false, code: "SSO_AUTHENTICATION_REQUIRED", error: "SSO 로그인이 필요합니다." })
    try {
      const state = repository.read()
      req.accessRole = resolveAccessRole(req.auth, state)
      if (req.accessRole === "blocked") {
        if (url.pathname === "/api" || url.pathname.startsWith("/api/") || !["GET", "HEAD"].includes(req.method)) return json(res, 403, { ok: false, code: "ACCESS_DENIED", error: "접근 권한이 없습니다. 마스터 사용자에게 권한을 요청해 주세요." })
        res.writeHead(403, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" })
        res.end(req.method === "HEAD" ? "" : '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>접근 권한 필요 · L0 Spider</title><body style="font-family:system-ui;max-width:560px;margin:15vh auto;padding:24px"><h1>접근 권한이 없습니다</h1><p>SSO 인증은 완료되었지만 L0 Spider 접근 권한이 없습니다.</p><p>마스터 사용자에게 유저ID 또는 소속부서의 접근 권한을 요청해 주세요.</p><p><a href="/">권한 다시 확인</a></p><form action="/auth/logout" method="post"><button type="submit">로그아웃</button></form></body></html>')
        return true
      }
      if (url.pathname !== API) return false
      if (req.accessRole !== "master") return json(res, 403, { ok: false, code: "MASTER_REQUIRED", error: "마스터만 권한을 관리할 수 있습니다." })
      if (req.method === "GET") return json(res, 200, { ok: true, masters: state.masters, rules: state.rules })
      if (!["POST", "PATCH", "DELETE"].includes(req.method)) return json(res, 405, { ok: false, error: "지원하지 않는 요청입니다." })
      let source
      try { source = new URL(req.headers.origin ?? req.headers.referer).origin } catch { /* deny missing origin */ }
      if (source !== origin) return json(res, 403, { ok: false, error: "요청 출처를 확인해 주세요." })
      const input = await body(req)
      if (!repository.mutate(req.auth, req.method, input)) return json(res, 403, { ok: false, code: "MASTER_REQUIRED", error: "마스터만 권한을 관리할 수 있습니다." })
      return json(res, 200, { ok: true })
    } catch (error) {
      if (error instanceof TypeError) return json(res, 400, { ok: false, error: error.message })
      return json(res, 503, { ok: false, code: "ACCESS_STORE_UNAVAILABLE", error: "접근 권한 저장소를 확인할 수 없습니다. 관리자에게 문의해 주세요." })
    }
  } }
}

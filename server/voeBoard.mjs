import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { getSsoCurrentUser, sendSsoAuthenticationError } from "./currentUser.mjs"
import { MAX_QNA_REQUEST_BYTES } from "../src/features/voe/limits.mjs"

const helper = fileURLToPath(new URL("../scripts/voe_board.py", import.meta.url))
const errors = {
  VALIDATION_FAILED: [400, "제목, 카테고리, 본문과 상태를 확인해 주세요."],
  QNA_NOT_FOUND: [404, "게시글 또는 답변을 찾을 수 없습니다."],
  QNA_FORBIDDEN: [403, "이 내용을 변경할 권한이 없습니다."],
  BODY_TOO_LARGE: [413, "글과 사진의 전체 용량이 너무 큽니다. 사진 크기를 줄여 주세요."],
  DB_FAILED: [503, "VOE DB에 연결하지 못했습니다. DB 설정과 VOE 테이블 2개가 준비되었는지 확인해 주세요."],
}
function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" })
  res.end(JSON.stringify(payload))
}

export function runVoeHelper(payload, { execute = execFile } = {}) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(Object.assign(new Error("VOE DB 요청 실패"), { code: "DB_FAILED" }))
    const child = execute("python3", ["-B", helper], { timeout: 30_000, maxBuffer: 72 * 1024 * 1024, env: process.env }, (error, stdout) => {
      if (error) return fail()
      let result
      try { result = JSON.parse(stdout) } catch { return fail() }
      if (!result.ok) return reject(Object.assign(new Error("VOE 요청 실패"), { code: Object.hasOwn(errors, result.code) ? result.code : "DB_FAILED" }))
      resolve(result)
    })
    child.stdin.on("error", fail)
    child.stdin.end(JSON.stringify(payload))
  })
}

async function readBody(req) {
  if (String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new TypeError()
  const chunks = []
  let size = 0
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += Buffer.byteLength(chunk)
    if (size > MAX_QNA_REQUEST_BYTES) {
      req.resume()
      throw Object.assign(new Error(), { code: "BODY_TOO_LARGE" })
    }
    chunks.push(Buffer.from(chunk))
  }
  let result
  try { result = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { throw new TypeError() }
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new TypeError()
  return result
}

export function createVoeHandler({ run = runVoeHelper } = {}) {
  return async (req, res, url) => {
    try {
      const userId = getSsoCurrentUser(req).knoxId.trim().toLowerCase()
      if (!["master", "general"].includes(req.accessRole)) throw Object.assign(new Error(), { code: "QNA_FORBIDDEN" })
      const actor = { userId, displayName: req.auth.displayName || userId, role: req.accessRole }
      if (url.pathname === "/api/voe/identity" && req.method === "GET") return json(res, 200, { user: { userId, name: actor.displayName }, role: actor.role })
      const route = /^\/api\/voe(?:\/(notifications|questions)(?:\/([1-9][0-9]*)(?:\/(messages)(?:\/([1-9][0-9]*))?)?)?)?$/.exec(url.pathname)
      if (!route) return json(res, 404, { error: { message: "VOE 요청 경로를 찾을 수 없습니다." } })
      const [, resource, qid, messages, mid] = route
      const questionId = qid ? Number(qid) : undefined
      const messageId = mid ? Number(mid) : undefined
      if ((qid && !Number.isSafeInteger(questionId)) || (mid && !Number.isSafeInteger(messageId)) || (resource === "notifications" && qid)) throw new TypeError()
      let action
      if (req.method === "GET" && !resource) action = "list"
      if (req.method === "GET" && qid && !messages) action = "detail"
      if (req.method === "POST" && resource === "questions" && !qid) action = "create"
      if (req.method === "POST" && messages && !mid) action = "reply"
      if (req.method === "PATCH" && qid && !messages) action = "update"
      if (req.method === "PATCH" && mid) action = "message"
      if (req.method === "PATCH" && resource === "notifications" && !qid) action = "notifications"
      if (!action) return json(res, 405, { error: { message: "지원하지 않는 요청입니다." } })
      const input = req.method === "GET" ? undefined : await readBody(req)
      // 사용자 식별과 권한은 SSO에서만 가져옵니다. 요청 본문의 actor는 사용하지 않습니다.
      return json(res, req.method === "POST" ? 201 : 200, await run({ action, actor, questionId, messageId, input }))
    } catch (error) {
      if (sendSsoAuthenticationError(error, res)) return
      const code = error instanceof TypeError ? "VALIDATION_FAILED" : Object.hasOwn(errors, error.code) ? error.code : "DB_FAILED"
      const [status, message] = errors[code]
      return json(res, status, { error: { code, message } })
    }
  }
}
export const handleVoeRequest = createVoeHandler()

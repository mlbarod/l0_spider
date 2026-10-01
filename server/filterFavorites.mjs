import { FAVORITE_VIRTUAL_SDWTS } from "../src/features/fdc-trend/utils/filterFavorites.mjs"
import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { getSsoCurrentUser, sendSsoAuthenticationError } from "./currentUser.mjs"
import { assertKnownMappingLine, assertKnownMappingLineSdwt, requireLineMapping, readLineMapping } from "./mappingConfig.mjs"

const helperPath = fileURLToPath(new URL("../scripts/filter_favorites.py", import.meta.url))
function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify(payload))
}
function runHelper(action, payload) {
  return new Promise((resolve, reject) => {
    const child = execFile("python3", ["-B", helperPath, action], { timeout: 10000, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(new Error("즐겨찾기 DB 처리에 실패했습니다."))
      try {
        const result = JSON.parse(stdout)
        if (!result.ok) throw new Error("즐겨찾기 DB 처리에 실패했습니다.")
        resolve(result)
      } catch { reject(new Error("즐겨찾기 DB 처리에 실패했습니다.")) }
    })
    child.stdin.on("error", () => {})
    child.stdin.end(JSON.stringify(payload))
  })
}
export async function handleFilterFavoritesRequest(req, res, { helper = runHelper, mappingReader = readLineMapping } = {}) {
  if (!["GET", "PUT"].includes(req.method)) return sendJson(res, 405, { ok: false, error: "Method not allowed" })
  try {
    const { knoxId } = getSsoCurrentUser(req)
    if (req.method === "GET") return sendJson(res, 200, await helper("get", { knoxId }))
    let raw = ""
    for await (const chunk of req) {
      raw += chunk
      if (Buffer.byteLength(raw) > 4096) return sendJson(res, 413, { ok: false, error: "요청 데이터가 너무 큽니다." })
    }
    let body
    try { body = JSON.parse(raw) } catch { return sendJson(res, 400, { ok: false, error: "잘못된 JSON입니다." }) }
    if (!body || (body.selected !== undefined && typeof body.selected !== "boolean") || !["line", "sdwt"].includes(body.field) || typeof body.line !== "string" || !body.line || body.line.length > 160
      || (body.field === "sdwt" && (typeof body.sdwt !== "string" || !body.sdwt || body.sdwt.length > 160))) {
      return sendJson(res, 400, { ok: false, error: "즐겨찾기 필터 값이 올바르지 않습니다." })
    }
    const selected = body.selected !== false
    if (selected) {
      const mapping = await requireLineMapping(mappingReader)
      assertKnownMappingLine(mapping, body.line)
      if (body.field === "sdwt" && !FAVORITE_VIRTUAL_SDWTS.includes(body.sdwt)) assertKnownMappingLineSdwt(mapping, { line: body.line, pathSdwt: body.sdwt })
    }
    return sendJson(res, 200, await helper("save", { knoxId, field: body.field, line: body.line, sdwt: body.field === "sdwt" ? body.sdwt : null, selected }))
  } catch (error) {
    if (sendSsoAuthenticationError(error, res)) return
    const invalid = error.code === "MAPPING_SCOPE_MISMATCH"
    sendJson(res, invalid ? 400 : 503, { ok: false, error: invalid ? "선택한 Line·SDWT가 기준정보와 일치하지 않습니다." : "즐겨찾기를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." })
  }
}

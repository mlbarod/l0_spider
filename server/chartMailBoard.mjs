import { getSsoCurrentUser, sendSsoAuthenticationError } from "./currentUser.mjs"
import { createSafeApiError } from "./safeApiError.mjs"
import { createChartMailBoardDb } from "./chartMailBoardDb.mjs"

export function isChartMailBoardEnabled(env = process.env) {
  return String(env.CHART_MAIL_BOARD_ENABLED ?? "").trim().toLowerCase() === "true"
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
  res.end(JSON.stringify(payload))
}

async function readStatus(req) {
  if (String(req.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase() !== "application/json") throw new TypeError()
  let size = 0
  const chunks = []
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk)
    if (size > 8192) throw new TypeError()
    chunks.push(Buffer.from(chunk))
  }
  let input
  try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch { throw new TypeError() }
  if (!input || !["IN_PROGRESS", "COMPLETED"].includes(input.status)
    || !Number.isSafeInteger(input.version) || input.version < 1 || input.version > 4294967294
    || (input.comment !== undefined && (typeof input.comment !== "string" || input.comment.length > 1000))) throw new TypeError()
  return { status: input.status, version: input.version, comment: input.comment?.trim() ?? "" }
}

export function createChartMailBoardHandler({ db = createChartMailBoardDb(), env = process.env, logger } = {}) {
  return async function handle(req, res, url) {
    try {
      const actor = getSsoCurrentUser(req).knoxId.trim().toLowerCase()
      if (!isChartMailBoardEnabled(env)) return json(res, 503, { ok: false, code: "BOARD_NOT_CONFIGURED", error: "게시판 DB 준비 후 사용할 수 있습니다. 관리자에게 문의해 주세요." })
      const match = /^\/api\/chart-mail-board(?:\/([a-f0-9]{64})(\/image)?)?$/.exec(url.pathname)
      if (!match) return json(res, 404, { ok: false, code: "BOARD_NOT_FOUND", error: "게시글을 찾을 수 없습니다." })
      const [, id, image] = match
      if (req.method === "GET" && !id) {
        const pageText = url.searchParams.get("page") ?? "1"
        const page = Number(pageText)
        const status = url.searchParams.get("status") ?? ""
        const search = (url.searchParams.get("search") ?? "").trim()
        if (!/^\d+$/.test(pageText) || !Number.isSafeInteger(page) || page < 1 || page > 100000
          || !["", "IN_PROGRESS", "COMPLETED"].includes(status) || search.length > 200) throw new TypeError()
        return json(res, 200, await db.list(actor, { page, status, search }))
      }
      if (req.method === "GET" && image) {
        const result = await db.image(actor, id)
        const png = Buffer.from(result.imageBase64, "base64")
        res.writeHead(200, {
          "Content-Type": "image/png", "Content-Length": png.length,
          "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": 'inline; filename="chart.png"',
        })
        return res.end(png)
      }
      if (req.method === "GET" && id) return json(res, 200, await db.detail(actor, id))
      if (req.method === "PATCH" && id && !image) return json(res, 200, await db.status(actor, id, await readStatus(req)))
      return json(res, 405, { ok: false, error: "지원하지 않는 요청입니다." })
    } catch (error) {
      if (sendSsoAuthenticationError(error, res)) return
      if (error instanceof TypeError || error.code === "BOARD_INVALID") return json(res, 400, { ok: false, code: "BOARD_INVALID", error: "게시판 조회 조건 또는 상태 변경 내용을 확인해 주세요." })
      if (error.code === "BOARD_NOT_FOUND") return json(res, 404, { ok: false, code: error.code, error: "게시글을 찾을 수 없습니다." })
      if (error.code === "BOARD_CONFLICT") return json(res, 409, { ok: false, code: error.code, error: "다른 사용자가 상태를 변경했습니다. 최신 내용을 확인한 뒤 다시 처리해 주세요." })
      return json(res, 500, createSafeApiError({ code: "BOARD_STORAGE_ERROR", message: "게시판을 저장하거나 불러오지 못했습니다. DB 설정과 테이블을 확인해 주세요.", scope: "chart-mail-board", logger }))
    }
  }
}

export const handleChartMailBoardRequest = createChartMailBoardHandler()

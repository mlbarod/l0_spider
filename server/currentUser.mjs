import { requireAuthenticatedUser } from "./auth.mjs"

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

export function resolveCurrentUser(req) {
  return Promise.resolve(requireAuthenticatedUser(req))
}

export async function handleCurrentUserRequest(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  try {
    const user = await resolveCurrentUser(req)
    sendJson(res, 200, { ok: true, ...user })
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message })
  }
}

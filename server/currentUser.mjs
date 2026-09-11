function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

// Only the server-side SSO guard may assign req.auth and req.ssoRequired.
export function getSsoCurrentUser(req) {
  if (!req.ssoRequired || typeof req.auth?.knoxId !== "string" || !req.auth.knoxId.trim()) {
    const error = new Error("SSO 로그인이 필요합니다.")
    error.code = "SSO_AUTHENTICATION_REQUIRED"
    throw error
  }
  return { ok: true, knoxId: req.auth.knoxId }
}

export function resolveRequestCurrentUser(req) {
  return Promise.resolve(getSsoCurrentUser(req))
}

export function sendSsoAuthenticationError(error, res) {
  if (error?.code !== "SSO_AUTHENTICATION_REQUIRED") return false
  sendJson(res, 401, { ok: false, code: error.code, error: "SSO 로그인이 필요합니다." })
  return true
}

export async function handleCurrentUserRequest(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }
  try {
    sendJson(res, 200, await resolveRequestCurrentUser(req))
  } catch (error) {
    if (!sendSsoAuthenticationError(error, res)) throw error
  }
}

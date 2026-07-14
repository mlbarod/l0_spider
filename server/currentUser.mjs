import { spawn } from "node:child_process"
import { fileURLToPath, URL } from "node:url"

const lookupScriptPath = fileURLToPath(new URL("../scripts/current_user.py", import.meta.url))
const CACHE_TTL_MS = 5 * 60 * 1000
const userCache = new Map()
const pendingLookups = new Map()

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

export function normalizeRemoteIp(value) {
  const ip = String(value ?? "").split(",")[0].trim()
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip
}

export function getRemoteIp(req) {
  return normalizeRemoteIp(
    req.headers["x-forwarded-for"]
    ?? req.headers["x-real-ip"]
    ?? req.socket?.remoteAddress
    ?? "",
  )
}

export function resolveCurrentUser(remoteIp) {
  const now = Date.now()
  userCache.forEach((entry, ip) => {
    if (entry.expiresAt <= now) userCache.delete(ip)
  })
  const cached = userCache.get(remoteIp)
  if (cached) return Promise.resolve(cached.payload)
  if (pendingLookups.has(remoteIp)) return pendingLookups.get(remoteIp)

  const lookup = new Promise((resolve, reject) => {
    const child = spawn("python3", ["-B", lookupScriptPath], {
      env: { ...process.env, REMOTE_ADDR: remoteIp },
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, 10_000)

    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", () => {
      clearTimeout(timeout)
      if (timedOut) {
        reject(new Error("접속자 조회 시간이 초과되었습니다."))
        return
      }

      let payload
      try {
        payload = JSON.parse(stdout.trim())
      } catch {
        reject(new Error(stderr.trim() || "접속자 조회 응답을 해석하지 못했습니다."))
        return
      }

      if (!payload.ok) {
        if (stderr.trim()) console.error(`[current-user] ${stderr.trim()}`)
        const error = new Error(payload.error || "접속자 정보를 확인하지 못했습니다.")
        error.code = payload.code
        reject(error)
        return
      }

      const normalizedPayload = {
        ok: true,
        knoxId: String(payload.knoxId ?? "").trim(),
      }
      if (!normalizedPayload.knoxId) {
        reject(new Error("접속자 knox_id를 확인하지 못했습니다."))
        return
      }
      userCache.set(remoteIp, {
        payload: normalizedPayload,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })
      resolve(normalizedPayload)
    })
  }).finally(() => pendingLookups.delete(remoteIp))

  pendingLookups.set(remoteIp, lookup)
  return lookup
}

export async function handleCurrentUserRequest(req, res) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  const remoteIp = getRemoteIp(req)
  if (!remoteIp) {
    sendJson(res, 400, { ok: false, error: "접속자 IP를 확인하지 못했습니다." })
    return
  }

  try {
    const payload = await resolveCurrentUser(remoteIp)
    sendJson(res, 200, payload)
  } catch (error) {
    const statusCode = error.code === "USER_NOT_FOUND" ? 404 : 500
    sendJson(res, statusCode, { ok: false, error: error.message })
  }
}

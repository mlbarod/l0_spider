import { spawn } from "node:child_process"
import { fileURLToPath, URL } from "node:url"

const lookupScriptPath = fileURLToPath(new URL("../scripts/my_eqp_reference.py", import.meta.url))
const CACHE_TTL_MS = 5 * 60 * 1000
let cachedPayload = null
let pendingLookup = null

function sendJson(res, statusCode, payload, method = "GET") {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": statusCode === 200 ? "private, max-age=60" : "no-store",
  })
  res.end(method === "HEAD" ? undefined : JSON.stringify(payload))
}

export function normalizeMyEqpReferenceRows(rows) {
  if (!Array.isArray(rows)) return []

  return rows.map((row) => ({
    main: String(row?.main ?? "").trim(),
    disp_name: String(row?.disp_name ?? "").trim(),
    sdwt_prod: String(row?.sdwt_prod ?? "").trim(),
    prc_group: String(row?.prc_group ?? "").trim(),
  })).filter((row) => row.main && row.disp_name && row.sdwt_prod && row.prc_group)
}

export function readMyEqpReferenceRows() {
  const now = Date.now()
  if (cachedPayload?.expiresAt > now) return Promise.resolve(cachedPayload.rows)
  if (pendingLookup) return pendingLookup

  pendingLookup = new Promise((resolve, reject) => {
    const child = spawn("python3", ["-B", lookupScriptPath], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, 15_000)

    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", () => {
      clearTimeout(timeout)
      if (timedOut) {
        reject(new Error("erdtsum_info 기준정보 조회 시간이 초과되었습니다."))
        return
      }

      let payload
      try {
        payload = JSON.parse(stdout.trim())
      } catch {
        reject(new Error(stderr.trim() || "erdtsum_info 기준정보 응답을 해석하지 못했습니다."))
        return
      }

      if (!payload.ok) {
        if (stderr.trim()) console.error(`[my-eqp-reference] ${stderr.trim()}`)
        reject(new Error(payload.error || "erdtsum_info 기준정보를 조회하지 못했습니다."))
        return
      }

      const rows = normalizeMyEqpReferenceRows(payload.rows)
      cachedPayload = { rows, expiresAt: Date.now() + CACHE_TTL_MS }
      resolve(rows)
    })
  }).finally(() => { pendingLookup = null })

  return pendingLookup
}

export async function handleMyEqpReferenceRequest(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {
      Allow: "GET, HEAD",
      "Content-Type": "application/json; charset=utf-8",
    })
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }))
    return
  }

  try {
    const rows = await readMyEqpReferenceRows()
    sendJson(res, 200, { ok: true, rows }, req.method)
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message }, req.method)
  }
}

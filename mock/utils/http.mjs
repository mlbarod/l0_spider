export function sendJson(res, statusCode, payload, extraHeaders = {}) {
  if (res.writableEnded) return
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...extraHeaders,
  })
  res.end(body)
}

export function sendSvg(res, label = "Synthetic Mock Image") {
  const safeLabel = String(label).replace(/[<>&"']/g, "")
  const body = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="#f1f5f9"/><path d="M80 420 L220 300 L350 340 L500 190 L650 260 L820 100" fill="none" stroke="#2563eb" stroke-width="12"/><text x="60" y="80" font-family="sans-serif" font-size="34" fill="#0f172a">${safeLabel}</text><text x="60" y="125" font-family="sans-serif" font-size="20" fill="#475569">Generated synthetic fixture — no company data</text></svg>`
  res.writeHead(200, {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  })
  res.end(body)
}

export async function readJson(req, limit = 1_000_000) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) {
      const error = new Error("Request body is too large")
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString("utf8").trim()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    const error = new Error("Request body must be valid JSON")
    error.statusCode = 400
    throw error
  }
}

export function queryObject(url) {
  const result = {}
  for (const [key, value] of url.searchParams) {
    if (key === "priority" || key === "line") {
      const current = result[key] ?? []
      result[key] = [...current, value]
    } else {
      result[key] = value
    }
  }
  return result
}

export function wait(delayMs, signal) {
  if (!delayMs) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, delayMs)
    signal?.addEventListener("abort", () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
  })
}

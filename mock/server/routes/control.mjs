import { readJson, sendJson } from "../../utils/http.mjs"
import { SCENARIOS } from "../../state/store.mjs"

export async function handleControlRoute(req, res, url, state) {
  if (url.pathname === "/__mock/offline") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "GET" })
      return true
    }
    res.writeHead(204, { "Cache-Control": "no-store" })
    res.end()
    return true
  }

  if (url.pathname === "/__mock/health") {
    if (req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "GET" })
      return true
    }
    sendJson(res, 200, {
      ok: true,
      service: "l0-spider-synthetic-mock",
      scenario: state.getScenario(),
    })
    return true
  }

  if (url.pathname === "/__mock/scenario") {
    if (req.method === "GET") {
      sendJson(res, 200, { ok: true, scenarios: SCENARIOS, ...state.snapshot() })
      return true
    }
    if (req.method === "POST") {
      const body = await readJson(req)
      sendJson(res, 200, { ok: true, ...state.setScenario(body.scenario) })
      return true
    }
    sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "GET, POST" })
    return true
  }

  if (url.pathname === "/__mock/reset") {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "POST" })
      return true
    }
    sendJson(res, 200, { ok: true, ...state.reset() })
    return true
  }

  if (url.pathname === "/__mock/override") {
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: "POST" })
      return true
    }
    const body = await readJson(req)
    sendJson(res, 200, { ok: true, ...state.setOverride(body) })
    return true
  }

  return false
}

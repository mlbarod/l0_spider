import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { createMockState } from "../state/store.mjs"
import { loadMockEnvironment } from "../utils/env.mjs"
import { sendJson, wait } from "../utils/http.mjs"
import { requestLogger } from "../utils/logging.mjs"
import { resolveScenarioEffect } from "./middleware/scenario.mjs"
import { handleApiRoute } from "./routes/api.mjs"
import { handleControlRoute } from "./routes/control.mjs"

const LOOPBACK_ORIGIN = /^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/

function setCors(req, res) {
  const origin = req.headers.origin
  if (origin && !LOOPBACK_ORIGIN.test(origin)) return false
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
  return true
}

export function createMockApiServer({ state = createMockState(), logger = console } = {}) {
  const sockets = new Set()
  const log = requestLogger(logger)
  const server = createServer(async (req, res) => {
    const startedAt = performance.now()
    const url = new URL(req.url ?? "/", "http://127.0.0.1")
    log(req, res, url.pathname, startedAt)

    if (!setCors(req, res)) {
      sendJson(res, 403, { ok: false, error: "Origin is not allowed", code: "MOCK_ORIGIN_REJECTED" })
      return
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204)
      res.end()
      return
    }

    try {
      if (await handleControlRoute(req, res, url, state)) return
      if (!url.pathname.startsWith("/api/")) {
        sendJson(res, 404, { ok: false, error: "Route not found", code: "MOCK_ROUTE_NOT_FOUND" })
        return
      }

      const effect = resolveScenarioEffect(state, req, url)
      if (effect.timeout) return
      await wait(effect.delayMs)
      if (res.destroyed) return
      if (effect.status !== undefined) {
        sendJson(res, effect.status, {
          ok: false,
          error: `Synthetic HTTP ${effect.status} response`,
          code: `MOCK_ERROR_${effect.status}`,
        })
        return
      }
      if (!await handleApiRoute(req, res, url, effect.fixtureScenario)) {
        sendJson(res, 404, { ok: false, error: "API route not implemented", code: "MOCK_API_NOT_FOUND" })
      }
    } catch (error) {
      sendJson(res, error.statusCode ?? 500, {
        ok: false,
        error: error.statusCode ? error.message : "Synthetic Mock server error",
        code: "MOCK_REQUEST_FAILED",
      })
    }
  })

  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.once("close", () => sockets.delete(socket))
  })

  async function close() {
    await new Promise((resolveClose) => {
      server.close(resolveClose)
      server.closeAllConnections?.()
      for (const socket of sockets) socket.destroy()
    })
  }

  return { server, state, close }
}

export async function startMockApiServer({
  host = "127.0.0.1",
  port = Number(process.env.MOCK_API_PORT ?? 5175),
  logger = console,
} = {}) {
  const instance = createMockApiServer({ logger })
  await new Promise((resolveListen, reject) => {
    instance.server.once("error", reject)
    instance.server.listen(port, host, resolveListen)
  })
  const address = instance.server.address()
  logger.info(`[mock-api] listening on http://${host}:${address.port}`)
  return { ...instance, host, port: address.port }
}

const isEntrypoint = process.argv[1]
  && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isEntrypoint) {
  await loadMockEnvironment()
  const instance = await startMockApiServer()
  let closing = false
  const shutdown = async (signal) => {
    if (closing) return
    closing = true
    console.info(`[mock-api] received ${signal}; shutting down`)
    await instance.close()
    process.exit(0)
  }
  process.once("SIGINT", () => shutdown("SIGINT"))
  process.once("SIGTERM", () => shutdown("SIGTERM"))
}

import { spawnSync } from "node:child_process"
import { createReadStream, existsSync, statSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, normalize } from "node:path"
import { fileURLToPath, URL } from "node:url"
import { createServer as createViteServer } from "vite"

import { handleCurrentUserRequest } from "./server/currentUser.mjs"
import { handleHitHistoryRequest } from "./server/hitHistory.mjs"
import {
  handleCommonalityDataRequest,
  handleCommonalityImageRequest,
} from "./server/commonalityData.mjs"
import { handleLatestCommonalityPathRequest } from "./server/latestCommonalityPath.mjs"
import { handleMappingConfigRequest } from "./server/mappingConfig.mjs"
import { handlePassHistoryRequest } from "./server/passHistory.mjs"
import {
  handleErdFileRequest,
  handleErdScatterDataRequest,
  handleSelfEquipmentDataRequest,
} from "./server/selfEquipmentData.mjs"

const rootDir = fileURLToPath(new URL(".", import.meta.url))
const distDir = join(rootDir, "dist")
const port = Number(process.env.PORT ?? 5173)
const host = process.env.HOST ?? "0.0.0.0"
const buildOnStart = process.env.BUILD_ON_START !== "0"
const liveReload = process.env.LIVE_RELOAD !== "0"

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

function buildClient() {
  if (!buildOnStart) return

  console.log("Building L0 Spider client before starting server...")
  const result = spawnSync("npm", ["run", "build"], {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, BUILD_ON_START: "0" },
  })

  if (result.status !== 0) {
    throw new Error(`client build failed with code ${result.status}`)
  }
}

async function assertDistExists() {
  const indexPath = join(distDir, "index.html")
  if (!existsSync(indexPath)) {
    throw new Error("dist/index.html is missing. Run npm run build before starting the server.")
  }

  await readFile(indexPath, "utf8")
}

function resolveStaticPath(pathname) {
  const requestedPath = decodeURIComponent(pathname)
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "")
  const filePath = join(distDir, normalizedPath)

  if (!filePath.startsWith(distDir)) {
    return { forbidden: true, filePath }
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    return { filePath: join(distDir, "index.html") }
  }

  return { filePath }
}

async function serveStatic(req, res) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
  const { forbidden, filePath } = resolveStaticPath(url.pathname)

  if (forbidden) {
    res.writeHead(403)
    res.end("Forbidden")
    return
  }

  if (!existsSync(filePath)) {
    sendJson(res, 500, { ok: false, error: "dist/index.html is missing. Run npm run build first." })
    return
  }

  const extension = extname(filePath)
  const contentType = mimeTypes[extension] ?? "application/octet-stream"
  const cacheControl = extension === ".html" ? "no-cache" : "public, max-age=31536000, immutable"

  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
  })
  createReadStream(filePath).pipe(res)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)

  if (url.pathname === "/api/current-user") {
    handleCurrentUserRequest(req, res).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  if (url.pathname === "/api/hit-history") {
    handleHitHistoryRequest(req, res).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  if (url.pathname === "/api/latest-commonality-path") {
    handleLatestCommonalityPathRequest(req, res).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  if (url.pathname === "/api/commonality-data") {
    handleCommonalityDataRequest(req, res, url).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  if (url.pathname === "/api/commonality-image") {
    handleCommonalityImageRequest(req, res, url).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  if (url.pathname === "/api/pass-history") {
    handlePassHistoryRequest(req, res, url).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  if (url.pathname === "/api/mapping-config") {
    handleMappingConfigRequest(req, res).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  if (url.pathname === "/api/self-equipment-data") {
    handleSelfEquipmentDataRequest(req, res, url).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  if (url.pathname === "/api/erd-scatter-data") {
    handleErdScatterDataRequest(req, res, url).catch((error) => {
      sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  if (url.pathname === "/api/erd-file") {
    handleErdFileRequest(req, res, url)
    return
  }

  if (liveReload) {
    viteServer.middlewares(req, res, (error) => {
      if (error) sendJson(res, 500, { ok: false, error: error.message })
    })
    return
  }

  serveStatic(req, res).catch((error) => {
    sendJson(res, 500, { ok: false, error: error.message })
  })
})

let viteServer

if (liveReload) {
  viteServer = await createViteServer({
    root: rootDir,
    server: {
      middlewareMode: true,
      hmr: { server },
    },
    appType: "spa",
  })
} else {
  buildClient()
  await assertDistExists()
}

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${port} is already in use. Use a different port, for example PORT=5174 node server.mjs.`)
    process.exit(1)
  }

  console.error(error)
  process.exit(1)
})

server.listen(port, host, () => {
  const mode = liveReload ? "live reload" : "static dist"
  console.log(`L0 Spider server listening on http://${host}:${port} (${mode})`)
})

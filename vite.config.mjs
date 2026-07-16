import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import process from "node:process"

import { handleCurrentUserRequest } from "./server/currentUser.mjs"
import { handleLatestCommonalityPathRequest } from "./server/latestCommonalityPath.mjs"
import { handleMappingConfigRequest } from "./server/mappingConfig.mjs"
import { handlePassHistoryRequest } from "./server/passHistory.mjs"
import {
  handleErdFileRequest,
  handleSelfEquipmentDataRequest,
} from "./server/selfEquipmentData.mjs"

const STAGING_HOST = "stg.plane.samsungds.net"
const siteHost = process.env.VITE_SITE_URL
  ? process.env.VITE_SITE_URL.replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
  : ""
const isStagingHost = siteHost === STAGING_HOST

function mappingConfigApi() {
  return {
    name: "l0-spider-mapping-config-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost")
        if (url.pathname === "/api/current-user") {
          handleCurrentUserRequest(req, res)
          return
        }

        if (url.pathname === "/api/latest-commonality-path") {
          handleLatestCommonalityPathRequest(req, res)
          return
        }

        if (url.pathname === "/api/pass-history") {
          handlePassHistoryRequest(req, res, url)
          return
        }

        if (url.pathname === "/api/mapping-config") {
          handleMappingConfigRequest(req, res)
          return
        }

        if (url.pathname === "/api/self-equipment-data") {
          handleSelfEquipmentDataRequest(req, res, url)
          return
        }

        if (url.pathname === "/api/erd-file") {
          handleErdFileRequest(req, res, url)
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), mappingConfigApi()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      components: path.resolve(process.cwd(), "src/components"),
    },
  },
  server: {
    host: true,
    port: 3000,
    ...(isStagingHost
      ? {
          allowedHosts: [STAGING_HOST],
          hmr: {
            host: STAGING_HOST,
            protocol: "wss",
            clientPort: 443,
          },
        }
      : {}),
  },

})

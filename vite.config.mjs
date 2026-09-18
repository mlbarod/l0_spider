import "./server/loadEnv.mjs"
import { loadOidcConfig } from "./server/oidcService.mjs"

import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import process from "node:process"

import { handleDashboardDataRequest } from "./server/dashboardData.mjs"
import { handleChartMailRequest } from "./server/chartMail.mjs"
import { handleChartMailBoardRequest } from "./server/chartMailBoard.mjs"
import { handleMailRecipientGroupsRequest } from "./server/mailRecipientGroups.mjs"
import { handleCurrentUserRequest } from "./server/currentUser.mjs"
import {
  handleCommonAnomalyDataRequest,
  handleCommonAnomalyImageRequest,
  handleCommonAnomalyScatterRequest,
} from "./server/commonAnomalyData.mjs"
import { handleHitHistoryRequest } from "./server/hitHistory.mjs"
import {
  handleCommonalityDataRequest,
  handleCommonalityImageRequest,
} from "./server/commonalityData.mjs"
import {
  handleCommonCommonalityDataRequest,
  handleCommonCommonalityImageRequest,
} from "./server/commonCommonalityData.mjs"
import { handleLatestCommonalityPathRequest } from "./server/latestCommonalityPath.mjs"
import { handleMappingConfigRequest } from "./server/mappingConfig.mjs"
import { handlePassHistoryRequest } from "./server/passHistory.mjs"
import {
  handleErdFileRequest,
  handleErdScatterDataRequest,
  handleSelfEquipmentDataRequest,
} from "./server/selfEquipmentData.mjs"

const STAGING_HOST = "stg.plane.samsungds.net"
const MEM_ETCH_COMMON_HOST = "mem-etch-common.samsungds.net"
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
      if (loadOidcConfig().enabled) throw new Error("SSO는 LIVE_RELOAD=0 npm start로 실행하세요.")
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost")
        if (url.pathname === "/api/chart-mail-board" || url.pathname.startsWith("/api/chart-mail-board/")) {
          void handleChartMailBoardRequest(req, res, url)
          return
        }
        if (url.pathname === "/api/dashboard-data") {
          handleDashboardDataRequest(req, res)
          return
        }

        if (url.pathname === "/api/chart-mail") {
          handleChartMailRequest(req, res).catch(() => {
            res.writeHead(500, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
            res.end(JSON.stringify({ ok: false, error: "메일 요청을 처리하지 못했습니다." }))
          })
          return
        }

        if (url.pathname === "/api/mail-recipient-groups") {
          handleMailRecipientGroupsRequest(req, res)
          return
        }

        if (url.pathname === "/api/current-user") {
          handleCurrentUserRequest(req, res)
          return
        }

        if (url.pathname === "/api/hit-history") {
          handleHitHistoryRequest(req, res)
          return
        }

        if (url.pathname === "/api/latest-commonality-path") {
          handleLatestCommonalityPathRequest(req, res)
          return
        }

        if (url.pathname === "/api/commonality-data") {
          handleCommonalityDataRequest(req, res, url)
          return
        }

        if (url.pathname === "/api/common-commonality-data") {
          handleCommonCommonalityDataRequest(req, res, url)
          return
        }

        if (url.pathname === "/api/common-anomaly-data") {
          handleCommonAnomalyDataRequest(req, res, url)
          return
        }

        if (url.pathname === "/api/common-anomaly-scatter-data") {
          handleCommonAnomalyScatterRequest(req, res, url)
          return
        }

        if (url.pathname === "/api/common-anomaly-image") {
          handleCommonAnomalyImageRequest(req, res, url)
          return
        }

        if (url.pathname === "/api/commonality-image") {
          handleCommonalityImageRequest(req, res, url)
          return
        }

        if (url.pathname === "/api/common-commonality-image") {
          handleCommonCommonalityImageRequest(req, res, url)
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

        if (url.pathname === "/api/erd-scatter-data") {
          handleErdScatterDataRequest(req, res, url)
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
    allowedHosts: [
      MEM_ETCH_COMMON_HOST,
      ...(isStagingHost ? [STAGING_HOST] : []),
    ],
    ...(isStagingHost
      ? {
          hmr: {
            host: STAGING_HOST,
            protocol: "wss",
            clientPort: 443,
          },
        }
      : {}),
  },
  preview: {
    allowedHosts: [MEM_ETCH_COMMON_HOST],
  },

})

import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import process from "node:process"

import { handleDashboardDataRequest } from "./server/dashboardData.mjs"
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
import { handleLatestCommonalityPathRequest } from "./server/latestCommonalityPath.mjs"
import { handleMappingConfigRequest } from "./server/mappingConfig.mjs"
import { handlePassHistoryRequest } from "./server/passHistory.mjs"
import {
  handleErdFileRequest,
  handleErdScatterDataRequest,
  handleSelfEquipmentDataRequest,
} from "./server/selfEquipmentData.mjs"
import { sanitizeMockFrontendSource } from "./mock/utils/sanitize-source.mjs"

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
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost")
        if (url.pathname === "/api/dashboard-data") {
          handleDashboardDataRequest(req, res)
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

function syntheticLocalDataPlugin() {
  const syntheticDataPath = path.resolve(
    process.cwd(),
    "mock/fixtures/local/fdcTrendMockData.js",
  )
  const syntheticApiPath = path.resolve(
    process.cwd(),
    "mock/fixtures/local/fdcTrendApi.js",
  )
  return {
    name: "l0-spider-synthetic-local-data",
    enforce: "pre",
    resolveId(source, importer) {
      if (!importer?.includes("/src/features/fdc-trend/")) return null
      if (/\/utils\/fdcTrendMockData(?:\.js)?$/.test(source)) return syntheticDataPath
      if (/\/api\/fdcTrendApi(?:\.js)?$/.test(source)) return syntheticApiPath
      return null
    },
    transform(code, id) {
      const transformed = sanitizeMockFrontendSource(code, id)
      return transformed === null ? null : { code: transformed, map: null }
    },
  }
}

export default defineConfig(({ mode }) => {
  const modeEnv = loadEnv(mode, process.cwd(), "")
  const useMockApi = mode === "mock" && modeEnv.VITE_USE_MOCK_API === "true"
  const mockApiTarget = modeEnv.VITE_API_BASE_URL || "http://127.0.0.1:5175"
  const mockFrontendPort = Number(modeEnv.VITE_MOCK_FRONTEND_PORT || 4175)

  return {
  plugins: [
    react(),
    ...(useMockApi ? [syntheticLocalDataPlugin()] : [mappingConfigApi()]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      components: path.resolve(process.cwd(), "src/components"),
    },
  },
  server: {
    host: useMockApi ? "127.0.0.1" : true,
    port: useMockApi ? mockFrontendPort : 3000,
    ...(useMockApi
      ? {
          proxy: {
            "/api": { target: mockApiTarget, changeOrigin: false },
            "/__mock": { target: mockApiTarget, changeOrigin: false },
          },
        }
      : {}),
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

  }
})

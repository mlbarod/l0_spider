import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import process from "node:process"

const STAGING_HOST = "stg.plane.samsungds.net"
const siteHost = process.env.VITE_SITE_URL
  ? process.env.VITE_SITE_URL.replace(/^https?:\/\//, "")
      .split("/")[0]
      .split(":")[0]
  : ""
const isStagingHost = siteHost === STAGING_HOST

export default defineConfig({
  plugins: [react()],
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

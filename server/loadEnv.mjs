import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath, URL } from "node:url"
import { parseEnv } from "node:util"

const defaultEnvPath = fileURLToPath(new URL("../notices.env", import.meta.url))

export function loadServerEnv(envPath = defaultEnvPath) {
  if (!existsSync(envPath)) return false

  const fileEnvironment = parseEnv(readFileSync(envPath, "utf8"))
  Object.entries(fileEnvironment).forEach(([key, value]) => {
    const existingValue = String(process.env[key] ?? "").trim()
    if (!existingValue) process.env[key] = value
  })
  return true
}

loadServerEnv()

import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath, URL } from "node:url"
import { parseEnv } from "node:util"

const defaultEnvPath = fileURLToPath(new URL("../notices.env", import.meta.url))

export function readServerEnv(envPath = defaultEnvPath) {
  if (!existsSync(envPath)) return { exists: false, values: {} }

  return {
    exists: true,
    values: parseEnv(readFileSync(envPath, "utf8")),
  }
}

export function loadServerEnv(envPath = defaultEnvPath) {
  const environment = readServerEnv(envPath)
  if (!environment.exists) return false

  Object.entries(environment.values).forEach(([key, value]) => {
    const existingValue = String(process.env[key] ?? "").trim()
    if (!existingValue) process.env[key] = value
  })
  return true
}

loadServerEnv()

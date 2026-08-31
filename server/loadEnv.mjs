import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"
import { fileURLToPath, URL } from "node:url"

const defaultEnvPath = fileURLToPath(new URL("../notices.env", import.meta.url))

export function loadServerEnv(envPath = defaultEnvPath) {
  if (!existsSync(envPath)) return false

  const existingEnvironment = { ...process.env }
  loadEnvFile(envPath)
  Object.assign(process.env, existingEnvironment)
  return true
}

loadServerEnv()

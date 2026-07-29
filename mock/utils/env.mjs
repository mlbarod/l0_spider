import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

function parseEnv(text) {
  const values = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const separator = line.indexOf("=")
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2")
    values[key] = value
  }
  return values
}

async function readEnvFile(filePath) {
  try {
    return parseEnv(await readFile(filePath, "utf8"))
  } catch (error) {
    if (error.code === "ENOENT") return {}
    throw error
  }
}

export async function loadMockEnvironment(rootDir = process.cwd()) {
  const shared = await readEnvFile(resolve(rootDir, ".env.mock"))
  const local = await readEnvFile(resolve(rootDir, ".env.mock.local"))
  const merged = { ...shared, ...local }
  for (const key of ["MOCK_API_PORT"]) {
    if (process.env[key] === undefined && merged[key] !== undefined) {
      process.env[key] = merged[key]
    }
  }
  return merged
}

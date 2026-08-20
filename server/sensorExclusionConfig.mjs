import { readFile, stat } from "node:fs/promises"

export const SENSOR_EXCLUSION_APP_KEYS = Object.freeze([
  "selfEquipment",
  "matchingAnomaly",
  "commonAnomaly",
  "commonCommonalityAnomaly",
  "mailing",
])

export const sensorExclusionConfigPath = String(
  process.env.SENSOR_EXCLUSION_CONFIG_PATH ?? "",
).trim()

const MAX_TERMS_PER_APP = 100
const MAX_TERM_LENGTH = 128
let configCache = null
let lastFailureSignature = ""

function createConfigError(message) {
  const error = new Error(message)
  error.code = "SENSOR_EXCLUSION_CONFIG_INVALID"
  return error
}

function normalizeTerm(value, appKey) {
  if (typeof value !== "string") {
    throw createConfigError(`${appKey}.contains 항목은 문자열이어야 합니다.`)
  }
  const term = value.trim()
  if (!term || Array.from(value).length > MAX_TERM_LENGTH) {
    throw createConfigError(`${appKey}.contains 항목 길이가 올바르지 않습니다.`)
  }
  return term.toUpperCase()
}

export function normalizeSensorExclusionConfig(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createConfigError("sensor 제외 설정은 JSON object여야 합니다.")
  }
  if (payload.version !== 1) {
    throw createConfigError("sensor 제외 설정 version은 1이어야 합니다.")
  }
  const unknownRootFields = Object.keys(payload)
    .filter((key) => key !== "version" && key !== "apps")
  if (unknownRootFields.length) {
    throw createConfigError("sensor 제외 설정에는 version과 apps만 사용할 수 있습니다.")
  }
  if (!payload.apps || typeof payload.apps !== "object" || Array.isArray(payload.apps)) {
    throw createConfigError("sensor 제외 설정 apps가 필요합니다.")
  }

  const unknownAppKeys = Object.keys(payload.apps)
    .filter((key) => !SENSOR_EXCLUSION_APP_KEYS.includes(key))
  if (unknownAppKeys.length) {
    throw createConfigError("지원하지 않는 sensor 제외 App key가 있습니다.")
  }

  const apps = Object.fromEntries(SENSOR_EXCLUSION_APP_KEYS.map((appKey) => {
    const appConfig = payload.apps[appKey] ?? { contains: [] }
    if (!appConfig || typeof appConfig !== "object" || Array.isArray(appConfig)) {
      throw createConfigError(`${appKey} 설정은 object여야 합니다.`)
    }
    const unknownFields = Object.keys(appConfig).filter((key) => key !== "contains")
    if (unknownFields.length || !Array.isArray(appConfig.contains)) {
      throw createConfigError(`${appKey} 설정에는 contains 배열만 사용할 수 있습니다.`)
    }
    if (appConfig.contains.length > MAX_TERMS_PER_APP) {
      throw createConfigError(`${appKey}.contains는 ${MAX_TERMS_PER_APP}개 이하여야 합니다.`)
    }
    const contains = Array.from(new Set(
      appConfig.contains.map((value) => normalizeTerm(value, appKey)),
    ))
    return [appKey, Object.freeze({ contains: Object.freeze(contains) })]
  }))

  const signature = JSON.stringify(apps)
  return Object.freeze({
    version: 1,
    apps: Object.freeze(apps),
    signature,
  })
}

const EMPTY_SENSOR_EXCLUSION_CONFIG = normalizeSensorExclusionConfig({
  version: 1,
  apps: {},
})

export function isSensorExcluded(sensor, contains = []) {
  const normalizedSensor = String(sensor ?? "").trim().toUpperCase()
  return Boolean(normalizedSensor) && contains.some((term) => {
    const normalizedTerm = String(term ?? "").trim().toUpperCase()
    return Boolean(normalizedTerm) && normalizedSensor.includes(normalizedTerm)
  })
}

export function excludeSensorRows(rows, config, appKey) {
  if (!SENSOR_EXCLUSION_APP_KEYS.includes(appKey)) {
    throw createConfigError("지원하지 않는 sensor 제외 App key입니다.")
  }
  const contains = config.apps[appKey].contains
  if (!contains.length) return { rows, excludedCount: 0 }
  const visibleRows = rows.filter((row) => !isSensorExcluded(row?.sensor, contains))
  return {
    rows: visibleRows,
    excludedCount: rows.length - visibleRows.length,
  }
}

export async function readSensorExclusionConfig(
  configPath = sensorExclusionConfigPath,
  { onReloadError = () => console.error(
    "sensor exclusion config load failed; using safe fallback configuration",
  ) } = {},
) {
  const normalizedPath = String(configPath ?? "").trim()
  if (!normalizedPath) return EMPTY_SENSOR_EXCLUSION_CONFIG

  let failureSignature = normalizedPath
  try {
    const fileStat = await stat(normalizedPath)
    failureSignature = `${normalizedPath}\u0000${fileStat.mtimeMs}\u0000${fileStat.size}`
    if (
      configCache?.path === normalizedPath
      && configCache.mtimeMs === fileStat.mtimeMs
      && configCache.size === fileStat.size
    ) return configCache.config

    const payload = JSON.parse(await readFile(normalizedPath, "utf8"))
    const config = normalizeSensorExclusionConfig(payload)
    configCache = {
      path: normalizedPath,
      mtimeMs: fileStat.mtimeMs,
      size: fileStat.size,
      config,
    }
    lastFailureSignature = ""
    return config
  } catch {
    if (lastFailureSignature !== failureSignature) {
      onReloadError()
      lastFailureSignature = failureSignature
    }
    if (configCache?.path === normalizedPath) {
      return configCache.config
    }
    return EMPTY_SENSOR_EXCLUSION_CONFIG
  }
}

export function resetSensorExclusionConfigCacheForTest() {
  configCache = null
  lastFailureSignature = ""
}

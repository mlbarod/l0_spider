import { readFile } from "node:fs/promises"

import Ajv2020 from "ajv/dist/2020.js"

import {
  SENSOR_EXCLUSION_APP_KEYS,
  normalizeSensorExclusionConfig,
  sensorExclusionConfigPath,
} from "../server/sensorExclusionConfig.mjs"

const configPath = String(process.argv[2] ?? sensorExclusionConfigPath).trim()
const schemaUrl = new URL("../harness/contracts/sensor-exclusions.schema.json", import.meta.url)
if (!configPath) {
  console.error("검증할 JSON 경로 또는 SENSOR_EXCLUSION_CONFIG_PATH가 필요합니다.")
  process.exitCode = 1
} else {
  try {
    const [payload, schema] = await Promise.all([
      readFile(configPath, "utf8").then(JSON.parse),
      readFile(schemaUrl, "utf8").then(JSON.parse),
    ])
    const validate = new Ajv2020({ strict: true }).compile(schema)
    if (!validate(payload)) throw new Error("JSON Schema validation failed")
    const config = normalizeSensorExclusionConfig(payload)
    const counts = Object.fromEntries(
      SENSOR_EXCLUSION_APP_KEYS.map((appKey) => [appKey, config.apps[appKey].contains.length]),
    )
    console.log(JSON.stringify({ ok: true, termCounts: counts }))
  } catch {
    console.error("sensor 제외 설정 검증에 실패했습니다.")
    process.exitCode = 1
  }
}

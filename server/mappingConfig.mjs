import { readFile } from "node:fs/promises"

import { SPIDER_DATA_PATH_TEMPLATES } from "../src/config/spiderDataPaths.mjs"

export const mappingConfigPath = process.env.MAPPING_CONFIG_PATH
  ?? SPIDER_DATA_PATH_TEMPLATES.mappingConfig

function validateMappingDictionary(config, mappingName, valueName) {
  const mapping = config?.[mappingName]

  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new Error(`mapping_config.json의 ${mappingName}은 dictionary 타입이어야 합니다.`)
  }

  const invalidEntry = Object.entries(mapping).find(
    ([key, value]) => !key || typeof value !== "string" || !value.trim(),
  )

  if (invalidEntry) {
    throw new Error(`${mappingName}의 key와 ${valueName} value는 비어 있지 않은 문자열이어야 합니다.`)
  }

  return mapping
}

export async function readLineMapping(configPath = mappingConfigPath) {
  const configText = await readFile(configPath, "utf8")
  const config = JSON.parse(configText)
  const mappingRoot = config?.root && typeof config.root === "object" && !Array.isArray(config.root)
    ? config.root
    : config
  const lineMapping = validateMappingDictionary(mappingRoot, "line_mapping", "라인")
  const sdwtMapping = validateMappingDictionary(mappingRoot, "sdwt_mapping", "SDWT")

  return {
    line_mapping: lineMapping,
    sdwt_mapping: sdwtMapping,
    source_path: configPath,
  }
}

export async function handleMappingConfigRequest(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {
      Allow: "GET, HEAD",
      "Content-Type": "application/json; charset=utf-8",
    })
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }))
    return
  }

  try {
    const payload = await readLineMapping()
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
    })
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(payload))
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    })
    res.end(JSON.stringify({
      ok: false,
      error: `기준정보 매핑 파일을 불러오지 못했습니다: ${error.message}`,
      source_path: mappingConfigPath,
    }))
  }
}

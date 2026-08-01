function validateMappingDictionary(config, mappingName, { requireEntries = false } = {}) {
  const mapping = config?.[mappingName]

  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new Error(`기준정보의 ${mappingName} 형식이 올바르지 않습니다.`)
  }

  const entries = Object.entries(mapping)
  if (requireEntries && entries.length === 0) {
    throw new Error(`기준정보의 ${mappingName}이 비어 있습니다.`)
  }

  const hasInvalidEntry = entries.some(
    ([key, value]) => !key.trim() || typeof value !== "string" || !value.trim(),
  )
  if (hasInvalidEntry) {
    throw new Error(`기준정보의 ${mappingName} 항목이 올바르지 않습니다.`)
  }

  return mapping
}

export function validateLineMappingPayload(payload) {
  const mappingRoot = payload?.root
    && typeof payload.root === "object"
    && !Array.isArray(payload.root)
    ? payload.root
    : payload

  return {
    line_mapping: validateMappingDictionary(mappingRoot, "line_mapping", { requireEntries: true }),
    sdwt_mapping: validateMappingDictionary(mappingRoot, "sdwt_mapping"),
  }
}

export function isLineMappingQueryReady(mappingQuery) {
  if (!mappingQuery?.isSuccess || mappingQuery.isError) return false
  try {
    validateLineMappingPayload(mappingQuery.data)
    return true
  } catch {
    return false
  }
}

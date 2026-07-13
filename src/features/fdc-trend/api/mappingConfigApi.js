export async function fetchLineMapping() {
  const response = await fetch("/api/mapping-config", {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || "기준정보 매핑을 불러오지 못했습니다.")
  }

  const lineMapping = payload.line_mapping
  if (!lineMapping || typeof lineMapping !== "object" || Array.isArray(lineMapping)) {
    throw new Error("기준정보의 line_mapping 형식이 올바르지 않습니다.")
  }

  const sdwtMapping = payload.sdwt_mapping
  if (!sdwtMapping || typeof sdwtMapping !== "object" || Array.isArray(sdwtMapping)) {
    throw new Error("기준정보의 sdwt_mapping 형식이 올바르지 않습니다.")
  }

  return payload
}

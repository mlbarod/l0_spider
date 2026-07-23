async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || "동일성 이상감지 데이터를 불러오지 못했습니다.")
  }
  return payload
}

export async function fetchCommonalityData({
  line,
  pathSdwt,
  sdwt,
  stepDesc,
  sensor,
  chStep,
}) {
  const searchParams = new URLSearchParams({ line, pathSdwt, sdwt })
  if (stepDesc) searchParams.set("stepDesc", stepDesc)
  if (sensor) searchParams.set("sensor", sensor)
  if (chStep) searchParams.set("chStep", chStep)
  const response = await fetch(`/api/commonality-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  return parseResponse(response)
}

export function buildCommonalityImageUrl(filePath) {
  return `/api/commonality-image?path=${encodeURIComponent(filePath)}`
}

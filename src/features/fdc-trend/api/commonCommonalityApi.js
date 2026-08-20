import { getApiErrorMessage } from "./errorMessage.js"

async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, "공통부 동일성 이상감지 데이터를 불러오지 못했습니다."))
  }
  return payload
}

export async function fetchCommonCommonalityData({
  line,
  pathSdwt,
  sdwt,
  eqpModel,
  sensor,
  chStep,
}) {
  const searchParams = new URLSearchParams({ line, pathSdwt, sdwt })
  if (eqpModel) searchParams.set("eqpModel", eqpModel)
  if (sensor) searchParams.set("sensor", sensor)
  if (chStep) searchParams.set("chStep", chStep)
  const response = await fetch(`/api/common-commonality-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  return parseResponse(response)
}

export function buildCommonCommonalityImageUrl(filePath) {
  return `/api/common-commonality-image?path=${encodeURIComponent(filePath)}`
}

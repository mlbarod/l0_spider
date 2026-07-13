export async function fetchSelfEquipmentData({
  line,
  pathSdwt,
  sdwt,
  priorities,
  desc,
  sensor,
  chStep,
}) {
  const searchParams = new URLSearchParams({ line, pathSdwt, sdwt })
  priorities.forEach((priority) => searchParams.append("priority", priority))
  if (desc) searchParams.set("desc", desc)
  if (sensor) searchParams.set("sensor", sensor)
  if (chStep) searchParams.set("chStep", chStep)

  const response = await fetch(`/api/self-equipment-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || "자설비 이상감지 데이터를 불러오지 못했습니다.")
  }

  return payload
}

export async function fetchErdScatterData({ filePath, eqp }) {
  const searchParams = new URLSearchParams({ path: filePath, eqp })
  const response = await fetch(`/api/erd-scatter-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(payload.error || "ERD 이상감지 데이터를 불러오지 못했습니다.")
    error.sourcePath = payload.sourcePath
    throw error
  }

  return payload
}

export function buildErdFileUrl(filePath) {
  return `/api/erd-file?path=${encodeURIComponent(filePath)}`
}

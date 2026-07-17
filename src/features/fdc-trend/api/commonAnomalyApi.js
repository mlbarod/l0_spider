export async function fetchCommonAnomalyData({
  line,
  pathSdwt,
  sdwt,
  prcGroup,
  eqp,
  sensor,
}) {
  const searchParams = new URLSearchParams({ line, pathSdwt, sdwt })
  if (prcGroup) searchParams.set("prcGroup", prcGroup)
  if (eqp) searchParams.set("eqp", eqp)
  if (sensor) searchParams.set("sensor", sensor)

  const response = await fetch(`/api/common-anomaly-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || "공통부 이상감지 경로 데이터를 불러오지 못했습니다.")
  }
  return payload
}

export async function fetchCommonSkipListData({ lineId, prcGroup, eqp, sensor }) {
  const searchParams = new URLSearchParams({ view: "common-filters", lineId })
  if (prcGroup) searchParams.set("prcGroup", prcGroup)
  if (eqp) searchParams.set("eqp", eqp)
  if (sensor) searchParams.set("sensor", sensor)

  const response = await fetch(`/api/pass-history?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || "공통부 SKIP LIST 데이터를 불러오지 못했습니다.")
  }
  return payload
}

async function fetchCommonChartData({ filePath, eqp, sensor, chStep, mode = "scatter" }) {
  const searchParams = new URLSearchParams({ path: filePath, eqp, sensor, chStep, mode })
  const response = await fetch(`/api/common-anomaly-scatter-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || "공통부 이상감지 데이터를 불러오지 못했습니다.")
    error.sourcePath = payload.sourcePath
    throw error
  }
  return payload
}

export function fetchCommonAnomalyScatterData(options) {
  return fetchCommonChartData(options)
}

export function fetchCommonAnomalyIdentityData(options) {
  return fetchCommonChartData({ ...options, mode: "identity" })
}

export function buildCommonAnomalyImageUrl(filePath) {
  return `/api/common-anomaly-image?path=${encodeURIComponent(filePath)}`
}

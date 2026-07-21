export async function fetchDashboardSummary({ startDate, endDate, lines = [], signal } = {}) {
  const searchParams = new URLSearchParams()
  if (startDate) searchParams.set("startDate", startDate)
  if (endDate) searchParams.set("endDate", endDate)
  lines.forEach((line) => searchParams.append("line", line))
  const query = searchParams.toString()
  const response = await fetch(`/api/dashboard-data${query ? `?${query}` : ""}`, {
    headers: { Accept: "application/json" },
    signal,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || "대시보드 데이터를 불러오지 못했습니다.")
  }

  const lineDashboard = payload.lineDashboard
  if (
    !lineDashboard
    || !lineDashboard.summary
    || !Array.isArray(lineDashboard.lineSummary)
    || !Array.isArray(lineDashboard.dailyTrend)
    || !Array.isArray(lineDashboard.mailingSummary)
    || !Array.isArray(lineDashboard.options?.lines)
  ) {
    throw new Error("대시보드 응답 데이터 형식이 올바르지 않습니다.")
  }

  return payload
}

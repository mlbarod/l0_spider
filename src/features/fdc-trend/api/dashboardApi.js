import { getApiErrorMessage } from "./errorMessage.js"
import { assertDashboardIntegrity } from "./dashboardIntegrity.mjs"

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
    throw new Error(getApiErrorMessage(payload, "대시보드 데이터를 불러오지 못했습니다."))
  }

  assertDashboardIntegrity(payload.lineDashboard, { startDate, endDate, lines })

  return payload
}

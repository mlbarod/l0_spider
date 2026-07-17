export async function fetchDashboardSummary() {
  const response = await fetch("/api/dashboard-data", {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || "대시보드 데이터를 불러오지 못했습니다.")
  }

  return payload
}

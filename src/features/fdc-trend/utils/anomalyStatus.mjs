export const ANOMALY_STATUSES = Object.freeze([
  { value: "ALARM", label: "CRITICAL" },
  { value: "WARN", label: "WARNING" },
])

export function readAnomalyStatusFromUrl(searchParams) {
  const status = String(searchParams.get("status") ?? "").trim().toUpperCase()
  return ANOMALY_STATUSES.some((item) => item.value === status) ? status : "ALARM"
}

export function filterChartsByStatus(rows, status) {
  return status ? rows.filter((row) => String(row.status ?? "").trim().toUpperCase() === status) : rows
}

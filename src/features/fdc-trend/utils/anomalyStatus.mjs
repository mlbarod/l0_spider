export const ANOMALY_STATUSES = Object.freeze([
  { value: "ALARM", label: "CRITICAL" },
  { value: "WARN", label: "WARNING" },
])

export function filterChartsByStatus(rows, status) {
  return status ? rows.filter((row) => String(row.status ?? "").trim().toUpperCase() === status) : rows
}

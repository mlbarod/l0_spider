import { fetchDashboardSummary } from "./dashboardApi.js"

export function createDashboardQueryOptions(appliedFilters = {}) {
  return {
    queryKey: [
      "spider-line-dashboard",
      (appliedFilters.lines ?? []).join("\u0000"),
    ],
    queryFn: ({ signal }) => fetchDashboardSummary({ ...appliedFilters, signal }),
    staleTime: 60 * 1000,
    retry: false,
  }
}

export function createDashboardTrendQueryOptions(trendPeriodDays, trendFilters) {
  return {
    queryKey: [
      "spider-line-dashboard-trend",
      trendPeriodDays,
      trendFilters?.startDate ?? "",
      trendFilters?.endDate ?? "",
      (trendFilters?.lines ?? []).join("\u0000"),
    ],
    queryFn: ({ signal }) => fetchDashboardSummary({ ...trendFilters, signal }),
    enabled: Boolean(trendFilters),
    staleTime: 5 * 60 * 1000,
    retry: false,
  }
}

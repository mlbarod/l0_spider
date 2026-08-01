export const DASHBOARD_INTEGRITY_ERROR_CODE = "DASHBOARD_RESPONSE_INTEGRITY_ERROR"

function failIntegrityCheck() {
  const error = new Error("대시보드 응답 데이터 정합성 오류가 발생했습니다.")
  error.code = DASHBOARD_INTEGRITY_ERROR_CODE
  throw error
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeStringSet(values, { rejectDuplicates = true } = {}) {
  if (!Array.isArray(values)) failIntegrityCheck()
  const normalized = values.map((value) => {
    if (typeof value !== "string" || !normalizeText(value)) failIntegrityCheck()
    return normalizeText(value)
  })
  if (rejectDuplicates && new Set(normalized).size !== normalized.length) failIntegrityCheck()
  return new Set(normalized)
}

function assertCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) failIntegrityCheck()
}

function assertSameSet(left, right) {
  if (left.size !== right.size) failIntegrityCheck()
  left.forEach((value) => {
    if (!right.has(value)) failIntegrityCheck()
  })
}

function assertLineInScope(lineId, lineScope) {
  if (typeof lineId !== "string" || !lineScope.has(normalizeText(lineId))) {
    failIntegrityCheck()
  }
}

function compareLineIds(left, right) {
  return left.localeCompare(right, "ko", { numeric: true })
}

function buildLineCountMap(rows, valueKey) {
  const counts = new Map()
  rows.forEach((row) => {
    assertCount(row[valueKey])
    counts.set(row.lineId, (counts.get(row.lineId) ?? 0) + row[valueKey])
  })
  return counts
}

export function assertDashboardIntegrity(lineDashboard, expectedFilters = {}) {
  if (
    !isRecord(lineDashboard)
    || !isRecord(lineDashboard.filters)
    || !isRecord(lineDashboard.summary)
    || !isRecord(lineDashboard.options)
    || !Array.isArray(lineDashboard.lineSummary)
    || !Array.isArray(lineDashboard.dailyTrend)
    || !Array.isArray(lineDashboard.mailingSummary)
    || !Array.isArray(lineDashboard.options.lines)
  ) failIntegrityCheck()

  const responseFilterLines = normalizeStringSet(lineDashboard.filters.lines)
  const requestedLines = normalizeStringSet(
    expectedFilters.lines ?? [],
    { rejectDuplicates: false },
  )
  assertSameSet(responseFilterLines, requestedLines)

  if (
    expectedFilters.startDate
    && lineDashboard.filters.startDate !== normalizeText(expectedFilters.startDate)
  ) failIntegrityCheck()
  if (
    expectedFilters.endDate
    && lineDashboard.filters.endDate !== normalizeText(expectedFilters.endDate)
  ) failIntegrityCheck()

  const lineSummaryIds = normalizeStringSet(
    lineDashboard.lineSummary.map((row) => isRecord(row) ? row.lineId : null),
  )
  const allowedLines = requestedLines.size ? requestedLines : lineSummaryIds
  lineSummaryIds.forEach((lineId) => assertLineInScope(lineId, allowedLines))

  const lineTotals = new Map()
  let totalAbnormalCount = 0
  let latestDateCount = 0
  let abGradeCount = 0
  let abnormalLineCount = 0
  lineDashboard.lineSummary.forEach((row) => {
    assertCount(row.totalCount)
    assertCount(row.latestDateCount)
    assertCount(row.abGradeCount)
    lineTotals.set(row.lineId, row.totalCount)
    totalAbnormalCount += row.totalCount
    latestDateCount += row.latestDateCount
    abGradeCount += row.abGradeCount
    if (row.totalCount > 0) abnormalLineCount += 1
  })
  lineDashboard.lineSummary.slice(1).forEach((row, index) => {
    const previous = lineDashboard.lineSummary[index]
    if (
      previous.totalCount < row.totalCount
      || (
        previous.totalCount === row.totalCount
        && compareLineIds(previous.lineId, row.lineId) > 0
      )
    ) failIntegrityCheck()
  })

  const summary = lineDashboard.summary
  ;[
    summary.totalAbnormalCount,
    summary.latestDateCount,
    summary.abnormalLineCount,
    summary.topLineCount,
    summary.abGradeCount,
  ].forEach(assertCount)
  if (
    summary.totalAbnormalCount !== totalAbnormalCount
    || summary.latestDateCount !== latestDateCount
    || summary.abnormalLineCount !== abnormalLineCount
    || summary.abGradeCount !== abGradeCount
  ) failIntegrityCheck()

  const topLineRow = lineDashboard.lineSummary.find((row) => row.totalCount > 0) ?? null
  if (
    summary.topLine !== (topLineRow?.lineId ?? null)
    || summary.topLineCount !== (topLineRow?.totalCount ?? 0)
  ) failIntegrityCheck()

  const dailyKeys = new Set()
  lineDashboard.dailyTrend.forEach((row) => {
    if (!isRecord(row)) failIntegrityCheck()
    assertLineInScope(row.lineId, lineSummaryIds)
    if (typeof row.date !== "string" || !row.date) failIntegrityCheck()
    const key = `${row.date}\u0000${row.lineId}`
    if (dailyKeys.has(key)) failIntegrityCheck()
    dailyKeys.add(key)
  })
  const dailyTotals = buildLineCountMap(lineDashboard.dailyTrend, "abnormalCount")
  if (dailyTotals.size !== lineTotals.size) failIntegrityCheck()
  lineTotals.forEach((count, lineId) => {
    if (dailyTotals.get(lineId) !== count) failIntegrityCheck()
  })
  if (summary.latestDate !== null && typeof summary.latestDate !== "string") {
    failIntegrityCheck()
  }
  lineDashboard.lineSummary.forEach((row) => {
    const latestTrendRow = summary.latestDate === null
      ? null
      : lineDashboard.dailyTrend.find((item) => (
        item.date === summary.latestDate && item.lineId === row.lineId
      ))
    const expectedLatestDateCount = latestTrendRow?.abnormalCount ?? 0
    if (row.latestDateCount !== expectedLatestDateCount) failIntegrityCheck()
  })

  lineDashboard.mailingSummary.forEach((row) => {
    if (!isRecord(row)) failIntegrityCheck()
    assertLineInScope(row.lineId, lineSummaryIds)
  })

  if (summary.topLine !== null) assertLineInScope(summary.topLine, lineSummaryIds)
  return lineDashboard
}

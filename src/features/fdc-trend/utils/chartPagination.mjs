export const CHARTS_PER_PAGE = 20

export function paginateChartGroups(groups, requestedPage, pageSize = CHARTS_PER_PAGE) {
  const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0
    ? pageSize
    : CHARTS_PER_PAGE
  const chartEntries = groups.flatMap((group) => (
    group.visibleRows.map((row) => ({
      group,
      row,
      chartCount: Number.isInteger(group.chartsPerRow) && group.chartsPerRow > 0
        ? group.chartsPerRow
        : 1,
    }))
  ))
  const totalCharts = chartEntries.reduce((total, entry) => total + entry.chartCount, 0)
  const pages = [[]]
  let pageChartCount = 0

  chartEntries.forEach((entry) => {
    if (pageChartCount > 0 && pageChartCount + entry.chartCount > normalizedPageSize) {
      pages.push([])
      pageChartCount = 0
    }
    pages.at(-1).push(entry)
    pageChartCount += entry.chartCount
  })

  const totalPages = pages.length
  const numericPage = Number.isInteger(requestedPage) ? requestedPage : 1
  const page = Math.min(Math.max(numericPage, 1), totalPages)
  const pageEntries = pages[page - 1]
  const pageGroups = []

  pageEntries.forEach(({ group, row }) => {
    const lastPageGroup = pageGroups.at(-1)
    if (lastPageGroup?.sourceGroup === group) {
      lastPageGroup.visibleRows.push(row)
      return
    }
    pageGroups.push({
      ...group,
      sourceGroup: group,
      totalVisibleRows: group.visibleRows.length,
      visibleRows: [row],
    })
  })

  return {
    page,
    pageGroups,
    totalCharts,
    totalPages,
  }
}

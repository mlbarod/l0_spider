export function buildChartMailPath({ app, line, sdwt, row }) {
  const filters = { line, sdwt, sensor: row.sensor }
  if (app === "self-equipment") {
    Object.assign(filters, { grade: row.priority, desc: row.desc, eqpCh: row.eqp, chStep: row.step, chart: row.file_path })
  } else if (app === "matching-anomaly") {
    Object.assign(filters, { stepDesc: row.stepDesc, chStep: row.chStep, chart: row.filePath })
  } else if (app === "common-anomaly") {
    Object.assign(filters, { prcGroup: row.prc_group, eqp: row.eqp, chart: row.file_path ?? row.data_path })
  } else {
    throw new Error("지원하지 않는 차트 링크입니다.")
  }
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== "") params.set(key, value)
  }
  return `/${app}?${params}`
}

// Keep the linked chart on the first page without hiding other matching results.
export function prioritizeLinkedChart(rows, filePath) {
  if (!filePath) return rows
  const index = rows.findIndex((row) => (row.file_path ?? row.filePath ?? row.data_path) === filePath)
  if (index <= 0) return rows
  return [rows[index], ...rows.slice(0, index), ...rows.slice(index + 1)]
}

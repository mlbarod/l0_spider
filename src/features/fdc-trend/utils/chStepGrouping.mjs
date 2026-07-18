export function getChStepNumber(value) {
  const numberText = String(value ?? "").split("@")[0].match(/-?\d+(?:\.\d+)?/)?.[0]
  const number = Number(numberText)
  return Number.isFinite(number) ? number : null
}

export function getLowestChStepRows(rows) {
  if (rows.length < 2) return rows
  const numericSteps = rows
    .map((row) => getChStepNumber(row.step))
    .filter((value) => value !== null)

  if (numericSteps.length) {
    const lowestStep = Math.min(...numericSteps)
    return rows.filter((row) => getChStepNumber(row.step) === lowestStep)
  }

  const lowestStep = rows
    .map((row) => String(row.step ?? ""))
    .sort((left, right) => left.localeCompare(right, "ko", { numeric: true }))[0]
  return rows.filter((row) => String(row.step ?? "") === lowestStep)
}

export function getLowestChStepRowsByPpid(rows) {
  const rowsByPpid = new Map()
  rows.forEach((row) => {
    const ppid = String(row.recipe_id ?? "").trim() || "PPID 미지정"
    const ppidRows = rowsByPpid.get(ppid) ?? []
    ppidRows.push(row)
    rowsByPpid.set(ppid, ppidRows)
  })
  return Array.from(rowsByPpid.values()).flatMap(getLowestChStepRows)
}

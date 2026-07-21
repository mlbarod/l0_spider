export function normalizeMyEqpSdwt(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleUpperCase("en-US")
}

export function filterMyEqpReferenceRowsBySdwt(rows, sdwtValues) {
  const normalizedSdwts = new Set(
    sdwtValues.map(normalizeMyEqpSdwt).filter(Boolean),
  )
  if (!normalizedSdwts.size) return []

  return (Array.isArray(rows) ? rows : []).filter((row) => (
    normalizedSdwts.has(normalizeMyEqpSdwt(row?.sdwt_prod))
  ))
}

export const FAVORITE_VIRTUAL_SDWTS = Object.freeze(["__MY_EQP__", "__SKIP_LIST__"])

// Accept the former single favorite during a rolling deployment.
export function normalizeFavorites(value) {
  if (Array.isArray(value?.lines) && Array.isArray(value?.sdwts)) return value
  return { lines: value?.line ? [value.line] : [], sdwts: value?.line && value?.sdwt ? [{ line: value.line, sdwt: value.sdwt }] : [] }
}
export function inspectFavoriteFilters(value, lineMapping) {
  const favorites = normalizeFavorites(value)
  const knownLines = new Set(Object.values(lineMapping))
  const lines = favorites.lines.filter(line => knownLines.has(line))
  const sdwts = favorites.sdwts.filter(item => knownLines.has(item.line)
    && (lineMapping[item.sdwt] === item.line || FAVORITE_VIRTUAL_SDWTS.includes(item.sdwt)))
  const line = lines[0] ?? sdwts[0]?.line
  return {
    selection: line ? { line, sdwt: sdwts.find(item => item.line === line)?.sdwt ?? "" } : null,
    changed: lines.length !== favorites.lines.length || sdwts.length !== favorites.sdwts.length,
  }
}
export function resolveFavoriteFilters(value, lineMapping) {
  return inspectFavoriteFilters(value, lineMapping).selection
}

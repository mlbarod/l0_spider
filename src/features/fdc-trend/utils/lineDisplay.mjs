const LINE_DISPLAY_ALIASES = Object.freeze({
  P4D: "P3D2",
})

export function formatLineDisplayName(lineId) {
  const value = String(lineId ?? "")
  return LINE_DISPLAY_ALIASES[value] ?? value
}

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim()
}

function normalizeMatchValue(value) {
  return normalizeText(value).toLocaleUpperCase("en-US")
}

function uniqueTextValues(values) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)))
}

export function readSelfEquipmentUrlFilters(searchParams) {
  return {
    line: normalizeText(searchParams.get("line")),
    sdwts: uniqueTextValues(searchParams.getAll("sdwt")),
    grades: uniqueTextValues(searchParams.getAll("grade")),
  }
}

export function resolveSelfEquipmentTeam(teamOptions, requestedSdwts) {
  const requestedValues = uniqueTextValues(requestedSdwts).map(normalizeMatchValue)
  if (!requestedValues.length) return ""

  return teamOptions.find((team) => (
    requestedValues.includes(normalizeMatchValue(team?.key))
      || requestedValues.includes(normalizeMatchValue(team?.label))
  ))?.key ?? ""
}

export function resolveSelfEquipmentGrades(requestedGrades, gradeOptions) {
  const requested = new Set(uniqueTextValues(requestedGrades).map((grade) => {
    const normalized = normalizeMatchValue(grade)
    return normalized === "A" || normalized === "B" || normalized === "A/B"
      ? "A/B"
      : normalized
  }))

  return gradeOptions.filter((grade) => requested.has(normalizeMatchValue(grade)))
}

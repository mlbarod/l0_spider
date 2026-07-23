function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim()
}

function normalizeMatchValue(value) {
  return normalizeText(value).toLocaleUpperCase("en-US")
}

function uniqueTextValues(values) {
  return Array.from(new Set(values.map(normalizeText).filter(Boolean)))
}

export const MY_EQP_TEAM_KEY = "__MY_EQP__"
export const MY_EQP_TEAM_LABEL = "MY EQP"
export const MY_EQP_URL_SDWT = "MY_EQP"

function isMyEqpValue(value) {
  const normalized = normalizeMatchValue(value).replaceAll(/\s+/g, "_")
  return normalized === MY_EQP_URL_SDWT || normalized === MY_EQP_TEAM_KEY
}

export function readSelfEquipmentUrlFilters(searchParams) {
  return {
    line: normalizeText(searchParams.get("line")),
    sdwts: uniqueTextValues(searchParams.getAll("sdwt")),
    grades: uniqueTextValues(searchParams.getAll("grade")),
    stepToken: normalizeText(searchParams.get("step")),
    eqpCh: normalizeText(searchParams.get("eqpCh") ?? searchParams.get("eqp_ch")),
  }
}

export function resolveSelfEquipmentTeam(teamOptions, requestedSdwts) {
  const requestedValues = uniqueTextValues(requestedSdwts).map(normalizeMatchValue)
  if (!requestedValues.length) return ""

  if (requestedValues.some(isMyEqpValue)) {
    return teamOptions.some((team) => team?.key === MY_EQP_TEAM_KEY)
      ? MY_EQP_TEAM_KEY
      : ""
  }

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

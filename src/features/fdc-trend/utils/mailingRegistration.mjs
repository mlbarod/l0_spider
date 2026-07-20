import { buildSelfEquipmentDetailUrl } from "./dashboardLinks.mjs"

function normalizeText(value) {
  return String(value ?? "").trim()
}

export function buildSdwtLineLookup(lineMapping = {}, sdwtMapping = {}) {
  const lookup = new Map()

  Object.entries(lineMapping).forEach(([sdwtKey, line]) => {
    const normalizedLine = normalizeText(line)
    const sdwtLabel = normalizeText(sdwtMapping[sdwtKey] ?? sdwtKey)
    if (!normalizedLine) return
    lookup.set(normalizeText(sdwtKey), normalizedLine)
    if (sdwtLabel) lookup.set(sdwtLabel, normalizedLine)
  })

  return lookup
}

export function expandMailingRegistrationRows(registrations, lineMapping = {}, sdwtMapping = {}) {
  const lineBySdwt = buildSdwtLineLookup(lineMapping, sdwtMapping)
  const rows = new Map()

  ;(Array.isArray(registrations) ? registrations : []).forEach((registration) => {
    const knoxId = normalizeText(registration?.knoxId)
    const sdwts = Array.isArray(registration?.sdwts) ? registration.sdwts : []
    const grades = Array.isArray(registration?.priorities) ? registration.priorities : []

    sdwts.forEach((sdwtValue) => {
      const sdwt = normalizeText(sdwtValue)
      const line = lineBySdwt.get(sdwt) ?? ""
      grades.forEach((gradeValue) => {
        const grade = normalizeText(gradeValue)
        if (!sdwt || !grade) return
        const key = [knoxId, line, sdwt, grade].join("\u0000")
        if (rows.has(key)) return

        rows.set(key, {
          id: key,
          knoxId,
          line,
          sdwt,
          grade,
          url: buildSelfEquipmentDetailUrl({
            lineId: line,
            sdwts: [sdwt],
            sensorGrades: [grade],
          }),
        })
      })
    })
  })

  return Array.from(rows.values()).sort((left, right) => (
    left.line.localeCompare(right.line, "ko", { numeric: true })
      || left.sdwt.localeCompare(right.sdwt, "ko", { numeric: true })
      || left.grade.localeCompare(right.grade, "ko", { numeric: true })
  ))
}

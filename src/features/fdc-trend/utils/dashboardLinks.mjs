import { MY_EQP_URL_SDWT } from "./selfEquipmentUrlFilters.mjs"

export function buildSelfEquipmentDetailUrl({ lineId, sdwts = [], sensorGrades = [] }) {
  const searchParams = new URLSearchParams()
  if (lineId) searchParams.set("line", lineId)
  Array.from(new Set(sdwts.filter(Boolean))).forEach((sdwt) => searchParams.append("sdwt", sdwt))
  Array.from(new Set(sensorGrades.filter(Boolean))).forEach((grade) => searchParams.append("grade", grade))
  const query = searchParams.toString()
  return `/self-equipment${query ? `?${query}` : ""}`
}

export function buildMyEqpDetailUrl({ lineId, sensorGrades = [] }) {
  return buildSelfEquipmentDetailUrl({
    lineId,
    sdwts: [MY_EQP_URL_SDWT],
    sensorGrades,
  })
}

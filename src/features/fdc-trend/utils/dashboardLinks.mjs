import {
  MY_EQP_URL_SDWT,
  MY_EQP_URL_STEP,
} from "./selfEquipmentUrlFilters.mjs"

export function buildSelfEquipmentDetailUrl({ lineId, sdwts = [], sensorGrades = [] }) {
  const searchParams = new URLSearchParams()
  if (lineId) searchParams.set("line", lineId)
  Array.from(new Set(sdwts.filter(Boolean))).forEach((sdwt) => searchParams.append("sdwt", sdwt))
  Array.from(new Set(sensorGrades.filter(Boolean))).forEach((grade) => searchParams.append("grade", grade))
  const query = searchParams.toString()
  return `/self-equipment${query ? `?${query}` : ""}`
}

export function buildMyEqpDetailUrl({
  lineId,
  sensorGrades = [],
  eqpCh = "",
}) {
  const url = buildSelfEquipmentDetailUrl({
    lineId,
    sdwts: [MY_EQP_URL_SDWT],
    sensorGrades,
  })
  const parsed = new URL(url, "http://localhost")
  parsed.searchParams.set("step", MY_EQP_URL_STEP)
  if (eqpCh) parsed.searchParams.set("eqpCh", eqpCh)
  return `${parsed.pathname}?${parsed.searchParams.toString()}`
}

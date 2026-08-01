import { getApiErrorMessage } from "./errorMessage.js"

export async function fetchSelfEquipmentData({
  line,
  pathSdwt,
  sdwt,
  priorities,
  desc,
  eqpCh,
  sensor,
  chStep,
}) {
  const searchParams = new URLSearchParams({ line, pathSdwt, sdwt })
  priorities.forEach((priority) => searchParams.append("priority", priority))
  if (desc) searchParams.set("desc", desc)
  if (eqpCh) searchParams.set("eqpCh", eqpCh)
  if (sensor) searchParams.set("sensor", sensor)
  if (chStep) searchParams.set("chStep", chStep)

  const response = await fetch(`/api/self-equipment-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, "자설비 이상감지 데이터를 불러오지 못했습니다."))
  }

  return payload
}

export async function fetchMyEqpEquipmentData({
  line,
  priorities,
  desc,
  eqpCh,
  sensor,
  chStep,
}) {
  const searchParams = new URLSearchParams({ line })
  priorities.forEach((priority) => searchParams.append("priority", priority))
  if (desc) searchParams.set("desc", desc)
  if (eqpCh) searchParams.set("eqpCh", eqpCh)
  if (sensor) searchParams.set("sensor", sensor)
  if (chStep) searchParams.set("chStep", chStep)

  const response = await fetch(`/api/my-eqp-equipment-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, "My EQP 이상감지 데이터를 불러오지 못했습니다."))
  }
  return payload
}

export async function fetchEqpAllSkipTargets({
  isMyEqp,
  line,
  pathSdwt,
  sdwt,
  priorities,
  desc,
  eqpCh,
  sensor,
}) {
  const targetSensor = String(sensor ?? "").trim()
  if (!targetSensor || targetSensor === "ALL") {
    throw new Error("EQP ALL SKIP은 개별 sensor를 지정해야 합니다.")
  }
  const filters = {
    line,
    priorities,
    desc,
    eqpCh,
    sensor: targetSensor,
    chStep: "ALL",
  }
  const payload = isMyEqp
    ? await fetchMyEqpEquipmentData(filters)
    : await fetchSelfEquipmentData({ ...filters, pathSdwt, sdwt })

  return (payload.rows ?? []).map((row) => ({ filePath: row.file_path }))
}

export async function fetchErdScatterData({ filePath, eqp, sensor, chStep }) {
  const searchParams = new URLSearchParams({ path: filePath, eqp })
  if (sensor) searchParams.set("sensor", sensor)
  if (chStep) searchParams.set("chStep", chStep)
  const response = await fetch(`/api/erd-scatter-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, "ERD 이상감지 데이터를 불러오지 못했습니다."))
  }

  return payload
}

export async function fetchErdIdentityData({ filePath, eqp, sensor, chStep, days, signal }) {
  const searchParams = new URLSearchParams({ path: filePath, eqp, mode: "identity" })
  if (sensor) searchParams.set("sensor", sensor)
  if (chStep) searchParams.set("chStep", chStep)
  if (days) searchParams.set("days", String(days))
  const response = await fetch(`/api/erd-scatter-data?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
    signal,
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, "동일성 차트 데이터를 불러오지 못했습니다."))
  }

  return payload
}

export function buildErdFileUrl(filePath) {
  return `/api/erd-file?path=${encodeURIComponent(filePath)}`
}

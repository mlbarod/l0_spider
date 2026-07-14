async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || "PASS 이력을 처리하지 못했습니다.")
  return payload
}

export async function fetchPassHistory({ lineId, sdwt, desc }) {
  const searchParams = new URLSearchParams({ lineId })
  if (sdwt) searchParams.set("sdwt", sdwt)
  if (desc) searchParams.set("desc", desc)
  const response = await fetch(`/api/pass-history?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  return parseResponse(response)
}

export async function fetchSkipListData({
  lineId,
  priorities,
  desc,
  eqpCh,
  sensor,
  chStep,
}) {
  const searchParams = new URLSearchParams({ view: "filters", lineId })
  priorities.forEach((priority) => searchParams.append("priority", priority))
  if (desc) searchParams.set("desc", desc)
  if (eqpCh) searchParams.set("eqpCh", eqpCh)
  if (sensor) searchParams.set("sensor", sensor)
  if (chStep) searchParams.set("chStep", chStep)

  const response = await fetch(`/api/pass-history?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  return parseResponse(response)
}

export async function createPassHistory({ lineId, filePath, comment, execDate }) {
  const response = await fetch("/api/pass-history", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ lineId, filePath, comment, execDate }),
  })
  return parseResponse(response)
}

export async function deletePassHistory({ lineId, filePath }) {
  const response = await fetch("/api/pass-history", {
    method: "DELETE",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ lineId, filePath }),
  })
  return parseResponse(response)
}

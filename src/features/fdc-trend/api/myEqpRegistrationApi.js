export async function createMyEqpRegistration({
  line,
  sdwt,
  prcGroup,
  eqps,
  periode,
  comment,
}) {
  const response = await fetch("/api/my-eqp-registration", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ line, sdwt, prcGroup, eqps, periode, comment }),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(payload.error || "My EQP 기준정보를 저장하지 못했습니다.")
    error.table = payload.table
    error.debugRows = Array.isArray(payload.debugRows) ? payload.debugRows : []
    throw error
  }
  return payload
}

export async function fetchMyEqpRegistrations({ line, activeOnly = false }) {
  const searchParams = new URLSearchParams({ line })
  if (activeOnly) searchParams.set("activeOnly", "true")
  const response = await fetch(`/api/my-eqp-registration?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || "등록된 My EQP 기준정보를 불러오지 못했습니다.")
  }
  return Array.isArray(payload.registrations) ? payload.registrations : []
}

export async function deleteMyEqpRegistration(registration) {
  const response = await fetch("/api/my-eqp-registration", {
    method: "DELETE",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(registration),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || "My EQP 기준정보를 삭제하지 못했습니다.")
  }
  return payload
}

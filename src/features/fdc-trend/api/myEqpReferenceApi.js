export async function fetchMyEqpReference() {
  const response = await fetch("/api/my-eqp-reference", {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || "My EQP 기준정보를 불러오지 못했습니다.")
  }
  if (!Array.isArray(payload.rows)) {
    throw new Error("My EQP 기준정보 형식이 올바르지 않습니다.")
  }

  return payload.rows
}

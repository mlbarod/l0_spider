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
    throw new Error(payload.error || "My EQP 기준정보를 저장하지 못했습니다.")
  }
  return payload
}

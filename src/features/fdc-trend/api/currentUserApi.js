export async function fetchCurrentUser() {
  const response = await fetch("/api/current-user", {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || "접속자 정보를 확인하지 못했습니다.")
  }

  return payload
}

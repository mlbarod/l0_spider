export async function fetchLatestCommonalityPath() {
  const response = await fetch("/api/latest-commonality-path", {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error || "동일성 최신날짜 경로를 확인하지 못했습니다.")
  }

  return payload
}

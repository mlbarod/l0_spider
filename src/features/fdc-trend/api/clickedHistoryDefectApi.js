export async function createClickedHistoryDefect({ lineName, selectStep, clickedAt }) {
  const response = await fetch("/api/clicked-history-defect", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ lineName, selectStep, clickedAt }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || "MY EQP 조회이력을 저장하지 못했습니다.")
  }
  if (Number(payload.affectedRows) < 1) {
    throw new Error("MY EQP 조회이력이 DB에 반영되지 않았습니다.")
  }
  return payload
}

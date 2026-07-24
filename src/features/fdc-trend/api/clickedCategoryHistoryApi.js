export async function createClickedCategoryHistory({
  app,
  lineId,
  filePaths,
  grades,
  selectedSensor,
  defectSelectStep,
  clickedAt,
}) {
  const response = await fetch("/api/clicked-category-history", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      app,
      lineId,
      filePaths,
      grades,
      selectedSensor,
      defectSelectStep,
      clickedAt,
    }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || "클릭이력을 저장하지 못했습니다.")
  }
  if (Number(payload.affectedRows) < 1) {
    throw new Error("클릭이력이 DB에 반영되지 않았습니다.")
  }
  return payload
}

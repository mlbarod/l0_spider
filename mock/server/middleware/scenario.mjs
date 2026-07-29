const SLOW_DELAYS = Object.freeze({
  "/api/dashboard-data": 1000,
  "/api/self-equipment-data": 3000,
  "/api/my-eqp-equipment-data": 3000,
  "/api/erd-scatter-data": 10_000,
  "/api/common-anomaly-scatter-data": 10_000,
})

export function resolveScenarioEffect(state, req, url) {
  const override = state.getOverride(req.method ?? "GET", url.pathname)
  const configuredScenario = state.getScenario()
  const fixtureScenario = override?.fixture ?? (
    ["slow", "race-condition"].includes(configuredScenario) ? "normal" : configuredScenario
  )
  let status = override?.status
  let delayMs = override?.delay_ms ?? 0
  let timeout = override?.timeout ?? false

  const errorMatch = configuredScenario.match(/^error-(400|401|403|404|500|502)$/)
  if (errorMatch && status === undefined) status = Number(errorMatch[1])
  if (configuredScenario === "timeout" && override?.timeout === undefined) timeout = true
  if (configuredScenario === "slow" && override?.delay_ms === undefined) {
    delayMs = SLOW_DELAYS[url.pathname] ?? 1000
  }
  if (configuredScenario === "race-condition" && override?.delay_ms === undefined) {
    const line = url.searchParams.get("line") ?? url.searchParams.get("lineId")
    delayMs = line === "LINE_A" ? 3000 : line === "LINE_B" ? 300 : 1000
  }

  return { fixtureScenario, status, delayMs, timeout }
}

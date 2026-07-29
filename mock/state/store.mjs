export const SCENARIOS = Object.freeze([
  "normal",
  "empty",
  "single",
  "partial",
  "large",
  "slow",
  "error-400",
  "error-401",
  "error-403",
  "error-404",
  "error-500",
  "error-502",
  "timeout",
  "race-condition",
  "inconsistent",
  "edge-values",
])

function overrideKey(method, route) {
  return `${method.toUpperCase()} ${route}`
}

export function createMockState() {
  let scenario = "normal"
  const overrides = new Map()

  return {
    snapshot() {
      return {
        scenario,
        overrides: Array.from(overrides.values()).map((item) => ({ ...item })),
      }
    },
    getScenario() {
      return scenario
    },
    setScenario(nextScenario) {
      if (!SCENARIOS.includes(nextScenario)) {
        const error = new Error(`Unknown scenario: ${nextScenario}`)
        error.statusCode = 400
        throw error
      }
      scenario = nextScenario
      return this.snapshot()
    },
    setOverride(input) {
      const route = String(input?.route ?? "").trim()
      const method = String(input?.method ?? "GET").trim().toUpperCase()
      if (!route.startsWith("/api/")) {
        const error = new Error("Override route must start with /api/")
        error.statusCode = 400
        throw error
      }
      const status = input.status === undefined ? undefined : Number(input.status)
      const delayMs = input.delay_ms === undefined ? undefined : Number(input.delay_ms)
      const timeout = input.timeout === undefined ? undefined : Boolean(input.timeout)
      const fixture = input.fixture ?? input.response_fixture
      if (status !== undefined && (!Number.isInteger(status) || status < 100 || status > 599)) {
        const error = new Error("status must be an integer from 100 through 599")
        error.statusCode = 400
        throw error
      }
      if (delayMs !== undefined && (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 60_000)) {
        const error = new Error("delay_ms must be an integer from 0 through 60000")
        error.statusCode = 400
        throw error
      }
      if (fixture !== undefined && !SCENARIOS.includes(fixture)) {
        const error = new Error("response fixture must be a supported scenario")
        error.statusCode = 400
        throw error
      }
      const value = { route, method, status, delay_ms: delayMs, timeout, fixture }
      overrides.set(overrideKey(method, route), value)
      return this.snapshot()
    },
    getOverride(method, route) {
      return overrides.get(overrideKey(method, route))
    },
    reset() {
      scenario = "normal"
      overrides.clear()
      return this.snapshot()
    },
  }
}

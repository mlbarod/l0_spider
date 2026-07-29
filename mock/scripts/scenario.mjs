import { SCENARIOS } from "../state/store.mjs"
import { loadMockEnvironment } from "../utils/env.mjs"

await loadMockEnvironment()
const scenario = process.argv[2]
if (!scenario || !SCENARIOS.includes(scenario)) {
  console.error(`Usage: npm run mock:scenario -- <${SCENARIOS.join("|")}>`)
  process.exit(1)
}

const port = Number(process.env.MOCK_API_PORT ?? 5175)
const response = await fetch(`http://127.0.0.1:${port}/__mock/scenario`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ scenario }),
}).catch((error) => {
  console.error(`Mock API is unavailable: ${error.message}`)
  process.exit(1)
})

const payload = await response.json().catch(() => ({}))
if (!response.ok) {
  console.error(payload.error ?? `Scenario update failed with HTTP ${response.status}`)
  process.exit(1)
}
console.info(`Mock scenario: ${payload.scenario}`)

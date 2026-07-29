import { loadMockEnvironment } from "../utils/env.mjs"

await loadMockEnvironment()
const port = Number(process.env.MOCK_API_PORT ?? 5175)
const response = await fetch(`http://127.0.0.1:${port}/__mock/reset`, {
  method: "POST",
}).catch((error) => {
  console.error(`Mock API is unavailable: ${error.message}`)
  process.exit(1)
})

const payload = await response.json().catch(() => ({}))
if (!response.ok) {
  console.error(payload.error ?? `Mock reset failed with HTTP ${response.status}`)
  process.exit(1)
}
console.info("Mock state reset to normal")

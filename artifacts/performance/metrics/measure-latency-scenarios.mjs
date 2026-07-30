import { writeFile } from "node:fs/promises"
import { performance } from "node:perf_hooks"

const apiOrigin = process.env.MOCK_API_ORIGIN
const outputPath = process.env.PERF_LATENCY_OUTPUT
if (!apiOrigin || !outputPath) {
  throw new Error("MOCK_API_ORIGIN and PERF_LATENCY_OUTPUT are required")
}

function round(value) {
  return Number(value.toFixed(2))
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return {
    mean: round(mean),
    median: round(sorted[Math.floor(sorted.length / 2)]),
    min: round(sorted[0]),
    max: round(sorted.at(-1)),
  }
}

async function resetAndSet(scenario) {
  const reset = await fetch(`${apiOrigin}/__mock/reset`, { method: "POST" })
  if (!reset.ok) throw new Error(`reset failed: ${reset.status}`)
  const selected = await fetch(`${apiOrigin}/__mock/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  })
  if (!selected.ok) throw new Error(`scenario failed: ${selected.status}`)
}

async function timedFetch(path) {
  const startedAt = performance.now()
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: { Accept: "application/json" },
  })
  await response.arrayBuffer()
  if (!response.ok) throw new Error(`${new URL(path, "http://synthetic.local").pathname} failed: ${response.status}`)
  return performance.now() - startedAt
}

await resetAndSet("slow")
const slowDefinitions = {
  dashboard: "/api/dashboard-data",
  selfEquipment: "/api/self-equipment-data?line=LINE_A&pathSdwt=PRODUCT_001&sdwt=PRODUCT_001",
  scatter: "/api/erd-scatter-data?path=fixture%3A%2F%2Fbenchmark%2Fchart&eqp=EQP_TEST_001",
}
const slow = {}
for (const [name, path] of Object.entries(slowDefinitions)) {
  await timedFetch(path)
  const samples = []
  for (let index = 0; index < 3; index += 1) samples.push(await timedFetch(path))
  slow[name] = {
    path: new URL(path, "http://synthetic.local").pathname,
    samplesMs: samples.map(round),
    durationMs: stats(samples),
  }
}

await resetAndSet("race-condition")
const race = []
for (let index = 0; index < 3; index += 1) {
  const pairStartedAt = performance.now()
  const [lineA, lineB] = await Promise.all([
    timedFetch("/api/dashboard-data?line=LINE_A"),
    timedFetch("/api/dashboard-data?line=LINE_B"),
  ])
  race.push({
    iteration: index + 1,
    slowerRequestMs: round(lineA),
    fasterRequestMs: round(lineB),
    pairCompletionMs: round(performance.now() - pairStartedAt),
    gapMs: round(lineA - lineB),
  })
}

await resetAndSet("normal")
const result = {
  metadata: {
    generatedAt: new Date().toISOString(),
    iterations: 3,
    warmupIterations: 1,
    timingSource: "Node performance.now() around local HTTP fetch and body read",
    dataPolicy: "synthetic aggregate metrics only; response bodies and origins omitted",
  },
  slow,
  raceCondition: {
    concurrentPairCount: race.length,
    samples: race,
    slowerRequestMs: stats(race.map((item) => item.slowerRequestMs)),
    fasterRequestMs: stats(race.map((item) => item.fasterRequestMs)),
    completionGapMs: stats(race.map((item) => item.gapMs)),
  },
}

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
console.log(JSON.stringify({
  output: "latency-scenarios.json",
  scenarios: ["slow", "race-condition"],
  status: "completed",
}))

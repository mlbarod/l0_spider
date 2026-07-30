import { writeFile } from "node:fs/promises"
import { performance } from "node:perf_hooks"

import {
  createChartPoints,
  createCommonPayload,
  createSyntheticRows,
} from "../../../mock/generators/synthetic-data.mjs"
import {
  buildIdentityChartPoints,
  selectRenderedIdentityPoints,
} from "../../../src/features/fdc-trend/utils/identityChart.mjs"

const outputPath = process.env.PERF_COMPUTE_OUTPUT
if (!outputPath) throw new Error("PERF_COMPUTE_OUTPUT is required")

const scenarios = ["single", "normal", "large"]
const samplesPerScenario = 5
const repeats = Object.freeze({ single: 1000, normal: 500, large: 50 })

function round(value, digits = 4) {
  return Number(value.toFixed(digits))
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  return {
    mean: round(mean),
    median: round(median),
    min: round(sorted[0]),
    max: round(sorted.at(-1)),
  }
}

function groupAndSort(rows) {
  const groups = new Map()
  for (const row of rows) {
    const eqp = String(row.eqp ?? "").replace(/\.png$/i, "")
    const groupRows = groups.get(eqp) ?? []
    groupRows.push(row)
    groups.set(eqp, groupRows)
  }
  return Array.from(groups, ([eqp, groupRows]) => ({ eqp, rows: groupRows }))
    .sort((left, right) => left.eqp.localeCompare(right.eqp, "ko", { numeric: true }))
}

function timeRepeated(repeatCount, operation) {
  const startedAt = performance.now()
  let lastResult
  for (let index = 0; index < repeatCount; index += 1) {
    lastResult = operation()
  }
  return {
    perOperationMs: (performance.now() - startedAt) / repeatCount,
    lastResult,
  }
}

const result = {
  metadata: {
    generatedAt: new Date().toISOString(),
    scenarios,
    samplesPerScenario,
    warmupIterations: 1,
    timingSource: "Node performance.now(); per-operation time normalized from repeated operations",
    scope: "pure data generation, JSON encode/decode, grouping, and existing identity chart transforms; not browser rendering",
  },
  scenarios: {},
}

for (const scenario of scenarios) {
  const rows = createSyntheticRows(scenario)
  const points = createChartPoints(scenario)
  const groups = [
    { eqpCb: "EQP_TEST_001", isSelected: true, points },
    ...(scenario === "single"
      ? []
      : [{ eqpCb: "EQP_TEST_002", isSelected: false, points }]),
  ]
  const identityPoints = buildIdentityChartPoints(groups)
  const repeatCount = repeats[scenario]
  const operations = {
    commonPayloadGeneration: () => createCommonPayload(scenario, {
      line: "LINE_A",
      pathSdwt: "PRODUCT_001",
      sdwt: "PRODUCT_001",
      prcGroup: "RECIPE_TEST_001",
      eqp: "EQP_TEST_001.png",
      sensor: "SENSOR_FLOW_001",
    }),
    jsonRoundTrip: () => JSON.parse(JSON.stringify({ groups, rows })),
    rowGroupingAndSort: () => groupAndSort(rows),
    identitySelection: () => selectRenderedIdentityPoints(groups, identityPoints, null),
  }

  result.scenarios[scenario] = {
    dataRows: rows.length,
    pointsPerGroup: points.length,
    identitySourcePoints: identityPoints.length,
    repeatCountPerSample: repeatCount,
    operations: {},
  }

  for (const [name, operation] of Object.entries(operations)) {
    timeRepeated(repeatCount, operation)
    const samples = []
    let lastResult
    for (let sample = 0; sample < samplesPerScenario; sample += 1) {
      const measured = timeRepeated(repeatCount, operation)
      samples.push(measured.perOperationMs)
      lastResult = measured.lastResult
    }
    result.scenarios[scenario].operations[name] = {
      durationMs: stats(samples),
      samples: samples.map((value) => round(value)),
      outputCount: Array.isArray(lastResult)
        ? lastResult.length
        : Array.isArray(lastResult?.points)
        ? lastResult.points.length
        : Array.isArray(lastResult?.rows)
        ? lastResult.rows.length
        : null,
    }
  }
}

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
console.log(JSON.stringify({
  output: "compute-benchmark.json",
  scenarios,
  samplesPerScenario,
  status: "completed",
}))

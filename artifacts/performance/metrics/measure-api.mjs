import { writeFile } from "node:fs/promises"
import { performance } from "node:perf_hooks"

const apiOrigin = process.env.MOCK_API_ORIGIN
const outputPath = process.env.PERF_METRICS_OUTPUT

if (!apiOrigin || !outputPath) {
  throw new Error("MOCK_API_ORIGIN and PERF_METRICS_OUTPUT are required")
}

const scenarios = ["single", "normal", "large"]
const iterations = 5

const syntheticQuery = {
  line: "LINE_A",
  pathSdwt: "PRODUCT_001",
  sdwt: "PRODUCT_001",
  priority: "A",
  desc: "U%10000",
  eqpCh: "EQP_TEST_001.png",
  eqp: "EQP_TEST_001.png",
  sensor: "SENSOR_FLOW_001",
  chStep: "U%10000",
  prcGroup: "RECIPE_TEST_001",
  path: "fixture://benchmark/chart",
}

function query(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, item)
    } else if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value))
    }
  }
  return search.toString()
}

const requests = {
  dashboard: [
    `/api/dashboard-data`,
  ],
  selfEquipmentFinal: [
    `/api/self-equipment-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      priority: [syntheticQuery.priority],
      desc: syntheticQuery.desc,
      eqpCh: syntheticQuery.eqpCh,
      sensor: syntheticQuery.sensor,
      chStep: syntheticQuery.chStep,
    })}`,
  ],
  selfEquipmentProgressive: [
    `/api/self-equipment-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      priority: [syntheticQuery.priority],
    })}`,
    `/api/self-equipment-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      priority: [syntheticQuery.priority],
      desc: syntheticQuery.desc,
    })}`,
    `/api/self-equipment-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      priority: [syntheticQuery.priority],
      desc: syntheticQuery.desc,
      eqpCh: syntheticQuery.eqpCh,
    })}`,
    `/api/self-equipment-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      priority: [syntheticQuery.priority],
      desc: syntheticQuery.desc,
      eqpCh: syntheticQuery.eqpCh,
      sensor: syntheticQuery.sensor,
    })}`,
    `/api/self-equipment-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      priority: [syntheticQuery.priority],
      desc: syntheticQuery.desc,
      eqpCh: syntheticQuery.eqpCh,
      sensor: syntheticQuery.sensor,
      chStep: syntheticQuery.chStep,
    })}`,
  ],
  commonAnomalyFinal: [
    `/api/common-anomaly-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      prcGroup: syntheticQuery.prcGroup,
      eqp: syntheticQuery.eqp,
      sensor: syntheticQuery.sensor,
    })}`,
  ],
  commonAnomalyProgressive: [
    `/api/common-anomaly-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
    })}`,
    `/api/common-anomaly-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      prcGroup: syntheticQuery.prcGroup,
    })}`,
    `/api/common-anomaly-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      prcGroup: syntheticQuery.prcGroup,
      eqp: syntheticQuery.eqp,
    })}`,
    `/api/common-anomaly-data?${query({
      line: syntheticQuery.line,
      pathSdwt: syntheticQuery.pathSdwt,
      sdwt: syntheticQuery.sdwt,
      prcGroup: syntheticQuery.prcGroup,
      eqp: syntheticQuery.eqp,
      sensor: syntheticQuery.sensor,
    })}`,
  ],
  scatter: [
    `/api/erd-scatter-data?${query({
      path: syntheticQuery.path,
      eqp: syntheticQuery.eqp,
      sensor: syntheticQuery.sensor,
      chStep: syntheticQuery.chStep,
    })}`,
  ],
  identity: [
    `/api/erd-scatter-data?${query({
      path: syntheticQuery.path,
      eqp: syntheticQuery.eqp,
      sensor: syntheticQuery.sensor,
      chStep: syntheticQuery.chStep,
      mode: "identity",
      days: 30,
    })}`,
  ],
  passHistory: [
    `/api/pass-history?${query({ lineId: syntheticQuery.line })}`,
  ],
  registrations: [
    `/api/my-eqp-registration?${query({
      line: syntheticQuery.line,
      activeOnly: true,
    })}`,
  ],
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits))
}

function percentileStats(values) {
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const median = sorted.length % 2
    ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return {
    mean: round(mean),
    median: round(median),
    min: round(sorted[0]),
    max: round(sorted.at(-1)),
    standardDeviation: round(Math.sqrt(variance)),
  }
}

function payloadShape(name, payload) {
  if (name === "dashboard") {
    return {
      rows: payload.lineDashboard?.summary?.monitoringSensorTotal ?? null,
      chartPoints: payload.lineDashboard?.dailyTrend?.length ?? null,
    }
  }
  if (name.startsWith("selfEquipment") || name.startsWith("commonAnomaly")) {
    return {
      rows: payload.rows?.length ?? null,
      chartPoints: null,
    }
  }
  if (name === "scatter") {
    return {
      rows: null,
      chartPoints: payload.points?.length ?? null,
    }
  }
  if (name === "identity") {
    return {
      rows: null,
      chartPoints: payload.groups?.reduce(
        (sum, group) => sum + (group.points?.length ?? 0),
        0,
      ) ?? null,
    }
  }
  if (name === "passHistory") {
    return { rows: payload.records?.length ?? null, chartPoints: null }
  }
  if (name === "registrations") {
    return { rows: payload.registrations?.length ?? null, chartPoints: null }
  }
  return { rows: null, chartPoints: null }
}

async function requestJson(path) {
  const startedAt = performance.now()
  const response = await fetch(`${apiOrigin}${path}`, {
    headers: { Accept: "application/json" },
  })
  const text = await response.text()
  const endedAt = performance.now()
  if (!response.ok) {
    throw new Error(`GET ${new URL(path, "http://synthetic.local").pathname} failed with ${response.status}`)
  }
  return {
    durationMs: endedAt - startedAt,
    bytes: Buffer.byteLength(text),
    payload: JSON.parse(text),
    status: response.status,
  }
}

async function setScenario(scenario) {
  const resetResponse = await fetch(`${apiOrigin}/__mock/reset`, { method: "POST" })
  if (!resetResponse.ok) throw new Error(`reset failed: ${resetResponse.status}`)
  const scenarioResponse = await fetch(`${apiOrigin}/__mock/scenario`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario }),
  })
  if (!scenarioResponse.ok) throw new Error(`scenario failed: ${scenarioResponse.status}`)
}

async function measureFlow(name, paths) {
  const startedAt = performance.now()
  let totalBytes = 0
  let lastPayload = null
  const requestsDetail = []
  for (const path of paths) {
    const result = await requestJson(path)
    totalBytes += result.bytes
    lastPayload = result.payload
    requestsDetail.push({
      path: new URL(path, "http://synthetic.local").pathname,
      durationMs: round(result.durationMs),
      bytes: result.bytes,
      status: result.status,
    })
  }
  return {
    durationMs: performance.now() - startedAt,
    bytes: totalBytes,
    requestCount: paths.length,
    shape: payloadShape(name, lastPayload),
    requests: requestsDetail,
  }
}

const result = {
  metadata: {
    generatedAt: new Date().toISOString(),
    scenarios,
    iterations,
    warmupIterations: 1,
    cacheCondition: "server cache not implemented; first complete flow excluded as warm-up",
    timingSource: "Node performance.now() around local HTTP fetch and body read",
    dataPolicy: "synthetic aggregate metrics only; response bodies omitted",
  },
  scenarios: {},
}

for (const scenario of scenarios) {
  await setScenario(scenario)
  result.scenarios[scenario] = {}
  for (const [name, paths] of Object.entries(requests)) {
    const warmup = await measureFlow(name, paths)
    const samples = []
    for (let index = 0; index < iterations; index += 1) {
      samples.push(await measureFlow(name, paths))
    }
    result.scenarios[scenario][name] = {
      requestCountPerFlow: paths.length,
      pathSequence: paths.map((path) => new URL(path, "http://synthetic.local").pathname),
      warmup: {
        durationMs: round(warmup.durationMs),
        bytes: warmup.bytes,
      },
      durationMs: percentileStats(samples.map((sample) => sample.durationMs)),
      bytes: percentileStats(samples.map((sample) => sample.bytes)),
      representativeShape: samples[0].shape,
      samples: samples.map((sample, index) => ({
        iteration: index + 1,
        durationMs: round(sample.durationMs),
        bytes: sample.bytes,
        requestCount: sample.requestCount,
        shape: sample.shape,
        requests: sample.requests,
      })),
    }
  }
}

await setScenario("normal")
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
console.log(JSON.stringify({
  output: "api-benchmark.json",
  scenarios,
  iterations,
  status: "completed",
}))

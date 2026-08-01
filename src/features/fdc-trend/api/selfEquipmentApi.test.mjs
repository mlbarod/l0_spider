import assert from "node:assert/strict"
import test from "node:test"

import { fetchEqpAllSkipTargets } from "./selfEquipmentApi.js"

test("MY EQP의 EQP ALL SKIP 대상은 My EQP 전용 API로 조회한다", async (t) => {
  const originalFetch = globalThis.fetch
  let requestedUrl = ""
  globalThis.fetch = async (url) => {
    requestedUrl = String(url)
    return {
      ok: true,
      json: async () => ({ rows: [{ file_path: "/appdata/erd/chart.png" }] }),
    }
  }
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  const targets = await fetchEqpAllSkipTargets({
    isMyEqp: true,
    line: "LINE-1",
    pathSdwt: "__MY_EQP__",
    sdwt: "MY EQP",
    priorities: ["A"],
    desc: "STEP-1",
    eqpCh: "EQP-1",
    sensor: "SENSOR-1",
  })

  assert.match(requestedUrl, /^\/api\/my-eqp-equipment-data\?/)
  assert.doesNotMatch(requestedUrl, /pathSdwt/)
  assert.match(requestedUrl, /sensor=SENSOR-1/)
  assert.match(requestedUrl, /chStep=ALL/)
  assert.deepEqual(targets, [{ filePath: "/appdata/erd/chart.png" }])
})

test("EQP ALL SKIP 대상 조회는 sensor ALL을 허용하지 않는다", async (t) => {
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    throw new Error("호출되면 안 됩니다.")
  }
  t.after(() => {
    globalThis.fetch = originalFetch
  })

  await assert.rejects(
    () => fetchEqpAllSkipTargets({
      isMyEqp: false,
      line: "LINE-1",
      pathSdwt: "SDWT-1",
      sdwt: "SDWT-1",
      priorities: ["A"],
      desc: "STEP-1",
      eqpCh: "EQP-1",
      sensor: "ALL",
    }),
    /개별 sensor/,
  )
  assert.equal(fetchCalled, false)
})

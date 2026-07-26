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
  assert.match(requestedUrl, /chStep=ALL/)
  assert.deepEqual(targets, [{ filePath: "/appdata/erd/chart.png" }])
})

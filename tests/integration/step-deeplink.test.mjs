import assert from "node:assert/strict"
import test from "node:test"

import { buildSelfEquipmentPayload } from "../../server/selfEquipmentData.mjs"
import { buildMyEqpDetailUrl } from "../../src/features/fdc-trend/utils/dashboardLinks.mjs"
import {
  MY_EQP_TEAM_KEY,
  readSelfEquipmentUrlFilters,
  resolveSelfEquipmentGrades,
  resolveSelfEquipmentTeam,
} from "../../src/features/fdc-trend/utils/selfEquipmentUrlFilters.mjs"

function createSyntheticRow(overrides = {}) {
  return {
    line_rev: "SYNTH_LINE",
    sdwt: "SYNTH_SDWT",
    desc: "SYNTH_STEP_ALPHA",
    ver: "SYNTH_VERSION",
    recipe_id: "SYNTH_RECIPE",
    priority: "D",
    sensor: "SYNTH_SENSOR",
    step: "SYNTH_CH_STEP",
    eqp: "SYNTH_EQP_01.png",
    file_path: "SYNTHETIC_FILE_NOT_READ",
    ...overrides,
  }
}

test("MY EQP URL의 ALL·eqpCh 계약이 parser와 payload builder까지 보존된다", () => {
  const link = buildMyEqpDetailUrl({
    lineId: "SYNTH_LINE",
    sensorGrades: ["D"],
    eqpCh: "synth-eqp 01",
  })
  const parsedUrl = new URL(link, "http://localhost")
  const requested = readSelfEquipmentUrlFilters(parsedUrl.searchParams)
  const team = resolveSelfEquipmentTeam([
    { key: "SYNTH_SDWT", label: "SYNTH SDWT" },
    { key: MY_EQP_TEAM_KEY, label: "MY EQP" },
  ], requested.sdwts)
  const priorities = resolveSelfEquipmentGrades(requested.grades, ["A/B", "D", "N", "M"])
  const rows = [
    createSyntheticRow(),
    createSyntheticRow({ desc: "SYNTH_STEP_BETA" }),
    createSyntheticRow({ eqp: "SYNTH_EQP_02.png" }),
    createSyntheticRow({ priority: "A", eqp: "SYNTH_EQP_03.png" }),
  ]

  const payload = buildSelfEquipmentPayload(rows, {
    line: requested.line,
    pathSdwt: team,
    sdwt: "MY EQP",
    priorities,
    desc: requested.stepToken,
    eqpCh: requested.eqpCh,
    sensor: "",
    chStep: "",
    includeAllLines: true,
    includeAllSdwt: true,
    allowAllSteps: true,
    normalizeEqpCh: true,
  })

  assert.equal(parsedUrl.pathname, "/self-equipment")
  assert.equal(team, MY_EQP_TEAM_KEY)
  assert.deepEqual(priorities, ["D"])
  assert.equal(payload.filters.desc, "ALL")
  assert.equal(payload.filters.eqpCh, "SYNTH_EQP_01.png")
  assert.deepEqual(payload.steps.map((item) => item.desc), [
    "SYNTH_STEP_ALPHA",
    "SYNTH_STEP_BETA",
  ])
  assert.equal(
    payload.eqpChannels.find((item) => item.eqpCh === "SYNTH_EQP_01.png")?.rowCount,
    2,
  )
})

test("일반 Self Equipment payload는 실제 STEP 이름이 없으면 ALL을 선택하지 않는다", () => {
  const payload = buildSelfEquipmentPayload([
    createSyntheticRow(),
    createSyntheticRow({ desc: "SYNTH_STEP_BETA" }),
  ], {
    line: "SYNTH_LINE",
    pathSdwt: "SYNTH_SDWT",
    sdwt: "SYNTH_SDWT",
    priorities: ["D"],
    desc: "ALL",
    eqpCh: "SYNTH_EQP_01.png",
    sensor: "",
    chStep: "",
  })

  assert.equal(payload.filters.desc, "")
  assert.deepEqual(payload.eqpChannels, [])
})

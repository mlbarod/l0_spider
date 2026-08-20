import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  excludeSensorRows,
  isSensorExcluded,
  normalizeSensorExclusionConfig,
  readSensorExclusionConfig,
  resetSensorExclusionConfigCacheForTest,
} from "../../server/sensorExclusionConfig.mjs"

test("App별 contains 규칙을 대소문자 구분 없이 sensor에만 적용한다", () => {
  const config = normalizeSensorExclusionConfig({
    version: 1,
    apps: {
      selfEquipment: { contains: [" temp ", "TEMP"] },
      mailing: { contains: ["virtual"] },
    },
  })
  const sourceRows = [
    { sensor: "TEMP_PRESSURE", desc: "NORMAL" },
    { sensor: "PRESSURE", desc: "TEMP STEP" },
  ]

  assert.deepEqual(config.apps.selfEquipment.contains, ["TEMP"])
  assert.equal(isSensorExcluded("Virtual_Sensor", ["virtual"]), true)
  assert.deepEqual(excludeSensorRows(sourceRows, config, "selfEquipment"), {
    rows: [sourceRows[1]],
    excludedCount: 1,
  })
  assert.deepEqual(excludeSensorRows(sourceRows, config, "commonAnomaly"), {
    rows: sourceRows,
    excludedCount: 0,
  })
})

test("네 이상감지 App과 Mailing 규칙을 서로 독립적으로 적용한다", () => {
  const config = normalizeSensorExclusionConfig({
    version: 1,
    apps: {
      selfEquipment: { contains: ["SELF"] },
      matchingAnomaly: { contains: ["MATCH"] },
      commonAnomaly: { contains: ["COMMON"] },
      commonCommonalityAnomaly: { contains: ["MODEL"] },
      mailing: { contains: ["MAIL"] },
    },
  })
  const rows = ["SELF-1", "MATCH-1", "COMMON-1", "MODEL-1", "MAIL-1"]
    .map((sensor) => ({ sensor }))

  assert.deepEqual(
    excludeSensorRows(rows, config, "selfEquipment").rows.map((row) => row.sensor),
    ["MATCH-1", "COMMON-1", "MODEL-1", "MAIL-1"],
  )
  assert.deepEqual(
    excludeSensorRows(rows, config, "matchingAnomaly").rows.map((row) => row.sensor),
    ["SELF-1", "COMMON-1", "MODEL-1", "MAIL-1"],
  )
  assert.deepEqual(
    excludeSensorRows(rows, config, "commonAnomaly").rows.map((row) => row.sensor),
    ["SELF-1", "MATCH-1", "MODEL-1", "MAIL-1"],
  )
  assert.deepEqual(
    excludeSensorRows(rows, config, "commonCommonalityAnomaly").rows.map((row) => row.sensor),
    ["SELF-1", "MATCH-1", "COMMON-1", "MAIL-1"],
  )
  assert.deepEqual(
    excludeSensorRows(rows, config, "mailing").rows.map((row) => row.sensor),
    ["SELF-1", "MATCH-1", "COMMON-1", "MODEL-1"],
  )
})

test("잘못된 version, App key, 빈 contains 항목을 거부한다", () => {
  assert.throws(
    () => normalizeSensorExclusionConfig({ version: 2, apps: {} }),
    { code: "SENSOR_EXCLUSION_CONFIG_INVALID" },
  )
  assert.throws(
    () => normalizeSensorExclusionConfig({ version: 1, apps: { typo: { contains: [] } } }),
    { code: "SENSOR_EXCLUSION_CONFIG_INVALID" },
  )
  assert.throws(
    () => normalizeSensorExclusionConfig({
      version: 1,
      apps: { selfEquipment: { contains: [" "] } },
    }),
    { code: "SENSOR_EXCLUSION_CONFIG_INVALID" },
  )
})

test("외부 JSON 변경을 다시 읽고 잘못된 변경에는 마지막 정상 설정을 유지한다", async (t) => {
  resetSensorExclusionConfigCacheForTest()
  const directory = await mkdtemp(join(tmpdir(), "l0-sensor-exclusions-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const configPath = join(directory, "sensor-exclusions.json")
  await writeFile(configPath, JSON.stringify({
    version: 1,
    apps: { selfEquipment: { contains: ["TEMP"] } },
  }))
  const first = await readSensorExclusionConfig(configPath)
  assert.deepEqual(first.apps.selfEquipment.contains, ["TEMP"])

  await writeFile(configPath, JSON.stringify({
    version: 1,
    apps: { selfEquipment: { contains: ["PRESSURE"] } },
  }))
  const second = await readSensorExclusionConfig(configPath)
  assert.deepEqual(second.apps.selfEquipment.contains, ["PRESSURE"])

  await writeFile(configPath, "{invalid-json")
  let reloadErrors = 0
  const retained = await readSensorExclusionConfig(configPath, {
    onReloadError: () => { reloadErrors += 1 },
  })
  await readSensorExclusionConfig(configPath, {
    onReloadError: () => { reloadErrors += 1 },
  })
  assert.equal(reloadErrors, 1)
  assert.equal(retained, second)
})

test("설정 경로가 없거나 최초 읽기에 실패하면 빈 규칙을 제공하고 같은 실패 log를 억제한다", async () => {
  resetSensorExclusionConfigCacheForTest()
  const withoutPath = await readSensorExclusionConfig("")
  assert.deepEqual(withoutPath.apps.mailing.contains, [])
  assert.deepEqual(withoutPath.apps.commonCommonalityAnomaly.contains, [])

  let loadErrors = 0
  const unavailable = await readSensorExclusionConfig("/missing/sensor-exclusions.json", {
    onReloadError: () => { loadErrors += 1 },
  })
  await readSensorExclusionConfig("/missing/sensor-exclusions.json", {
    onReloadError: () => { loadErrors += 1 },
  })
  assert.equal(loadErrors, 1)
  assert.deepEqual(unavailable.apps.selfEquipment.contains, [])
})

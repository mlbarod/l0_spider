import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import Ajv2020 from "ajv/dist/2020.js"

import { normalizeSensorExclusionConfig } from "../../server/sensorExclusionConfig.mjs"

const schemaUrl = new URL("../../harness/contracts/sensor-exclusions.schema.json", import.meta.url)
const defaultConfigUrl = new URL("../../config/sensor-exclusions.json", import.meta.url)
const exampleUrl = new URL("../../config/sensor-exclusions.example.json", import.meta.url)
const schema = JSON.parse(await readFile(schemaUrl, "utf8"))
const defaultConfig = JSON.parse(await readFile(defaultConfigUrl, "utf8"))
const example = JSON.parse(await readFile(exampleUrl, "utf8"))
const validate = new Ajv2020({ strict: true }).compile(schema)

test("기본 sensor 제외 설정과 예제가 JSON Schema와 runtime 검증을 통과한다", () => {
  assert.equal(validate(defaultConfig), true, JSON.stringify(validate.errors))
  assert.equal(validate(example), true, JSON.stringify(validate.errors))
  const normalized = normalizeSensorExclusionConfig(example)
  assert.equal(normalized.version, 1)
  assert.deepEqual(normalized.apps.selfEquipment.contains, [])
})

test("오타 App과 빈 contains 항목은 Schema와 runtime에서 거부한다", () => {
  const invalid = {
    version: 1,
    apps: {
      matchingAnomlay: { contains: ["TEMP"] },
      mailing: { contains: [" "] },
    },
  }
  assert.equal(validate(invalid), false)
  assert.throws(
    () => normalizeSensorExclusionConfig(invalid),
    { code: "SENSOR_EXCLUSION_CONFIG_INVALID" },
  )
})

test("공백을 포함해 128자를 넘는 contains 항목을 Schema와 runtime에서 함께 거부한다", () => {
  const invalid = {
    version: 1,
    apps: {
      selfEquipment: { contains: [` ${"A".repeat(127)} `] },
    },
  }
  assert.equal(validate(invalid), false)
  assert.throws(
    () => normalizeSensorExclusionConfig(invalid),
    { code: "SENSOR_EXCLUSION_CONFIG_INVALID" },
  )
})

test("Schema와 runtime은 비-BMP Unicode 길이를 같은 code point 기준으로 처리한다", () => {
  const valid = {
    version: 1,
    apps: { mailing: { contains: ["😀".repeat(128)] } },
  }
  const invalid = {
    version: 1,
    apps: { mailing: { contains: ["😀".repeat(129)] } },
  }

  assert.equal(validate(valid), true, JSON.stringify(validate.errors))
  assert.equal(normalizeSensorExclusionConfig(valid).apps.mailing.contains.length, 1)
  assert.equal(validate(invalid), false)
  assert.throws(
    () => normalizeSensorExclusionConfig(invalid),
    { code: "SENSOR_EXCLUSION_CONFIG_INVALID" },
  )
})

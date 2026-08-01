import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import Ajv2020 from "ajv/dist/2020.js"

import { validateLineMappingPayload } from "../../src/features/fdc-trend/api/mappingContract.mjs"

const testDirectory = dirname(fileURLToPath(import.meta.url))
const schemaPath = resolve(testDirectory, "../../harness/contracts/mapping-config.schema.json")
const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)

const validMapping = {
  line_mapping: { TEAM_A: "LINE_A" },
  sdwt_mapping: { TEAM_A: "SDWT_A" },
}

test("synthetic mapping success payload가 Schema와 runtime 계약을 만족한다", () => {
  assert.equal(validate(validMapping), true, JSON.stringify(validate.errors))
  assert.deepEqual(validateLineMappingPayload(validMapping), validMapping)
})

test("빈 line mapping과 잘못된 value type을 거부한다", () => {
  assert.equal(validate({ line_mapping: {}, sdwt_mapping: {} }), false)
  assert.equal(validate({
    line_mapping: { TEAM_A: 123 },
    sdwt_mapping: {},
  }), false)
  assert.throws(
    () => validateLineMappingPayload({ line_mapping: {}, sdwt_mapping: {} }),
    /line_mapping이 비어 있습니다/,
  )
})

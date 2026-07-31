import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import Ajv2020 from "ajv/dist/2020.js"

import { buildLineDashboardPayload } from "../../server/dashboardData.mjs"

const testDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(testDirectory, "../..")
const schemaPath = resolve(repositoryRoot, "harness/contracts/mailing-summary.schema.json")
const successFixturePath = resolve(
  repositoryRoot,
  "harness/fixtures/mailing/mailing-summary-success.json",
)
const emptyFixturePath = resolve(
  repositoryRoot,
  "harness/fixtures/mailing/mailing-summary-empty.json",
)

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"))
  } catch (error) {
    throw new Error(`${label} JSON 읽기 실패: ${error.message}`)
  }
}

const mailingSchema = readJson(schemaPath, "mailing summary Schema")
const successFixture = readJson(successFixturePath, "mailing summary success fixture")
const emptyFixture = readJson(emptyFixturePath, "mailing summary empty fixture")

function compileMailingSchema() {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  return ajv.compile(mailingSchema)
}

function formatValidationErrors(errors = []) {
  return (errors ?? []).map((error) => [
    `instancePath=${error.instancePath || "/"}`,
    `schemaPath=${error.schemaPath}`,
    `keyword=${error.keyword}`,
    `message=${error.message}`,
  ].join(" | ")).join("\n")
}

function assertSchemaValid(value, label) {
  const validate = compileMailingSchema()
  assert.equal(
    validate(value),
    true,
    `${label} validation 실패:\n${formatValidationErrors(validate.errors)}`,
  )
}

function assertSchemaInvalid(value, label) {
  const validate = compileMailingSchema()
  assert.equal(validate(value), false, `${label} 값이 Schema에 의해 거부되지 않았습니다.`)
  assert.ok(validate.errors?.length, `${label} validation 오류가 없습니다.`)
  return validate.errors
}

const mappingConfig = {
  line_mapping: {
    S1: "TEST_LINE_A",
    S2: "TEST_LINE_B",
  },
  sdwt_mapping: {
    S1: "TEST_SDWT_ALPHA",
    S2: "TEST_SDWT_GAMMA",
  },
}

const datedRows = [
  {
    dateTime: "2000-01-01 08:00:00",
    rows: [
      { sdwt: "S1", desc: "STEP_1", recipe_id: "RECIPE_1", priority: "A", sensor: "SENSOR_1", eqp: "EQP_1" },
      { sdwt: "S1", desc: "STEP_1", recipe_id: "RECIPE_1", priority: "A", sensor: "SENSOR_1", eqp: "EQP_1" },
      { sdwt: "S1", desc: "STEP_1", recipe_id: "RECIPE_2", priority: "A", sensor: "SENSOR_1", eqp: "EQP_1" },
      { sdwt: "S1", desc: "STEP_1", recipe_id: "RECIPE_3", priority: "B", sensor: "SENSOR_1", eqp: "EQP_1" },
      { sdwt: "S2", desc: "STEP_2", recipe_id: "RECIPE_4", priority: "D", sensor: "SENSOR_2", eqp: "EQP_2" },
      { sdwt: "S2", desc: "STEP_2", recipe_id: "RECIPE_5", priority: "X", sensor: "SENSOR_2", eqp: "EQP_2" },
    ],
  },
  {
    dateTime: "2000-01-02 08:00:00",
    rows: [
      { sdwt: "S1", desc: "STEP_1", recipe_id: "RECIPE_1", priority: "A", sensor: "SENSOR_1", eqp: "EQP_1" },
      { sdwt: "S2", desc: "STEP_2", recipe_id: "RECIPE_6", priority: "M", sensor: "SENSOR_2", eqp: "EQP_2" },
      { sdwt: "S2", desc: "STEP_2", recipe_id: "RECIPE_7", priority: "N", sensor: "SENSOR_2", eqp: "EQP_2" },
    ],
  },
]

function buildSyntheticPayload(rows = datedRows) {
  return buildLineDashboardPayload(rows, mappingConfig, {
    startDate: "2000-01-01",
    endDate: "2000-01-02",
    minDate: "2000-01-01",
    maxDate: "2000-01-02",
    defaultStartDate: "2000-01-02",
    defaultEndDate: "2000-01-02",
    monitoringSensorTotal: 0,
    lines: [],
    comparisonDateTime: "",
    comparisonRows: [],
  })
}

test("mailing summary schema compiles", () => {
  assert.doesNotThrow(() => compileMailingSchema())
})

test("mailing summary success and empty fixtures satisfy the schema", () => {
  assertSchemaValid(successFixture, "mailing summary success fixture")
  assertSchemaValid(emptyFixture, "mailing summary empty fixture")
})

test("mailing summary schema rejects invalid root, required, grade, and count values", () => {
  assertSchemaInvalid({}, "object root")

  const missingField = structuredClone(successFixture)
  delete missingField[0].lineId
  assert.ok(assertSchemaInvalid(missingField, "missing lineId").some((error) => (
    error.keyword === "required" && error.params.missingProperty === "lineId"
  )))

  const invalidGrade = structuredClone(successFixture)
  invalidGrade[0].sensorGrade = "A/B"
  assert.ok(assertSchemaInvalid(invalidGrade, "invalid sensorGrade").some((error) => (
    error.keyword === "enum" && error.instancePath === "/0/sensorGrade"
  )))

  const invalidCount = structuredClone(successFixture)
  invalidCount[0].abnormalCount = -1
  assert.ok(assertSchemaInvalid(invalidCount, "negative abnormalCount").some((error) => (
    error.keyword === "minimum" && error.instancePath === "/0/abnormalCount"
  )))
})

test("server producer preserves mailing deduplication, daily accumulation, filtering, and order", () => {
  const mailingSummary = buildSyntheticPayload().mailingSummary

  assert.deepEqual(mailingSummary, [
    { lineId: "TEST_LINE_A", sdwt: "TEST_SDWT_ALPHA", sensorGrade: "A", abnormalCount: 3 },
    { lineId: "TEST_LINE_A", sdwt: "TEST_SDWT_ALPHA", sensorGrade: "B", abnormalCount: 1 },
    { lineId: "TEST_LINE_B", sdwt: "TEST_SDWT_GAMMA", sensorGrade: "D", abnormalCount: 1 },
    { lineId: "TEST_LINE_B", sdwt: "TEST_SDWT_GAMMA", sensorGrade: "M", abnormalCount: 1 },
    { lineId: "TEST_LINE_B", sdwt: "TEST_SDWT_GAMMA", sensorGrade: "N", abnormalCount: 1 },
  ])
  assertSchemaValid(mailingSummary, "server-produced mailing summary")
})

test("server producer returns a schema-valid empty mailing summary", () => {
  const mailingSummary = buildSyntheticPayload([]).mailingSummary
  assert.deepEqual(mailingSummary, [])
  assertSchemaValid(mailingSummary, "empty server-produced mailing summary")
})

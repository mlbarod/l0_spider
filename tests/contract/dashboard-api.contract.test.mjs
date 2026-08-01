import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import Ajv2020 from "ajv/dist/2020.js"
import addFormats from "ajv-formats"

import {
  DASHBOARD_INTEGRITY_ERROR_CODE,
  assertDashboardIntegrity,
} from "../../src/features/fdc-trend/api/dashboardIntegrity.mjs"

const testDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(testDirectory, "../..")
const schemaPath = resolve(repositoryRoot, "harness/contracts/dashboard-api.schema.json")
const successFixturePath = resolve(
  repositoryRoot,
  "harness/fixtures/dashboard/dashboard-success.json",
)
const emptyFixturePath = resolve(
  repositoryRoot,
  "harness/fixtures/dashboard/dashboard-empty.json",
)

function readJson(filePath, label) {
  let source
  try {
    source = readFileSync(filePath, "utf8")
  } catch (error) {
    throw new Error(`${label} 파일 읽기 실패: ${error.message}`)
  }

  try {
    return JSON.parse(source)
  } catch (error) {
    throw new Error(`${label} JSON syntax 오류: ${error.message}`)
  }
}

const dashboardSchema = readJson(schemaPath, "dashboard API Schema")
const successFixture = readJson(successFixturePath, "dashboard success fixture")

function compileDashboardSchema() {
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
  })
  addFormats(ajv)
  return ajv.compile(dashboardSchema)
}

function formatValidationErrors(errors = []) {
  return (errors ?? []).map((error) => [
    `instancePath=${error.instancePath || "/"}`,
    `schemaPath=${error.schemaPath}`,
    `keyword=${error.keyword}`,
    `message=${error.message}`,
    `params=${JSON.stringify(error.params)}`,
  ].join(" | ")).join("\n")
}

function assertSchemaValid(value, label) {
  const validate = compileDashboardSchema()
  const valid = validate(value)
  assert.equal(
    valid,
    true,
    `${label} validation 실패:\n${formatValidationErrors(validate.errors)}`,
  )
}

function assertSchemaInvalid(value, label) {
  const validate = compileDashboardSchema()
  const valid = validate(value)
  const errors = validate.errors?.map((error) => ({ ...error })) ?? []
  assert.equal(valid, false, `${label} 값이 Schema에 의해 거부되지 않았습니다.`)
  assert.ok(errors.length > 0, `${label} validation 오류가 제공되지 않았습니다.`)
  return errors
}

function assertHasValidationError(errors, predicate, label) {
  assert.ok(
    errors.some(predicate),
    `${label} validation 오류가 없습니다:\n${formatValidationErrors(errors)}`,
  )
}

function cloneFixture() {
  return JSON.parse(JSON.stringify(successFixture))
}

test("dashboard API schema compiles", () => {
  assert.doesNotThrow(() => compileDashboardSchema())
})

test("dashboard success fixture satisfies the API schema", () => {
  assertSchemaValid(successFixture, "dashboard success fixture")
})

if (existsSync(emptyFixturePath)) {
  test("dashboard empty fixture satisfies the API schema", () => {
    const emptyFixture = readJson(emptyFixturePath, "dashboard empty fixture")
    assertSchemaValid(emptyFixture, "dashboard empty fixture")
  })
}

test("dashboard schema rejects an invalid root type", () => {
  const errors = assertSchemaInvalid(null, "invalid root")
  assertHasValidationError(
    errors,
    (error) => error.keyword === "type" && error.instancePath === "",
    "invalid root type",
  )
})

test("dashboard schema rejects an invalid core field type", () => {
  const invalidFixture = cloneFixture()
  invalidFixture.lineDashboard.summary.monitoringSensorTotal = "2"

  const errors = assertSchemaInvalid(invalidFixture, "invalid monitoringSensorTotal")
  assertHasValidationError(
    errors,
    (error) => (
      error.keyword === "type"
      && error.instancePath === "/lineDashboard/summary/monitoringSensorTotal"
    ),
    "invalid monitoringSensorTotal type",
  )
})

test("dashboard schema rejects a missing required property", () => {
  const invalidFixture = cloneFixture()
  delete invalidFixture.lineDashboard.summary

  const errors = assertSchemaInvalid(invalidFixture, "missing lineDashboard.summary")
  assertHasValidationError(
    errors,
    (error) => (
      error.keyword === "required"
      && error.instancePath === "/lineDashboard"
      && error.params.missingProperty === "summary"
    ),
    "missing lineDashboard.summary",
  )
})

test("dashboard schema rejects an unexpected property in a closed object", () => {
  const invalidFixture = cloneFixture()
  invalidFixture.lineDashboard.summary.unexpectedContractField = true

  const errors = assertSchemaInvalid(invalidFixture, "unexpected summary property")
  assertHasValidationError(
    errors,
    (error) => (
      error.keyword === "additionalProperties"
      && error.instancePath === "/lineDashboard/summary"
      && error.params.additionalProperty === "unexpectedContractField"
    ),
    "unexpected lineDashboard.summary property",
  )
})

test("dashboard cross-field contract accepts the success and empty fixtures", () => {
  assert.doesNotThrow(() => assertDashboardIntegrity(successFixture.lineDashboard))
  const emptyFixture = readJson(emptyFixturePath, "dashboard empty fixture")
  assert.doesNotThrow(() => assertDashboardIntegrity(emptyFixture.lineDashboard))
})

test("dashboard cross-field contract rejects partial summary/detail data", () => {
  const partialFixture = cloneFixture()
  partialFixture.lineDashboard.lineSummary = []
  partialFixture.lineDashboard.dailyTrend = []
  partialFixture.lineDashboard.mailingSummary = []

  assert.throws(
    () => assertDashboardIntegrity(partialFixture.lineDashboard),
    (error) => error.code === DASHBOARD_INTEGRITY_ERROR_CODE,
  )
})

test("dashboard cross-field contract rejects response Lines outside the request scope", () => {
  const inconsistentFixture = cloneFixture()
  inconsistentFixture.lineDashboard.filters.lines = ["TEST_LINE"]
  inconsistentFixture.lineDashboard.dailyTrend[0].lineId = "OTHER_LINE"

  assert.throws(
    () => assertDashboardIntegrity(
      inconsistentFixture.lineDashboard,
      { lines: ["TEST_LINE"] },
    ),
    (error) => error.code === DASHBOARD_INTEGRITY_ERROR_CODE,
  )
})

test("dashboard cross-field contract rejects a filter echo mismatch", () => {
  assert.throws(
    () => assertDashboardIntegrity(
      successFixture.lineDashboard,
      { startDate: "2000-01-01", endDate: "2000-01-02", lines: [] },
    ),
    (error) => error.code === DASHBOARD_INTEGRITY_ERROR_CODE,
  )
})

test("dashboard cross-field contract rejects an invalid top-Line order", () => {
  const fixture = cloneFixture()
  const lowerCountRow = {
    ...fixture.lineDashboard.lineSummary[0],
    lineId: "LOWER_LINE",
    totalCount: 0,
    latestDateCount: 0,
    abGradeCount: 0,
    ratio: 0,
  }
  fixture.lineDashboard.lineSummary.unshift(lowerCountRow)
  fixture.lineDashboard.dailyTrend.unshift({
    date: "2000-01-02",
    lineId: "LOWER_LINE",
    abnormalCount: 0,
  })

  assert.throws(
    () => assertDashboardIntegrity(fixture.lineDashboard),
    (error) => error.code === DASHBOARD_INTEGRITY_ERROR_CODE,
  )
})

test("mailing count is not treated as the global Dashboard total", () => {
  const fixture = cloneFixture()
  fixture.lineDashboard.mailingSummary[0].abnormalCount = 999
  assert.doesNotThrow(() => assertDashboardIntegrity(fixture.lineDashboard))
})

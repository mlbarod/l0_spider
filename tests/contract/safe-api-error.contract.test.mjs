import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import Ajv2020 from "ajv/dist/2020.js"

import { createSafeApiError } from "../../server/safeApiError.mjs"

const testDirectory = dirname(fileURLToPath(import.meta.url))
const schemaPath = resolve(testDirectory, "../../harness/contracts/safe-api-error.schema.json")
const schema = JSON.parse(readFileSync(schemaPath, "utf8"))
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema)

test("보호 대상 오류 응답은 안전한 오류 계약을 만족한다", () => {
  const payload = createSafeApiError({
    code: "SYNTHETIC_REQUEST_FAILED",
    message: "요청을 처리하지 못했습니다.",
    scope: "contract-test",
    logger: () => {},
  })

  assert.equal(validate(payload), true, JSON.stringify(validate.errors))
})

test("내부 진단정보가 추가된 오류 응답은 계약에서 거부한다", () => {
  const payload = createSafeApiError({
    code: "SYNTHETIC_REQUEST_FAILED",
    message: "요청을 처리하지 못했습니다.",
    scope: "contract-test",
    logger: () => {},
  })

  for (const [key, value] of [
    ["debugRow", { secret: true }],
    ["dbErrorDetail", "internal"],
    ["sourcePath", "/appdata/internal"],
    ["path", "/appdata/internal"],
  ]) {
    assert.equal(validate({ ...payload, [key]: value }), false, `${key}가 허용되었습니다.`)
  }
})

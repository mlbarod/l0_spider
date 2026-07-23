import assert from "node:assert/strict"
import test from "node:test"

import {
  ALL_STEPS,
  createStepUrlToken,
  resolveStepUrlToken,
} from "./selfEquipmentStepToken.mjs"

const SECRET = "test-only-secret"

test("STEP URL 토큰은 원문을 노출하지 않고 같은 비밀키로만 후보를 선택한다", () => {
  const step = "OXIDE ETCH"
  const token = createStepUrlToken(step, SECRET)

  assert.ok(token)
  assert.equal(token.includes(step), false)
  assert.equal(resolveStepUrlToken(token, ["CVD", step], SECRET), step)
  assert.equal(resolveStepUrlToken(token, ["CVD", step], "different-secret"), "")
  assert.equal(resolveStepUrlToken(`${token}x`, [step], SECRET), "")
})

test("STEP ALL은 토큰화하지 않고 그대로 사용한다", () => {
  assert.equal(createStepUrlToken(ALL_STEPS, SECRET), ALL_STEPS)
  assert.equal(resolveStepUrlToken(ALL_STEPS, ["CVD"], SECRET), ALL_STEPS)
})

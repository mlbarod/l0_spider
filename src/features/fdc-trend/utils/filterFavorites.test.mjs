import assert from "node:assert/strict"
import test from "node:test"
import { resolveFavoriteFilters } from "./filterFavorites.mjs"
const mapping = { TEAM_A: "L1", TEAM_B: "L2" }
test("미등록 사용자/삭제된 Line은 기존 기본값을 유지한다", () => {
  assert.equal(resolveFavoriteFilters(null, mapping), null)
  assert.equal(resolveFavoriteFilters({ line: "OLD", sdwt: "TEAM_A" }, mapping), null)
})
test("저장된 Line과 SDWT를 복원하고 삭제되거나 다른 Line의 SDWT는 무시한다", () => {
  assert.deepEqual(resolveFavoriteFilters({ line: "L2", sdwt: "TEAM_B" }, mapping), { line: "L2", sdwt: "TEAM_B" })
  for (const sdwt of [null, "OLD", "TEAM_A"]) {
    assert.deepEqual(resolveFavoriteFilters({ line: "L2", sdwt }, mapping), { line: "L2", sdwt: "" })
  }
})

test("가상 SDWT key는 보존하여 각 App의 기존 선택지 해석에 맡긴다", () => {
  for (const sdwt of ["__MY_EQP__", "__SKIP_LIST__"]) {
    assert.deepEqual(resolveFavoriteFilters({ line: "L1", sdwt }, mapping), { line: "L1", sdwt })
  }
})

test("복수 등록은 등록순으로 유효한 Line·해당 SDWT를 복원하고 0개도 허용한다", () => {
  assert.equal(resolveFavoriteFilters({ lines: [], sdwts: [] }, mapping), null)
  assert.deepEqual(resolveFavoriteFilters({ lines: ["OLD", "L2", "L1"], sdwts: [{ line: "L2", sdwt: "OLD" }, { line: "L2", sdwt: "TEAM_B" }] }, mapping), { line: "L2", sdwt: "TEAM_B" })
  assert.deepEqual(resolveFavoriteFilters({ lines: [], sdwts: [{ line: "L2", sdwt: "TEAM_B" }] }, mapping), { line: "L2", sdwt: "TEAM_B" })
})

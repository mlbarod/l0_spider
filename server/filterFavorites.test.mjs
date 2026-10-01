import assert from "node:assert/strict"
import { Readable } from "node:stream"
import test from "node:test"
import { handleFilterFavoritesRequest } from "./filterFavorites.mjs"

const mappingReader = async () => ({ line_mapping: { TEAM_A: "L1", TEAM_B: "L2" }, sdwt_mapping: { TEAM_A: "A", TEAM_B: "B" } })
function request(method, body = {}, user = "User.One") {
  return Object.assign(Readable.from([typeof body === "string" ? body : JSON.stringify(body)]), {
    method, ssoRequired: true, auth: user ? { knoxId: user } : undefined,
    headers: { "x-knox-id": "forged" },
  })
}
function response() {
  return { writeHead(status, headers) { this.status = status; this.headers = headers }, end(body) { this.body = JSON.parse(body) } }
}
test("즐겨찾기 읽기/저장은 본문이나 헤더가 아닌 로그인 사용자로 격리한다", async () => {
  const users = new Map()
  const helper = async (action, payload) => {
    if (action === "save") users.set(payload.knoxId, { line: payload.line, sdwt: payload.sdwt })
    return { ok: true, favorite: users.get(payload.knoxId) ?? null }
  }
  for (const [user, line, sdwt] of [["User.One", "L1", "TEAM_A"], ["User.Two", "L2", "TEAM_B"]]) {
    const saved = response()
    await handleFilterFavoritesRequest(request("PUT", { field: "sdwt", line, sdwt, knoxId: "forged" }, user), saved, { helper, mappingReader })
    assert.equal(saved.status, 200)
    const read = response()
    await handleFilterFavoritesRequest(request("GET", {}, user), read, { helper })
    assert.deepEqual(read.body.favorite, { line, sdwt })
    assert.equal(read.headers["Cache-Control"], "no-store")
  }
  const res = response()
  await handleFilterFavoritesRequest(request("GET", {}, "new-user"), res, { helper })
  assert.equal(res.body.favorite, null)
  assert.equal(users.has("forged"), false)
})
test("인증 없는 읽기/저장을 DB 접근 전에 차단한다", async () => {
  for (const method of ["GET", "PUT"]) {
    const res = response()
    await handleFilterFavoritesRequest(request(method, "invalid-json", null), res, { helper: () => assert.fail("DB 접근 금지") })
    assert.equal(res.status, 401)
  }
})
test("다른 Line의 SDWT, 미등록 Line, 잘못된 JSON과 과도한 요청을 거부한다", async () => {
  for (const [body, expected] of [
    [{ field: "sdwt", line: "L1", sdwt: "TEAM_B" }, 400],
    [{ field: "line", line: "UNKNOWN" }, 400],
    [{ field: "sdwt", line: "L1", sdwt: "__UNKNOWN__" }, 400],
    [{ field: "other", line: "L1" }, 400],
    ["null", 400], ["bad-json", 400], ["x".repeat(4097), 413],
  ]) {
    const res = response()
    await handleFilterFavoritesRequest(request("PUT", body), res, { mappingReader, helper: () => assert.fail("DB 접근 금지") })
    assert.equal(res.status, expected)
  }
})
test("Line 단독 저장을 허용하고 DB/매핑 실패 시 내부 정보를 노출하지 않는다", async () => {
  const res = response()
  await handleFilterFavoritesRequest(request("PUT", { field: "line", line: "L1", sdwt: "ignored" }), res, {
    mappingReader, helper: async (_action, payload) => {
      assert.equal(payload.sdwt, null)
      return { ok: true, favorite: { line: "L1", sdwt: null } }
    },
  })
  assert.equal(res.status, 200)
  for (const dependencies of [
    { helper: async () => { throw new Error("private driver detail") } },
    { mappingReader: async () => { throw new Error("private mapping path") } },
  ]) {
    const failed = response()
    await handleFilterFavoritesRequest(request("PUT", { field: "line", line: "L1" }), failed, { mappingReader, ...dependencies })
    assert.equal(failed.status, 503)
    assert.equal(JSON.stringify(failed.body).includes("private"), false)
  }
})

test("MY EQP/SKIP LIST도 실제 Line 범위 안에서 저장한다", async () => {
  for (const sdwt of ["__MY_EQP__", "__SKIP_LIST__"]) {
    const res = response()
    await handleFilterFavoritesRequest(request("PUT", { field: "sdwt", line: "L1", sdwt }), res, {
      mappingReader, helper: async (_action, payload) => ({ ok: true, favorite: { line: payload.line, sdwt: payload.sdwt } }),
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.favorite.sdwt, sdwt)
  }
})

test("해제는 사용자·항목을 한정하며 삭제된 기준정보도 해제할 수 있다", async () => {
  const res = response()
  await handleFilterFavoritesRequest(request("PUT", { field: "sdwt", line: "OLD", sdwt: "OLD_TEAM", selected: false, knoxId: "forged" }), res, {
    mappingReader: () => assert.fail("해제에는 기준정보가 필요하지 않음"),
    helper: async (_action, payload) => {
      assert.deepEqual(payload, { knoxId: "User.One", field: "sdwt", line: "OLD", sdwt: "OLD_TEAM", selected: false })
      return { ok: true, favorites: { lines: [], sdwts: [] }, favorite: null }
    },
  })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.favorites, { lines: [], sdwts: [] })
})

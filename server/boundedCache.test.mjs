import assert from "node:assert/strict"
import test from "node:test"

import { getLruEntry, setLruEntry } from "./boundedCache.mjs"

test("LRU 캐시는 상한을 넘으면 가장 오래 사용하지 않은 항목을 제거한다", () => {
  const cache = new Map()
  setLruEntry(cache, "first", 1, 2)
  setLruEntry(cache, "second", 2, 2)
  assert.equal(getLruEntry(cache, "first"), 1)

  setLruEntry(cache, "third", 3, 2)

  assert.equal(cache.has("second"), false)
  assert.deepEqual(Array.from(cache.keys()), ["first", "third"])
})

test("LRU 캐시는 유효하지 않은 상한을 거부한다", () => {
  assert.throws(() => setLruEntry(new Map(), "key", "value", 0), /1 이상의 정수/)
})

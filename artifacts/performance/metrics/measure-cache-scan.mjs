import { writeFile } from "node:fs/promises"

import { getLruEntry, setLruEntry } from "../../../server/boundedCache.mjs"

const outputPath = process.env.PERF_CACHE_OUTPUT
if (!outputPath) throw new Error("PERF_CACHE_OUTPUT is required")

const capacity = 32
const periods = [10, 30, 90, 180]

function scan(cache, itemCount) {
  let hits = 0
  let misses = 0
  for (let index = 0; index < itemCount; index += 1) {
    const key = `day-${String(index + 1).padStart(3, "0")}`
    if (getLruEntry(cache, key)) {
      hits += 1
    } else {
      misses += 1
      setLruEntry(cache, key, { loaded: true }, capacity)
    }
  }
  return { hits, misses, cacheEntries: cache.size }
}

const result = {
  metadata: {
    generatedAt: new Date().toISOString(),
    capacity,
    model: "server/boundedCache.mjs LRU with dashboard chronological scan repeated twice",
    scope: "deterministic cache behavior only; file I/O duration and production file count are not measured",
  },
  periods: {},
}

for (const period of periods) {
  const cache = new Map()
  result.periods[period] = {
    cold: scan(cache, period),
    repeated: scan(cache, period),
  }
}

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
console.log(JSON.stringify({ output: "cache-scan.json", status: "completed" }))

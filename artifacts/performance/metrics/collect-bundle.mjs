import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import { extname, relative, resolve } from "node:path"
import { gzipSync } from "node:zlib"

const buildRoot = process.env.PERF_BUILD_ROOT
const outputPath = process.env.PERF_BUNDLE_OUTPUT
const buildMode = process.env.PERF_BUILD_MODE
if (!buildRoot || !outputPath || !buildMode) {
  throw new Error("PERF_BUILD_ROOT, PERF_BUNDLE_OUTPUT, and PERF_BUILD_MODE are required")
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(path))
    else files.push(path)
  }
  return files
}

const absoluteRoot = resolve(buildRoot)
const files = await listFiles(absoluteRoot)
const details = []
for (const path of files) {
  const buffer = await readFile(path)
  const fileStat = await stat(path)
  details.push({
    path: relative(absoluteRoot, path),
    extension: extname(path) || "(none)",
    bytes: fileStat.size,
    gzipBytes: gzipSync(buffer).length,
  })
}

const indexHtml = await readFile(resolve(absoluteRoot, "index.html"), "utf8")
const initialAssets = Array.from(indexHtml.matchAll(/(?:src|href)="\/?([^"]+)"/g), (match) => match[1])
  .filter((path) => path.startsWith("assets/"))
const initialAssetSet = new Set(initialAssets)
const initialDetails = details.filter((item) => initialAssetSet.has(item.path))

const result = {
  metadata: {
    generatedAt: new Date().toISOString(),
    buildMode,
    dataPolicy: "relative artifact paths and aggregate sizes only",
  },
  summary: {
    fileCount: details.length,
    jsChunkCount: details.filter((item) => item.extension === ".js").length,
    cssChunkCount: details.filter((item) => item.extension === ".css").length,
    totalBytes: details.reduce((sum, item) => sum + item.bytes, 0),
    totalGzipBytes: details.reduce((sum, item) => sum + item.gzipBytes, 0),
    initialAssetCount: initialDetails.length,
    initialBytes: initialDetails.reduce((sum, item) => sum + item.bytes, 0),
    initialGzipBytes: initialDetails.reduce((sum, item) => sum + item.gzipBytes, 0),
  },
  initialAssets: initialDetails.sort((left, right) => right.bytes - left.bytes),
  largestFiles: [...details].sort((left, right) => right.bytes - left.bytes).slice(0, 20),
}

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8")
console.log(JSON.stringify({ output: "bundle-summary.json", status: "completed" }))

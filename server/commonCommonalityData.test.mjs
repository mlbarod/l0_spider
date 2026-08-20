import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  buildCommonCommonalityFilterPayload,
  collectCommonCommonalityRows,
} from "./commonCommonalityData.mjs"
import {
  getLatestCommonCommonalityPath,
  latestCommonCommonalityPathName,
} from "./latestCommonCommonalityPath.mjs"

async function createImage(rootPath, {
  eqpModel,
  grade,
  sensorChStep,
}) {
  const directoryPath = join(rootPath, eqpModel, grade, sensorChStep)
  await mkdir(directoryPath, { recursive: true })
  await writeFile(join(directoryPath, "img.png"), "png")
}

test("공통부 동일성 root의 최신 유효 날짜 디렉터리를 선택한다", async (context) => {
  const rootPath = await mkdtemp(join(tmpdir(), "common-commonality-latest-"))
  context.after(() => rm(rootPath, { recursive: true, force: true }))
  await Promise.all([
    mkdir(join(rootPath, "2026-08-19 23:00:00")),
    mkdir(join(rootPath, "2026-08-20 12:00:00")),
    mkdir(join(rootPath, "temporary")),
  ])

  assert.deepEqual(await getLatestCommonCommonalityPath(rootPath), {
    name: latestCommonCommonalityPathName,
    path: join(rootPath, "2026-08-20 12:00:00"),
    date: "2026-08-20 12:00:00",
  })
})

test("공통부 동일성 경로를 EQP_MODEL, sensor, ch_step 종속 필터로 변환한다", async (context) => {
  const latestRoot = await mkdtemp(join(tmpdir(), "common-commonality-data-"))
  context.after(() => rm(latestRoot, { recursive: true, force: true }))
  const sdwtPath = join(latestRoot, "SDWT-1")
  await Promise.all([
    createImage(sdwtPath, {
      eqpModel: "MODEL-A",
      grade: "A",
      sensorChStep: "PRESSURE_SENSOR@10@001",
    }),
    createImage(sdwtPath, {
      eqpModel: "MODEL-A",
      grade: "B",
      sensorChStep: "PRESSURE_SENSOR@20@001",
    }),
    createImage(sdwtPath, {
      eqpModel: "MODEL-B",
      grade: "D",
      sensorChStep: "TEMP@30@001",
    }),
  ])
  await mkdir(join(sdwtPath, "MODEL-C", "M", "INVALID"), { recursive: true })

  const latest = { name: "공통부 동일성 최신날짜", path: latestRoot, date: "2026-08-20 12:00:00" }
  const rows = await collectCommonCommonalityRows(sdwtPath, latest, "SDWT-1")

  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map((row) => row.eqpModel).sort(), ["MODEL-A", "MODEL-A", "MODEL-B"])
  assert.deepEqual(rows.map((row) => row.chStep).sort(), ["10@001", "20@001", "30@001"])
  assert.ok(rows.every((row) => row.filePath.endsWith("/img.png")))

  const optionsPayload = buildCommonCommonalityFilterPayload(
    { latestPath: latest, folderSdwt: "SDWT-1", rows },
    {
      line: "P1L",
      pathSdwt: "SDWT-1",
      sdwt: "SDWT-1",
      eqpModel: "",
      sensor: "",
      chStep: "",
    },
  )
  assert.deepEqual(optionsPayload.eqpModels, ["MODEL-A", "MODEL-B"])
  assert.deepEqual(optionsPayload.sensors, [])
  assert.deepEqual(optionsPayload.chSteps, [])
  assert.equal(optionsPayload.rows.length, 0)

  const payload = buildCommonCommonalityFilterPayload(
    { latestPath: latest, folderSdwt: "SDWT-1", rows },
    {
      line: "P1L",
      pathSdwt: "SDWT-1",
      sdwt: "SDWT-1",
      eqpModel: "MODEL-A",
      sensor: "PRESSURE_SENSOR",
      chStep: "20@001",
    },
  )
  assert.equal(payload.filters.eqpModel, "MODEL-A")
  assert.deepEqual(payload.sensors, ["PRESSURE_SENSOR"])
  assert.deepEqual(payload.chSteps, ["10@001", "20@001"])
  assert.equal(payload.rows.length, 1)
  assert.equal(payload.rows[0].grade, "B")

  const allSensorsPayload = buildCommonCommonalityFilterPayload(
    { latestPath: latest, folderSdwt: "SDWT-1", rows },
    {
      line: "P1L",
      pathSdwt: "SDWT-1",
      sdwt: "SDWT-1",
      eqpModel: "MODEL-A",
      sensor: "ALL",
      chStep: "ALL",
    },
  )
  assert.equal(allSensorsPayload.filters.sensor, "ALL")
  assert.deepEqual(allSensorsPayload.chSteps, ["ALL"])
  assert.equal(allSensorsPayload.filters.chStep, "ALL")
  assert.equal(allSensorsPayload.rows.length, 2)
})

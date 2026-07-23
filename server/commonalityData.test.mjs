import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  buildCommonalityFilterPayload,
  collectCommonalityRows,
} from "./commonalityData.mjs"

async function createImage(rootPath, {
  grade,
  stepSeq,
  stepDesc,
  ppid,
  duplicatePpid = ppid,
  sensorChStep,
  fileName = "img.png",
}) {
  const directoryPath = join(
    rootPath,
    grade,
    stepSeq,
    stepDesc,
    ppid,
    duplicatePpid,
    sensorChStep,
  )
  await mkdir(directoryPath, { recursive: true })
  await writeFile(join(directoryPath, fileName), "png")
}

test("고정 경로 구조의 img.png를 찾아 sensor와 ch_step 필터 데이터를 생성한다", async (context) => {
  const latestRoot = await mkdtemp(join(tmpdir(), "commonality-data-"))
  context.after(() => rm(latestRoot, { recursive: true, force: true }))
  const sdwtPath = join(latestRoot, "SDWT-1")
  await Promise.all([
    createImage(sdwtPath, {
      grade: "A",
      stepSeq: "100",
      stepDesc: "MAIN ETCH",
      ppid: "PPID-1",
      sensorChStep: "PRESSURE_SENSOR_10@001",
    }),
    createImage(sdwtPath, {
      grade: "B",
      stepSeq: "200",
      stepDesc: "MAIN ETCH",
      ppid: "PPID-2",
      sensorChStep: "PRESSURE_SENSOR_20@001",
    }),
    createImage(sdwtPath, {
      grade: "D",
      stepSeq: "300",
      stepDesc: "IGNORED",
      ppid: "PPID-3",
      duplicatePpid: "OTHER-PPID",
      sensorChStep: "TEMP_30@001",
    }),
    createImage(sdwtPath, {
      grade: "M",
      stepSeq: "400",
      stepDesc: "NO IMAGE",
      ppid: "PPID-4",
      sensorChStep: "TEMP_40@001",
      fileName: "temporary.png",
    }),
  ])
  const latest = { name: "동일성 최신날짜", path: latestRoot, date: "2026-07-16 12:00:00" }
  const rows = await collectCommonalityRows(sdwtPath, latest, "SDWT-1")

  assert.equal(rows.length, 3)
  assert.deepEqual(
    Array.from(new Set(rows.map((row) => row.sensor))).sort(),
    ["PRESSURE_SENSOR", "TEMP"],
  )
  const stepOptionsPayload = buildCommonalityFilterPayload(
    { latestPath: latest, folderSdwt: "SDWT-1", rows },
    {
      line: "P1L",
      pathSdwt: "SDWT-1",
      sdwt: "SDWT-1",
      stepDesc: "",
      sensor: "",
      chStep: "",
    },
  )
  assert.deepEqual(stepOptionsPayload.stepDescs, ["MAIN ETCH", "NO IMAGE"])
  assert.deepEqual(stepOptionsPayload.sensors, [])
  assert.deepEqual(stepOptionsPayload.chSteps, [])
  assert.equal(stepOptionsPayload.rows.length, 0)

  const payload = buildCommonalityFilterPayload(
    { latestPath: latest, folderSdwt: "SDWT-1", rows },
    {
      line: "P1L",
      pathSdwt: "SDWT-1",
      sdwt: "SDWT-1",
      stepDesc: "MAIN ETCH",
      sensor: "PRESSURE_SENSOR",
      chStep: "20@001",
    },
  )
  assert.equal(payload.filters.stepDesc, "MAIN ETCH")
  assert.deepEqual(payload.sensors, ["PRESSURE_SENSOR"])
  assert.deepEqual(payload.chSteps, ["10@001", "20@001"])
  assert.equal(payload.rows.length, 1)
  assert.equal(payload.rows[0].stepDesc, "MAIN ETCH")

  const allPayload = buildCommonalityFilterPayload(
    { latestPath: latest, folderSdwt: "SDWT-1", rows },
    {
      line: "P1L",
      pathSdwt: "SDWT-1",
      sdwt: "SDWT-1",
      stepDesc: "MAIN ETCH",
      sensor: "PRESSURE_SENSOR",
      chStep: "ALL",
    },
  )
  assert.equal(allPayload.filters.chStep, "ALL")
  assert.equal(allPayload.rows.length, 2)

  const allSensorsPayload = buildCommonalityFilterPayload(
    { latestPath: latest, folderSdwt: "SDWT-1", rows },
    {
      line: "P1L",
      pathSdwt: "SDWT-1",
      sdwt: "SDWT-1",
      stepDesc: "MAIN ETCH",
      sensor: "ALL",
      chStep: "ALL",
    },
  )
  assert.equal(allSensorsPayload.filters.sensor, "ALL")
  assert.deepEqual(allSensorsPayload.chSteps, ["ALL"])
  assert.equal(allSensorsPayload.filters.chStep, "ALL")
  assert.equal(allSensorsPayload.rows.length, 2)
  assert.ok(allSensorsPayload.rows.every((row) => row.stepDesc === "MAIN ETCH"))

  const invalidAllSensorsChStepPayload = buildCommonalityFilterPayload(
    { latestPath: latest, folderSdwt: "SDWT-1", rows },
    {
      line: "P1L",
      pathSdwt: "SDWT-1",
      sdwt: "SDWT-1",
      stepDesc: "MAIN ETCH",
      sensor: "ALL",
      chStep: "10@001",
    },
  )
  assert.deepEqual(invalidAllSensorsChStepPayload.chSteps, ["ALL"])
  assert.equal(invalidAllSensorsChStepPayload.filters.chStep, "")
  assert.equal(invalidAllSensorsChStepPayload.rows.length, 0)
})

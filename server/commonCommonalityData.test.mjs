import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import test from "node:test"

import { SPIDER_DATA_PATH_TEMPLATES } from "../src/config/spiderDataPaths.mjs"
import {
  buildCommonCommonalityFilterPayload,
  collectCommonCommonalityRows,
  handleCommonCommonalityDataRequest,
} from "./commonCommonalityData.mjs"
import {
  getLatestCommonCommonalityPath,
  latestCommonCommonalityPathName,
  resolveCommonCommonalityRootPath,
} from "./latestCommonCommonalityPath.mjs"

test("공통부 동일성 root는 전용 override와 기존 데이터 root의 형제 경로를 따른다", () => {
  assert.equal(
    resolveCommonCommonalityRootPath({
      explicitRoot: "/mounted/custom/common-commonality",
      commonalityRoot: "/mounted/pic/erd_commonality",
      dashboardRoot: "/other/pic/path",
    }),
    "/mounted/custom/common-commonality",
  )
  assert.equal(
    resolveCommonCommonalityRootPath({
      explicitRoot: "",
      commonalityRoot: "/mounted/pic/erd_commonality",
      dashboardRoot: "/other/pic/path",
    }),
    "/mounted/pic/path_common_commonality",
  )
  assert.equal(
    resolveCommonCommonalityRootPath({
      explicitRoot: "",
      commonalityRoot: "",
      dashboardRoot: "/dashboard-mount/pic/path",
    }),
    "/dashboard-mount/pic/path_common_commonality",
  )
  assert.equal(
    resolveCommonCommonalityRootPath({
      explicitRoot: "",
      commonalityRoot: "",
      dashboardRoot: "",
    }),
    resolve(SPIDER_DATA_PATH_TEMPLATES.commonCommonalityRoot),
  )
})

function createResponseRecorder() {
  return {
    statusCode: 0,
    body: "",
    writeHead(statusCode) {
      this.statusCode = statusCode
    },
    end(body = "") {
      this.body = String(body)
    },
  }
}

async function requestCommonCommonalityData(rootPath, pathSdwt = "SDWT-1") {
  const response = createResponseRecorder()
  const url = new URL("http://localhost/api/common-commonality-data")
  url.searchParams.set("line", "P1L")
  url.searchParams.set("pathSdwt", pathSdwt)
  url.searchParams.set("sdwt", pathSdwt)
  await handleCommonCommonalityDataRequest(
    { method: "GET" },
    response,
    url,
    { rootPath },
  )
  return { response, payload: JSON.parse(response.body) }
}

async function createImage(rootPath, {
  eqpModel,
  grade,
  sensorChStep,
}) {
  const directoryPath = join(rootPath, eqpModel, grade, sensorChStep)
  await mkdir(directoryPath, { recursive: true })
  await writeFile(join(directoryPath, "img.png"), "png")
}

test("각 root precedence에서 handler가 EQP_MODEL 선택지를 반환한다", async (context) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "common-commonality-roots-"))
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }))

  const rootCases = [
    {
      options: {
        explicitRoot: join(fixtureRoot, "explicit"),
        commonalityRoot: join(fixtureRoot, "matching", "erd_commonality"),
        dashboardRoot: join(fixtureRoot, "dashboard", "path"),
      },
      expectedRoot: join(fixtureRoot, "explicit"),
    },
    {
      options: {
        explicitRoot: "",
        commonalityRoot: join(fixtureRoot, "matching", "erd_commonality"),
        dashboardRoot: join(fixtureRoot, "dashboard", "path"),
      },
      expectedRoot: join(fixtureRoot, "matching", "path_common_commonality"),
    },
    {
      options: {
        explicitRoot: "",
        commonalityRoot: "",
        dashboardRoot: join(fixtureRoot, "dashboard", "path"),
      },
      expectedRoot: join(fixtureRoot, "dashboard", "path_common_commonality"),
    },
  ]

  for (const [index, rootCase] of rootCases.entries()) {
    const resolvedRoot = resolveCommonCommonalityRootPath(rootCase.options)
    assert.equal(resolvedRoot, rootCase.expectedRoot)
    const sdwtPath = join(resolvedRoot, "2026-08-20 12:00:00", "SDWT-1")
    await createImage(sdwtPath, {
      eqpModel: `MODEL-${index + 1}`,
      grade: "A",
      sensorChStep: "PRESSURE@10",
    })

    const { response, payload } = await requestCommonCommonalityData(resolvedRoot)
    assert.equal(response.statusCode, 200)
    assert.deepEqual(payload.eqpModels, [`MODEL-${index + 1}`])
    assert.equal(payload.counts.indexedImages, 1)
  }
})

test("최신날짜 없음과 선택 SDWT 없음 404를 구분한다", async (context) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "common-commonality-errors-"))
  context.after(() => rm(fixtureRoot, { recursive: true, force: true }))

  const noLatestRoot = join(fixtureRoot, "no-latest")
  await mkdir(noLatestRoot)
  const noLatest = await requestCommonCommonalityData(noLatestRoot)
  assert.equal(noLatest.response.statusCode, 404)
  assert.equal(noLatest.payload.code, "COMMON_COMMONALITY_LATEST_DATE_NOT_FOUND")
  assert.equal(noLatest.payload.error, "공통부 동일성 최신날짜 폴더를 찾지 못했습니다.")

  const noSdwtRoot = join(fixtureRoot, "no-sdwt")
  await mkdir(join(noSdwtRoot, "2026-08-20 12:00:00"), { recursive: true })
  const noSdwt = await requestCommonCommonalityData(noSdwtRoot, "SDWT-MISSING")
  assert.equal(noSdwt.response.statusCode, 404)
  assert.equal(noSdwt.payload.code, "COMMON_COMMONALITY_SDWT_NOT_FOUND")
  assert.equal(noSdwt.payload.error, "선택한 SDWT의 공통부 동일성 폴더를 찾지 못했습니다.")
})

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

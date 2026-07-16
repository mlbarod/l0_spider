import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  getLatestCommonalityPath,
  latestCommonalityPathName,
} from "./latestCommonalityPath.mjs"

test("직하위의 유효한 날짜 디렉터리 중 최신 폴더를 반환한다", async (context) => {
  const rootPath = await mkdtemp(join(tmpdir(), "commonality-latest-"))
  context.after(() => rm(rootPath, { recursive: true, force: true }))

  await Promise.all([
    mkdir(join(rootPath, "2026-07-16 08:30:00")),
    mkdir(join(rootPath, "2026-07-16 12:45:30")),
    mkdir(join(rootPath, "2026-07-16")),
    mkdir(join(rootPath, "2026-02-30 12:00:00")),
    mkdir(join(rootPath, "2026-07-16 25:00:00")),
    mkdir(join(rootPath, "temporary")),
    writeFile(join(rootPath, "2026-07-20 12:00:00"), "일반 파일"),
  ])
  await mkdir(join(rootPath, "temporary", "2026-12-31 23:59:59"))

  assert.deepEqual(await getLatestCommonalityPath(`${rootPath}/`), {
    name: latestCommonalityPathName,
    path: join(rootPath, "2026-07-16 12:45:30"),
    date: "2026-07-16 12:45:30",
  })
})

test("유효한 날짜 디렉터리가 없으면 명확한 오류를 반환한다", async (context) => {
  const rootPath = await mkdtemp(join(tmpdir(), "commonality-empty-"))
  context.after(() => rm(rootPath, { recursive: true, force: true }))

  await mkdir(join(rootPath, "2026-02-30 12:00:00"))
  await mkdir(join(rootPath, "2026-07-16"))
  await writeFile(join(rootPath, "2026-07-16 12:00:00"), "디렉터리가 아닌 파일")

  await assert.rejects(
    getLatestCommonalityPath(rootPath),
    (error) => (
      error.code === "COMMONALITY_DATE_DIRECTORY_NOT_FOUND"
      && error.message.includes("YYYY-MM-DD hh:mm:ss 형식의 디렉터리가 없습니다")
    ),
  )
})

import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { loadServerEnv } from "./loadEnv.mjs"

test("공지 환경 파일을 로드하되 기존 프로세스 환경변수를 우선한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "l0-spider-env-"))
  const envPath = join(directory, ".env")
  const previousLoadedValue = process.env.L0_SPIDER_ENV_FILE_TEST
  const previousExistingValue = process.env.L0_SPIDER_ENV_PRIORITY_TEST
  const previousEmptyValue = process.env.L0_SPIDER_ENV_EMPTY_TEST

  try {
    delete process.env.L0_SPIDER_ENV_FILE_TEST
    process.env.L0_SPIDER_ENV_PRIORITY_TEST = "from-process"
    process.env.L0_SPIDER_ENV_EMPTY_TEST = ""
    await writeFile(envPath, [
      "L0_SPIDER_ENV_FILE_TEST=from-file",
      "L0_SPIDER_ENV_PRIORITY_TEST=from-file",
      "L0_SPIDER_ENV_EMPTY_TEST=from-file",
    ].join("\n"), "utf8")

    assert.equal(loadServerEnv(envPath), true)
    assert.equal(process.env.L0_SPIDER_ENV_FILE_TEST, "from-file")
    assert.equal(process.env.L0_SPIDER_ENV_PRIORITY_TEST, "from-process")
    assert.equal(process.env.L0_SPIDER_ENV_EMPTY_TEST, "from-file")
  } finally {
    if (previousLoadedValue === undefined) delete process.env.L0_SPIDER_ENV_FILE_TEST
    else process.env.L0_SPIDER_ENV_FILE_TEST = previousLoadedValue
    if (previousExistingValue === undefined) delete process.env.L0_SPIDER_ENV_PRIORITY_TEST
    else process.env.L0_SPIDER_ENV_PRIORITY_TEST = previousExistingValue
    if (previousEmptyValue === undefined) delete process.env.L0_SPIDER_ENV_EMPTY_TEST
    else process.env.L0_SPIDER_ENV_EMPTY_TEST = previousEmptyValue
    await rm(directory, { recursive: true })
  }
})

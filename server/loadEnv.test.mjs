import assert from "node:assert/strict"
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import { loadServerEnv, readServerEnv } from "./loadEnv.mjs"

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
    assert.equal(readServerEnv(envPath).values.L0_SPIDER_ENV_FILE_TEST, "from-file")
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

test("서버 시작 시 .env.mail을 읽고 기존 환경변수·공지 파일의 우선순위를 유지한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "l0-spider-mail-env-"))
  try {
    await mkdir(join(directory, "server"))
    const loaderPath = join(directory, "server", "loadEnv.mjs")
    await copyFile(new URL("./loadEnv.mjs", import.meta.url), loaderPath)
    await writeFile(join(directory, "notices.env"), "L0_ENV_NOTICE_PRIORITY=notice\n")
    await writeFile(join(directory, ".env.mail"), "KNOX_MAIL_TOKEN=synthetic-file-token\nL0_ENV_NOTICE_PRIORITY=mail\n")
    const scriptPath = join(directory, "check.mjs")
    await writeFile(scriptPath, `
      import './server/loadEnv.mjs'
      import assert from 'node:assert/strict'
      assert.equal(process.env.KNOX_MAIL_TOKEN, process.env.EXPECTED_TOKEN)
      assert.equal(process.env.L0_ENV_NOTICE_PRIORITY, 'notice')
    `)
    for (const token of ["", "synthetic-process-token"]) {
      execFileSync(process.execPath, [scriptPath], {
        cwd: tmpdir(),
        env: { KNOX_MAIL_TOKEN: token, EXPECTED_TOKEN: token || "synthetic-file-token" },
        stdio: "pipe",
      })
    }
    await rm(join(directory, ".env.mail"))
    execFileSync(process.execPath, [loaderPath], { env: {}, stdio: "pipe" })
  } finally {
    await rm(directory, { recursive: true })
  }
})

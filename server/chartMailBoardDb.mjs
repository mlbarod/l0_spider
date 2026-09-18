import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"

const helperPath = fileURLToPath(new URL("../scripts/chart_mail_board.py", import.meta.url))
const inputCodes = new Set(["BOARD_NOT_FOUND", "BOARD_INVALID", "BOARD_CONFLICT", "MAIL_REQUEST_CONFLICT"])

export function runChartMailBoardHelper(action, payload, { execute = execFile } = {}) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(Object.assign(new Error("게시판 DB 요청을 처리하지 못했습니다."), { code: "BOARD_STORAGE_ERROR" }))
    const child = execute("python3", ["-B", helperPath, action], {
      env: process.env, timeout: 20_000, maxBuffer: 8 * 1024 * 1024,
    }, (error, stdout) => {
      if (error) return fail()
      let result
      try { result = JSON.parse(stdout) } catch { return fail() }
      if (result?.ok !== true) {
        if (inputCodes.has(result?.code)) return reject(Object.assign(new Error("게시판 요청을 확인해 주세요."), { code: result.code }))
        return fail()
      }
      resolve(result)
    })
    child.stdin.on("error", fail)
    child.stdin.end(JSON.stringify(payload))
  })
}

export function createChartMailBoardDb({ run = runChartMailBoardHelper } = {}) {
  return {
    begin: (payload) => run("begin", payload),
    finish: (payload) => run("finish", payload),
    list: (actor, filters) => run("list", { ...filters, actor }),
    detail: (actor, id) => run("detail", { actor, id }),
    image: (actor, id) => run("image", { actor, id }),
    status: (actor, id, payload) => run("status", { ...payload, actor, id }),
  }
}

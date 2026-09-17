import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"

const helperPath = fileURLToPath(new URL("../scripts/mail_recipient_groups.py", import.meta.url))
const inputErrors = Object.freeze({
  INVALID_GROUP: "그룹 내용을 확인해 주세요.",
  GROUP_NOT_FOUND: "수정할 그룹을 찾을 수 없습니다.",
  DELETE_NOT_FOUND: "삭제할 그룹을 찾을 수 없습니다.",
  DUPLICATE_GROUP: "같은 이름의 그룹이 있습니다.",
  GROUP_LIMIT: "개인 수신인 그룹은 최대 50개까지 저장할 수 있습니다.",
})

export function runMailRecipientGroupsHelper(action, payload, { execute = execFile } = {}) {
  return new Promise((resolve, reject) => {
    const failure = () => reject(new Error("수신인 그룹 DB 요청을 처리하지 못했습니다."))
    const child = execute("python3", ["-B", helperPath, action], {
      env: process.env, timeout: 15_000, maxBuffer: 2 * 1024 * 1024,
    }, (error, stdout) => {
      if (error) return failure()
      let result
      try { result = JSON.parse(stdout) } catch { return failure() }
      if (result?.ok !== true) {
        const message = Object.hasOwn(inputErrors, result?.code) ? inputErrors[result.code] : null
        if (message) return reject(new TypeError(message))
        return failure()
      }
      resolve(result)
    })
    // A missing interpreter or an early process exit can close stdin first.
    child.stdin.on("error", failure)
    child.stdin.end(JSON.stringify(payload))
  })
}

export function createMailRecipientGroupDbStore({ run = runMailRecipientGroupsHelper } = {}) {
  return {
    async list(owner) { return (await run("list", { owner })).groups },
    async save(owner, input) {
      return (await run("save", {
        ...input, owner, nameKey: input.name.toLowerCase(),
      })).group
    },
    async remove(owner, id) { await run("delete", { owner, id }) },
  }
}

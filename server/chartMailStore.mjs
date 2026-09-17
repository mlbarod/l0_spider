import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { safeMailDiagnostics } from "./chartMailDiagnostics.mjs"

const defaultPath = fileURLToPath(new URL("../.local/chart-mail-requests.json", import.meta.url))
const retentionMs = 7 * 24 * 60 * 60 * 1000
const hashPattern = /^[a-f0-9]{64}$/

// 단일 Node 프로세스용 저장소. 본문·주소·인증정보는 저장하지 않는다.
export function createChartMailStore({ filePath = process.env.CHART_MAIL_REQUESTS_PATH || defaultPath, now = Date.now } = {}) {
  const path = resolve(filePath)
  function read() {
    let data
    try { data = JSON.parse(readFileSync(path, "utf8")) } catch (error) {
      if (error.code === "ENOENT") return []
      throw new Error("메일 요청 기록을 읽지 못했습니다.")
    }
    if (data?.version !== 1 || !Array.isArray(data.requests) || data.requests.some((row) =>
      !row || !hashPattern.test(row.key) || !hashPattern.test(row.fingerprint)
      || !["pending", "accepted", "unknown", "rejected"].includes(row.state)
      || !Number.isFinite(row.createdAt))) throw new Error("메일 요청 기록을 확인해 주세요.")
    return data.requests.filter((row) => now() - row.createdAt < retentionMs)
  }
  function write(requests) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${randomUUID()}.tmp`
    try {
      writeFileSync(temporary, JSON.stringify({ version: 1, requests }) + "\n", { mode: 0o600, flag: "wx" })
      renameSync(temporary, path)
    } finally {
      try { unlinkSync(temporary) } catch { /* rename 후에는 임시 파일이 없다. */ }
    }
  }
  return {
    claim(key, fingerprint, diagnostics) {
      const rows = read()
      const existing = rows.find((row) => row.key === key)
      if (existing) return existing
      if (rows.length >= 10000) throw new Error("메일 요청 기록의 용량을 확인해 주세요.")
      write([...rows, { key, fingerprint, state: "pending", createdAt: now(), diagnostics: safeMailDiagnostics(diagnostics) }])
      return null
    },
    finish(key, state, diagnostics) {
      const rows = read()
      const row = rows.find((item) => item.key === key)
      if (!row) throw new Error("메일 요청 기록을 찾지 못했습니다.")
      row.state = state
      row.diagnostics = safeMailDiagnostics(diagnostics)
      write(rows)
    },
  }
}

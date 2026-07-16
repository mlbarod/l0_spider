import { readdir } from "node:fs/promises"
import { join, resolve } from "node:path"

import {
  SPIDER_DATA_PATH_NAMES,
  SPIDER_DATA_PATH_TEMPLATES,
} from "../src/config/spiderDataPaths.mjs"

export const commonalityRootPath = process.env.COMMONALITY_ROOT_PATH
  ?? SPIDER_DATA_PATH_TEMPLATES.commonalityRoot
export const latestCommonalityPathName = SPIDER_DATA_PATH_NAMES.latestCommonality

const DATE_DIRECTORY_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

function isValidDateDirectoryName(name) {
  const match = String(name ?? "").match(DATE_DIRECTORY_PATTERN)
  if (!match) return false

  const [, year, month, day, hour, minute, second] = match
  const date = new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ))
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day)
    && date.getUTCHours() === Number(hour)
    && date.getUTCMinutes() === Number(minute)
    && date.getUTCSeconds() === Number(second)
}

export async function getLatestCommonalityPath(rootPath = commonalityRootPath) {
  const normalizedRootPath = resolve(rootPath)
  const entries = await readdir(normalizedRootPath, { withFileTypes: true })
  const latestDate = entries
    .filter((entry) => entry.isDirectory() && isValidDateDirectoryName(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left))[0]

  if (!latestDate) {
    const error = new Error(
      `동일성 최신날짜를 찾지 못했습니다: ${normalizedRootPath} 바로 아래에 YYYY-MM-DD hh:mm:ss 형식의 디렉터리가 없습니다.`,
    )
    error.code = "COMMONALITY_DATE_DIRECTORY_NOT_FOUND"
    throw error
  }

  return {
    name: latestCommonalityPathName,
    path: join(normalizedRootPath, latestDate),
    date: latestDate,
  }
}

export async function handleLatestCommonalityPathRequest(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, {
      Allow: "GET, HEAD",
      "Content-Type": "application/json; charset=utf-8",
    })
    res.end(JSON.stringify({ ok: false, error: "Method not allowed" }))
    return
  }

  try {
    const payload = await getLatestCommonalityPath()
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    })
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(payload))
  } catch (error) {
    const statusCode = error.code === "COMMONALITY_DATE_DIRECTORY_NOT_FOUND" ? 404 : 500
    res.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    })
    res.end(req.method === "HEAD" ? undefined : JSON.stringify({
      ok: false,
      name: latestCommonalityPathName,
      error: error.code === "COMMONALITY_DATE_DIRECTORY_NOT_FOUND"
        ? error.message
        : `동일성 최신날짜 경로를 확인하지 못했습니다: ${error.message}`,
    }))
  }
}

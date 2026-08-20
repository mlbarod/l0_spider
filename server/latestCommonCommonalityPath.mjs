import { dirname, join, resolve } from "node:path"

import {
  SPIDER_DATA_PATH_NAMES,
  SPIDER_DATA_PATH_TEMPLATES,
} from "../src/config/spiderDataPaths.mjs"
import { getLatestCommonalityPath } from "./latestCommonalityPath.mjs"

function normalizeRootPath(value) {
  const normalized = String(value ?? "").trim()
  return normalized ? resolve(normalized) : ""
}

export function resolveCommonCommonalityRootPath({
  explicitRoot = process.env.COMMON_COMMONALITY_ROOT_PATH,
  commonalityRoot = process.env.COMMONALITY_ROOT_PATH,
  dashboardRoot = process.env.SPIDER_DASHBOARD_PATH_ROOT,
} = {}) {
  const normalizedExplicitRoot = normalizeRootPath(explicitRoot)
  if (normalizedExplicitRoot) return normalizedExplicitRoot

  const siblingSourceRoot = normalizeRootPath(commonalityRoot)
    || normalizeRootPath(dashboardRoot)
  if (siblingSourceRoot) {
    return join(dirname(siblingSourceRoot), "path_common_commonality")
  }

  return resolve(SPIDER_DATA_PATH_TEMPLATES.commonCommonalityRoot)
}

export const commonCommonalityRootPath = resolveCommonCommonalityRootPath()
export const latestCommonCommonalityPathName = SPIDER_DATA_PATH_NAMES.latestCommonCommonality

export async function getLatestCommonCommonalityPath(rootPath = commonCommonalityRootPath) {
  const latestPath = await getLatestCommonalityPath(rootPath)
  return {
    ...latestPath,
    name: latestCommonCommonalityPathName,
  }
}

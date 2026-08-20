import {
  SPIDER_DATA_PATH_NAMES,
  SPIDER_DATA_PATH_TEMPLATES,
} from "../src/config/spiderDataPaths.mjs"
import { getLatestCommonalityPath } from "./latestCommonalityPath.mjs"

export const commonCommonalityRootPath = SPIDER_DATA_PATH_TEMPLATES.commonCommonalityRoot
export const latestCommonCommonalityPathName = SPIDER_DATA_PATH_NAMES.latestCommonCommonality

export async function getLatestCommonCommonalityPath(rootPath = commonCommonalityRootPath) {
  const latestPath = await getLatestCommonalityPath(rootPath)
  return {
    ...latestPath,
    name: latestCommonCommonalityPathName,
  }
}

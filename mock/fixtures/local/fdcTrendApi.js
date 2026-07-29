import {
  FDC_LINES,
  SPIDER_FILE_PATHS,
  getHardSpecRows,
} from "./fdcTrendMockData.js"

const STEP_OPTIONS = ["U%10000", "U%20000"]

export async function fetchHardSpecMeta({ stepSeq, recipeId } = {}) {
  return {
    lineIds: FDC_LINES,
    stepSeq: stepSeq || STEP_OPTIONS[0],
    recipeId: recipeId || "RECIPE_TEST_001",
    stepSeqs: STEP_OPTIONS,
    recipeIds: ["RECIPE_TEST_001"],
    fdcModels: ["SENSOR_FLOW_001", "SENSOR_PRESSURE_001"],
    sourcePaths: {
      hardSpecRoot: SPIDER_FILE_PATHS.hardSpecRoot,
      priority: SPIDER_FILE_PATHS.priority,
      unitModel: SPIDER_FILE_PATHS.unitModel,
      hardLimit: SPIDER_FILE_PATHS.hardLimit,
    },
    warnings: [],
  }
}

export async function fetchHardSpecRecommendations() {
  const rows = getHardSpecRows().map((row, rowIndex) => ({
    ...row,
    points: Array.from({ length: 28 }, (_, index) => ({
      index: index + 1,
      param_value: 45 + rowIndex + index * 0.25,
    })),
  }))
  return {
    rows,
    sourcePaths: rows.map((row) => row.source_path),
    warnings: [],
  }
}

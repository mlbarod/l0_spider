import { FDC_LINES, SPIDER_FILE_PATHS, getHardSpecRows } from "../utils/fdcTrendMockData"

const DEFAULT_STEP_SEQS = ["CR380250", "CR580250", "CR590180", "CR610200"]
const DEFAULT_RECIPE_IDS = ["RCP-4100", "RCP-4170", "RCP-4240", "RCP-4310"]
const DEFAULT_FDC_MODELS = [
  "ESC Voltage",
  "RF Forward Power",
  "Chamber Pressure",
  "He Backside Flow",
]

function buildHardSpecPoints(rowIndex) {
  return Array.from({ length: 28 }, (_, index) => {
    const drift = index * 0.32
    const wave = Math.sin((index + rowIndex) / 2.6) * 2.4
    return {
      index: index + 1,
      param_value: Number((rowIndex * 1.7 + 48 + drift + wave).toFixed(2)),
    }
  })
}

function withHardSpecPoints(rows) {
  return rows.map((row, index) => ({
    ...row,
    points: row.points ?? buildHardSpecPoints(index),
  }))
}

export async function fetchHardSpecMeta({ lineId, stepSeq, recipeId } = {}) {
  return {
    lineIds: FDC_LINES,
    stepSeq: stepSeq || DEFAULT_STEP_SEQS[0],
    recipeId: recipeId || DEFAULT_RECIPE_IDS[0],
    stepSeqs: DEFAULT_STEP_SEQS,
    recipeIds: DEFAULT_RECIPE_IDS,
    fdcModels: DEFAULT_FDC_MODELS,
    sourcePaths: {
      hardSpecRoot: SPIDER_FILE_PATHS.hardSpecRoot,
      priority: SPIDER_FILE_PATHS.priority,
      unitModel: SPIDER_FILE_PATHS.unitModel,
      hardLimit: SPIDER_FILE_PATHS.hardLimit,
    },
    warnings: lineId ? [] : [],
  }
}

export async function fetchHardSpecRecommendations() {
  const rows = withHardSpecPoints(getHardSpecRows())
  return {
    rows,
    sourcePaths: rows.map((row) => row.source_path).filter(Boolean),
    warnings: [],
  }
}

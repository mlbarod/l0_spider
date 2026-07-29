export const FDC_LINES = Object.freeze(["LINE_A", "LINE_B", "LINE_C"])

export const SPIDER_LINE_REV = Object.freeze({
  PRODUCT_001: "LINE_A",
  PRODUCT_002: "LINE_B",
})

export const SENSOR_GRADES = Object.freeze(["A/B", "D", "N", "M"])

export const SPIDER_FILE_PATHS = Object.freeze({
  latestPath: "fixture://normal/latest",
  latestStats: "fixture://normal/stats",
  latestStatsExceptV: "fixture://normal/stats-except-v",
  teamErdPath: "fixture://normal/team-erd",
  mappingConfig: "fixture://normal/mapping",
  erdRoot: "fixture://normal/erd",
  commonDate: "fixture://normal/common-date",
  commonalityRoot: "fixture://normal/commonality",
  hardSpecRoot: "fixture://normal/hard-spec",
  priority: "fixture://normal/priority",
  unitModel: "fixture://normal/unit-model",
  hardLimit: "fixture://normal/hard-limit",
  yieldRoot: "fixture://normal/yield",
  yieldImage: "fixture://normal/yield-image",
})

const productsByLine = Object.freeze({
  LINE_A: ["PRODUCT_001"],
  LINE_B: ["PRODUCT_002"],
  LINE_C: ["PRODUCT_001"],
})

function points(offset = 0) {
  return Array.from({ length: 12 }, (_, index) => ({
    wafer: `WAFER_TEST_${String(index + 1).padStart(3, "0")}`,
    value: 40 + offset + index * 0.5,
    limit: 48,
  }))
}

export function getTeamsByLine(lineId) {
  return productsByLine[lineId] ?? []
}

export function getTrendSteps() {
  return ["U%10000", "U%20000"]
}

export function getSeverityLabel(severity) {
  return String(severity ?? "")
}

export function getSpiderSummaryRows() {
  const lineRows = FDC_LINES.map((line_id, index) => ({
    line_id,
    "A등급": 2 + index,
    "B등급": 1 + index,
    "D등급": index,
    "M등급": 1,
    "N등급": 1,
    OK: 100 + index * 10,
    NG: 5 + index,
    "NG비율": Number(((5 + index) / (105 + index * 11)).toFixed(4)),
  }))
  const sdwtRows = ["PRODUCT_001", "PRODUCT_002"].map((sdwt, index) => ({
    sdwt,
    "A등급": 2 + index,
    "B등급": 1,
    "D등급": index,
    "M등급": 1,
    "N등급": 1,
    OK: 80 + index * 10,
    NG: 4 + index,
    "NG비율": Number(((4 + index) / (84 + index * 11)).toFixed(4)),
  }))
  return { lineRows, sdwtRows }
}

export function getSpiderAnomalyRows() {
  return FDC_LINES.flatMap((line_id, lineIndex) => (
    getTeamsByLine(line_id).map((sdwt, index) => ({
      id: `SYNTHETIC_ANOMALY_${lineIndex}_${index}`,
      line_id,
      sdwt,
      grade: ["A", "B", "D"][lineIndex % 3],
      desc: "U%10000",
      sensor: "SENSOR_FLOW_001",
      eqp: "EQP_TEST_001",
      abnormalCount: 3 + lineIndex,
      file_path: `fixture://normal/anomaly/${lineIndex}/${index}`,
      points: points(lineIndex),
    }))
  ))
}

export function getSpiderCommonalityRows() {
  return getSpiderAnomalyRows().map((row, index) => ({
    ...row,
    id: `SYNTHETIC_COMMON_${index}`,
    priority: row.grade,
    step_seq: "U%10000",
    step_desc: "U%10000",
    ch_step: "U%10000",
    file_path: `fixture://normal/commonality/${index}`,
  }))
}

export function getHardSpecRows() {
  return ["SENSOR_FLOW_001", "SENSOR_PRESSURE_001"].map((sensor_name, index) => ({
    id: `HARD_SPEC_TEST_${index + 1}`,
    priority: index ? "B" : "A",
    sensor_name,
    ch_step: index ? "U%20000" : "U%10000",
    "추천Spec(Lower)": 40 + index,
    "추천Spec(Upper)": 60 + index,
    "기존Spec(Lower)": 38 + index,
    "기존Spec(Upper)": 62 + index,
    "Spec격차": 4,
    source_path: `fixture://normal/hard-spec/${index + 1}`,
  }))
}

export function getYieldSpecRows(stepSeq = "U%10000") {
  return ["SENSOR_FLOW_001", "SENSOR_PRESSURE_001"].map((fdc_parameter, index) => ({
    id: `YIELD_SPEC_TEST_${index + 1}`,
    step_seq: stepSeq,
    recipe_id: "RECIPE_TEST_001",
    fdc_parameter,
    g_min: 40 + index,
    g_max: 55 + index,
    b_min: 35 + index,
    b_max: 65 + index,
  }))
}

export function getRecipientRows() {
  return [{
    id: "RECIPIENT_TEST_001",
    email: "USER_TEST_001",
    sdwt: JSON.stringify(["PRODUCT_001"]),
    priority: JSON.stringify(["A", "B"]),
  }]
}

const DAY_MS = 24 * 60 * 60 * 1000

export const SYNTHETIC = Object.freeze({
  lines: ["LINE_A", "LINE_B", "LINE_C"],
  products: ["PRODUCT_001", "PRODUCT_002"],
  equipment: ["EQP_TEST_001", "EQP_TEST_002"],
  sensors: ["SENSOR_FLOW_001", "SENSOR_PRESSURE_001"],
  steps: ["U%10000", "U%20000"],
  grades: ["A", "B", "D", "M", "N"],
  ppid: "PPID_TEST_001",
  recipe: "RECIPE_TEST_001",
  user: "USER_TEST_001",
})

function mulberry32(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function dateAt(index) {
  return new Date(Date.UTC(2026, 0, 15, 12, 0, 0) - index * DAY_MS)
    .toISOString()
    .replace("T", " ")
    .replace(".000Z", "")
}

function fixturePath(scenario, kind, index = 1) {
  return `fixture://${scenario}/${kind}/${String(index).padStart(4, "0")}`
}

export function scenarioSize(scenario) {
  if (scenario === "empty") return 0
  if (scenario === "single") return 1
  if (scenario === "large") return 1200
  return 8
}

export function createSyntheticRows(scenario = "normal", seed = 4175) {
  const size = scenarioSize(scenario)
  const random = mulberry32(seed)
  const rows = Array.from({ length: size }, (_, index) => {
    const equipment = SYNTHETIC.equipment[index % SYNTHETIC.equipment.length]
    const sensor = SYNTHETIC.sensors[index % SYNTHETIC.sensors.length]
    const step = SYNTHETIC.steps[index % SYNTHETIC.steps.length]
    const product = SYNTHETIC.products[index % SYNTHETIC.products.length]
    return {
      id: `MOCK_ROW_${String(index + 1).padStart(5, "0")}`,
      sdwt: product,
      desc: step,
      ver: "VERSION_TEST_001",
      recipe_id: SYNTHETIC.ppid,
      priority: SYNTHETIC.grades[index % SYNTHETIC.grades.length],
      sensor,
      step,
      eqp: `${equipment}.png`,
      file_path: fixturePath(scenario, "erd", index + 1),
      line_rev: SYNTHETIC.lines[index % SYNTHETIC.lines.length],
      score: Number((random() * 100).toFixed(3)),
    }
  })

  if (scenario === "partial" && rows.length) {
    rows[0] = { ...rows[0], score: null }
    delete rows[1].score
  }

  if (scenario === "edge-values") {
    return [
      ...rows,
      {
        id: "MOCK_EDGE_001",
        sdwt: "",
        desc: SYNTHETIC.steps[0],
        ver: null,
        recipe_id: "000123",
        priority: "D",
        sensor: SYNTHETIC.sensors[0],
        step: SYNTHETIC.steps[0],
        eqp: `${SYNTHETIC.equipment[0]}.png`,
        file_path: fixturePath(scenario, "edge", 1),
        line_rev: SYNTHETIC.lines[0],
        score: -0.0001,
      },
      {
        id: "MOCK_EDGE_001",
        sdwt: SYNTHETIC.products[0],
        desc: "U%10000_" + "X".repeat(180),
        ver: "",
        recipe_id: SYNTHETIC.ppid,
        priority: "N",
        sensor: SYNTHETIC.sensors[1],
        step: SYNTHETIC.steps[1],
        eqp: `${SYNTHETIC.equipment[1]}.png`,
        file_path: fixturePath(scenario, "edge", 2),
        line_rev: SYNTHETIC.lines[1],
        score: 999999999999.125,
      },
    ]
  }

  return rows
}

export function createChartPoints(scenario = "normal", seed = 5175) {
  const size = scenario === "empty" ? 0 : scenario === "single" ? 1 : scenario === "large" ? 2500 : 12
  const random = mulberry32(seed)
  const points = Array.from({ length: size }, (_, index) => {
    const actTimeMs = Date.UTC(2026, 0, 15, 12, 0, 0) - (size - index) * 60_000
    return {
      actTime: new Date(actTimeMs).toISOString(),
      actTimeMs,
      value: Number((45 + random() * 10).toFixed(4)),
      eqpId: SYNTHETIC.equipment[index % SYNTHETIC.equipment.length],
      dispName: `SYNTHETIC_POINT_${String(index + 1).padStart(4, "0")}`,
      waferId: `WAFER_TEST_${String((index % 25) + 1).padStart(3, "0")}`,
      rootLotId: `LOT_TEST_${String((index % 20) + 1).padStart(3, "0")}`,
      lotId: `LOT_TEST_${String((index % 20) + 1).padStart(3, "0")}`,
      isRecent: index >= Math.max(0, size - 6),
    }
  })

  if (scenario === "edge-values") {
    return [
      ...points.slice().reverse(),
      { ...points[0], actTime: "invalid-date", actTimeMs: 0, value: -999.25 },
      { ...points[0], value: "NaN" },
      { ...points[0], value: "Infinity" },
      { ...points[0], value: 0 },
    ]
  }
  return points
}

export function createDashboardPayload(scenario = "normal", requestedLines = []) {
  const rows = createSyntheticRows(scenario)
  const baseLines = scenario === "single" ? SYNTHETIC.lines.slice(0, 1) : SYNTHETIC.lines
  const lines = requestedLines.length
    ? scenario === "inconsistent"
      ? Array.from(new Set([...requestedLines, "LINE_C"]))
      : requestedLines
    : baseLines
  const countFactor = scenario === "inconsistent" ? 7 : 1
  const lineSummary = scenario === "empty" || scenario === "partial"
    ? []
    : lines.map((lineId, index) => {
        const totalCount = scenario === "single" ? 1 : Math.max(1, rows.length - index)
        return {
          lineId,
          totalCount,
          abGradeCount: Math.ceil(totalCount / 2),
          latestDateCount: Math.max(0, totalCount - 1),
          changeCount: index - 1,
          ratio: Number((totalCount / Math.max(rows.length, 1)).toFixed(4)),
          lastAbnormalDate: "2026-01-15",
        }
      })
  const total = scenario === "partial"
    ? rows.length
    : lineSummary.reduce((sum, row) => sum + row.totalCount, 0)
  const dailyTrend = scenario === "empty"
    ? []
    : Array.from({ length: scenario === "single" ? 1 : scenario === "large" ? 180 : 7 }, (_, day) => (
        lines.map((lineId, index) => ({
          date: dateAt(day).slice(0, 10),
          lineId,
          abnormalCount: (day + index) % 6,
        }))
      )).flat()
  const mailingSummary = scenario === "empty" ? [] : lineSummary.map((row, index) => ({
    lineId: row.lineId,
    sdwt: SYNTHETIC.products[index % SYNTHETIC.products.length],
    sensorGrade: SYNTHETIC.grades[index % SYNTHETIC.grades.length],
    abnormalCount: row.totalCount,
  }))
  const latestDateTime = scenario === "empty"
    ? ""
    : scenario === "inconsistent"
      ? "2026-01-13 12:00:00"
      : "2026-01-15 12:00:00"

  return {
    ok: true,
    latestDate: latestDateTime,
    metrics: {
      monitoringSensorTotal: rows.length,
      detectedPpidCount: scenario === "empty" ? 0 : 1,
      totalAnomalyCount: total,
      abGradeCount: Math.ceil(total / 2),
      dGradeCount: Math.floor(total / 5),
      nGradeCount: Math.floor(total / 6),
      mGradeCount: Math.floor(total / 7),
    },
    detailCounts: {
      rows: rows.length,
      sdwt: scenario === "empty" ? 0 : SYNTHETIC.products.length,
      steps: scenario === "empty" ? 0 : SYNTHETIC.steps.length,
      recipeIds: scenario === "empty" ? 0 : 1,
      sensors: scenario === "empty" ? 0 : SYNTHETIC.sensors.length,
    },
    sourcePaths: {
      stats: fixturePath(scenario, "dashboard-stats"),
      detail: fixturePath(scenario, "dashboard-detail"),
    },
    columns: {
      stats: ["exec_date", "recipe_id", "priority", "total"],
      detail: ["sdwt", "desc", "recipe_id", "priority", "sensor", "eqp"],
    },
    lineDashboard: {
      filters: {
        startDate: "2026-01-09",
        endDate: "2026-01-15",
        lines: requestedLines,
      },
      options: {
        lines: SYNTHETIC.lines,
        minDate: "2025-12-01",
        maxDate: "2026-01-15",
        defaultStartDate: "2026-01-09",
        defaultEndDate: "2026-01-15",
      },
      summary: {
        totalAbnormalCount: total * countFactor,
        abnormalLineCount: lineSummary.length,
        latestDate: latestDateTime.slice(0, 10),
        latestDateTime,
        latestDateCount: lineSummary.reduce((sum, row) => sum + row.latestDateCount, 0),
        topLine: lineSummary[0]?.lineId ?? null,
        topLineCount: lineSummary[0]?.totalCount ?? 0,
        previousDate: scenario === "empty" ? null : "2026-01-14",
        previousDateTime: scenario === "empty" ? null : "2026-01-14 12:00:00",
        changeFromPreviousDay: scenario === "empty" ? null : 2,
        monitoringSensorTotal: rows.length,
        abGradeCount: scenario === "inconsistent" ? total + 3 : Math.ceil(total / 2),
        dGradeCount: Math.floor(total / 5),
        nGradeCount: Math.floor(total / 6),
        mGradeCount: Math.floor(total / 7),
      },
      lineSummary,
      dailyTrend,
      mailingSummary,
      meta: {
        filesRead: scenario === "empty" ? 0 : 1,
        comparisonFileRead: scenario !== "empty",
        unmappedRows: scenario === "inconsistent" ? 1 : 0,
      },
    },
  }
}

export function createFilterPayload(scenario = "normal", params = {}, type = "self") {
  const allRows = createSyntheticRows(scenario)
  const sourceRows = scenario === "inconsistent" || !params.line
    ? allRows
    : allRows.filter((row) => row.line_rev === params.line)
  const equipmentValues = scenario === "single"
    ? SYNTHETIC.equipment.slice(0, 1)
    : SYNTHETIC.equipment
  const sensorValues = scenario === "single" ? SYNTHETIC.sensors.slice(0, 1) : SYNTHETIC.sensors
  const stepValues = scenario === "single" ? SYNTHETIC.steps.slice(0, 1) : SYNTHETIC.steps
  const desc = params.desc && stepValues.includes(params.desc) ? params.desc : ""
  const eqpCh = params.eqpCh && (
    params.eqpCh === "ALL" || equipmentValues.some((item) => `${item}.png` === params.eqpCh)
  ) ? params.eqpCh : ""
  const sensor = params.sensor && (
    params.sensor === "ALL" || sensorValues.includes(params.sensor)
  ) ? params.sensor : ""
  const chStep = params.chStep && (
    params.chStep === "ALL" || stepValues.includes(params.chStep)
  ) ? params.chStep : ""
  const shouldReturnRows = Boolean(desc && eqpCh && sensor && chStep)
  const rows = shouldReturnRows ? sourceRows : []

  return {
    filters: {
      line: params.line || SYNTHETIC.lines[0],
      pathSdwt: params.pathSdwt || SYNTHETIC.products[0],
      sdwt: params.sdwt || SYNTHETIC.products[0],
      priorities: params.priorities || ["A", "B"],
      desc,
      eqpCh,
      sensor,
      chStep,
    },
    counts: {
      filteredRows: sourceRows.length,
      chartRows: rows.length,
      ...(type === "my" ? {
        registeredEqps: equipmentValues.length,
        matchedRegistrationRows: sourceRows.length,
        sourceRows: sourceRows.length,
      } : {}),
    },
    availablePriorities: SYNTHETIC.grades,
    steps: scenario === "empty" ? [] : stepValues.map((value) => ({
      desc: value,
      rowCount: sourceRows.length,
      equipmentCount: equipmentValues.length,
    })),
    eqpChannels: desc ? equipmentValues.map((value) => ({
      eqpCh: `${value}.png`,
      rowCount: sourceRows.length,
    })) : [],
    sensors: eqpCh ? sensorValues.map((value) => ({
      sensor: value,
      rowCount: sourceRows.length,
    })) : [],
    chSteps: sensor ? stepValues.map((value) => ({
      step: value,
      rowCount: sourceRows.length,
      equipmentCount: equipmentValues.length,
    })) : [],
    rows,
  }
}

export function createCommonPayload(scenario = "normal", params = {}) {
  const sourceRows = createSyntheticRows(scenario)
  const equipmentValues = scenario === "single"
    ? SYNTHETIC.equipment.slice(0, 1)
    : SYNTHETIC.equipment
  const sensorValues = scenario === "single" ? SYNTHETIC.sensors.slice(0, 1) : SYNTHETIC.sensors
  const prcGroup = params.prcGroup === SYNTHETIC.recipe ? params.prcGroup : ""
  const eqp = params.eqp && (
    params.eqp === "ALL" || equipmentValues.some((item) => `${item}.png` === params.eqp)
  ) ? params.eqp : ""
  const sensor = sensorValues.includes(params.sensor) ? params.sensor : ""
  const rows = sensor ? sourceRows.map((row, index) => ({
    ...row,
    prc_group: SYNTHETIC.recipe,
    date: dateAt(index),
    data_path: fixturePath(scenario, "common-data", index + 1),
    image_path: fixturePath(scenario, "common-image", index + 1),
  })) : []

  return {
    filters: {
      line: params.line || SYNTHETIC.lines[0],
      pathSdwt: params.pathSdwt || SYNTHETIC.products[0],
      sdwt: params.sdwt || SYNTHETIC.products[0],
      prcGroup,
      eqp,
      sensor,
    },
    counts: { filteredRows: sourceRows.length, chartRows: rows.length },
    prcGroups: scenario === "empty" ? [] : [{ value: SYNTHETIC.recipe, rowCount: sourceRows.length }],
    eqps: prcGroup ? equipmentValues.map((value) => ({
      value: `${value}.png`,
      rowCount: sourceRows.length,
    })) : [],
    sensors: eqp ? sensorValues.map((value) => ({ value, rowCount: sourceRows.length })) : [],
    rows,
  }
}

export function createCommonalityPayload(scenario = "normal", params = {}) {
  const sourceRows = createSyntheticRows(scenario)
  const sensorValues = scenario === "single" ? SYNTHETIC.sensors.slice(0, 1) : SYNTHETIC.sensors
  const stepValues = scenario === "single" ? SYNTHETIC.steps.slice(0, 1) : SYNTHETIC.steps
  const stepDesc = stepValues.includes(params.stepDesc) ? params.stepDesc : ""
  const sensor = params.sensor === "ALL" || sensorValues.includes(params.sensor) ? params.sensor : ""
  const chStep = params.chStep === "ALL" || stepValues.includes(params.chStep) ? params.chStep : ""
  const rows = chStep ? sourceRows.map((row, index) => ({
    id: `MOCK_COMMONALITY_${index + 1}`,
    filePath: fixturePath(scenario, "commonality-image", index + 1),
    sdwt: row.sdwt,
    grade: row.priority,
    stepSeq: row.step,
    stepDesc: row.desc,
    ppid: SYNTHETIC.ppid,
    sensor: row.sensor,
    chStep: row.step,
  })) : []
  return {
    latest: fixturePath(scenario, "commonality-latest"),
    filters: {
      line: params.line || SYNTHETIC.lines[0],
      pathSdwt: params.pathSdwt || SYNTHETIC.products[0],
      sdwt: params.sdwt || SYNTHETIC.products[0],
      folderSdwt: params.sdwt || SYNTHETIC.products[0],
      stepDesc,
      sensor,
      chStep,
    },
    stepDescs: scenario === "empty" ? [] : stepValues,
    sensors: stepDesc ? sensorValues : [],
    chSteps: sensor ? stepValues : [],
    counts: { indexedImages: sourceRows.length, filteredImages: rows.length },
    rows,
  }
}

export function createChartPayload(scenario = "normal", params = {}, identity = false) {
  const points = createChartPoints(scenario)
  const equipment = String(params.eqp || SYNTHETIC.equipment[0]).replace(/\.png$/i, "")
  const base = {
    eqp: equipment,
    axisColumn: `${params.sensor || SYNTHETIC.sensors[0]}_${params.chStep || SYNTHETIC.steps[0]}`,
    sourcePath: params.path || fixturePath(scenario, "chart-source"),
  }
  if (identity) {
    const equipmentValues = scenario === "single"
      ? SYNTHETIC.equipment.slice(0, 1)
      : SYNTHETIC.equipment
    const groups = scenario === "empty" ? [] : equipmentValues.map((eqp, index) => ({
      eqpCb: eqp,
      isSelected: index === 0,
      sourcePointCount: points.length,
      pointCount: points.length,
      points,
    }))
    return {
      ...base,
      windowDays: Number(params.days || 0),
      windowStartMs: points[0]?.actTimeMs ?? null,
      mostRecentActTimeMs: points.at(-1)?.actTimeMs ?? null,
      groupCount: groups.length,
      sourcePointCount: groups.reduce((sum, group) => sum + group.pointCount, 0),
      pointCount: groups.reduce((sum, group) => sum + group.pointCount, 0),
      groups,
    }
  }
  return {
    ...base,
    latestDate: "2026-01-15 12:00:00",
    historyPath: fixturePath(scenario, "history"),
    historyError: "",
    latestDateMs: Date.UTC(2026, 0, 15, 12),
    mostRecentActTimeMs: points.at(-1)?.actTimeMs ?? null,
    recentThresholdMs: points.at(-1)?.actTimeMs ?? null,
    pointCount: points.length,
    points,
    changeHistory: scenario === "empty" ? [] : [{
      date: "2026-01-14 09:00:00",
      dateMs: Date.UTC(2026, 0, 14, 9),
      ctttmUrl: "http://127.0.0.1:4175/mock-change",
      workType: "SYNTHETIC_CHECK",
      description: "Synthetic maintenance event",
    }],
  }
}

export function createPassRecords(scenario = "normal") {
  return createSyntheticRows(scenario).slice(0, scenario === "large" ? 300 : undefined).map((row, index) => ({
    id: `PASS_TEST_${index + 1}`,
    line_id: row.line_rev,
    sdwt: row.sdwt,
    desc: row.desc,
    ver: row.ver,
    recipe_id: row.recipe_id,
    priority: row.priority,
    sensor: row.sensor,
    step: row.step,
    eqp: row.eqp.replace(/\.png$/i, ""),
    update_date: dateAt(index),
    file_path: row.file_path,
    comment: "Synthetic pass history",
  }))
}

export function createRegistrations(scenario = "normal") {
  if (scenario === "empty") return []
  const count = scenario === "single" ? 1 : scenario === "large" ? 200 : 2
  return Array.from({ length: count }, (_, index) => ({
    id: `REG_TEST_${String(index + 1).padStart(4, "0")}`,
    line: SYNTHETIC.lines[index % SYNTHETIC.lines.length],
    sdwt: SYNTHETIC.products[index % SYNTHETIC.products.length],
    prcGroup: SYNTHETIC.recipe,
    eqps: [SYNTHETIC.equipment[index % SYNTHETIC.equipment.length]],
    execDate: "2026-01-15 09:00:00",
    periode: 30,
    comment: "Synthetic registration",
    knoxId: SYNTHETIC.user,
    isPublic: index % 2 === 0,
    expiresAt: "2026-02-14 09:00:00",
    active: true,
    ownedByCurrentUser: true,
  }))
}

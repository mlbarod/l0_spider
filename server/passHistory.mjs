import { spawn } from "node:child_process"
import { relative, resolve, sep } from "node:path"
import { fileURLToPath, URL } from "node:url"

import { resolveCurrentUser } from "./currentUser.mjs"

const ERD_FILE_ROOT = "/appdata/abnormal_trend/pic/erd"
const COMMON_FILE_ROOT = "/appdata/abnormal_trend/pic/common"
export const COMMON_PASS_HISTORY_VERSION = "NA"
export const PASS_HISTORY_ACTIVE_DURATION_MS = 3 * 24 * 60 * 60 * 1000
const helperPath = fileURLToPath(new URL("../scripts/pass_history.py", import.meta.url))
const ALL_VALUES = "ALL"

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function normalizeEqp(value) {
  return normalizeText(value).replace(/\.png$/i, "")
}

function normalizeDbDate(value) {
  const text = normalizeText(value)
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?/)
  if (!match) return text
  return !match[2] || match[2] === "00:00:00" ? match[1] : `${match[1]} ${match[2]}`
}

function parseDatabaseDate(value) {
  if (value instanceof Date) return value.getTime()
  const text = normalizeText(value)
  if (!text) return Number.NaN
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? text.replace(" ", "T")
    : text)
}

export function isActivePassHistoryRecord(
  record,
  nowMs = Date.now(),
  durationMs = PASS_HISTORY_ACTIVE_DURATION_MS,
) {
  const execDateMs = parseDatabaseDate(record.exec_date)
  const elapsedMs = nowMs - execDateMs
  return Number.isFinite(execDateMs) && elapsedMs >= 0 && elapsedMs < durationMs
}

function uniqueCount(records, key, normalizeValue = normalizeText) {
  return new Set(records.map((record) => normalizeValue(record[key])).filter(Boolean)).size
}

function aggregateBy(records, key, createItem, normalizeValue = normalizeText) {
  const groups = new Map()
  records.forEach((record) => {
    const value = normalizeValue(record[key])
    if (!value) return
    const rows = groups.get(value) ?? []
    rows.push(record)
    groups.set(value, rows)
  })
  return Array.from(groups, ([value, rows]) => createItem(value, rows))
}

function sortByCount(items, key) {
  return items.sort((left, right) => (
    right.rowCount - left.rowCount
    || left[key].localeCompare(right[key], "ko", { numeric: true })
  ))
}

function passRecordIdentity(record) {
  return [
    record.line_id,
    record.ver,
    record.sdwt,
    record.desc,
    record.recipe_id,
    normalizeDbDate(record.update_date),
    record.priority,
    record.sensor,
    record.step,
    normalizeEqp(record.eqp),
  ].map(normalizeText).join("\u0000")
}

function buildErdImagePath(record) {
  const segments = [
    normalizeDbDate(record.update_date),
    record.sdwt,
    record.desc,
    record.ver,
    record.recipe_id,
    record.priority,
    record.sensor,
    record.step,
    `${normalizeEqp(record.eqp)}.png`,
  ].map(normalizeText)
  if (segments.some((value) => !value)) throw new Error("PASS 이력에서 ERD 차트 경로를 복원하지 못했습니다.")
  return `${ERD_FILE_ROOT}/${segments.join("/")}`
}

function buildCommonDataPath(record) {
  const segments = [
    normalizeDbDate(record.update_date),
    record.sdwt,
    record.desc,
    record.priority,
    record.sensor,
    record.step,
  ].map(normalizeText)
  if (segments.some((value) => !value || value.includes("/") || value.includes("\\") || value.includes(".."))) {
    throw new Error("PASS 이력에서 공통부 이상감지 경로를 복원하지 못했습니다.")
  }
  return `${COMMON_FILE_ROOT}/${segments.join("/")}/data.parquet`
}

export function buildPassHistoryFilterPayload(records, filters, nowMs = Date.now()) {
  const seenRecords = new Set()
  const uniqueRecords = records.filter((record) => {
    if (!isActivePassHistoryRecord(record, nowMs)) return false
    if (normalizeText(record.ver) === COMMON_PASS_HISTORY_VERSION) return false
    const identity = passRecordIdentity(record)
    if (seenRecords.has(identity)) return false
    seenRecords.add(identity)
    return true
  })
  const availablePriorities = Array.from(new Set(
    uniqueRecords.map((record) => normalizeText(record.priority)).filter(Boolean),
  )).sort((left, right) => left.localeCompare(right, "ko", { numeric: true }))
  const selectedPriorities = new Set(filters.priorities)
  const baseRecords = uniqueRecords.filter((record) => selectedPriorities.has(normalizeText(record.priority)))
  const steps = aggregateBy(baseRecords, "desc", (desc, stepRecords) => ({
    desc,
    rowCount: stepRecords.length,
    equipmentCount: uniqueCount(stepRecords, "eqp", normalizeEqp),
  })).sort((left, right) => left.desc.localeCompare(right.desc, "ko", { numeric: true }))
  const selectedDesc = steps.some((item) => item.desc === filters.desc) ? filters.desc : ""
  const stepRecords = selectedDesc
    ? baseRecords.filter((record) => normalizeText(record.desc) === selectedDesc)
    : []
  const eqpChannels = sortByCount(aggregateBy(stepRecords, "eqp", (eqpCh, eqpRecords) => ({
    eqpCh,
    rowCount: eqpRecords.length,
  }), normalizeEqp), "eqpCh")
  const selectedEqpCh = filters.eqpCh === ALL_VALUES && eqpChannels.length
    ? ALL_VALUES
    : eqpChannels.some((item) => item.eqpCh === normalizeEqp(filters.eqpCh))
    ? normalizeEqp(filters.eqpCh)
    : ""
  const eqpRecords = selectedEqpCh === ALL_VALUES
    ? stepRecords
    : selectedEqpCh
    ? stepRecords.filter((record) => normalizeEqp(record.eqp) === selectedEqpCh)
    : []
  const sensors = sortByCount(aggregateBy(eqpRecords, "sensor", (sensor, sensorRecords) => ({
    sensor,
    rowCount: sensorRecords.length,
  })), "sensor")
  const selectedSensor = filters.sensor === ALL_VALUES
    && selectedEqpCh !== ALL_VALUES
    && sensors.length
    ? ALL_VALUES
    : sensors.some((item) => item.sensor === filters.sensor)
    ? filters.sensor
    : ""
  const sensorRecords = selectedSensor === ALL_VALUES
    ? eqpRecords
    : selectedSensor
    ? eqpRecords.filter((record) => normalizeText(record.sensor) === selectedSensor)
    : []
  const chSteps = sortByCount(aggregateBy(sensorRecords, "step", (step, chStepRecords) => ({
    step,
    rowCount: chStepRecords.length,
    equipmentCount: uniqueCount(chStepRecords, "eqp", normalizeEqp),
  })), "step")
  const selectedChStep = filters.chStep === ALL_VALUES && chSteps.length
    ? ALL_VALUES
    : chSteps.some((item) => item.step === filters.chStep)
    ? filters.chStep
    : ""
  const chartRecords = selectedChStep === ALL_VALUES
    ? sensorRecords
    : selectedChStep
    ? sensorRecords.filter((record) => normalizeText(record.step) === selectedChStep)
    : []

  return {
    filters: {
      line: filters.lineId,
      priorities: filters.priorities,
      desc: selectedDesc,
      eqpCh: selectedEqpCh,
      sensor: selectedSensor,
      chStep: selectedChStep,
    },
    counts: { filteredRows: baseRecords.length, chartRows: chartRecords.length },
    availablePriorities,
    steps,
    eqpChannels,
    sensors,
    chSteps,
    rows: chartRecords.map((record) => {
      const filePath = buildErdImagePath(record)
      return {
        id: `pass-${filePath}`,
        sdwt: normalizeText(record.sdwt),
        desc: normalizeText(record.desc),
        ver: normalizeText(record.ver),
        recipe_id: normalizeText(record.recipe_id),
        priority: normalizeText(record.priority),
        sensor: normalizeText(record.sensor),
        step: normalizeText(record.step),
        eqp: `${normalizeEqp(record.eqp)}.png`,
        file_path: filePath,
        line_rev: normalizeText(record.line_id),
        pass_history: record,
      }
    }),
  }
}

export function buildCommonPassHistoryFilterPayload(records, filters, nowMs = Date.now()) {
  const seenRecords = new Set()
  const commonRecords = records.filter((record) => {
    if (!isActivePassHistoryRecord(record, nowMs)) return false
    if (normalizeText(record.line_id) !== filters.lineId) return false
    if (normalizeText(record.ver) !== COMMON_PASS_HISTORY_VERSION) return false
    const identity = passRecordIdentity(record)
    if (seenRecords.has(identity)) return false
    seenRecords.add(identity)
    return true
  })
  const prcGroups = aggregateBy(commonRecords, "recipe_id", (value, groupRecords) => ({
    value,
    rowCount: groupRecords.length,
  }))
  const selectedPrcGroup = prcGroups.some((item) => item.value === filters.prcGroup)
    ? filters.prcGroup
    : ""
  const prcGroupRecords = selectedPrcGroup
    ? commonRecords.filter((record) => normalizeText(record.recipe_id) === selectedPrcGroup)
    : []
  const eqps = aggregateBy(prcGroupRecords, "eqp", (value, groupRecords) => ({
    value: `${value}.png`,
    rowCount: groupRecords.length,
  }), normalizeEqp)
  const normalizedSelectedEqp = normalizeEqp(filters.eqp)
  const selectedEqp = filters.eqp === ALL_VALUES && eqps.length
    ? ALL_VALUES
    : eqps.some((item) => normalizeEqp(item.value) === normalizedSelectedEqp)
    ? `${normalizedSelectedEqp}.png`
    : ""
  const eqpRecords = selectedEqp === ALL_VALUES
    ? prcGroupRecords
    : selectedEqp
    ? prcGroupRecords.filter((record) => normalizeEqp(record.eqp) === normalizeEqp(selectedEqp))
    : []
  const sensors = aggregateBy(eqpRecords, "sensor", (value, groupRecords) => ({
    value,
    rowCount: groupRecords.length,
  }))
  const selectedSensor = sensors.some((item) => item.value === filters.sensor)
    ? filters.sensor
    : ""
  const chartRecords = selectedSensor
    ? eqpRecords.filter((record) => normalizeText(record.sensor) === selectedSensor)
    : []

  return {
    filters: {
      line: filters.lineId,
      pathSdwt: "__SKIP_LIST__",
      sdwt: "SKIP LIST",
      prcGroup: selectedPrcGroup,
      eqp: selectedEqp,
      sensor: selectedSensor,
    },
    counts: {
      filteredRows: commonRecords.length,
      chartRows: chartRecords.length,
    },
    prcGroups,
    eqps,
    sensors,
    rows: chartRecords.map((record) => {
      const dataPath = buildCommonDataPath(record)
      const eqp = normalizeEqp(record.eqp)
      const imagePath = `${dataPath.slice(0, -"data.parquet".length)}${eqp}.png`
      return {
        id: `pass-${passRecordIdentity(record)}`,
        file_path: imagePath,
        data_path: dataPath,
        image_path: imagePath,
        sdwt: normalizeText(record.sdwt),
        prc_group: normalizeText(record.recipe_id),
        date: normalizeDbDate(record.update_date),
        priority: normalizeText(record.priority),
        sensor: normalizeText(record.sensor),
        step: normalizeText(record.step),
        eqp: `${eqp}.png`,
        line_rev: normalizeText(record.line_id),
        pass_history: record,
      }
    }),
  }
}

export function parsePassHistoryPath(filePath) {
  const normalizedPath = normalizeText(filePath).replaceAll("/pic_server2/", "/pic/")
  const resolvedPath = resolve(normalizedPath)
  if (!resolvedPath.startsWith(`${ERD_FILE_ROOT}/`)) {
    throw new Error("허용되지 않은 ERD 차트 경로입니다.")
  }

  const segments = relative(ERD_FILE_ROOT, resolvedPath).split(sep)
  if (segments.length < 9) throw new Error("ERD 차트 경로에서 PASS 이력 정보를 찾지 못했습니다.")

  const [updateDate, sdwt, desc, ver, recipeId, priority, sensor, step] = segments
  const eqp = normalizeEqp(segments.at(-1))
  const required = { updateDate, sdwt, desc, ver, recipeId, priority, sensor, step, eqp }
  if (Object.values(required).some((value) => !value)) {
    throw new Error("ERD 차트 경로의 PASS 이력 정보가 올바르지 않습니다.")
  }

  return required
}

export function parseCommonPassHistoryPath(filePath, { eqp, prcGroup }) {
  const normalizedPath = normalizeText(filePath).replaceAll("/pic_server2/", "/pic/")
  const resolvedPath = resolve(normalizedPath)
  if (!resolvedPath.startsWith(`${COMMON_FILE_ROOT}/`)) {
    throw new Error("허용되지 않은 공통부 이상감지 데이터 경로입니다.")
  }

  const segments = relative(COMMON_FILE_ROOT, resolvedPath).split(sep)
  if (segments.length !== 7 || segments.at(-1) !== "data.parquet") {
    throw new Error("공통부 이상감지 경로에서 PASS 이력 정보를 찾지 못했습니다.")
  }

  const [updateDate, sdwt, desc, priority, sensor, step] = segments
  const required = {
    updateDate,
    sdwt,
    desc,
    ver: COMMON_PASS_HISTORY_VERSION,
    recipeId: normalizeText(prcGroup),
    priority,
    sensor,
    step,
    eqp: normalizeEqp(eqp),
  }
  if (Object.values(required).some((value) => !value)) {
    throw new Error("공통부 이상감지 PASS 이력 정보가 올바르지 않습니다.")
  }
  return required
}

async function readJsonBody(req) {
  let body = ""
  for await (const chunk of req) {
    body += chunk
    if (body.length > 512 * 1024) throw new Error("요청 데이터가 너무 큽니다.")
  }
  if (!body.trim()) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new Error("요청 JSON이 올바르지 않습니다.")
  }
}

function runPassHistoryHelper(action, payload) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("python3", ["-B", helperPath, action], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill("SIGTERM")
    }, 10_000)

    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.on("close", () => {
      clearTimeout(timeout)
      if (timedOut) {
        reject(new Error("PASS 이력 처리 시간이 초과되었습니다."))
        return
      }

      let result
      try {
        result = JSON.parse(stdout.trim())
      } catch {
        reject(new Error(stderr.trim() || "PASS 이력 응답을 해석하지 못했습니다."))
        return
      }
      if (!result.ok) {
        if (stderr.trim()) console.error(`[pass-history] ${stderr.trim()}`)
        reject(new Error(result.error || "PASS 이력을 처리하지 못했습니다."))
        return
      }
      resolvePromise(result)
    })

    child.stdin.end(JSON.stringify(payload))
  })
}

export async function listPassHistoryRecords({ lineId, sdwt = "", desc = "" }) {
  const result = await runPassHistoryHelper("list", {
    lineId: normalizeText(lineId),
    sdwt: normalizeText(sdwt),
    desc: normalizeText(desc),
  })
  return result.records ?? []
}

function buildRecord({
  lineId,
  filePath,
  eqp = "",
  prcGroup = "",
  knoxId,
  comment = "",
  execDate = "",
}) {
  const normalizedLineId = normalizeText(lineId)
  if (!normalizedLineId) throw new Error("Line Name이 필요합니다.")

  const normalizedPath = normalizeText(filePath).replaceAll("/pic_server2/", "/pic/")
  const pathValues = resolve(normalizedPath).startsWith(`${COMMON_FILE_ROOT}/`)
    ? parseCommonPassHistoryPath(normalizedPath, { eqp, prcGroup })
    : parsePassHistoryPath(normalizedPath)

  return {
    lineId: normalizedLineId,
    ...pathValues,
    knoxId: normalizeText(knoxId),
    execDate: normalizeText(execDate),
    comment: String(comment ?? ""),
  }
}

export async function handlePassHistoryRequest(req, res, url) {
  try {
    if (req.method === "GET") {
      const lineId = normalizeText(url.searchParams.get("lineId"))
      if (!lineId) {
        sendJson(res, 400, { ok: false, error: "Line Name이 필요합니다." })
        return
      }
      const view = normalizeText(url.searchParams.get("view"))
      const isFilterView = view === "filters" || view === "common-filters"
      const records = await listPassHistoryRecords({
        lineId,
        sdwt: isFilterView ? "" : normalizeText(url.searchParams.get("sdwt")),
        desc: isFilterView ? "" : normalizeText(url.searchParams.get("desc")),
      })
      if (view === "filters") {
        sendJson(res, 200, buildPassHistoryFilterPayload(records, {
          lineId,
          priorities: url.searchParams.getAll("priority").map(normalizeText).filter(Boolean),
          desc: normalizeText(url.searchParams.get("desc")),
          eqpCh: normalizeText(url.searchParams.get("eqpCh")),
          sensor: normalizeText(url.searchParams.get("sensor")),
          chStep: normalizeText(url.searchParams.get("chStep")),
        }))
        return
      }
      if (view === "common-filters") {
        sendJson(res, 200, buildCommonPassHistoryFilterPayload(records, {
          lineId,
          prcGroup: normalizeText(url.searchParams.get("prcGroup")),
          eqp: normalizeText(url.searchParams.get("eqp")),
          sensor: normalizeText(url.searchParams.get("sensor")),
        }))
        return
      }
      sendJson(res, 200, {
        ok: true,
        records: url.searchParams.get("activeOnly") === "true"
          ? records.filter((record) => isActivePassHistoryRecord(record))
          : records,
      })
      return
    }

    if (req.method === "POST" || req.method === "DELETE") {
      const currentUser = await resolveCurrentUser(req)
      const body = await readJsonBody(req)
      if (req.method === "POST" && Array.isArray(body.records)) {
        if (!body.records.length || body.records.length > 500) {
          sendJson(res, 400, { ok: false, error: "일괄 SKIP 대상은 1건 이상 500건 이하여야 합니다." })
          return
        }
        const records = body.records.map((item) => buildRecord({
          ...item,
          comment: body.comment,
          execDate: body.execDate,
          knoxId: currentUser.knoxId,
        }))
        const result = await runPassHistoryHelper("insert-many", { records })
        sendJson(res, 200, result)
        return
      }
      const record = buildRecord({ ...body, knoxId: currentUser.knoxId })
      const result = await runPassHistoryHelper(req.method === "POST" ? "insert" : "delete", record)
      sendJson(res, 200, result)
      return
    }

    sendJson(res, 405, { ok: false, error: "Method not allowed" })
  } catch (error) {
    sendJson(res, error.statusCode || 500, { ok: false, error: error.message })
  }
}

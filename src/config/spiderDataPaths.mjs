const PIC_ROOT = "/appdata/abnormal_trend/pic"

export const SPIDER_DATA_PATH_TEMPLATES = Object.freeze({
  erdData: `${PIC_ROOT}/erd/{latest_date}/{sdwt}/{step_desc}/{ver}/{ppid}/{grade}/{sensor}/{ch_step}/data.parquet`,
  stats: `${PIC_ROOT}/stats/{latest_date}_spider_step_stats.parquets`,
  statsExceptV: `${PIC_ROOT}/stats/{latest_date}_spider_step_stats_except_v.parquets`,
  commonalityRoot: `${PIC_ROOT}/erd_commonality`,
  commonalityImage: `${PIC_ROOT}/erd_commonality/{latest_date}/{sdwt}/{grade}/{step_seq}/{step_desc}/{ppid}/{ppid}/{sensor}_{ch_step}/img.png`,
  backupImage: `${PIC_ROOT}/backup/#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png`,
  latestDateFile: `${PIC_ROOT}/path/{latest_date}`,
  teamErdPath: `${PIC_ROOT}/path/{line}/{sdwt}/df_path.parquet`,
  commonAnomalyPath: `${PIC_ROOT}/path_common/{line}/{sdwt}/df_path.parquet`,
  commonAnomalyData: `${PIC_ROOT}/common/{latest_date}/{sdwt}/{step_desc}/{grade}/{sensor}/{ch_step}/data.parquet`,
  commonAnomalyImage: `${PIC_ROOT}/common/{latest_date}/{sdwt}/{step_desc}/{grade}/{sensor}/{ch_step}/{eqp_cb}.png`,
  mappingConfig: "/appdata/l0_spider/mapping_config.json",
})

export const SPIDER_DATA_PATH_NAMES = Object.freeze({
  latestCommonality: "동일성 최신날짜",
})

export const LATEST_DATE_FILE_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/

function fillPathTemplate(template, values) {
  return template.replace(/\{([a-z_]+)\}/g, (placeholder, key) => {
    const value = values[key]
    return value === undefined || value === null || value === "" ? placeholder : String(value)
  })
}

export function buildErdDataPath(values) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.erdData, values)
}

export function buildStatsPath(latestDate) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.stats, { latest_date: latestDate })
}

export function buildStatsExceptVPath(latestDate) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.statsExceptV, { latest_date: latestDate })
}

export function buildCommonalityImagePath(values) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.commonalityImage, values)
}

export function buildBackupImagePath(values) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.backupImage, values)
}

export function buildLatestDateFilePath(latestDate) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.latestDateFile, { latest_date: latestDate })
}

export function buildTeamErdPath({ line, sdwt }) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.teamErdPath, { line, sdwt })
}

export function buildCommonAnomalyPath({ line, sdwt }) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.commonAnomalyPath, { line, sdwt })
}

export function buildCommonAnomalyDataPath(values) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.commonAnomalyData, values)
}

export function buildCommonAnomalyImagePath(values) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.commonAnomalyImage, values)
}

export function resolveLatestDateFile(fileNames) {
  return fileNames
    .filter((fileName) => LATEST_DATE_FILE_PATTERN.test(fileName))
    .sort((left, right) => right.localeCompare(left))[0] ?? null
}

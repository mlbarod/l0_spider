const PIC_ROOT = "/appdata/abnormal_trend/pic"

export const SPIDER_DATA_PATH_TEMPLATES = Object.freeze({
  erdData: `${PIC_ROOT}/erd/{latest_date}/{sdwt}/{step_desc}/{ver}/{ppid}/{grade}/{sensor}/{ch_step}/data.parquet`,
  stats: `${PIC_ROOT}/stats/{latest_date}_spider_step_stats.parquets`,
  statsExceptV: `${PIC_ROOT}/stats/{latest_date}_spider_step_stats_except_v.parquets`,
  backupImage: `${PIC_ROOT}/backup/#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png`,
  latestDateFile: `${PIC_ROOT}/path/{latest_date}`,
  teamErdPath: `${PIC_ROOT}/path/{line}/{sdwt}/df_path.parquet`,
  mappingConfig: "/appdata/l0_spider/mapping_config.json",
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

export function buildBackupImagePath(values) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.backupImage, values)
}

export function buildLatestDateFilePath(latestDate) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.latestDateFile, { latest_date: latestDate })
}

export function buildTeamErdPath({ line, sdwt }) {
  return fillPathTemplate(SPIDER_DATA_PATH_TEMPLATES.teamErdPath, { line, sdwt })
}

export function resolveLatestDateFile(fileNames) {
  return fileNames
    .filter((fileName) => LATEST_DATE_FILE_PATTERN.test(fileName))
    .sort((left, right) => right.localeCompare(left))[0] ?? null
}

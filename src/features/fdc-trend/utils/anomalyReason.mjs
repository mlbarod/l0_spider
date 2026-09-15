const ANOMALY_REASONS = new Map([
  ["AVG_OUTSIDE_IDENTITY_RANGE", "동종설비와 비교하여 진행영역 벗어남"],
  ["IDENTITY_DATA_INSUFFICIENT_FALLBACK", "동종설비 모수 부족으로 자설비 기준으로 이상감지"],
  ["STD_SPEC_OUT", "자살비 산포 이상감지"],
])

export function getAnomalyReasonLabel(reason) {
  return ANOMALY_REASONS.get(reason) ?? ""
}

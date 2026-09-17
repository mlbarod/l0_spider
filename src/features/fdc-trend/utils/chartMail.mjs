export const CHART_MAIL_COMMENTS = Object.freeze([
  "이상감지 내용을 확인해 주세요.",
  "설비 상태와 변경점 확인을 부탁드립니다.",
  "원인 분석 및 조치 후 결과를 공유해 주세요.",
])
export const MAX_CHART_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_CHART_MAIL_COMMENT_LENGTH = 2000

export function parseMailRecipients(value) {
  const items = Array.isArray(value) ? value : String(value ?? "").split(/[\s,;]+/).filter(Boolean)
  const normalized = items.map((item) => {
    if (typeof item !== "string") throw new Error("수신인 Knox ID를 확인해 주세요.")
    const id = item.trim().replace(/@samsung\.com$/i, "").toLowerCase()
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(id)) {
      throw new Error("수신인은 Knox ID 또는 samsung.com 메일 주소로 입력해 주세요.")
    }
    return id
  })
  const recipients = [...new Set(normalized)]
  if (!recipients.length || recipients.length > 100) throw new Error("수신인은 1명 이상 100명 이하로 지정해 주세요.")
  return recipients
}

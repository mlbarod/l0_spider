import { getApiErrorMessage } from "./errorMessage.js"

async function request(path, options = {}) {
  const response = await fetch(path, options)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload.ok !== true) {
    const error = new Error(getApiErrorMessage(payload, "게시판 요청을 처리하지 못했습니다."))
    error.code = payload.code
    throw error
  }
  return payload
}

export function fetchChartMailPosts({ page, status, search, signal }) {
  const query = new URLSearchParams({ page: String(page), status, search })
  return request(`/api/chart-mail-board?${query}`, { signal })
}
export function fetchChartMailPost(id, signal) {
  return request(`/api/chart-mail-board/${encodeURIComponent(id)}`, { signal })
}
export function updateChartMailPost(id, input) {
  return request(`/api/chart-mail-board/${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  })
}
export function chartMailPostImageUrl(id) {
  return `/api/chart-mail-board/${encodeURIComponent(id)}/image`
}

import { getApiErrorMessage } from "./errorMessage.js"

async function requestNotices(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, "공지사항 요청을 처리하지 못했습니다."))
  }
  return payload
}

export function fetchActiveNotices({ signal } = {}) {
  return requestNotices("/api/notices", { signal })
}

export function fetchManagedNotices({ signal } = {}) {
  return requestNotices("/api/notices/manage", { signal })
}

export function createNotice({ title, body }) {
  return requestNotices("/api/notices", {
    method: "POST",
    body: JSON.stringify({ title, body }),
  })
}

export function completeNotice(noticeId) {
  return requestNotices("/api/notices", {
    method: "PATCH",
    body: JSON.stringify({ noticeId }),
  })
}

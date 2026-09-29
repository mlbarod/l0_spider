import { MAX_QNA_HTML_BYTES, MAX_QNA_REQUEST_BYTES } from "./limits.mjs"
import { qnaFailureMessage } from "./errors"

const empty = () => ({ posts: [], notifications: [], history: [] })
let snapshot = empty()
let generation = 0

export async function request(path, { method = "GET", body } = {}) {
  const json = body === undefined ? undefined : JSON.stringify(body)
  if ((body?.bodyHtml && new Blob([body.bodyHtml]).size > MAX_QNA_HTML_BYTES) || (json && new Blob([json]).size > MAX_QNA_REQUEST_BYTES)) {
    throw new Error(qnaFailureMessage({ status: 413 }))
  }
  let response
  try {
    response = await fetch(path, { method, credentials: "same-origin", headers: { Accept: "application/json", ...(json ? { "Content-Type": "application/json" } : {}) }, body: json })
  } catch { throw new Error(qnaFailureMessage({ code: "NETWORK_ERROR" })) }
  let payload
  try { payload = await response.json() } catch { throw new Error(qnaFailureMessage({ code: "INVALID_RESPONSE" })) }
  if (!response.ok) throw new Error(payload.error?.message || (typeof payload.error === "string" ? payload.error : qnaFailureMessage({ status: response.status })))
  return payload
}

async function mutate(path, input, method = "PATCH") {
  const version = ++generation
  const result = await request(path, { method, body: input })
  if (version !== generation) return qnaRepository.read()
  if (result.post) snapshot.posts = snapshot.posts.some(post => post.questionId === result.post.questionId)
    ? snapshot.posts.map(post => post.questionId === result.post.questionId ? result.post : post)
    : [result.post, ...snapshot.posts]
  if (result.notifications) snapshot.notifications = result.notifications
  if (result.history) snapshot.history = result.history
  return qnaRepository.read()
}

export const qnaRepository = {
  read: () => structuredClone(snapshot),
  reset() { generation++; snapshot = empty() },
  async getSnapshot() {
    const version = generation
    const result = await request("/api/voe")
    if (version === generation) snapshot = result
    return this.read()
  },
  async getQuestion(id) {
    const version = generation
    const { post } = await request(`/api/voe/questions/${id}`)
    if (version === generation) snapshot.posts = snapshot.posts.map(item => item.questionId === post.questionId ? post : item)
    return this.read()
  },
  createQuestion: (input) => mutate("/api/voe/questions", input, "POST"),
  updateQuestion: (id, input) => mutate(`/api/voe/questions/${id}`, input),
  createMessage: (id, input) => mutate(`/api/voe/questions/${id}/messages`, input, "POST"),
  updateMessage: (id, messageId, input) => mutate(`/api/voe/questions/${id}/messages/${messageId}`, input),
  markNotificationRead: (notificationId) => mutate("/api/voe/notifications", { notificationId }),
  markAllNotificationsRead: () => mutate("/api/voe/notifications", { all: true }),
}

export async function fetchJson(url, options = {}) {
  const base = { ok: false, status: 0, data: null, error: null }
  let response

  try {
    response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      ...options,
    })
  } catch (error) {
    return { ...base, error: String(error) }
  }

  const contentType = response.headers.get("content-type") || ""
  let data = null
  try {
    data = contentType.includes("application/json")
      ? await response.json()
      : await response.text()
  } catch {
    // Empty or malformed response bodies are represented as null.
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    error: response.ok ? null : (typeof data === "string" ? data : data?.detail || null),
  }
}

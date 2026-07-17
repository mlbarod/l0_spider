export function buildNextUrl(nextPath, base) {
  if (!nextPath || typeof window === "undefined") return undefined
  const baseUrl = base?.trim() || window.location.origin
  try {
    return new URL(nextPath, baseUrl).toString()
  } catch {
    return undefined
  }
}

export function appendNextParam(loginUrl, nextUrl) {
  if (!nextUrl) return loginUrl
  try {
    const resolved = new URL(loginUrl, window.location.origin)
    resolved.searchParams.set("next", nextUrl)
    return resolved.toString()
  } catch {
    const separator = loginUrl.includes("?") ? "&" : "?"
    return `${loginUrl}${separator}next=${encodeURIComponent(nextUrl)}`
  }
}

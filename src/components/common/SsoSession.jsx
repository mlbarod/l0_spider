import { useEffect, useState } from "react"

export function SsoSession() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let stopped = false
    let pending = false
    let redirecting = false
    async function check() {
      if (pending || stopped || redirecting) return
      pending = true
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        const payload = await response.json()
        if (stopped) return
        if (response.status === 401 && payload.code === "SSO_AUTHENTICATION_REQUIRED") {
          redirecting = true
          const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`
          window.location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
        } else if (response.ok) {
          setEnabled(payload.enabled === true)
        }
      } catch {
        // A transient network error is not proof that the login expired.
      } finally {
        pending = false
      }
    }
    void check()
    const interval = window.setInterval(check, 60_000)
    window.addEventListener("focus", check)
    window.addEventListener("pageshow", check)
    return () => {
      stopped = true
      window.clearInterval(interval)
      window.removeEventListener("focus", check)
      window.removeEventListener("pageshow", check)
    }
  }, [])

  if (!enabled) return null
  return (
    <form action="/auth/logout" method="post" className="flex shrink-0 items-center justify-end gap-3 border-b bg-card px-6 py-1 text-xs">
      <span className="text-muted-foreground">SSO 로그인 중</span>
      <button type="submit" className="rounded px-2 py-1 hover:bg-muted focus-visible:outline focus-visible:outline-2">로그아웃</button>
    </form>
  )
}

import { useEffect, useState } from "react"
import { ChevronDown, UserRound } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function SsoSession() {
  const [enabled, setEnabled] = useState(false)
  const [user, setUser] = useState(null)

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
          setUser(payload.enabled === true ? payload.user ?? null : null)
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
    <div className="flex shrink-0 items-center justify-end border-b bg-card py-1 pl-4 pr-16 sm:pl-6 sm:pr-20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="로그인 사용자 정보" className="flex max-w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2">
            <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="max-w-48 truncate font-medium">{user?.displayName || user?.userId || "사용자 정보"}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]" aria-label="로그인 사용자 정보">
          <DropdownMenuLabel>로그인 사용자</DropdownMenuLabel>
          <dl className="space-y-3 px-2 py-3 text-sm">
            {[
              ["USER ID", user?.userId],
              ["USER NAME", user?.displayName],
              ["DEP NAME", user?.department],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words font-medium">{value || "미제공"}</dd>
              </div>
            ))}
          </dl>
          <DropdownMenuSeparator />
          <form action="/auth/logout" method="post">
            <DropdownMenuItem asChild onSelect={(event) => event.preventDefault()}>
              <button type="submit" className="w-full">로그아웃</button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react"

import { DEFAULT_AUTH_CONFIG } from "../utils/authConfig"
import { fetchJson } from "../utils/fetchJson"
import { appendNextParam, buildNextUrl } from "../utils/url"

export const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [config, setConfig] = useState(DEFAULT_AUTH_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const mountedRef = useRef(false)

  const loadUser = useCallback(async ({ background = false } = {}) => {
    if (mountedRef.current) {
      if (background) setIsRefreshing(true)
      else setIsLoading(true)
    }
    try {
      const result = await fetchJson("/api/v1/auth/me")
      if (!mountedRef.current) return false
      setUser(result.ok && result.data ? result.data : null)
      return Boolean(result.ok && result.data)
    } finally {
      if (mountedRef.current) {
        if (background) setIsRefreshing(false)
        else setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const bootstrap = async () => {
      const [configResult, userResult] = await Promise.all([
        fetchJson("/api/v1/auth/config"),
        fetchJson("/api/v1/auth/me"),
      ])
      if (!mountedRef.current) return
      if (configResult.ok && configResult.data) {
        setConfig((previous) => ({ ...previous, ...configResult.data }))
      }
      setUser(userResult.ok && userResult.data ? userResult.data : null)
      setIsLoading(false)
    }
    bootstrap()
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refreshIntervalMs = useMemo(() => {
    const seconds = Number(config.sessionMaxAgeSeconds)
    if (!Number.isFinite(seconds) || seconds <= 0) return 0
    return Math.max(60_000, Math.floor(seconds * 500))
  }, [config.sessionMaxAgeSeconds])

  useEffect(() => {
    if (!user || !refreshIntervalMs) return undefined
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") loadUser({ background: true })
    }, refreshIntervalMs)
    return () => window.clearInterval(timer)
  }, [loadUser, refreshIntervalMs, user])

  const login = useCallback(({ next } = {}) => {
    const nextUrl = buildNextUrl(next || "/", config.frontendRedirect)
    const loginUrl = config.loginUrl || "/api/v1/auth/login"
    const target = appendNextParam(loginUrl, nextUrl)
    window.location.assign(target)
    return { method: "redirect", url: target }
  }, [config.frontendRedirect, config.loginUrl])

  const logout = useCallback(async () => {
    let redirectTarget = config.logoutUrl || "/"
    try {
      const result = await fetchJson("/api/v1/auth/logout", { method: "POST" })
      if (result.ok && typeof result.data?.logoutUrl === "string") {
        redirectTarget = result.data.logoutUrl
      }
    } finally {
      if (mountedRef.current) setUser(null)
      window.location.assign(redirectTarget)
    }
  }, [config.logoutUrl])

  const value = useMemo(() => ({
    config,
    isLoading,
    isRefreshing,
    login,
    logout,
    refresh: (options) => loadUser({ background: true, ...options }),
    user,
  }), [config, isLoading, isRefreshing, loadUser, login, logout, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

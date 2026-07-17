import { useEffect, useMemo, useRef } from "react"
import { Outlet, useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

import { useAuth } from "../hooks/useAuth"
import { CenteredPage } from "./CenteredPage"

export function AuthAutoLoginGate() {
  const { config, isLoading, login, user } = useAuth()
  const location = useLocation()
  const loginTriggeredRef = useRef(false)
  const authError = useMemo(
    () => new URLSearchParams(location.search).get("error"),
    [location.search],
  )
  const nextPath = `${location.pathname || "/"}${location.search || ""}`

  useEffect(() => {
    if (isLoading || user || authError || config.providerConfigured === false) return
    if (loginTriggeredRef.current) return
    loginTriggeredRef.current = true
    login({ next: nextPath })
  }, [authError, config.providerConfigured, isLoading, login, nextPath, user])

  if (user) return <Outlet />

  const unavailable = config.providerConfigured === false
  return (
    <CenteredPage>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>SPIDER SSO 인증</CardTitle>
          <CardDescription>
            {authError
              ? `SSO 인증에 실패했습니다. (${authError})`
              : unavailable
                ? "SSO 설정을 확인할 수 없습니다. 관리자에게 문의하세요."
                : "인증 상태를 확인하고 있습니다."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {authError ? (
            <Button type="button" onClick={() => login({ next: location.pathname || "/" })}>
              SSO 로그인 다시 시도
            </Button>
          ) : unavailable ? null : <Spinner className="size-8 text-primary" />}
        </CardContent>
      </Card>
    </CenteredPage>
  )
}

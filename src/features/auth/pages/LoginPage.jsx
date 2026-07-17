import { useEffect, useRef } from "react"
import { useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

import { CenteredPage } from "../components/CenteredPage"
import { useAuth } from "../hooks/useAuth"

export function LoginPage() {
  const { config, isLoading, login, user } = useAuth()
  const [searchParams] = useSearchParams()
  const nextPath = searchParams.get("next") || "/"
  const authError = searchParams.get("error")
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (isLoading || authError || config.providerConfigured === false || triggeredRef.current) return
    triggeredRef.current = true
    login({ next: nextPath })
  }, [authError, config.providerConfigured, isLoading, login, nextPath, user])

  return (
    <CenteredPage>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.png" alt="SPIDER" className="mx-auto h-12 w-auto" />
          <CardTitle>Welcome</CardTitle>
          <CardDescription>
            {authError ? `SSO 인증에 실패했습니다. (${authError})` : "Login with SSO"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {isLoading || (!authError && config.providerConfigured !== false) ? (
            <Spinner className="size-8 text-primary" />
          ) : (
            <Button
              type="button"
              disabled={config.providerConfigured === false}
              onClick={() => login({ next: nextPath })}
            >
              SSO 로그인
            </Button>
          )}
        </CardContent>
      </Card>
    </CenteredPage>
  )
}

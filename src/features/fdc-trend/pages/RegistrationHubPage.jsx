import { useRef, useState } from "react"
import { ArrowLeft, ChevronDown, Loader2, Mail, Save, Settings2 } from "lucide-react"
import { Link } from "react-router-dom"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { MailingRegistrationPage } from "./MailingRegistrationPage"
import { MyEqpRegistrationPage } from "./MyEqpRegistrationPage"

function RegistrationSection({
  title,
  description,
  icon: Icon,
  open,
  mounted,
  onToggle,
  children,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-semibold">{title}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground">
          {open ? "접기" : "펼치기"}
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      {mounted ? (
        <div className={cn("border-t px-4 py-5 sm:px-6", !open && "hidden")} aria-hidden={!open}>
          {children}
        </div>
      ) : null}
    </section>
  )
}

export function RegistrationHubPage() {
  const mailingRef = useRef(null)
  const myEqpRef = useRef(null)
  const [mailingOpen, setMailingOpen] = useState(false)
  const [myEqpOpen, setMyEqpOpen] = useState(false)
  const [mailingMounted, setMailingMounted] = useState(false)
  const [myEqpMounted, setMyEqpMounted] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const toggleMailing = () => {
    setMailingMounted(true)
    setMailingOpen((current) => !current)
  }
  const toggleMyEqp = () => {
    setMyEqpMounted(true)
    setMyEqpOpen((current) => !current)
  }

  const handleCombinedSave = async () => {
    if (isSaving) return
    const readySections = [mailingRef.current, myEqpRef.current]
      .filter((section) => section?.isReady)
    if (!readySections.length) {
      toast.error("저장할 입력사항이 없습니다.", {
        description: "Mailing 또는 My EQP 영역을 펼쳐 필수 조건을 입력해 주세요.",
      })
      return
    }

    const requests = readySections.map((section) => section.save()).filter(Boolean)
    if (!requests.length) return
    setIsSaving(true)
    try {
      await Promise.allSettled(requests)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-muted/30">
      <header className="shrink-0 border-b bg-card px-5 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Mail className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight tracking-tight">
                <span className="block">Mailing Report 및</span>
                <span className="block">My EQP 등록</span>
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Mailing 수신 조건과 My EQP 모니터링 기준정보를 한 화면에서 관리합니다.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="size-4" aria-hidden="true" />
              SPIDER 메인
            </Link>
          </Button>
        </div>
      </header>

      <main className="w-full flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1680px] gap-5">
          <RegistrationSection
            title="Mailing Report 수신인 등록"
            description="Line·SDWT별 Mailing 수신 조건을 등록하고 기존 조건을 조회·삭제합니다."
            icon={Mail}
            open={mailingOpen}
            mounted={mailingMounted}
            onToggle={toggleMailing}
          >
            <MailingRegistrationPage ref={mailingRef} embedded />
          </RegistrationSection>

          <RegistrationSection
            title="My EQP 등록"
            description="모니터링 설비와 기간, 열람 및 메일수신인을 지정합니다."
            icon={Settings2}
            open={myEqpOpen}
            mounted={myEqpMounted}
            onToggle={toggleMyEqp}
          >
            <MyEqpRegistrationPage ref={myEqpRef} embedded />
          </RegistrationSection>

          <section className="sticky bottom-4 z-20 rounded-2xl border border-primary/25 bg-card/95 p-4 shadow-xl backdrop-blur sm:p-5">
            <Button
              type="button"
              size="lg"
              className="h-16 w-full rounded-xl text-lg font-semibold shadow-lg shadow-primary/20"
              disabled={isSaving}
              onClick={handleCombinedSave}
            >
              {isSaving ? (
                <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-6" aria-hidden="true" />
              )}
              {isSaving ? "저장 및 등록 중…" : "저장 및 Mailing등록"}
            </Button>
          </section>
        </div>
      </main>
    </div>
  )
}

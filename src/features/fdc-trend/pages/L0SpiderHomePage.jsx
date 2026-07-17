import { Activity, BookOpen, ChartNoAxesCombined, Gauge, Mail, Network, Radar, ScanSearch, TrendingUp, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { LineAnomalyDashboard } from "../components/LineAnomalyDashboard"

const spiderApps = [
  {
    icon: Activity,
    title: "자설비 이상감지",
    subtitle: "STEP과 FDC 센서를 기준으로 설비별 이상 Trend를 확인합니다.",
    category: "FDC Trend",
    href: "/self-equipment",
    active: true,
    status: "운영중",
  },
  {
    icon: ChartNoAxesCombined,
    title: "동일성 이상감지",
    subtitle: "동일 조건 간 신호 분포 차이를 비교해 이상 패턴을 찾습니다.",
    category: "Matching",
    href: "/matching-anomaly",
    active: true,
    status: "운영중",
  },
  {
    icon: Network,
    title: "공통부 이상감지",
    subtitle: "공통 설비와 공정 구간의 이상 징후를 통합 관점으로 봅니다.",
    category: "Common",
    href: "/common-anomaly",
    active: true,
    status: "운영중",
  },
  {
    icon: Gauge,
    title: "FDC Hard Limit추천",
    subtitle: "FDC 분포 기반 Hard Limit 후보를 추천합니다.",
    category: "Limit",
    href: "/fdc-hard-limit",
    active: true,
  },
  {
    icon: TrendingUp,
    title: "수율기반 Hard Limit추천",
    subtitle: "수율 영향도를 반영한 Hard Limit 후보를 추천합니다.",
    category: "Yield",
    href: "/yield-hard-limit",
    active: true,
  },
  {
    icon: BookOpen,
    title: "사용자 메뉴얼",
    subtitle: "SPIDER의 메뉴와 기능별 상세 사용 방법을 확인합니다.",
    category: "Manual",
    href: "/manual",
    active: true,
    status: "운영중",
  },
  {
    icon: Mail,
    title: "이상감지 수신인 정비",
    subtitle: "이상감지 메일 수신 대상과 priority 조건을 관리합니다.",
    category: "Recipients",
    href: "/recipients",
    active: true,
  },
]

const spiderSuites = [
  {
    icon: ScanSearch,
    title: "Defect SPIDER",
    subtitle: "Defect 신호 기반 이상 패턴을 탐색합니다.",
    category: "Defect",
    href: "https://go/defect-spider",
    active: true,
    external: true,
    status: "운영중",
  },
  {
    icon: Radar,
    title: "L1 SPIDER",
    subtitle: "L1 설비/공정 신호를 추적합니다.",
    category: "Level 1",
    href: "https://go/spider1",
    active: true,
    external: true,
    status: "운영중",
  },
  {
    icon: Network,
    title: "L3 SPIDER",
    subtitle: "L3 연계 지표와 이상 흐름을 확인합니다.",
    category: "Level 3",
    href: "https://plane.samsungds.net/spider/l3",
    active: true,
    external: true,
    status: "운영중",
  },
]

function SpiderAppCard({ app }) {
  const isOperating = app.status === "운영중"
  const content = (
    <div
      className={cn(
        "relative h-full min-h-[140px] rounded-2xl border p-4 shadow-sm transition-all duration-300",
        "cursor-pointer hover:-translate-y-1 hover:shadow-lg",
        isOperating
          ? "border-border/50 bg-card hover:border-primary/20"
          : "border-muted bg-muted/50 hover:border-muted-foreground/20",
      )}
    >
      <Badge className={cn(
        "absolute -right-2 -top-2 z-10 px-2 py-1 text-xs font-medium",
        isOperating
          ? "border border-primary/20 bg-primary/10 text-primary"
          : "border border-muted-foreground/20 bg-muted text-muted-foreground",
      )}>
        {app.status ?? "개발중"}
      </Badge>

      <div className={cn(
        "mb-3 flex size-10 items-center justify-center rounded-2xl border transition-all duration-300",
        isOperating
          ? "border-primary/20 bg-primary/10 group-hover:border-primary/30 group-hover:bg-primary/15"
          : "border-muted-foreground/15 bg-muted",
      )}>
        <app.icon className={cn("size-5", isOperating ? "text-primary" : "text-muted-foreground")} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between text-left">
        <div>
          <h3 className={cn(
            "mb-2 text-base font-semibold leading-tight transition-colors",
            isOperating ? "text-foreground group-hover:text-primary" : "text-muted-foreground",
          )}>
            {app.title}
          </h3>
          <p className={cn(
            "mb-3 text-xs leading-5",
            isOperating ? "text-muted-foreground" : "text-muted-foreground/70",
          )}>{app.subtitle}</p>
        </div>
        <div className={cn(
          "text-xs font-medium",
          isOperating ? "text-primary/70" : "text-muted-foreground/70",
        )}>{app.category}</div>
      </div>
    </div>
  )

  return app.external ? (
    <a
      href={app.href}
      target="_blank"
      rel="noreferrer"
      className="group relative block h-full"
    >
      {content}
    </a>
  ) : (
    <Link to={app.href} className="group relative block h-full">
      {content}
    </Link>
  )
}

export function L0SpiderHomePage() {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-y-auto bg-background">
      <section className="shrink-0 border-b bg-card px-4 pb-4 pt-7 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-3">
            <Badge variant="outline">L0 Spider</Badge>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">ETCH SPIDER</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                L0 공정 이상감지와 Hard Limit 추천 기능을 한 화면에서 시작합니다.
              </p>
            </div>
          </div>
          <aside
            className="mb-0.5 flex shrink-0 items-center gap-3 rounded-xl border border-border/80 bg-muted/40 px-4 py-3 shadow-sm"
            aria-label="개발 및 운영 담당자"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">개발 · 운영</p>
              <p className="mt-0.5 whitespace-nowrap text-sm font-medium text-foreground">
                담당자 : 최상현, 강태환
              </p>
            </div>
          </aside>
        </div>
      </section>

      <main className="min-h-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-[1680px] gap-5">
          <section className="grid gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">L0 Spider</h2>
              <p className="mt-1 text-xs text-muted-foreground">L0 Spider 기반 이상감지와 Hard Limit 추천 기능입니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {spiderApps.map((app) => (
                <SpiderAppCard key={app.title} app={app} />
              ))}
            </div>
          </section>
          <section className="grid gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">L1,L3 이상감지 App</h2>
              <p className="mt-1 text-xs text-muted-foreground">L1과 L3 데이터를 활용한 이상감지 App입니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {spiderSuites.map((app) => (
                <SpiderAppCard key={app.title} app={app} />
              ))}
            </div>
          </section>
          <LineAnomalyDashboard />
        </div>
      </main>
    </div>
  )
}

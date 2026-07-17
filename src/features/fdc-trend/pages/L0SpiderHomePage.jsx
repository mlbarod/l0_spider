import { useQuery } from "@tanstack/react-query"
import { Activity, BookOpen, ChartNoAxesCombined, Database, Gauge, Layers3, Mail, Network, Radar, ScanSearch, TrendingUp, TriangleAlert, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { fetchDashboardSummary } from "../api/dashboardApi"

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

const DASHBOARD_METRICS = [
  {
    key: "monitoringSensorTotal",
    label: "모니터링 센서 총합",
    description: "TL Grade · total 합계",
    unit: "개",
    icon: Database,
    accent: "border-l-sky-500",
    iconStyle: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    key: "detectedPpidCount",
    label: "감지 PPID갯수",
    description: "세부 파일 · 고유 recipe_id",
    unit: "개",
    icon: Layers3,
    accent: "border-l-emerald-500",
    iconStyle: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "totalAnomalyCount",
    label: "전체 이상건수",
    description: "세부 파일 · 5개 컬럼 고유조합",
    unit: "건",
    icon: TriangleAlert,
    accent: "border-l-rose-500",
    iconStyle: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  {
    key: "abGradeCount",
    label: "A/B Grade",
    description: "A · B 필터 · 고유조합",
    unit: "건",
    icon: Gauge,
    accent: "border-l-blue-500",
    iconStyle: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    key: "dGradeCount",
    label: "D Grade",
    description: "D 필터 · 고유조합",
    unit: "건",
    icon: Gauge,
    accent: "border-l-amber-500",
    iconStyle: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    key: "nGradeCount",
    label: "N Grade",
    description: "N 필터 · 고유조합",
    unit: "건",
    icon: Gauge,
    accent: "border-l-violet-500",
    iconStyle: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    key: "mGradeCount",
    label: "M Grade",
    description: "M 필터 · 고유조합",
    unit: "건",
    icon: Gauge,
    accent: "border-l-fuchsia-500",
    iconStyle: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  },
]

function formatMetricValue(value, isLoading) {
  if (isLoading) return "…"
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString("ko-KR") : "—"
}

function DashboardMetricCard({ metric, value, isLoading }) {
  const Icon = metric.icon
  return (
    <article className={cn(
      "grid min-h-[150px] grid-rows-[auto_1fr_auto] rounded-2xl border border-l-4 bg-card p-4 shadow-sm",
      metric.accent,
    )}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold leading-5 text-foreground">{metric.label}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", metric.iconStyle)}>
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
      </div>
      <div className="flex items-end gap-1.5 py-3" aria-live="polite">
        <strong className="text-2xl font-semibold tracking-tight tabular-nums xl:text-3xl">
          {formatMetricValue(value, isLoading)}
        </strong>
        <span className="pb-1 text-sm font-medium text-muted-foreground">{metric.unit}</span>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">{metric.description}</p>
    </article>
  )
}

function SelfEquipmentDashboard() {
  const dashboardQuery = useQuery({
    queryKey: ["spider-dashboard-summary"],
    queryFn: fetchDashboardSummary,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const metrics = dashboardQuery.data?.metrics

  return (
    <section className="mt-2 grid gap-5 border-t-2 border-border/80 pt-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">자설비 이상감지 Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            최신 SPIDER 전체·세부 파일 기준 모니터링 범위와 이상감지 현황입니다.
          </p>
        </div>
        <Badge variant="outline" className="h-7 px-3">
          기준일시 {dashboardQuery.isError ? "조회 실패" : (dashboardQuery.data?.latestDate || "조회 중")}
        </Badge>
      </div>

      {dashboardQuery.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {dashboardQuery.error.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
        {DASHBOARD_METRICS.map((metric) => (
          <DashboardMetricCard
            key={metric.key}
            metric={metric}
            value={metrics?.[metric.key]}
            isLoading={dashboardQuery.isLoading}
          />
        ))}
      </div>
    </section>
  )
}

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
          <SelfEquipmentDashboard />
        </div>
      </main>
    </div>
  )
}

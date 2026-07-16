import { Activity, BookOpen, ChartNoAxesCombined, Gauge, History, Mail, Network, Radar, ScanSearch, TrendingUp } from "lucide-react"
import { Link } from "react-router-dom"
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { FDC_LINES, getTeamsByLine, getTrendSteps } from "../utils/fdcTrendMockData"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
]
const TREND_MONTHS = ["2025.12", "2026.01", "2026.02", "2026.03", "2026.04", "2026.05"]

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
    icon: History,
    title: "과거 이상감지 이력",
    subtitle: "이력저장된 이상감지 chart를 라인과 분임조 기준으로 조회합니다.",
    category: "History",
    href: "/history",
    active: true,
  },
  {
    icon: BookOpen,
    title: "사용자 메뉴얼",
    subtitle: "SPIDER 사용자 메뉴얼 이미지와 원본 파일 경로를 확인합니다.",
    category: "Manual",
    href: "/manual",
    active: true,
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

function getTrendFactor(index, monthIndex) {
  return 0.72 + monthIndex * 0.065 + ((index + monthIndex) % 3) * 0.035
}

function buildDashboardData() {
  const lineRows = FDC_LINES.map((lineId, lineIndex) => {
    const teams = getTeamsByLine(lineId)
    const count = teams.reduce((lineSum, teamId) => {
      const steps = getTrendSteps({ lineId, teamId })
      return lineSum + steps.reduce((stepSum, step) => stepSum + step.abnormalCount, 0)
    }, 0)

    return {
      name: lineId,
      count,
      lineIndex,
    }
  }).sort((a, b) => b.count - a.count)

  const teamRows = FDC_LINES.flatMap((lineId, lineIndex) =>
    getTeamsByLine(lineId).map((teamId, teamIndex) => {
      const steps = getTrendSteps({ lineId, teamId })
      const count = steps.reduce((sum, step) => sum + step.abnormalCount, 0)

      return {
        name: teamId,
        lineId,
        count,
        teamIndex: lineIndex * 4 + teamIndex,
      }
    }),
  ).sort((a, b) => b.count - a.count)

  const topLines = lineRows.slice(0, 6)
  const topTeams = teamRows.slice(0, 6)

  return {
    lineRows,
    teamRows,
    lineTrendRows: TREND_MONTHS.map((month, monthIndex) => {
      const row = { month }
      topLines.forEach((line) => {
        row[line.name] = Math.round(line.count * getTrendFactor(line.lineIndex, monthIndex))
      })
      return row
    }),
    teamTrendRows: TREND_MONTHS.map((month, monthIndex) => {
      const row = { month }
      topTeams.forEach((team) => {
        row[team.name] = Math.round(team.count * getTrendFactor(team.teamIndex, monthIndex))
      })
      return row
    }),
    topLines,
    topTeams,
    totalCount: lineRows.reduce((sum, line) => sum + line.count, 0),
  }
}

function SpiderMark() {
  return (
    <div className="relative flex size-28 items-center justify-center rounded-full border bg-card shadow-sm">
      <svg
        aria-hidden="true"
        viewBox="0 0 120 120"
        className="size-20 text-primary"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="60" cy="62" r="18" strokeWidth="6" />
        <circle cx="60" cy="36" r="10" strokeWidth="6" />
        <path d="M44 54 22 38M43 64 18 64M45 74 24 91M76 54 98 38M77 64 102 64M75 74 96 91" strokeWidth="6" />
        <path d="M51 31 40 18M69 31 80 18M50 78 40 104M70 78 80 104" strokeWidth="5" />
      </svg>
    </div>
  )
}

function DashboardCard({ title, description, badge, children }) {
  return (
    <section className="grid min-h-[320px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b bg-muted/40 px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant="secondary" className="shrink-0">{badge}</Badge>
      </div>
      <div className="min-h-0 p-4">{children}</div>
    </section>
  )
}

function AnomalyPieChart({ data }) {
  return (
    <div className="grid h-full min-h-[240px] grid-cols-[minmax(0,1fr)_170px] gap-4">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
            {data.map((row, index) => (
              <Cell key={row.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid content-center gap-2">
        {data.slice(0, 6).map((row, index) => (
          <div key={row.name} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <svg aria-hidden="true" viewBox="0 0 8 8" className="size-2 shrink-0">
                <circle cx="4" cy="4" r="4" fill={CHART_COLORS[index % CHART_COLORS.length]} />
              </svg>
              <span className="truncate text-muted-foreground">{row.name}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{row.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnomalyLineChart({ rows, series }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          width={48}
        />
        <Tooltip />
        {series.map((item, index) => (
          <Line
            key={item.name}
            type="monotone"
            dataKey={item.name}
            stroke={CHART_COLORS[index % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function SelfEquipmentDashboard() {
  const dashboard = buildDashboardData()
  const linePieData = dashboard.lineRows.slice(0, 6)
  const teamPieData = dashboard.teamRows.slice(0, 6)

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">자설비 이상감지 Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            현재 기준 이상건수와 과거 6개월 추이를 라인/분임조 단위로 확인합니다.
          </p>
        </div>
        <div className="rounded-xl border bg-card px-4 py-3 text-right shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">현재 이상건수</p>
          <p className="text-2xl font-semibold tabular-nums">{dashboard.totalCount.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DashboardCard title="라인별 현재 이상건수" description="상위 6개 라인 기준 분포" badge={`${linePieData.length} lines`}>
          <AnomalyPieChart data={linePieData} />
        </DashboardCard>
        <DashboardCard title="라인별 6개월 추이" description="상위 라인의 월별 이상건수 흐름" badge="6 months">
          <AnomalyLineChart rows={dashboard.lineTrendRows} series={dashboard.topLines} />
        </DashboardCard>
        <DashboardCard title="분임조별 현재 이상건수" description="상위 6개 분임조 기준 분포" badge={`${teamPieData.length} teams`}>
          <AnomalyPieChart data={teamPieData} />
        </DashboardCard>
        <DashboardCard title="분임조별 6개월 추이" description="상위 분임조의 월별 이상건수 흐름" badge="6 months">
          <AnomalyLineChart rows={dashboard.teamTrendRows} series={dashboard.topTeams} />
        </DashboardCard>
      </div>
    </section>
  )
}

function SpiderAppCard({ app }) {
  const isOperating = app.status === "운영중"
  const content = (
    <div
      className={cn(
        "relative h-full min-h-[148px] rounded-2xl border p-4 shadow-sm transition-all duration-300",
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
      <section className="shrink-0 border-b bg-card px-6 py-8">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-8">
          <div className="min-w-0 space-y-3">
            <Badge variant="outline">L0 Spider</Badge>
            <div>
              <h1 className="text-5xl font-semibold tracking-tight text-foreground">SPIDER</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                L0 공정 이상감지와 Hard Limit 추천 기능을 한 화면에서 시작합니다.
              </p>
            </div>
          </div>
          <SpiderMark />
        </div>
      </section>

      <main className="min-h-0 flex-1 px-6 py-8">
        <div className="mx-auto grid w-full max-w-7xl gap-6">
          <section className="grid gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">L0 Spider</h2>
              <p className="mt-1 text-xs text-muted-foreground">L0 Spider 기반 이상감지와 Hard Limit 추천 기능입니다.</p>
            </div>
            <div className="grid grid-cols-5 gap-4">
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
            <div className="grid grid-cols-5 gap-4">
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

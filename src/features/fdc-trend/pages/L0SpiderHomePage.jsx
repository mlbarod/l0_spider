import { useQuery } from "@tanstack/react-query"
import { Activity, ArrowRight, BookOpen, CalendarClock, ChartNoAxesCombined, Gauge, GitCompareArrows, Mail, Network, Radar, ScanSearch, Users } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

import { fetchDashboardSummary } from "../api/dashboardApi"
import { LineAnomalyDashboard } from "../components/LineAnomalyDashboard"
import { NoticeManagement } from "../components/NoticeManagement"

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
    icon: GitCompareArrows,
    title: "공통부 동일성 이상감지",
    subtitle: "공통부 EQP Model별 신호 분포 차이를 비교해 이상 패턴을 찾습니다.",
    category: "Common Matching",
    href: "/common-commonality-anomaly",
    active: true,
    status: "운영중",
  },
  {
    icon: Gauge,
    title: "FDC Hard Limit추천",
    subtitle: "FDC 분포 기반 Hard Limit 후보를 추천합니다.",
    category: "Limit",
    href: "http://mem-etch-spider.samsungds.net:32603/",
    active: true,
    external: true,
    status: "운영중",
    gridClassName: "2xl:col-start-1 2xl:row-start-2",
  },
  {
    key: "yield-hard-limit-placeholder",
    empty: true,
  },
  {
    icon: Mail,
    title: "Mailing Report 및\nMy EQP 등록",
    subtitle: "Mailing 수신 조건과 My EQP 모니터링 설비를 함께 등록합니다.",
    category: "Registration",
    href: "/registration",
    active: true,
    status: "운영중",
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

function SpiderAppCard({ app, animationIndex = 0 }) {
  const isOperating = app.status === "운영중"
  const animationStyle = {
    "--spider-app-enter-delay": `${animationIndex * 55}ms`,
  }
  const content = (
    <div
      className={cn(
        "relative flex h-full min-h-[220px] flex-col rounded-[18px] border p-6 transition-all duration-300 active:scale-[0.98]",
        "cursor-pointer hover:-translate-y-1",
        isOperating
          ? "border-[#e0e0e0] bg-white hover:border-[#0066cc]"
          : "border-[#e0e0e0] bg-[#fafafc] hover:border-[#b8b8bd]",
      )}
    >
      <Badge className={cn(
        "absolute right-5 top-5 z-10 border px-2.5 py-1 text-[11px] font-semibold",
        isOperating
          ? "border-[#0066cc]/20 bg-[#0066cc]/8 text-[#0066cc]"
          : "border-[#d2d2d7] bg-[#f5f5f7] text-[#7a7a7a]",
      )}>
        {app.status ?? "개발중"}
      </Badge>

      <div className={cn(
        "mb-8 flex size-11 items-center justify-center rounded-full transition-colors duration-300",
        isOperating
          ? "bg-[#d2d2d7]/55 text-[#1d1d1f] group-hover:bg-[#0066cc] group-hover:text-white"
          : "bg-[#e8e8ed] text-[#7a7a7a]",
      )}>
        <app.icon className="size-5" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col text-left">
        <div>
          <h3 className={cn(
            "mb-2 whitespace-pre-line text-[21px] font-semibold leading-tight tracking-[-0.23px] transition-colors",
            isOperating ? "text-[#1d1d1f] group-hover:text-[#0066cc]" : "text-[#333333]",
          )}>
            {app.title}
          </h3>
          <p className={cn(
            "text-sm leading-[1.5] tracking-[-0.22px]",
            isOperating ? "text-[#55555a]" : "text-[#7a7a7a]",
          )}>{app.subtitle}</p>
        </div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-7">
          <span className={cn("text-xs", isOperating ? "text-[#0066cc]" : "text-[#7a7a7a]")}>{app.category}</span>
          <span className={cn(
            "grid size-8 place-items-center rounded-full transition-colors",
            isOperating ? "bg-[#f5f5f7] text-[#0066cc] group-hover:bg-[#0066cc] group-hover:text-white" : "bg-[#e8e8ed] text-[#7a7a7a]",
          )}>
            <ArrowRight className="size-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </div>
  )

  return app.external ? (
    <a
      href={app.href}
      target="_blank"
      rel="noreferrer"
      className={cn("spider-app-enter group relative block h-full", app.gridClassName)}
      style={animationStyle}
    >
      {content}
    </a>
  ) : (
    <Link
      to={app.href}
      className={cn("spider-app-enter group relative block h-full", app.gridClassName)}
      style={animationStyle}
    >
      {content}
    </Link>
  )
}

function SpiderSuiteCard({ app, animationIndex = 0 }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-[#d2d2d7]/20 text-white"><app.icon className="size-5" /></span>
        <Badge className="border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-[#cccccc]">{app.status}</Badge>
      </div>
      <h3 className="mt-8 text-[21px] font-semibold leading-tight tracking-[-0.23px]">{app.title}</h3>
      <p className="mt-2 text-sm leading-[1.5] text-[#cccccc]">{app.subtitle}</p>
      <div className="mt-auto flex items-end justify-between pt-7 text-xs text-[#2997ff]">
        <span>{app.category}</span>
        <span className="grid size-8 place-items-center rounded-full bg-white/8"><ArrowRight className="size-4" /></span>
      </div>
    </>
  )
  const className = "spider-app-enter group flex min-h-[220px] flex-col rounded-[18px] border border-white/12 bg-[#2a2a2c] p-6 transition-transform hover:-translate-y-1 active:scale-[0.98]"
  const style = { "--spider-app-enter-delay": `${animationIndex * 55}ms` }

  return app.external ? (
    <a href={app.href} target="_blank" rel="noreferrer" className={className} style={style}>
      {content}
    </a>
  ) : (
    <Link to={app.href} className={className} style={style}>
      {content}
    </Link>
  )
}

function LatestDataCard() {
  const dashboardQuery = useQuery({
    queryKey: ["spider-line-dashboard", ""],
    queryFn: ({ signal }) => fetchDashboardSummary({ signal }),
    staleTime: 60 * 1000,
    retry: false,
  })
  const latestDateTime = dashboardQuery.data?.lineDashboard?.summary?.latestDateTime ?? ""
  const displayDateTime = latestDateTime
    ? `${latestDateTime.slice(0, 10).replaceAll("-", ".")} ${latestDateTime.slice(11)}`
    : dashboardQuery.isPending ? "조회 중" : "확인 불가"

  return (
    <aside
      className="flex min-h-11 items-center gap-3 rounded-full bg-[#fafafc] px-4 py-2"
      aria-label="마지막 알고리즘 수행 시간"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#d2d2d7]/55 text-[#0066cc]">
        <CalendarClock className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-normal tracking-[-0.08px] text-[#7a7a7a]">마지막 알고리즘 수행 시간</p>
        <p className="whitespace-nowrap text-xs font-semibold tabular-nums text-[#1d1d1f]">
          {displayDateTime}
        </p>
      </div>
    </aside>
  )
}

export function L0SpiderHomePage() {
  return (
    <div className="spider-home h-full min-h-0 min-w-0 overflow-y-auto bg-[#f5f5f7] text-[#1d1d1f]">
      <nav className="sticky top-0 z-40 h-11 bg-black text-white" aria-label="전역 탐색">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Link to="/" className="text-xs font-semibold tracking-[0.08em]">SPIDER</Link>
          <div className="mr-12 flex items-center gap-6 text-xs text-white/75">
            <a href="#spider-apps" className="hidden transition-colors hover:text-white sm:inline">Applications</a>
            <a href="#line-dashboard" className="hidden transition-colors hover:text-white sm:inline">Dashboard</a>
            <Link to="/manual" className="transition-colors hover:text-white">사용자 메뉴얼</Link>
          </div>
        </div>
      </nav>

      <div className="sticky top-11 z-30 h-[52px] border-b border-black/8 bg-[#f5f5f7]/85 backdrop-blur-[20px] backdrop-saturate-[180%]">
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <strong className="text-[17px] font-semibold tracking-[-0.37px]">ETCH SPIDER</strong>
          <a href="#spider-apps" className="rounded-full bg-[#0066cc] px-4 py-2 text-xs text-white transition-transform active:scale-95">
            시작하기
          </a>
        </div>
      </div>

      <header className="flex min-h-[500px] items-center bg-white px-5 py-20 sm:px-8">
        <div className="mx-auto flex w-full max-w-[980px] flex-col items-center text-center">
          <p className="mb-5 text-sm font-semibold tracking-[-0.22px] text-[#0066cc]">L0 PROCESS INTELLIGENCE</p>
          <h1 className="max-w-4xl text-[28px] font-semibold leading-[1.07] tracking-[-0.28px] text-[#1d1d1f] min-[420px]:text-[34px] min-[641px]:text-[40px] min-[1069px]:text-[56px]">
            ETCH SPIDER
          </h1>
          <p className="mt-5 max-w-2xl text-[21px] font-normal leading-[1.4] tracking-[-0.23px] text-[#333333] sm:text-[24px]">
            L0 공정 이상감지와 Hard Limit 추천 기능을 한 화면에서 시작합니다.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#spider-apps" className="rounded-full bg-[#0066cc] px-[22px] py-[11px] text-[17px] text-white transition-colors active:scale-95 hover:bg-[#0071e3]">
              앱 둘러보기
            </a>
            <a href="#line-dashboard" className="rounded-full border border-[#0066cc] bg-white px-[22px] py-[10px] text-[17px] text-[#0066cc] transition-colors active:scale-95 hover:bg-[#f5f5f7]">
              Dashboard 보기
            </a>
          </div>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
            <NoticeManagement />
            <LatestDataCard />
            <aside
              className="flex min-h-11 items-center gap-3 rounded-full bg-[#fafafc] px-4 py-2"
              aria-label="개발 및 운영 담당자"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#d2d2d7]/55 text-[#0066cc]">
                <Users className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-[10px] font-normal tracking-[-0.08px] text-[#7a7a7a]">개발 · 운영</p>
                <p className="whitespace-nowrap text-xs font-semibold text-[#1d1d1f]">담당자 : 최상현, 강태환</p>
              </div>
            </aside>
          </div>
        </div>
      </header>

      <main>
        <section id="spider-apps" className="scroll-mt-24 bg-[#f5f5f7] px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-10 max-w-3xl">
              <p className="mb-3 text-sm font-semibold text-[#0066cc]">L0 SPIDER</p>
              <h2 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.37px] sm:text-[40px]">이상 징후를 발견하는 모든 도구.</h2>
              <p className="mt-4 text-[17px] leading-[1.47] tracking-[-0.37px] text-[#55555a]">
                L0 Spider 기반 이상감지와 Hard Limit 추천 기능입니다.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {spiderApps.map((app, index) => (
                app.empty
                  ? null
                  : <SpiderAppCard key={app.title} app={app} animationIndex={index} />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#272729] px-5 py-16 text-white sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-10 max-w-3xl">
              <p className="mb-3 text-sm font-semibold text-[#2997ff]">EXPAND THE VIEW</p>
              <h2 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.37px] sm:text-[40px]">더 넓은 공정으로 연결됩니다.</h2>
              <p className="mt-4 text-[17px] leading-[1.47] tracking-[-0.37px] text-[#cccccc]">L1과 L3 데이터를 활용한 이상감지 App입니다.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {spiderSuites.map((app, index) => (
                <SpiderSuiteCard
                  key={app.title}
                  app={app}
                  animationIndex={spiderApps.length + index}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="line-dashboard" className="scroll-mt-24 bg-white px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[1440px]">
            <LineAnomalyDashboard />
          </div>
        </section>
      </main>

      <footer className="bg-[#f5f5f7] px-5 py-12 text-xs text-[#7a7a7a] sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 border-t border-[#d2d2d7] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span>ETCH SPIDER</span>
          <span>공정 이상감지 통합 서비스</span>
        </div>
      </footer>
    </div>
  )
}

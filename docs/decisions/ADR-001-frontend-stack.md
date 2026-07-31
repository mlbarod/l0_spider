# ADR-001: 프론트엔드 기술 스택 기준선

## 상태

`Accepted — As-Is Baseline`

현재 `main`에서 React 19, Vite 6, shadcn/ui New York 구성, Radix UI, Tailwind CSS 4, Recharts, Lucide React와 TanStack React Query가 선언되고 실제 화면 코드에서 사용된다.
이 상태는 과거에 모든 대안을 비교해 최적안을 선택했다는 의미가 아니라, 운영 중 화면·route·API 소비의 호환성을 보존하기 위한 현재 구현 기준선이다.

## 결정 날짜

2026-07-31

## 적용 범위

- `src/main.jsx`에서 시작하는 React SPA와 `react-router-dom` route
- `src/features/fdc-trend/`의 Dashboard, Self Equipment, 동일성·공통부, 등록과 사용자 메뉴얼 화면
- `src/components/ui/`의 로컬 UI component와 theme·style token
- Vite 개발·build 설정과 Node 통합 서버의 frontend 제공 경계
- React Query 기반 API server state와 Recharts 기반 chart
- 프론트엔드 기술 변경에 연동되는 unit·contract·browser 검증 경계

## 관련 문서

- `docs/system/overview.md`, `docs/system/architecture.md`
- `docs/system/environment-definition.md`, `docs/system/security.md`
- `docs/features/dashboard.md`, `docs/features/self-equipment.md`
- `docs/features/abnormal-data.md`

## 1. 컨텍스트

L0 Spider frontend는 하나의 SPA에서 Line Dashboard, Self Equipment, 동일성·공통부 이상 결과, 등록과 사용자 메뉴얼을 route별로 제공한다.
화면은 여러 종속 filter와 query parameter를 처리하고 Node의 상대 `/api/*`를 호출해 KPI·표·Parquet 기반 chart·image와 등록 상태를 표시한다.
사용자 선택에 따라 query를 재실행하고 mutation 뒤 관련 cache를 무효화하며, 많은 EQP·sensor 결과는 pagination과 조건부 chart mount로 제한한다.
동일한 button, dialog, table, input, theme와 icon을 여러 화면에서 재사용하면서 PC 화면의 일관된 상태·오류·빈 데이터 표현을 유지해야 한다.

현재 frontend는 JavaScript·JSX로 작성돼 있다.
`components.json`은 `tsx: false`이고 `jsconfig.json`은 `@/*`, `components/*` alias만 정의한다.
tracked `tsconfig*.json`과 TypeScript compile 계약은 확인되지 않았다.

## 2. 결정 동인

| 동인 | 현재 요구 | 중요성 |
|---|---|---|
| 기존 route 호환성 | `/`, `/self-equipment`, 이상감지·등록·메뉴얼 route와 alias 유지 | 높음 |
| 비동기 server state | Dashboard·filter option·chart·등록 조회와 mutation invalidation | 높음 |
| 데이터 시각화 | KPI, Line 추이, scatter·identity chart와 tooltip | 높음 |
| UI 일관성 | 공통 button·card·dialog·table·theme·responsive class 재사용 | 높음 |
| 접근 가능한 primitive | dialog, select, checkbox, tooltip 등의 focus·keyboard 기반 | 높음 |
| build·server 연계 | Vite build와 `server.mjs`의 middleware·`dist` 제공 | 높음 |
| 변경 검증 | API 계약, filter utility와 browser 동작의 회귀 범위 추적 | 높음 |

## 3. 기술 확인 결과

버전은 `package.json`의 선언 범위와 `package-lock.json`의 현재 해석 결과를 구분한다.
lockfile은 `package-lock.json` v3이며 package manager의 정확한 실행 버전은 `Unknown`이다.

| 기술 | manifest 선언 | lock 해석 | 실제 역할 | 대표 사용 위치 | 판정 |
|---|---|---|---|---|---|
| React 19 | `react`, `react-dom` `^19.0.0` | `19.2.0` | SPA component·hook와 `createRoot`, `StrictMode` | `src/main.jsx`, feature page·component | `Confirmed — Used` |
| Vite | `vite` `^6.0.0`, `@vitejs/plugin-react` `^5.1.1` | `6.4.1`, plugin `5.1.1` | JSX 개발·build, alias, dev middleware와 HMR 설정 | `package.json`, `vite.config.mjs` | `Confirmed — Used` |
| shadcn/ui New York | runtime package 없음; `components.json` | 해당 없음 | New York 스타일 기준으로 생성·관리되는 로컬 UI source | `components.json`, `src/components/ui/`, feature의 `@/components/ui/*` import | `Confirmed — Local Components` |
| Radix UI | `@radix-ui/react-*` 개별 package | package별 lock 고정 | shadcn local component의 dialog·select·checkbox·tabs·tooltip 등 primitive | `src/components/ui/dialog.jsx`, `select.jsx`, `checkbox.jsx`, `tabs.jsx` | `Confirmed — Used` |
| Tailwind CSS 4 | `tailwindcss` `^4`, `@tailwindcss/postcss` `^4` | 둘 다 `4.1.16` | utility class, CSS variable theme, dark variant와 animation | `postcss.config.mjs`, `src/styles/globals.css`, `tokens.css`, JSX `className` | `Confirmed — Used` |
| Recharts | `recharts` `^3.3.0` | `3.3.0` | Dashboard bar·line, ERD scatter·identity, 공통 chart·tooltip | `LineAnomalyDashboard.jsx`, `FdcTrendPage.jsx`, `src/components/ui/chart.jsx` | `Confirmed — Used` |
| Lucide React | `lucide-react` `^0.548.0` | `0.548.0` | 메뉴·상태·action icon과 shadcn component icon | `L0SpiderHomePage.jsx`, feature page, `src/components/ui/*` | `Confirmed — Used` |
| TanStack React Query | `@tanstack/react-query` `^5.61.3` | `5.90.11` | API query·mutation, cache와 invalidation, 공통 retry·stale 정책 | `AppProviders.jsx`, `src/lib/queryClient.js`, Dashboard·Self·등록 page | `Confirmed — Used` |

후보 8개 중 “선언됨·사용 위치 미확인”으로 남은 기술은 없다.
반면 인접 dependency인 `babel-plugin-react-compiler`와 `plotly.js-dist-min`은 manifest에 선언돼 있지만 현재 Vite 설정·source import에서 사용 위치를 확인하지 못했으므로 이 ADR의 사용 기술로 포함하지 않는다.

## 4. 기술별 현재 역할

### 4.1 React와 route

`src/main.jsx`는 `ReactDOM.createRoot` 아래 `AppProviders`와 `RouterProvider`를 구성한다.
`src/routes/router.jsx`와 `src/features/fdc-trend/routes.jsx`가 SPA route와 `/fdc_trend` alias를 정의한다.
React local state·memo·effect는 종속 filter, pagination, dialog, chart interaction과 등록 form을 담당한다.

### 4.2 Vite와 frontend 제공

Vite는 React plugin, `@`·`components` alias, 개발 server와 일부 API middleware를 구성한다.
`package.json`의 `dev`와 `build` script가 Vite를 사용하고, 통합 `server.mjs`는 환경에 따라 Vite middleware 또는 build된 `dist`를 제공한다.
Vite 단독 middleware와 full Node server의 API route 범위는 같지 않으므로 실행 mode를 frontend 기능 계약과 분리할 수 없다.

### 4.3 shadcn/ui, Radix UI와 Tailwind CSS

shadcn/ui는 독립 runtime framework가 아니다.
`components.json`의 `style: "new-york"`, `rsc: false`, `tsx: false`, CSS variable·Lucide 설정을 기준으로 `src/components/ui/`에 component source가 저장된다.
일부 component는 Radix primitive를 감싸고, 다른 component는 React element와 Tailwind class·`class-variance-authority`를 조합한다.

Tailwind CSS 4는 `@tailwindcss/postcss`와 `@import "tailwindcss"` 방식으로 연결된다.
별도 `tailwind.config.*`는 없고 `globals.css`·`tokens.css`의 `@theme`, CSS variable, dark variant와 JSX utility class가 현재 style 계약이다.

### 4.4 React Query

`AppProviders`가 한 개의 `QueryClientProvider`를 제공한다.
`createQueryClient()`는 query `staleTime` 60초, retry 1회, window focus 재조회 비활성화를 공통 기본값으로 둔다.
각 기능은 `useQuery`, `useMutation`, `useQueryClient`로 조회 상태와 mutation 뒤 cache invalidation을 관리한다.

### 4.5 Recharts와 Lucide React

Recharts는 Dashboard와 이상 데이터 화면의 bar·line·scatter·reference line·tooltip·responsive container에 사용된다.
chart data shape, axis key, tooltip payload와 실제 mount 수는 화면 성능·표현 계약의 일부다.
Lucide React는 화면과 로컬 UI component의 icon source이며 icon 이름·크기·접근성 속성은 메뉴와 action layout에 직접 영향을 준다.

## 5. 결정

현재 Core Harness의 frontend As-Is 기준선으로 다음을 유지한다.

1. React 19 SPA와 현재 React Router route·alias 구조를 유지한다.
2. Vite 6 build·development 도구와 Node 통합 제공 방식을 유지하되 실행 mode별 API 범위 차이를 명시한다.
3. shadcn/ui New York 기반의 로컬 `src/components/ui/` source를 UI 재사용 기준으로 사용한다.
4. 접근성·interaction primitive는 현재 Radix UI wrapper 계약을 유지한다.
5. Tailwind CSS 4 utility와 CSS variable token을 style·theme 기준으로 유지한다.
6. server state는 TanStack React Query, chart는 Recharts, 공통 icon은 Lucide React를 기준으로 유지한다.
7. major upgrade나 기술 교체는 route·API·UI·chart·test migration을 함께 설계한 경우에만 수행한다.

이 결정은 dependency를 영구 고정하거나 현재 조합이 유일한 해법이라고 선언하지 않는다.
현재 동작을 보존하기 위한 승인된 기준선이다.

## 6. 장점과 현재 효과

- React component와 로컬 UI source를 통해 화면 구조와 interaction을 기능 단위로 재사용한다.
- shadcn/Radix/Tailwind 조합이 component source, primitive behavior와 theme token의 수정 위치를 분리한다.
- React Query가 loading·error·cache·retry와 mutation invalidation의 공통 언어를 제공한다.
- Recharts가 Dashboard·scatter·identity 시각화를 React component tree 안에서 일관되게 구성한다.
- Lucide가 메뉴·button·상태 icon의 시각 언어를 통일한다.
- Vite가 JS/JSX 개발과 build를 제공하고 Node server가 동일 frontend를 API와 함께 제공할 수 있다.

## 7. 제약과 부정적 결과

| 제약 | 영향 | 관리 기준 |
|---|---|---|
| local shadcn source | upstream component 갱신이 자동 적용되지 않고 local diff 검토가 필요 | 생성 도구로 무조건 덮어쓰지 않고 현재 component API·style 보존 |
| Radix·Tailwind 결합 | primitive API, `data-*` state와 class 변경이 dialog·select 등 여러 화면에 파급 | wrapper와 소비 화면을 함께 검토 |
| Tailwind CSS 4 방식 | CSS-first theme·PostCSS 연결을 이전 major 방식으로 오인할 수 있음 | 현재 `globals.css`, `tokens.css`, PostCSS를 기준으로 유지 |
| React Query cache 결합 | query key·default option·invalidation 변경이 stale UI나 과도한 재조회 유발 가능 | API consumer와 mutation 회귀 검증 |
| Recharts data 결합 | data shape·axis·tooltip·responsive 변경이 의미와 성능에 영향 | synthetic chart data와 mount 범위 검증 |
| Vite·Node 이중 실행 | 단독 Vite와 full server의 API surface 차이 | 통합 기능 검증의 entrypoint를 명시 |
| JS/JSX | TypeScript compile 기반 prop·API shape 검증이 없음 | 실행 가능한 API Schema·contract와 좁은 unit test로 보완 |
| dependency 규모 | major·peer upgrade와 bundle 변화가 복합적으로 발생 가능 | lockfile 단일 갱신, release diff와 bundle 측정 |

production bundle 크기, browser runtime memory, accessibility 회귀와 현재 dependency 취약점은 이번 정적 조사에서 측정하지 않아 `Unknown`이다.

## 8. 현재 기준선 평가를 위한 비교 대안

아래 항목은 과거에 실제 채택 심사를 했다는 기록이 아니라 현재 구조를 평가하기 위한 비교 대안이다.

| 비교 대안 | 잠재 효과 | 현재 기준선에서 채택하지 않는 이유 |
|---|---|---|
| 다른 SPA framework 또는 SSR framework | routing·server rendering·toolchain 재구성 가능 | 현재 React component·route·provider를 광범위하게 교체하고 Node API·딥링크 호환 위험이 큼 |
| 완전한 외부 UI framework | component와 theme를 package 단위로 통합 가능 | 현재 local shadcn source·Radix behavior·Tailwind token을 대규모 치환해야 함 |
| 순수 custom component, Radix 제거 | dependency 축소 가능 | focus·keyboard·portal behavior를 자체 소유해야 하며 기존 dialog·select 회귀 범위가 큼 |
| CSS Modules·CSS-in-JS | style scope와 component 결합 방식 변경 가능 | 현재 utility class·CSS variable·dark theme의 전면 migration 필요 |
| native fetch와 custom global store | dependency 축소 가능 | cache, retry, loading, invalidation과 query dedupe를 화면별로 다시 구현해야 함 |
| D3·Plotly·Canvas 중심 chart | 세밀한 대용량 시각화 제어 가능 | 현재 Recharts component·tooltip·axis 계약과 테스트 기준을 다시 작성해야 함 |

`plotly.js-dist-min`의 manifest 선언만으로 Plotly가 현재 chart 대안으로 채택됐거나 사용 중이라고 판단하지 않는다.

## 9. 변경 영향

| 변경 대상 | 함께 검토할 범위 | 필수 확인 |
|---|---|---|
| React·Router major | `main.jsx`, providers, route alias, query parameter와 lazy/error boundary | 직접 URL·뒤로가기·화면 mount 호환 |
| Vite·React plugin | build, alias, middleware, HMR, `server.mjs`, `dist` 제공 | 단독·통합 mode와 API route parity |
| shadcn/Radix | `src/components/ui/`, feature import, focus·portal·keyboard behavior | 메뉴·form·dialog·table 사용자 흐름 |
| Tailwind | PostCSS, CSS import, token, dark/theme class와 responsive layout | 주요 화면·사용자 메뉴얼 image 영향 |
| React Query | provider, query key, retry·stale option, mutation invalidation | loading·error·empty·stale data 회귀 |
| Recharts | chart data adapter, axis, tooltip, responsive size와 pagination | Dashboard count 의미, scatter·identity 출력과 mount 수 |
| Lucide | icon import, size, label·`aria-hidden`과 button layout | 의미 전달과 접근성 |

API field 변경은 frontend consumer와 JSON Schema·fixture·contract test를 함께 갱신한다.
route·메뉴·query 변경은 Dashboard detail link, STEP/My EQP link와 사용자 메뉴얼을 함께 검토한다.
chart 변경은 off-page chart가 불필요하게 mount되지 않는지와 빈·부분 데이터 표현을 확인한다.

## 10. Mismatch·Unknown·Risk

### Mismatch

- Vite 단독 middleware는 full `server.mjs`보다 API route가 적다. 같은 SPA라도 실행 mode에 따라 등록·MY EQP·이력 기능 가용성이 달라질 수 있다.

### Unknown

- 공식 지원 Node.js·browser matrix와 package manager 정확한 버전
- TypeScript 도입 의도와 현재 JS/JSX의 장기 유지 정책
- `babel-plugin-react-compiler`, `plotly.js-dist-min` 등 선언만 된 dependency의 보존 목적
- production bundle·source map, browser 성능·memory와 accessibility 측정 결과
- 각 major dependency의 upgrade cadence·owner와 보안 patch SLA

### Risk

- major version을 개별적으로 올리면 React peer dependency, Radix wrapper, Tailwind build와 Recharts rendering이 연쇄적으로 깨질 수 있다.
- Vite 단독 실행 결과를 full application 검증으로 오인하면 일부 API 회귀를 놓칠 수 있다.
- local shadcn component를 재생성으로 덮어쓰면 기존 style·interaction 수정이 사라질 수 있다.
- frontend에 전달된 업무 payload와 query cache가 browser memory에 머무르므로 secret을 client bundle·`VITE_*`에 넣지 않는다.

## 11. 재검토 조건

다음 중 하나가 발생하면 이 ADR을 재검토한다.

- React, Vite, Tailwind, React Query 또는 Recharts major upgrade
- route 구조, SSR·multi-page 또는 frontend/server 분리 도입
- 현재 chart가 데이터량·interaction·접근성 요구를 충족하지 못한다는 측정 근거 확보
- design system 전환 또는 shadcn/Radix component 대규모 재생성
- TypeScript 도입과 API type 생성 전략 승인
- Vite 단독·통합 server의 API route parity 해결 또는 실행 기준 변경
- bundle·browser 성능, dependency 보안 또는 접근성 기준 미달 확인

재검토 시 현재 route·API·사용자 메뉴얼 호환, migration 순서, rollback과 검증 증거를 함께 기록한다.

## 12. `main`과 `mock-agent` 경계

- `main`은 실제 frontend source, route, UI component, dependency·lockfile, API 계약과 운영 자원 비의존 unit·contract 검증의 기준이다.
- `main`의 build와 문서는 `mock-agent`의 server·data·fixture·Playwright에 의존하지 않는다.
- `mock-agent`는 `main`의 route·API·UI 계약을 따라 mock 기반 browser QA와 성능 검증을 확장할 수 있다.
- mock server·mock data·mock 의존 E2E와 Playwright 결과는 frontend 기술 선택의 구현 근거가 아니며 `main` 병합 대상도 아니다.
- mock 검수에서 발견한 실제 frontend 결함은 현재 `main`에서 다시 확인한 뒤 코드 수정과 보고서를 별도로 선별한다.

## 13. 검증 의무

기술 스택 변경 시 저장소에서 확인된 범위에 맞춰 다음을 검토한다.

1. `package.json`과 `package-lock.json`의 단일·의도된 변경
2. lint와 Vite build
3. 운영 자원 비의존 unit·contract test
4. route·query·API consumer와 Dashboard·Self·이상 데이터 화면 영향
5. CSS token, dark theme, responsive layout와 component 접근성
6. chart 의미·빈 데이터·pagination·mount 수
7. browser 검증이 필요하면 `mock-agent` 경계에서 수행하고 결과를 Core 기준선과 구분

실행하지 않은 검증은 `Not Run`, 일부만 확인한 검증은 `Partial`로 기록한다.

## 14. 결정 결과

현재 구현이 충분히 확인됐으므로 frontend 조합을 `Accepted — As-Is Baseline`으로 기록한다.
새 기능은 기존 component·style·server-state·chart 패턴을 우선 재사용한다.
기술 교체는 별도 ADR과 호환 migration 없이 기능 개발에 부수적으로 수행하지 않는다.

## 15. 근거

| 근거 | 확인 내용 |
|---|---|
| `package.json`, `package-lock.json` | candidate dependency 선언과 현재 lock 해석 버전 |
| `components.json` | New York, JS/JSX, CSS variable, Lucide와 alias 설정 |
| `vite.config.mjs`, `postcss.config.mjs` | Vite React plugin·alias·middleware, Tailwind PostCSS 연결 |
| `jsconfig.json`, `src/styles/{globals,tokens}.css` | JS alias와 Tailwind CSS 4 theme·token |
| `src/main.jsx`, `src/routes/router.jsx`, `src/features/fdc-trend/routes.jsx` | SPA entry와 route 구조 |
| `src/components/common/AppProviders.jsx`, `src/lib/queryClient.js` | React Query provider와 default option |
| `src/components/ui/` | local shadcn source와 Radix·Tailwind·Lucide·Recharts wrapper |
| `LineAnomalyDashboard.jsx`, `FdcTrendPage.jsx`, 이상 데이터 page | React Query·Recharts·Lucide·공통 UI 실제 소비 |
| 관련 system·feature 문서 | 화면 요구, 실행 mode Mismatch, 보안·data flow 경계 |

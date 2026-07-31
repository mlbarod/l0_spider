# L0 Spider Browser QA 및 UX 종합 검수 보고서

## 종합 결론

Chromium 실행 장애는 해소되었고 기존 Playwright E2E는 **6/6 통과**했다. 주요 라우트의 직접 진입·새로고침·뒤로/앞으로, Dashboard 검색·필터·정렬, 대량 동일성 이미지 페이지 이동, 등록 화면, 세 가지 데스크톱 해상도는 정상 동작했다.

다만 **Dashboard가 부분 데이터와 조회 범위 밖 데이터를 오류나 경고 없이 정상 결과처럼 표시하는 P0 문제 2건**이 각각 5/5 재현되었다. 우선 API 응답의 합계-상세 및 요청-응답 범위 정합성을 검증하고, 불일치 시 결과 사용을 중단해 명시적 오류 상태를 표시해야 한다. 그다음 자설비 Mock 계약 오류, 권한 오류 안내, 404 복구 동선, URL-화면 상태 동기화, 테스트 커버리지와 필터 검색 접근성 이름을 보완하는 것이 권장된다.

## 실행 개요

- 증거 상태: `Confirmed`, `Mismatch`, `Unknown`을 항목별 표기
- 브랜치 / 기준 commit: `agent/browser-qa` / `6beba6d`
- 브라우저: Chromium, Playwright `1.61.1`
- 환경: WSL2 Linux, Node.js `22.22.1`
- viewport: `1920×1080`, `1440×900`, `1366×768`
- 데이터: 합성 Mock만 사용, 운영 자원 변경 없음
- 필수 시나리오: 16종 모두 실행
- 결과 요약: P0 2건, P1 1건, P2 4건, P3 1건
- 상태 요약: 확인됨 7건, 잠재 위험 1건

## 기존 검증 실행 결과

| 명령 | 결과 | 비고 |
|---|---:|---|
| `npm run test:e2e` | Pass | Chromium 6/6, 약 1.1분 |
| `npm run lint` | Pass | 오류 없음 |
| `npm run test:unit` | Pass | `tests/unit/*.test.mjs`만 실행 |
| `npm run test:integration` | Pass | 합성 Mock integration |
| `npm run test:contract` | Pass | 권한 허용 재실행에서 51개 통과 |
| 기존 colocated unit 직접 실행 | Pass | `server/`와 프런트 API·utils 22개 subtest 통과 |

첫 `test:contract` 실행의 loopback bind 실패와 직접 진단 명령의 `connect EPERM`은 권한 허용 재실행에서 해소되었으므로 제품 결함으로 판정하지 않았다.

## 시나리오 실행표

| 시나리오 | 주요 확인 결과 | 판정 |
|---|---|---|
| normal | 8개 라우트, 직접 URL, 새로고침, 뒤로/앞으로, 필터·검색·정렬·등록 확인 | 대체로 정상. 자설비 chart는 BQA-003 제한 |
| empty | 기존 E2E 및 ad-hoc 브라우저에서 정상 렌더 | Pass |
| single | Dashboard 기본 렌더 | Pass |
| partial | KPI 8건과 상세 0건을 동시에 정상 표시 | BQA-001 |
| slow | 로딩 상태 표시 후 완료 | Pass |
| error-400 | 오류 상태 표시 | Pass, 메시지 UX는 BQA-004 참조 |
| error-401 | 기술 메시지 노출, 권한·복구 안내 없음 | BQA-004 |
| error-403 | 기술 메시지 노출, 권한·복구 안내 없음 | BQA-004 |
| error-404 | API 오류 상태 표시 | Pass, 라우트 404는 BQA-005 참조 |
| error-500 | 기존 E2E와 ad-hoc 검증에서 오류 상태 표시 | Pass |
| error-502 | 오류 상태 표시 | Pass |
| timeout | 로딩 중 Manual 화면 이탈 정상 | Pass |
| race-condition | 조회 버튼 비활성화·로딩 표시, 동일 필터 요청만 유지 | Pass |
| inconsistent | 선택 범위 밖 라인을 경고 없이 표시 | BQA-002 |
| edge-values | Dashboard가 Router 오류 없이 렌더 | Partial: 값별 시각 검증은 제한적 |
| large | Dashboard 렌더, 동일성 이미지 1,200건을 페이지당 18개씩 표시 | Pass |

정상 시나리오 주요 화면에서는 page error가 없었다. 탐색 종료 시 진행 중 요청의 `ERR_ABORTED`는 페이지 이동·context 종료에 따른 것으로 제품 오류에서 제외했다. 4xx/5xx 시나리오의 브라우저 console resource 오류는 의도한 API 실패와 일치한다.

---

## BQA-001 — 부분 응답의 합계와 상세 불일치를 정상 화면으로 표시

- 심각도: **P0 (Critical)**
- 상태 / 근거 상태: 확인됨 / `Confirmed`
- 신뢰도: 높음
- 대상 화면: 메인 `라인별 이상 현황 Dashboard`
- 관련 API: `GET /api/dashboard-data`
- 관련 파일 및 위치: `src/features/fdc-trend/api/dashboardApi.js:19-29`, `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:435-496`, `:622-630`
- 재현 횟수: **5/5**

### 재현 절차

1. Mock 시나리오를 `partial`로 설정한다.
2. 메인 화면에 직접 진입한다.
3. `전체 이상 건수` KPI와 `라인별 상세 현황`을 비교한다.

### 기대 동작

합계와 상세가 일치해야 한다. 부분 응답이라면 데이터가 완전하지 않음을 알리고 KPI·차트·상세를 정상 결과로 확정 표시하지 않아야 한다.

### 실제 동작

KPI는 `8건`을 표시하지만 상세 표는 `조회 조건에 해당하는 라인 데이터가 없습니다.`를 표시한다. 불일치·부분 데이터 경고는 0개였다.

### 확인 근거

- 스크린샷: `artifacts/browser-qa/2026-08-01_0233/screenshots/dashboard-partial-integrity.png`
- 반복 결과: `network/focused-recheck-results.json`, `network/critical-recheck-results.json`
- 코드: API 클라이언트는 배열 존재 여부만 확인하며 합계와 상세의 상호 정합성은 확인하지 않는다. 화면은 수신한 `summary`와 `lineSummary`를 각각 그대로 렌더한다.

### 권장 수정 방향

서버 계약과 프런트 경계에서 합계-상세 불변조건을 검증하고, 위반 시 전용 `부분 데이터/정합성 오류` 상태로 전환한다. 임의로 0이나 빈 배열로 보정하지 않는다.

### 수정 후 검증 기준

동일 시나리오에서 KPI 8건과 상세 0건이 동시에 정상 표시되지 않고, 사용자에게 불일치 사유와 재조회/문의 동선이 보인다.

---

## BQA-002 — 선택하지 않은 라인이 조회 결과에 포함되어도 경고가 없음

- 심각도: **P0 (Critical)**
- 상태 / 근거 상태: 확인됨 / `Confirmed`
- 신뢰도: 높음
- 대상 화면: Dashboard 라인 필터
- 관련 API: `GET /api/dashboard-data?line=...`
- 관련 파일 및 위치: `src/features/fdc-trend/api/dashboardApi.js:3-31`, `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:390-479`, `:622`
- 재현 횟수: **5/5**

### 재현 절차

1. Mock 시나리오를 `inconsistent`로 설정한다.
2. Dashboard에서 합성 라인 `LINE_A`만 선택하고 조회한다.
3. 상세 표와 경고 메시지를 확인한다.

### 기대 동작

요청 범위 밖 라인은 표시하지 않아야 한다. 응답이 요청 범위를 위반하면 전체 결과를 신뢰 불가로 처리하고 명시적 오류를 보여야 한다.

### 실제 동작

요청은 `LINE_A`만 포함했지만 상세 표에 범위 밖 합성 라인 `LINE_C`도 표시된다. 불일치 관련 경고는 0개였다.

### 확인 근거

- 스크린샷: `artifacts/browser-qa/2026-08-01_0233/screenshots/dashboard-inconsistent-scope.png`
- Network: 필터 요청은 `line=LINE_A`; 화면 표에는 `LINE_C` 존재
- 반복 결과: `network/focused-recheck-results.json`, `network/critical-recheck-results.json`
- 코드: 요청 lines와 응답 `filters.lines`, `lineSummary[].lineId`, `dailyTrend[].lineId`의 포함 관계를 검증하는 경로가 없다.

### 권장 수정 방향

서버에서 필터 범위를 강제하고 프런트에서도 응답의 line 집합이 요청 집합의 부분집합인지 검증한다. 위반한 응답은 표시하지 말고 범위 불일치 상태를 노출한다.

### 수정 후 검증 기준

`LINE_A` 단독 조회에서 다른 라인은 절대 정상 표시되지 않으며, 고의적 범위 위반 응답은 오류 상태로 처리된다.

---

## BQA-003 — 정상 자설비 Mock이 모든 행을 제거해 핵심 chart 검수가 차단됨

- 심각도: **P1 (High)**
- 상태 / 근거 상태: 확인됨 / `Mismatch`
- 신뢰도: 높음
- 대상 화면: `자설비 이상감지`
- 관련 API: `GET /api/self-equipment-data`
- 관련 파일 및 위치: `mock/utils/http.mjs:47-55`, `mock/generators/synthetic-data.mjs:256-260`
- 재현 횟수: 2/2 브라우저 흐름, 결정적 코드 근거
- 제품 구현 판정: `Unknown` — Mock 오류로 정상 chart 동작을 판단할 수 없음

### 재현 절차

1. `normal` 시나리오에서 자설비 화면에 직접 진입한다.
2. STEP, `eqp_ch=ALL`, `sensor=ALL`, `ch_step=ALL`을 순서대로 선택한다.
3. 응답 행 수와 화면 chart 수를 확인한다.

### 기대 동작

합성 정상 데이터가 필터 조건에 맞는 행과 chart를 반환해 주요 자설비 흐름을 검수할 수 있어야 한다.

### 실제 동작

HTTP 200이며 선택 옵션은 존재하지만 `rows=0`, 화면은 `0 charts`와 빈 상태를 표시한다.

### 확인 근거

- 스크린샷: `artifacts/browser-qa/2026-08-01_0233/screenshots/self-equipment-normal-zero-data.png`
- 측정: `availablePriorities=5`, `steps=2`, `eqpChannels=2`, `sensors=2`, `chSteps=2`, `rows=0`
- 코드: query parser는 `line`을 배열로 만들지만 generator는 `row.line_rev === params.line` 문자열 비교를 수행한다.

### 권장 수정 방향

`mock-agent`에서 `line` 계약을 단일 문자열 또는 명시적 배열 중 하나로 통일하고 contract test를 추가한다. 이 변경은 실제 서비스 코드가 아니라 Mock Validation Extension 범위에서 처리한다.

### 수정 후 검증 기준

`normal` 자설비 최종 필터 응답에 합성 행과 chart가 존재하고, chart 렌더·페이지 이동·툴팁·이미지/빈 상태를 다시 Browser QA할 수 있어야 한다.

---

## BQA-004 — 401/403에서 기술 메시지만 표시하고 권한 안내·재시도 수단이 없음

- 심각도: **P2 (Medium)**
- 상태 / 근거 상태: 확인됨 / `Confirmed`
- 신뢰도: 높음
- 대상 화면: Dashboard 초기 로딩 오류
- 관련 API: `GET /api/dashboard-data`
- 관련 파일 및 위치: `src/features/fdc-trend/api/dashboardApi.js:13-17`, `src/features/fdc-trend/api/errorMessage.js:19-20`, `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:424-430`
- 재현 횟수: 401 2/2, 403 2/2

### 재현 절차

1. `error-401` 또는 `error-403` 시나리오로 메인 화면에 진입한다.
2. 오류 메시지와 실행 가능한 복구 수단을 확인한다.

### 기대 동작

인증/권한 문제임을 사용자 언어로 설명하고 로그인, 관리자 문의, 재시도 등 가능한 다음 행동을 제공해야 한다.

### 실제 동작

합성 기술 메시지가 그대로 보이며 권한 안내와 재시도 버튼은 없다. 브라우저 console에는 해당 HTTP 실패가 기록된다.

### 확인 근거

- 스크린샷: `artifacts/browser-qa/2026-08-01_0233/screenshots/dashboard-error-403-guidance.png`
- 반복 결과: `network/focused-recheck-results.json`
- 코드: 상태 코드별 UX 분기 없이 payload의 `error` 문자열을 그대로 표시한다.

### 권장 수정 방향

401/403/재시도 가능한 서버 오류를 상태별 사용자 메시지와 복구 동작으로 매핑하되, 원문 기술 정보는 사용자 화면과 분리한다.

---

## BQA-005 — 알 수 없는 URL이 개발자용 Router 오류 화면과 console error를 노출

- 심각도: **P2 (Medium)**
- 상태 / 근거 상태: 확인됨 / `Confirmed`
- 신뢰도: 높음
- 대상 화면: 존재하지 않는 직접 URL
- 관련 파일 및 위치: `src/routes/router.jsx:13-18`, `src/features/fdc-trend/routes.jsx:11-67`
- 재현 횟수: **3/3**

### 재현 절차

1. 존재하지 않는 합성 경로에 직접 진입한다.
2. 화면 문구, 메인 복귀 링크, console을 확인한다.

### 기대 동작

서비스 스타일의 404 안내와 메인 복귀 동선을 제공하고 개발자 안내는 사용자에게 노출하지 않아야 한다.

### 실제 동작

React Router 기본 `Unexpected Application Error`, `404 Not Found`, 개발자 안내가 표시된다. 메인 복귀 링크는 0개이고 console error는 매번 2건 발생했다.

### 확인 근거

- 브라우저 결과: `network/browser-qa-results.json`
- 코드: catch-all route와 route error element가 정의되어 있지 않다.
- 보안 유의: 개발 화면의 내부 정보 포함 가능성을 고려해 스크린샷은 보고 증거로 첨부하지 않았다.

### 권장 수정 방향

제품 전용 `errorElement`와 `*` 404 route를 추가하고 메인 복귀·이전 페이지 이동을 제공한다. 내부 stack/개발자 문구는 사용자 화면에서 제외한다.

---

## BQA-006 — 동일 문서에서 query가 바뀌어도 자설비 선택 상태가 갱신되지 않음

- 심각도: **P2 (Medium)**
- 상태 / 근거 상태: 잠재 위험 / `Confirmed` 동작 + 도달 경로 `Unknown`
- 신뢰도: 중간
- 대상 화면: 자설비 deep link 및 history 상태
- 관련 파일 및 위치: `src/features/fdc-trend/pages/FdcTrendPage.jsx:1440-1463`
- 재현 횟수: **3/3**

### 재현 절차

1. 같은 탭에서 `line=LINE_A` query의 자설비 deep link를 연다.
2. 브라우저 history API로 같은 pathname의 query를 `line=LINE_B`로 변경하고 `popstate`를 발생시킨다.
3. URL과 선택된 Line Name을 비교한다.

### 기대 동작

URL query가 바뀌면 화면 필터도 새 query를 반영하거나, 지원하지 않는 변경이면 명시적으로 재로딩해야 한다.

### 실제 동작

URL은 `LINE_B`지만 선택 UI는 계속 `LINE_A`를 표시했다.

### 확인 근거

- 반복 결과: `network/browser-qa-results.json`
- 코드: `requestedFilters`는 갱신되지만 관련 state는 최초 `useState` initializer에서만 사용된다.
- 제한: 현재 화면에서 동일 pathname query를 변경하는 내부 링크는 확인하지 못했다. 따라서 일반 사용자 도달성은 판단 불가이며 확정 사용자 결함이 아닌 잠재 위험으로 분류한다.

### 권장 수정 방향

query 변경 시 상태를 일관되게 동기화하고, 실제 Link/뒤로가기 흐름으로 회귀 E2E를 추가한다. 초기화 중인 사용자 선택을 무조건 덮지 않도록 동기화 규칙을 명시한다.

---

## BQA-007 — 기본 unit 명령이 기존 22개 colocated unit test를 실행하지 않음

- 심각도: **P2 (Medium)**
- 상태 / 근거 상태: 확인됨 / `Mismatch`
- 신뢰도: 높음
- 대상 기능: 회귀 검증 명령
- 관련 파일 및 위치: `package.json:13`, `docs/operations/release-checklist.md:106-113`
- 재현 횟수: 1/1, 별도 직접 실행 1/1

### 재현 절차

1. `npm run test:unit`의 실행 대상을 확인하고 실행한다.
2. `server/*.test.mjs`, 프런트 API·utils의 `*.test.mjs` 목록과 비교한다.
3. 기존 colocated suite를 명시적으로 실행한다.

### 기대 동작

릴리스 체크리스트의 기본 unit 명령이 저장소의 유지 중인 unit suite 전체를 실행하거나, suite가 나뉘었다면 문서가 각 명령을 명확히 열거해야 한다.

### 실제 동작

기본 명령은 `tests/unit/*.test.mjs`만 실행한다. 별도 직접 실행에서는 기본 명령에 포함되지 않은 기존 suite 22개 subtest가 모두 통과했다.

### 확인 근거

- `package.json`의 `test:unit` glob
- `rg --files`로 확인한 server/API/utils test 파일 목록
- 두 실행의 통과 범위 차이

### 권장 수정 방향

unit script를 전체 unit suite를 포함하도록 구성하거나 목적별 script로 분리하고 릴리스 체크리스트에 모두 반영한다. 적용 위치는 `mock-agent`/현재 main 정책을 재확인해야 한다.

---

## BQA-008 — 자설비 필터 검색 입력 7개가 모두 같은 접근성 이름을 사용

- 심각도: **P3 (Low)**
- 상태 / 근거 상태: 확인됨 / `Confirmed`
- 신뢰도: 높음
- 대상 화면: 자설비 필터 영역
- 관련 파일 및 위치: `src/features/fdc-trend/pages/FdcTrendPage.jsx:189-228`; 동일 패턴 `CommonalityAnomalyPage.jsx:81-105`, `CommonAnomalyPage.jsx:67-90`
- 재현 횟수: 1/1, 결정적 DOM·코드 근거

### 재현 절차

1. 자설비 화면에 진입한다.
2. 접근성 tree에서 textbox 이름을 조회한다.
3. 각 필터 검색 입력을 구분할 수 있는지 확인한다.

### 기대 동작

각 입력은 `Line Name 검색`, `SDWT 검색`, `Sensor Grade 검색`처럼 연결된 필터 제목을 포함한 고유 이름을 가져야 한다.

### 실제 동작

7개 textbox가 모두 placeholder에서 유래한 `검색…`이라는 동일한 접근성 이름으로 노출된다.

### 확인 근거

- 브라우저 측정: `getByRole("textbox", { name: "검색…" }).count() === 7`
- 결과: `network/focused-recheck-results.json`
- 코드: `FilterCard`의 title과 Input 사이에 `label`/`aria-label` 연결이 없다.

### 권장 수정 방향

`FilterCard`가 title을 포함한 고유 `aria-label` 또는 `label`/`id` 연결을 생성하도록 한다. 키보드 및 screen reader 회귀 검증을 추가한다.

## 정상 확인 항목

- 8개 주요 route 직접 진입, 새로고침, 뒤로/앞으로: 정상
- Dashboard `LINE_A` 단독 필터, 검색 empty state, 정렬 2회: 정상
- `race-condition`: submit 비활성화와 로딩 표시로 중복 필터 요청 방지
- `large` 동일성: 1페이지 18개, 2페이지 18개, `19–36 / 1,200 images` 표시
- 등록 화면: Mailing/My EQP 펼치기와 입력 없음 안내 정상
- 공통부 필터 최종 결과: 합성 카드 8개 렌더
- `1366×768` 주요 5개 route: body/document 가로 overflow 없음
- `1920×1080`, `1440×900`, `1366×768` 메인: 잘림·겹침 관찰 안 됨

## 실행 실패 및 제한사항

- 자설비 chart·pagination·tooltip의 정상 데이터 검수는 BQA-003 때문에 `Unknown`이다.
- `edge-values`는 Router 오류 없는 렌더만 확인했다. 각 비정상 숫자/날짜 값이 차트에 미치는 영향은 이번 Browser QA에서 판단 불가다.
- 모바일 요구사항은 확인되지 않아 모바일 viewport는 실행하지 않았다.
- ad-hoc 탐색의 초기 8건 실패 중 7건은 접근성 이름/로케이터 불일치로 재검증에서 해소했다. 대량 pagination의 후속 text matcher 1건도 최종 `aria-current` 검증으로 정상임을 확인했다.
- trace는 수집하지 않았다. JSON·스크린샷·코드 근거로 재현성이 충분했고, 불필요한 내부 정보 저장을 피했다.

## 변경 보호 및 종료 확인

- Mock API와 프런트 프로세스는 SIGINT/SIGTERM으로 종료했고 잔여 관련 프로세스가 없음을 확인했다.
- 이번 실행에서 새로 작성한 저장소 파일은 `artifacts/browser-qa/2026-08-01_0233/`와 이 보고서뿐이다.
- 애플리케이션 소스, 테스트, 설정, 의존성은 수정하지 않았다.
- 시작 전부터 존재한 `2026-08-01_0203` 보고서·아티팩트는 수정하거나 삭제하지 않았다.

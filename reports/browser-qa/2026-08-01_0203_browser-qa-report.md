# L0 Spider Browser QA 및 UX 종합 검수 보고서

## 종합 결론

현재 근거로 P0 확정 결함은 없다. 다만 자설비의 URL과 화면 필터가 양방향으로 동기화되지 않아 같은 route의 history 이동에서 잘못된 조건이 남을 수 있는 P1 잠재 위험이 가장 중요하다. 또한 제품 전용 404·오류 복구 화면 부재, Playwright 검수 범위 누락, 중복 npm script로 인한 회귀 테스트 축소를 P2로 분류했다.

권장 수정 핵심은 ① 자설비 URL을 단일 필터 상태로 사용하고 history 변경을 회귀 테스트할 것, ② route-level 404/ErrorBoundary와 복구 동작을 제공할 것, ③ 16개 Mock 시나리오·3개 권장 viewport·핵심 필터/페이지/키보드 흐름을 Playwright에 보강할 것, ④ 중복 npm script를 제거해 전체 unit suite를 기본 명령으로 복원할 것이다.

Chromium이 page 생성 전에 공유 라이브러리 누락으로 종료되어 실제 DOM, screenshot, console/page error, 반응형 레이아웃과 16개 시나리오의 화면 표현은 `판단 불가`다. 아래 잠재 위험은 현재 코드와 실행 가능한 서버 근거로만 판정했으며 실제 브라우저 결함으로 과장하지 않았다.

## 실행 개요

- 보고서 작성 시각: 2026-08-01 02:03 KST
- 브랜치: `agent/browser-qa`
- 기준 commit: `2ec86f6`
- 검수자: Browser QA & UX Reliability Agent
- 운영체제: 개인 PC WSL Linux
- 브라우저: Playwright bundled Chromium, 시작 실패
- 권장 viewport: `1920×1080`, `1440×900`, `1366×768`
- 실제 viewport: page 생성 실패로 미설정
- 데이터: 합성 Mock만 사용
- 운영 자원 변경: 없음
- 코드·테스트·설정·의존성 변경: 없음
- 작성 파일: 본 보고서 및 `artifacts/browser-qa/2026-08-01_0203/` 증거만 추가

### 적용 지침

- `AGENTS.md`: 실제 파일을 읽었으며 저장소 전체에 적용
- 하위 `AGENTS.md`: 검색 결과 확인되지 않음
- 역할 지침: `.codex/agents/browser-qa.md`
- 실행 지침: `.codex/tasks/run-browser-qa.md`
- 공통 지침: `docs/agent-operating-guide.md`, `docs/agent-reporting-standard.md`

### 검수 범위

- 전체 frontend route와 주요 페이지 컴포넌트
- 주요 UI가 호출하는 API client와 Mock route
- Dashboard, Self Equipment, 동일성, 공통부, 등록, 사용자 매뉴얼 흐름
- 검색·종속 필터·정렬·페이지 이동·로딩·빈 데이터·오류 상태 코드 경로
- 직접 URL과 `/fdc_trend` 호환 route의 HTTP 진입
- 기존 unit, integration, contract, Playwright, lint 명령

### 제외 또는 미검수 범위

- 실제 운영 데이터, 운영 API, 운영 DB, 실제 메일과 실제 사용자
- Browser QA 역할 밖의 backend 알고리즘 전면 정적 감사
- 실제 화면 렌더링, 클릭, focus, tooltip, chart gesture, console/page error
- 실제 viewport별 잘림·겹침·가로 스크롤·반응형 동작
- browser history의 실제 back/forward 동작
- 실제 저장·삭제 mutation의 영속성: Mock은 응답만 주고 저장하지 않음

## 결과 요약

| 심각도 | 확인됨 | 잠재 위험 | 합계 |
|---|---:|---:|---:|
| P0 (Critical) | 0 | 0 | 0 |
| P1 (High) | 0 | 1 | 1 |
| P2 (Medium) | 2 | 1 | 3 |
| P3 (Low) | 0 | 0 | 0 |

브라우저 UI 결함 0건을 의미하지 않는다. 브라우저가 시작되지 않아 UI 판정 자체가 제한됐다.

## 우선순위별 문제 목록

| 우선순위 | 코드 | 제목 | 상태 | 신뢰도 |
|---|---|---|---|---|
| 1 | BQA-001 | 자설비 URL과 필터 state가 history 변경에 동기화되지 않음 | 잠재 위험 | 중간 |
| 2 | BQA-002 | 제품 전용 404·route error 복구 화면이 없음 | 잠재 위험 | 중간 |
| 3 | BQA-003 | 기존 Playwright가 필수 시나리오와 핵심 UX 흐름 대부분을 검증하지 않음 | 확인됨 | 높음 |
| 4 | BQA-004 | 중복 npm script가 기본 unit 명령의 기존 22개 검증을 숨김 | 확인됨 | 높음 |

## BQA-001 자설비 URL과 필터 state가 history 변경에 동기화되지 않음

- 상태: 잠재 위험
- 심각도: P1 (High)
- 신뢰도: 중간
- 분류: routing / back-forward / filter state / data scope
- 대상 화면 또는 기능: 자설비 이상감지 deep-link
- 관련 파일: `src/features/fdc-trend/pages/FdcTrendPage.jsx`, `src/features/fdc-trend/utils/selfEquipmentUrlFilters.mjs`, `src/features/fdc-trend/routes.jsx`
- 관련 API: `/api/self-equipment-data`, `/api/my-eqp-equipment-data`
- 연관 에이전트: Code Audit Agent
- 최초 발견 시나리오: 정적 route·state 추적
- 브라우저 및 viewport: Chromium 시작 실패, 미측정
- 재현 횟수: 0 / 3, 브라우저 재현 불가

### 문제 요약

`useSearchParams()`로 URL 변경은 감지하지만, URL에서 읽은 `requestedFilters`는 `useState` 초기값으로만 사용된다. 이후 같은 `/self-equipment` route에서 query string만 바뀌면 새 URL 값을 `selectedLine`, `selectedTeam`, `selectedGrades`, `selectedDesc`, `selectedEqpCh`에 다시 반영하는 effect가 없다. 반대로 사용자가 화면에서 선택한 sensor·ch_step·검색·chart page도 URL에 쓰지 않는다.

따라서 동일 route의 서로 다른 deep-link를 history로 오가면 주소와 화면 조건이 달라지거나, 새로고침 때 긴 필터 선택 과정이 사라질 가능성이 있다. 실제 browser history 재현은 환경 제한으로 확인하지 못했다.

### 발생 화면과 재현 절차

1. 서로 다른 Line/SDWT/Grade/STEP/EQP 조건을 가진 `/self-equipment?...` deep-link 두 개를 같은 탭의 history에 연속으로 만든다.
2. 두 번째 URL이 표시된 상태에서 browser 뒤로가기와 앞으로가기를 수행한다.
3. 주소 표시줄 query와 화면의 Line, SDWT, Grade, STEP, eqp_ch 및 실제 API 요청 조건을 비교한다.
4. 화면에서 sensor와 ch_step까지 선택한 뒤 새로고침하고 선택 상태를 비교한다.

### 기대 동작

- back/forward 시 URL과 화면 필터 및 API query가 항상 같은 조건을 가리킨다.
- 새로고침 시 URL에 표현하기로 한 필터는 복원된다.
- 복원하지 않는 임시 검색·페이지 상태는 제품 정책으로 명확히 정의된다.

### 실제 동작

- Confirmed code: URL 값은 mount 시 state 초기화에만 사용되고 이후 query 변경을 state에 반영하는 코드가 없다.
- Confirmed code: UI 변경을 URL에 반영하는 `setSearchParams` 또는 동등한 navigation이 없다.
- Unknown browser: 실제 back/forward 후 화면·요청이 어떤 조합으로 남는지는 Chromium 미실행으로 판단 불가다.

### 확인 근거

- `FdcTrendPage.jsx:1440-1463`: `requestedFilters`를 읽고 각 `useState`의 초기값으로만 사용
- `FdcTrendPage.jsx:1792-1860`: 필터 handler는 local state만 변경
- `selfEquipmentUrlFilters.mjs:23-32`: URL에서 지원하는 filter parser
- `routes.jsx:58-66`: 같은 컴포넌트가 `/self-equipment`와 호환 prefix route를 담당
- `rg setSearchParams`: 해당 페이지에서 URL 갱신 호출 없음
- screenshot/trace/console/network: page 생성 실패로 없음

### 권장 수정 방향

- URL query를 공유 가능한 filter의 단일 기준으로 삼고, popstate/search param 변경 시 파생 state를 원자적으로 갱신한다.
- 모든 UI 검색어까지 URL에 넣기보다 Line·SDWT·Grade·STEP·eqp_ch·sensor·ch_step처럼 조회 범위를 바꾸는 값부터 정의한다.
- 잘못되거나 더 이상 유효하지 않은 query는 임의 기본값으로 조용히 바꾸지 말고 사용자에게 보정 사실을 표시한다.

### 수정 후 검증 기준

- 서로 다른 deep-link A/B를 같은 탭에서 3회 back/forward해 URL, 선택 표시, 상대 API query가 모두 일치한다.
- 최종 ch_step 선택 후 새로고침해 정책상 유지 대상이 복원된다.
- 무효 query, `MY_EQP`, `step=ALL`, `eqpCh` alias를 함께 회귀 검증한다.

## BQA-002 제품 전용 404·route error 복구 화면이 없음

- 상태: 잠재 위험
- 심각도: P2 (Medium)
- 신뢰도: 중간
- 분류: direct URL / error recovery / UX
- 대상 화면 또는 기능: 알 수 없는 URL, route rendering error
- 관련 파일: `src/routes/router.jsx`, `src/features/fdc-trend/routes.jsx`, `src/main.jsx`
- 관련 API: 없음
- 연관 에이전트: Code Audit Agent
- 최초 발견 시나리오: 알 수 없는 direct URL 정적·HTTP 확인
- 브라우저 및 viewport: Chromium 시작 실패, 미측정
- 재현 횟수: HTTP 1 / 1, DOM 0 / 3

### 문제 요약

route tree에는 `path: "*"`, `errorElement` 또는 제품 전용 `ErrorBoundary`가 없다. 알 수 없는 direct URL은 Vite SPA fallback에서 HTML 200을 받지만, React Router가 제공하는 기본 오류 UI 외에 SPIDER 메인으로 돌아갈 제품 복구 동작이 정의되지 않았다. runtime render error도 동일하게 제품 전용 안내 없이 기본 경계로 갈 수 있다.

### 발생 화면과 재현 절차

1. 존재하지 않는 하위 URL을 주소창에 입력한다.
2. 새로고침한다.
3. 사용자 친화적 404 제목, 요청한 경로 안내, SPIDER 메인 이동 버튼과 기술 stack 비노출 여부를 확인한다.

### 기대 동작

존재하지 않는 URL 또는 route render 오류에서 한글 안내와 메인 복귀/재시도 동작을 제공하고, 개발자용 오류 문구나 stack을 사용자에게 노출하지 않는다.

### 실제 동작

- Confirmed HTTP: 알 수 없는 URL도 SPA HTML 200을 반환한다.
- Confirmed code: catch-all route와 custom route error boundary가 없다.
- Inferred: React Router 기본 오류 요소가 사용될 수 있다.
- Unknown browser: 실제 사용자에게 표시되는 DOM과 개발/운영 build 차이는 확인하지 못했다.

### 확인 근거

- `router.jsx:13-20`: root route에 custom `errorElement` 없음
- `routes.jsx:13-55`: 명시 route만 있고 catch-all 없음
- `matchRoutes` read-only 확인: 알 수 없는 URL은 route match가 `null`
- localhost direct URL 확인: 알 수 없는 URL도 HTML 200
- screenshot/trace/console: 없음

### 권장 수정 방향

- root에 제품 전용 `errorElement`/`ErrorBoundary`를 두고 `path: "*"` 404 화면을 제공한다.
- 기술 오류 원문은 사용자 화면에서 정제하고, 메인 이동과 안전한 재시도 버튼을 제공한다.

### 수정 후 검증 기준

- 일반 route와 `/fdc_trend` prefix의 알 수 없는 URL에서 동일한 한글 404·메인 복귀 동작을 3회 확인한다.
- 의도적으로 throw한 route component 회귀 fixture에서 stack·내부 경로가 사용자 화면에 노출되지 않는다.

## BQA-003 기존 Playwright가 필수 시나리오와 핵심 UX 흐름 대부분을 검증하지 않음

- 상태: 확인됨
- 심각도: P2 (Medium)
- 신뢰도: 높음
- 분류: Browser QA automation coverage
- 대상 화면 또는 기능: 전체 주요 사용자 흐름
- 관련 파일: `tests/e2e/mock-smoke.spec.mjs`, `tests/e2e/fixtures.mjs`, `playwright.config.mjs`
- 관련 API: 전체 Mock API
- 연관 에이전트: Browser QA / main 개발
- 최초 발견 시나리오: 기존 Playwright 목록 검토
- 재현 횟수: 정적 확인 3회 검색, 결과 동일

### 문제 요약

기존 E2E는 6개 test뿐이며 normal route smoke, Dashboard line 선택, `empty`, `slow`, `error-500`, `large`의 매우 얕은 확인만 한다. 필수 16개 시나리오 중 `single`, `partial`, `error-400/401/403/404/502`, `timeout`, `race-condition`, `inconsistent`, `edge-values`의 화면 검증이 없다.

또한 뒤로/앞으로 가기, query deep-link 복원, 검색, 정렬, 결과 pagination, 연속 클릭, 빠른 필터 변경, 권한 부족 안내, keyboard focus, 3개 권장 viewport와 등록 mutation 흐름을 검사하지 않는다. 진단 fixture는 console/page/request failure를 수집하지만 정상 통과 test에서 오류가 없음을 assertion하지 않는다.

### 발생 화면과 재현 절차

1. `tests/e2e/`와 `playwright.config.mjs`의 test·viewport·scenario 사용을 검색한다.
2. 필수 16개 시나리오와 주요 UX 항목을 test case에 대조한다.
3. `npm run test:e2e`를 실행해 실제 실행 목록을 확인한다.

### 기대 동작

기존 Browser QA suite가 필수 시나리오와 핵심 사용자 흐름을 최소 1회 자동 검증하고, console/page/request 오류와 viewport 회귀를 assertion한다.

### 실제 동작

- test 6개만 등록됨
- 5개 시나리오 종류만 test 본문에서 사용
- viewport 설정·back/forward·keyboard·pagination·race 동작 없음
- 이번 실행은 Chromium 환경 제한으로 1개 실패·5개 미실행

### 확인 근거

- `mock-smoke.spec.mjs:15-70`: 전체 6개 test
- `playwright.config.mjs:18-45`: viewport project 없음
- `fixtures.mjs:5-37`: 진단 수집은 있으나 zero-error assertion 없음
- `artifacts/browser-qa/2026-08-01_0203/console/playwright-launch-failure.md`

### 권장 수정 방향

- route smoke와 기능 test를 분리하고 16개 시나리오 matrix를 구성한다.
- race-condition은 빠른 Line 전환 후 마지막 선택만 남는지, timeout은 화면 이탈·재시도 가능 여부를 검증한다.
- 3개 desktop viewport를 project 또는 data-driven test로 추가한다.
- 성공 test 종료 시 예상하지 않은 console error, page error, failed request가 0인지 assertion한다. 의도한 오류 요청은 allowlist로 분리한다.

### 수정 후 검증 기준

- 필수 16개 시나리오가 report에서 모두 실행됨으로 나타난다.
- route, refresh, back/forward, 검색, 정렬, filter, pagination, error/empty/permission, keyboard, 3개 viewport에 각각 명시 assertion이 있다.
- expected error를 제외한 console/page/request failure가 0이다.

## BQA-004 중복 npm script가 기본 unit 명령의 기존 22개 검증을 숨김

- 상태: 확인됨
- 심각도: P2 (Medium)
- 신뢰도: 높음
- 분류: regression test reliability
- 대상 화면 또는 기능: 전체 서비스 회귀 검증
- 관련 파일: `package.json`
- 관련 API: server 및 frontend API·utility 전반
- 연관 에이전트: Code Audit Agent / main 개발
- 최초 발견 시나리오: Mock/Playwright 기동 warning
- 재현 횟수: 3 / 3

### 문제 요약

`package.json`에 `test:unit`과 `test:contract` key가 각각 두 번 선언돼 있다. JSON parser는 뒤 값을 사용하므로 `npm run test:unit`은 `tests/unit/*.test.mjs`만 실행하고 앞에 정의된 server 및 frontend API·utility unit suite를 실행하지 않는다.

이번 검수에서 기본 명령은 1개 test file만 통과했지만, 앞 script의 명령을 명시 실행하자 22개 subtest가 추가로 통과했다. 즉 기본 성공 표시가 전체 unit 회귀 상태를 대표하지 않는다.

### 발생 화면과 재현 절차

1. `package.json`의 `scripts`에서 `test:unit`과 `test:contract` key를 확인한다.
2. `npm run test:unit`을 실행해 실제 선택된 명령을 확인한다.
3. 앞 `test:unit` 값의 명령을 직접 실행해 test 수를 비교한다.

### 기대 동작

script 이름은 한 번만 선언되고, 기본 unit 명령이 의도한 모든 unit suite를 실행한다.

### 실제 동작

- `npm run test:unit`: 1개 test file 실행, 통과
- 앞 script 명령 직접 실행: 22개 subtest 실행, 모두 통과
- Vite/Playwright 기동 시 duplicate key warning 출력

### 확인 근거

- `package.json:13-14`, `package.json:21-23`
- `artifacts/browser-qa/2026-08-01_0203/console/test-execution-summary.md`

### 권장 수정 방향

- 중복 key를 제거하고 core unit과 harness unit을 모두 포함하는 단일 `test:unit` 또는 의도가 드러나는 하위 script 조합으로 정리한다.
- CI에서 `package.json` duplicate key를 거부하는 JSON lint를 추가한다.

### 수정 후 검증 기준

- `npm run test:unit` 한 번으로 현재 server, frontend API·utility, harness unit이 모두 실행된다.
- Vite와 Playwright 시작 로그에 duplicate key warning이 없다.

## 시나리오 실행표

아래 `API 확인`은 localhost 합성 Mock 서버 응답만 의미한다. `브라우저 UI`는 Chromium 시작 실패로 모두 `Not Run`이다.

| 시나리오 | API 확인 | 브라우저 UI | 결과 및 제한 |
|---|---|---|---|
| normal | Pass | Not Run | Dashboard HTTP 200, page 미생성 |
| empty | Pass | Not Run | HTTP 200, 빈 화면 표현 판단 불가 |
| single | Pass | Not Run | HTTP 200, 단일 row/chart 판단 불가 |
| partial | Pass | Not Run | HTTP 200, 부분 누락 안내 판단 불가 |
| slow | Pass | Not Run | 지연 후 HTTP 200, loading/연속 클릭 판단 불가 |
| error-400 | Pass | Not Run | HTTP 400, 화면 안내 판단 불가 |
| error-401 | Pass | Not Run | HTTP 401, 권한 안내 판단 불가 |
| error-403 | Pass | Not Run | HTTP 403, 권한 안내 판단 불가 |
| error-404 | Pass | Not Run | HTTP 404, 화면 안내 판단 불가 |
| error-500 | Pass | Not Run | HTTP 500, 화면 안내 판단 불가 |
| error-502 | Pass | Not Run | HTTP 502, 화면 안내 판단 불가 |
| timeout | Pass | Not Run | 제한 시간 내 응답 없음, 취소/재시도 판단 불가 |
| race-condition | Pass | Not Run | HTTP 200, 빠른 전환 stale 결과 판단 불가 |
| inconsistent | Pass | Not Run | HTTP 200, 불일치 노출 판단 불가 |
| edge-values | Pass | Not Run | HTTP 200, 긴 텍스트/invalid 값 표시 판단 불가 |
| large | Pass | Not Run | HTTP 200, 대량 UI·pagination·잘림 판단 불가 |

근거: `artifacts/browser-qa/2026-08-01_0203/network/mock-scenario-readiness.md`

## 주요 사용자 흐름 판정

| 검수 항목 | 판정 | 근거 또는 제한 |
|---|---|---|
| 메인·주요 route 직접 URL HTTP 진입 | Confirmed | SPA HTML 200 |
| React 화면 렌더링 | Unknown | Chromium page 생성 실패 |
| 새로고침 | Unknown | 기존 E2E에 self-equipment reload가 있으나 실행 전 브라우저 실패 |
| 뒤로/앞으로 가기 | Unknown | test 없음, 브라우저 미실행 |
| 자설비 deep-link parser | Confirmed | unit/integration 통과 |
| 자설비 URL-history 양방향 동기화 | 잠재 위험 | BQA-001 |
| Dashboard 검색·정렬·pagination | Inferred 구현 | 코드 확인, 실제 조작 미검수 |
| 자설비 7단계 종속 filter | Inferred 구현 | 코드 확인, 실제 조작 미검수 |
| 동일성 5단계 filter·18개 pagination | Inferred 구현 | 코드 확인, 실제 조작 미검수 |
| 공통부 5단계 filter | Inferred 구현 | 코드 확인, 실제 조작 미검수 |
| 등록 펼치기·입력·저장·삭제 | Inferred 구현 | Mock mutation 비영속, 브라우저 미실행 |
| loading·empty·error 분기 | Inferred 구현 | 코드 확인, 화면 미검수 |
| 401/403 권한 부족 UX | Unknown | API 상태 확인, 화면 미검수 |
| console/page/request 오류 | Unknown | page 생성 실패 |
| 반응형·잘림·겹침 | Unknown | 3개 viewport 미실행 |
| keyboard·focus·label | Partial | 코드의 일부 label/aria 확인, 실제 keyboard 미실행 |

## 검증 명령

| 명령 | 상태 | 결과 |
|---|---|---|
| `git status --short --branch` | Pass | 예상 브랜치, 시작 변경 없음 |
| `npm run lint` | Pass | 오류 없음 |
| `npm run test:unit` | Pass / Partial | 중복 key 때문에 1개 파일만 실행 |
| 기존 unit 명령 직접 실행 | Pass | 22개 subtest 통과 |
| `npm run test:integration` | Pass | 1개 integration 파일 통과 |
| `npm run test:contract` | Fail | `ajv/dist/2020.js` 누락, 3개 파일 시작 실패 |
| `npm run test:e2e` | Fail | Chromium 시작 실패, 1개 실패·5개 미실행 |
| `npm run mock` | Pass | Mock API·frontend 기동 및 정상 종료 |
| 16개 `mock:scenario` 전환 | Pass | health 성공, 각 상태 특성 확인 |
| 주요 direct URL HTTP 확인 | Pass | 명시 route HTML 200 |
| build | Not Run | Browser QA 산출물 외 write를 피하기 위해 미실행 |

## 실행 실패 및 제한사항

### Playwright

- 실패 명령: `npm run test:e2e`
- 실패 원인: `libnspr4.so` 공유 라이브러리 누락
- 사용자 화면 영향 판정: 애플리케이션 결함이 아닌 검수 환경 제한
- 미실행: screenshot, 유효 trace, console/page/network 진단, DOM·접근성, 모든 viewport
- 조치하지 않은 이유: Browser QA 역할은 의존성·OS 라이브러리 설치와 Playwright 설정 변경을 금지

### Contract test

- 실패 명령: `npm run test:contract`
- 실패 원인: 선언된 `ajv` 8 계열과 현재 설치된 `ajv` 6 계열 불일치
- 결과: 3개 contract file이 test body 실행 전에 실패
- 조치하지 않은 이유: 의존성 설치·업데이트 금지

## Mismatch / Unknown

- `Mismatch`: `package.json`의 `test:unit` 앞 정의는 server/frontend unit 전체를 의도하지만 뒤 중복 key가 이를 덮어 실제 기본 명령은 harness unit 1개만 실행한다.
- `Mismatch`: `package.json`은 `ajv` 8 계열을 선언하지만 현재 설치 상태는 호환되지 않는 6 계열이다.
- `Unknown`: 실제 16개 시나리오의 화면 처리, 특히 API 실패와 정상 0건 구분.
- `Unknown`: race-condition에서 오래된 응답이 최신 선택을 덮는지 여부.
- `Unknown`: 401/403의 권한 부족 안내와 사용자 복구 동작.
- `Unknown`: 3개 권장 viewport의 잘림·겹침·가로 스크롤 사용성.
- `Unknown`: tooltip, chart drag/double-click, modal focus trap, keyboard 탐색.

## 변경 보호 확인

- 종료한 실행 프로세스: 합성 Mock API와 Vite frontend 정상 종료
- 실행 후 Mock process: 없음
- 보고서·아티팩트 외 신규 Git 변경: 없음
- 애플리케이션 소스 수정: 없음
- 테스트·설정·의존성 수정: 없음
- commit/push/merge/rebase/branch 변경: 수행하지 않음

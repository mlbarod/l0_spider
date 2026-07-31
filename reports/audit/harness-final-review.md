# L0 Spider Core Harness 최종 독립 감사

## 1. 감사 범위와 기준 commit

| 항목 | 감사 기준 |
|---|---|
| 저장소 | L0 Spider `main` |
| 기준 commit | `cc5504e08e701d8a597e6619556270310c238fa9` (`cc5504e`) |
| commit 제목 | `harness setup modi` |
| 감사 시점 | 2026-07-31 23:17 KST 이후 |
| 시작 작업 트리 | clean |
| 감사 방식 | 현재 checkout의 정적 교차 검토와 운영 자원 비의존 검증 실행 |
| 생성·수정 허용 파일 | `reports/audit/harness-final-review.md` |

감사 기준 우선순위와 사실 상태는 루트 `AGENTS.md`를 따른다.
판정은 `PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, `NOT APPLICABLE`을 사용한다.
`PASS`는 이번 감사 범위에서 실제 파일 또는 실행 결과로 확인된 경우에만 부여한다.

다음은 명시적으로 실행하거나 접근하지 않았다.

- 애플리케이션 server와 실제 API
- 운영 DB와 Python DB helper
- 실제 `/appdata` 파일
- SMTP·메일 API와 실제 recipient
- 실제 `.env`, credential, HMAC secret과 운영 token
- 외부 API, systemd, Docker, Playwright와 Chromium
- `mock-agent` checkout·파일·실행 결과

## 2. 전체 완성도 요약

### 2.1 최종 판정

**Core Harness 최종 판정: `READY WITH CONDITIONS`**

Core Harness의 기준 문서, Dashboard·Mailing summary 계약, 최소 synthetic fixture, STEP/딥링크 회귀 테스트와 안전한 검증 진입점은 존재하며 현재 환경에서 실행된다.
모든 지정 검증은 종료 코드 `0`으로 통과했고 운영 자원 접근도 발생하지 않았다.
이전 감사의 P0였던 기준 문서 drift는 commit `cc5504e`에서 해소됐고, 현재 일곱 기준 문서는 실제 후속 산출물과 `Blocked`·`Partial` 상태를 구분한다.
그러나 개별 STEP HMAC과 실제 메일 renderer·sender는 구현 근거가 없어 `BLOCKED`다.
Dashboard 성공 Schema도 fixture는 검증하지만 실제 producer 결과를 직접 검증하지 않으므로 코드 변경에 대한 자동 drift 방지는 `PARTIAL`이다.

### 2.2 상위 판정표

| 감사 항목 | 판정 | 핵심 근거 |
|---|---|---|
| `AGENTS.md` 목표 구조 | `PASS` | Core 필수 디렉터리와 대표 산출물 존재; mock 전용 구조는 의도적으로 없음 |
| Markdown 상대경로 링크 | `PASS` | 24개 Markdown, 204개 link 정적 검사, broken 0 |
| 문서 최신성·상호 일치 | `PASS` | 일곱 기준 문서가 `Active Baseline`, 검증 commit, 최신 감사와 현재 산출물 상태를 기록 |
| 화면과 데이터 경로 추적 | `PARTIAL` | 주요 화면→API→파일·DB 연결은 존재; producer·Schema·timezone·freshness는 미확인 |
| Dashboard API 계약 | `PARTIAL` | 성공 Schema·fixture·contract test 통과; 오류 Schema와 producer 직접 검증 없음 |
| STEP 딥링크와 HMAC | `BLOCKED` | `step=ALL`·`eqpCh`는 검증됨; HMAC 생성·검증·secret·정책은 없음 |
| 메일 생성 및 발송 | `BLOCKED` | `mailingSummary` 계약은 통과; full context·renderer·sender·scheduler 없음 |
| Schema·fixture·contract test | `PARTIAL` | JSON·Schema compile·fixture validation 통과; 전체 API·mail 계약은 범위 밖 |
| STEP·Mailing test 실행 | `PARTIAL` | synthetic ALL·딥링크·mail summary 통과; 실제 HMAC·mail render는 Blocked |
| 검증 script | `PASS` | 세 script 문법 및 실제 실행 통과 |
| 운영 안전 경계 | `PASS` | 검증 경로에서 DB·`/appdata`·SMTP·secret 접근 없음 |
| `main` / `mock-agent` 분리 | `PASS` | mock server·data·E2E 자산 없음; script도 명시적으로 제외 |
| 비밀·개인정보 정적 점검 | `PARTIAL` | 확인된 실제 secret 없음; email 형식 test literal, 내부 URL·path와 오류 detail 노출 위험은 남음 |

## 3. 목표 구조 감사

### 3.1 Core Harness 구조

| 목표 | 현재 확인 결과 | 판정 | 근거 |
|---|---|---|---|
| 공통 지침 | 루트 `AGENTS.md` 112줄 | `PASS` | `AGENTS.md` |
| 시스템 문서 | `overview`, `architecture`, `environment-definition`, `data-flow`, `deployment`, `security`, `glossary` | `PASS` | `docs/system/` |
| 기능 문서 | Dashboard, Self Equipment, STEP, Mailing, abnormal data | `PASS` | `docs/features/` |
| 운영 문서 | deployment 연계 runbook, systemd, troubleshooting, backup·restore, release checklist | `PASS` | `docs/operations/` |
| 사용자 문서 | 기준 메뉴얼, 탐색 index, PNG 11개 | `PASS` | `docs/user-manual/` |
| ADR | frontend, Parquet, STEP/HMAC | `PASS` | `docs/decisions/` |
| 계약 | Dashboard API, Mailing summary | `PASS` | `harness/contracts/` JSON 2개 |
| 최소 fixture | Dashboard success·empty, Mailing success·empty | `PASS` | `harness/fixtures/` JSON 4개 |
| Core test | contract 2, unit 1, integration 1 | `PASS` | `tests/` |
| 안전 검증 진입점 | env, contracts, all | `PASS` | `scripts/verify-*.sh` |
| 감사 보고서 | inventory와 현재 최종 감사 | `PASS` | `reports/audit/` |

`harness/mock/`, mock server·data, mock smoke, E2E와 `verify-ui.sh`가 없는 것은 `NOT APPLICABLE`이다.
이는 `AGENTS.md:40-45`에 정의된 `mock-agent` 전용 범위이며 Core 누락으로 판정하지 않는다.

### 3.2 링크와 참조 대상

본 보고서를 만들기 전 감사 입력 문서에 수행한 Markdown link 정적 검사 결과는 다음과 같다.

- 대상: `docs/**/*.md`, `reports/audit/*.md`
- 파일: 24개
- Markdown link·image 참조: 204개
- 존재하지 않는 상대경로 target: 0개
- 판정: `PASS`

이 검사는 상대경로 target의 존재만 확인한다.
anchor heading의 renderer별 slug 호환, browser에서의 실제 이동과 픽셀 일치는 실행하지 않아 `PARTIAL` 범위다.

## 4. 네 가지 필수 영역 판정

### 4.1 화면과 데이터 경로 추적 — `PARTIAL`

확인된 연결은 다음과 같다.

| 화면 | route | API·조회 | server | 데이터 원천 | 판정 |
|---|---|---|---|---|---|
| Dashboard | `/`, `/fdc_trend` | `fetchDashboardSummary()` → `GET /api/dashboard-data` | `handleDashboardDataRequest()` | Dashboard detail·stats Parquet, mapping JSON | `PASS` |
| Self Equipment | `/self-equipment` | self equipment·scatter·history API | `server/selfEquipmentData.mjs` 등 | team path Parquet, ERD data·history, DB history | `PASS` |
| MY EQP | `/self-equipment?sdwt=MY_EQP...` | registration·equipment API | `myEqpRegistration.mjs`, `selfEquipmentData.mjs` | `myeqp_regist`, path Parquet, ERD | `PASS` |
| 동일성 | `/matching-anomaly` | commonality data·image API | `commonalityData.mjs` | directory index와 `img.png` | `PASS` |
| 공통부 | `/common-anomaly` | anomaly·scatter·image API | `commonAnomalyData.mjs` | `df_path.parquet`, point Parquet, PNG, DB history | `PASS` |
| Mailing 등록 | `/registration` | mailing registration API | Node→Python helper | DB `email` table | `PASS` |

근거는 `docs/system/data-flow.md`, `docs/features/{dashboard,self-equipment,abnormal-data}.md`, `src/features/fdc-trend/routes.jsx:11-67`, `server.mjs:131-260`과 기능별 handler다.
실제 `/appdata`와 DB를 확인하지 않았으므로 upstream producer, 파일 Schema·version, publish 원자성, timezone, freshness SLA와 보존 정책은 `Unknown`이다.
따라서 경로와 consumer 추적은 사용 가능하지만 운영 데이터 생애주기 전체는 `PARTIAL`이다.

### 4.2 Dashboard API 계약 — `PARTIAL`

`GET /api/dashboard-data`의 현재 생산자는 `server/dashboardData.mjs:712-827`이며, 성공 body는 `ok`, 상위 summary와 `lineDashboard`를 조립한다.
`lineDashboard.summary`와 sibling `lineDashboard.mailingSummary`는 현재 code·Schema·fixture에서 같은 위치를 사용한다.

확인된 계약 자산은 다음과 같다.

- `harness/contracts/dashboard-api.schema.json`
- `harness/fixtures/dashboard/dashboard-success.json`
- `harness/fixtures/dashboard/dashboard-empty.json`
- `tests/contract/dashboard-api.contract.test.mjs`
- frontend consumer `src/features/fdc-trend/api/dashboardApi.js:3-31`

Schema compile, success·empty fixture와 negative 사례는 현재 contract test에서 통과했다.
다만 Dashboard contract test는 fixture만 검증하고 `buildLineDashboardPayload()` 또는 다른 pure producer 결과를 Dashboard root Schema로 검증하지 않는다.
`400`, `404`, `405`, `500` body와 `HEAD`는 Schema 범위에서 명시적으로 제외돼 문서형 계약만 존재한다.
따라서 현재 success fixture의 유효성은 `PASS`, code–Schema drift 자동 방지는 `PARTIAL`이다.

### 4.3 STEP 딥링크와 HMAC — `BLOCKED`

현재 확인되고 실행된 범위는 다음과 같다.

- `buildMyEqpDetailUrl()`은 `sdwt=MY_EQP`, `step=ALL`, 선택적 `eqpCh`를 생성한다.
- `readSelfEquipmentUrlFilters()`는 MY EQP의 누락·임의 `step`을 `ALL`로 정규화한다.
- `eqpCh`와 `eqp_ch` alias, URL round trip, synthetic payload 연결 test가 통과한다.
- 근거: `dashboardLinks.mjs:15-28`, `selfEquipmentUrlFilters.mjs:13-32`, `tests/unit/step-hmac.test.mjs`, `tests/integration/step-deeplink.test.mjs`.

그러나 현재 `tests/unit/step-hmac.test.mjs`라는 파일명과 달리 실제 HMAC 생성·검증을 test하지 않는다.
현재 코드에는 HMAC generator, validator, canonicalization, algorithm, digest, secret loader, 변조·누락·만료 판정과 STEP mapping이 없다.
`ADR-003-step-hmac-token.md`도 올바르게 `Proposed` 상태를 유지한다.
따라서 ALL·`eqpCh` 회귀는 `PASS`지만 개별 STEP HMAC 계약과 검증은 `BLOCKED`다.

### 4.4 메일 생성 및 발송 — `BLOCKED`

현재 실행 가능한 범위는 Dashboard의 `lineDashboard.mailingSummary` fragment다.
`mailing-summary.schema.json`, success·empty fixture와 contract test는 compile·validation에 성공했고, test는 `buildLineDashboardPayload()`를 import해 중복 제거·기간 합산·정렬과 빈 배열을 확인한다.

다음은 저장소에서 확인되지만 실행 가능한 발송 흐름은 아니다.

- `public/mailing-report.html`의 template 변수·표·링크
- `/api/mailing-registration`과 MY EQP 등록 API
- Dashboard KPI·Mailing summary producer

수신자별 full context 조립, renderer, autoescape 실행, sender, scheduler, timeout, retry, 중복 발송 방지와 발송 audit log는 확인되지 않았다.
`tests/unit/mailing-render.test.mjs`는 side-effect-free renderer가 없어 의도적으로 미생성됐다.
따라서 summary fragment는 `PASS`, 실제 메일 생성·발송과 render 검증은 `BLOCKED`다.

## 5. 문서·코드·계약·테스트 일치성

### 5.1 문서 최신성 — `PASS`

이전 감사의 `DOC-M01`~`DOC-M05`를 현재 tree에서 다시 확인한 결과 P0 기준 문서 drift는 해소됐다.

| 확인 항목 | 현재 결과 | 판정 | 근거 |
|---|---|---|---|
| 기준 문서 상태 | 일곱 문서 모두 `Active Baseline`과 검증 기준 branch·commit을 기록 | `PASS` | `overview.md`, `architecture.md`, `data-flow.md`, `dashboard.md`, `self-equipment.md`, `step-deeplink.md`, `security.md` 상단 |
| 최신 감사 연결 | 일곱 문서 모두 본 보고서 상대 링크를 제공 | `PASS` | `최신 하네스 감사` metadata |
| 후속 산출물 상태 | 현재 문서·Schema·fixture·test·script를 작성됨으로 기록 | `PASS` | 각 문서의 연계 문서·산출물 표 |
| 미완료 과장 방지 | 실제 HMAC, mail renderer·sender와 Dashboard 일부 계약을 `Blocked`·`Partial`로 유지 | `PASS` | STEP·Mailing·Dashboard 관련 절 |
| 역사적 inventory 경계 | commit `6cf9568` snapshot이며 현재 감사·기준 문서를 우선한다고 명시 | `PASS` | `reports/audit/system-inventory.md:3-7` |

오래된 상태 표현 제한 검색에서 “향후 작성 예정”, “모두 향후”, “아직 작성 전”과 같은 P0 대상 문구는 발견되지 않았다.
일곱 기준 문서의 검증 기준 코드 commit은 `99c4361`이고 현재 감사 기준은 그 문서 보정을 포함한 `cc5504e`다. 이는 미래 commit을 소급 기록하지 않기 위한 의도된 구분이며 `Mismatch`가 아니다.

### 5.2 코드·사용자 메뉴얼 — `PARTIAL`

`docs/user-manual/index.md:53-64,70-87`은 현재 코드와 이미지 차이를 이미 명시한다.

- 오래된 메인 메뉴 이미지
- Self Equipment의 3일 동일성 toggle·모아보기 pair가 빠진 이미지
- 동일성 화면에서 STEP filter가 빠진 이미지
- 과거 메뉴얼 기준일 이미지
- 실제 sender가 확인되지 않았는데 메일 구성을 사용자 절차로 읽을 수 있는 위험

route와 메뉴 연결은 `routes.jsx:11-67` 및 index 표와 일치한다.
브라우저·Playwright를 실행하지 않았으므로 픽셀 최신성과 직접 진입·새로고침 동작은 `PARTIAL`이다.

### 5.3 Schema·fixture·producer — `PARTIAL`

| 대상 | 결과 | 판정 |
|---|---|---|
| JSON 문법 | Schema 2개, fixture 4개 모두 통과 | `PASS` |
| Schema compile | Ajv 2020 compile 성공 | `PASS` |
| Dashboard fixture | success·empty validation 성공 | `PASS` |
| Mailing fixture | success·empty validation 성공 | `PASS` |
| Mailing producer | pure producer 결과가 Schema를 통과 | `PASS` |
| Dashboard producer | root producer 결과의 직접 Schema validation 없음 | `PARTIAL` |
| 오류 응답 | 실행 가능한 JSON Schema 없음 | `PARTIAL` |
| full mail context·send result | producer 없음 | `BLOCKED` |

Dashboard success fixture의 `sourcePaths`에는 production-like absolute path pattern이 포함된다.
실제 운영 data는 아니지만 Core synthetic fixture의 이식성과 정보 노출 관점에서 검토가 필요하다.

### 5.4 테스트 진입점과 기존 테스트 — `PARTIAL`

현재 Core `tests/`의 4개 파일은 모두 검증 script가 호출한다.
반면 저장소에는 추가 Node test 22개와 Python test 2개가 `server/`, `src/`, `scripts/`에 있으나 `package.json`의 `test:unit`은 `tests/unit/*.test.mjs`만 대상으로 한다.
`verify-all.sh`도 기존 24개 test를 실행하지 않는다.
이는 이번 안전 script의 명시 범위를 위반하지 않지만, “전체 회귀 검증”으로 해석하면 공백이므로 `Risk`다.

## 6. 검증 script 실행 결과

### 6.1 문법

| 명령 | 결과 | 판정 |
|---|---|---|
| `bash -n scripts/verify-env.sh scripts/verify-contracts.sh scripts/verify-all.sh` | exit `0` | `PASS` |

세 script는 `#!/usr/bin/env bash`, `set -euo pipefail`, script 기준 root 계산과 `[PASS]`·`[FAIL]`·`[SKIP]` 출력을 사용한다.
필수 실패는 non-zero로 종료하고 `|| true`로 test 실패를 숨기지 않는다.

### 6.2 `verify-env.sh`

| 항목 | 결과 |
|---|---|
| command·runtime 존재 | `PASS` |
| 필수 문서·Schema·fixture·test | `PASS` |
| package script·lockfile·module | `PASS` |
| JSON 문법 | `PASS` |
| 코드 환경변수 이름 참조 | `PASS` |
| tracked `.env.example` parity | `SKIP` — 파일 부재 |
| 지원 runtime version 적합성 | `SKIP` — 선언 부재 |
| HMAC·SMTP 환경변수 | `SKIP` — 구현 근거 없음 |
| mail renderer | `SKIP` — 문서상 Blocked |

명령 `./scripts/verify-env.sh`는 exit `0`이었다.

### 6.3 `verify-contracts.sh`

`./scripts/verify-contracts.sh`는 exit `0`이었다.
Dashboard·Mailing contract test 파일 2개가 통과했고 JSON 문법, Schema compile과 fixture validation이 성공했다.
full mail context·renderer·sender와 실제 API·DB·`/appdata`·SMTP는 명시적으로 `SKIP`됐다.

### 6.4 `verify-all.sh`

`./scripts/verify-all.sh`는 exit `0`이었다.

| 단계 | 실행 결과 | 판정 |
|---|---|---|
| `verify-env.sh` | exit `0` | `PASS` |
| `verify-contracts.sh` | exit `0`, contract 2개 통과 | `PASS` |
| STEP/ALL unit | 1 test 통과 | `PASS` |
| STEP deep-link integration | 1 test 통과 | `PASS` |
| Mailing summary | 1 test 통과 | `PASS` |
| ESLint | exit `0` | `PASS` |
| Vite build | exit `0`, 임시 `/tmp` 출력 후 정리 | `PASS` |
| `git diff --check` | exit `0` | `PASS` |
| 전체 integration·mail render | 안전 경계와 Blocked 상태로 미실행 | `NOT APPLICABLE` / `BLOCKED` |
| E2E·Playwright·browser·mock-agent | Core 범위 밖 | `NOT APPLICABLE` |

Vite build는 성공했지만 minified JavaScript chunk 약 `1,162.15 kB`에 대해 500 kB 초과 warning을 냈다.
이는 build 실패는 아니며 bundle size 측정·분할 정책이 없는 `Risk`다.

## 7. 운영 안전 및 비밀정보 경계

### 7.1 검증 경로 — `PASS`

- contract와 STEP·Mailing test는 synthetic 값과 pure function을 사용한다.
- `verify-all.sh`는 전체 integration, E2E, Playwright와 browser test를 실행하지 않는다.
- Vite output은 `mktemp`로 만든 `/tmp/l0-spider-verify-build.*`에 한정되고 종료 시 정리됐다.
- 실제 server, DB, `/appdata`, SMTP, 외부 API, systemd와 Docker 접근은 없었다.
- 실제 `.env`, DB credential file, HMAC secret, 운영 token과 recipient를 읽지 않았다.

### 7.2 정적 노출 위험 — `PARTIAL`

제한적 정적 pattern 검토에서 private key 또는 실제 secret literal은 확인되지 않았다.
test에는 synthetic email 형태 값이 있으나 실제 recipient라고 판단할 근거가 없으며 보고서에는 값을 복사하지 않았다.
Python DB helper의 `password=`는 외부 credential 구조에서 읽은 값을 connector에 전달하는 참조이며 hard-coded credential로 확인되지 않았다.

다음 위험은 남아 있다.

- `vite.config.mjs`와 `L0SpiderHomePage.jsx`의 내부 host·service URL 후보: `<redacted>`
- Dashboard `sourcePaths`와 일부 오류 body의 absolute path·`error.message` 노출 가능성
- DB helper 오류·debug detail이 browser 응답으로 전달될 가능성
- `currentUser.mjs`의 forwarded address 신뢰 정책 미확인
- runtime `ALTER TABLE` 가능 코드와 DB 최소 권한 미확인

이 감사는 secret scanner, dependency audit 또는 운영 log 검사가 아니므로 비밀정보 부재를 완전 보증하지 않는다.

## 8. `main`과 `mock-agent` 분리

판정은 `PASS`다.

- 현재 checkout은 `main`이며 다른 branch를 조사하지 않았다.
- `harness/mock/`, mock server·DB·data, mock 실행 script, mock E2E와 Playwright config는 현재 Core 구조에 없다.
- 세 verify script는 `mock-agent`, Playwright, Chromium과 mock server를 조건으로 요구하지 않는다.
- 문서와 ADR은 공유 기준을 API 계약·시스템·기능 정의로 제한하고 동기화 방향을 `main → mock-agent`로 기록한다.
- `scripts/generate-user-manual-screenshots.mjs`의 Playwright 사용은 문서 이미지 생성 도구로 분류되며 Core verify에서 실행되지 않는다.

## 9. Mismatch·Unknown·Risk Register

### 9.1 Mismatch

| ID | 심각도 | 내용 | 근거 | 영향 |
|---|---|---|---|---|
| `FINAL-M02` | 높음 | 개별 STEP HMAC 후보와 현재 미구현 상태의 차이 | STEP 문서·ADR·실제 utility | 개별 STEP 진위·오류 계약 없음 |
| `FINAL-M03` | 중간 | 후보 `lineDashboard.summary.mailingSummary`와 실제 sibling 위치 차이 | `AGENTS.md`, Dashboard code·Schema | 잘못된 consumer path 가능 |
| `FINAL-M04` | 중간 | Vite 단독 middleware와 full `server.mjs` API route 범위 차이 | architecture·environment 문서 | 실행 mode별 기능 차이 |
| `FINAL-M05` | 중간 | 사용자 메뉴얼 일부 이미지가 현재 메뉴·filter·상태를 반영하지 않음 | `docs/user-manual/index.md:53-79` | 사용자 조작 혼선 |
| `FINAL-M06` | 중간 | Parquet/API `recipe_id`와 path·UI의 PPID 용어 불일치 | glossary·ADR-002 | 데이터 해석·검색 혼선 |

`FINAL-M01` 문서 snapshot drift는 commit `cc5504e`에서 해결돼 현재 Mismatch Register에서 제거했다.

### 9.2 Unknown·Blocked

| ID | 상태 | 항목 | 영향 |
|---|---|---|---|
| `FINAL-U01` | `Unknown` | 운영 data producer·owner·주기·완료 신호 | freshness·장애·복구 기준 미확정 |
| `FINAL-U02` | `Unknown` | Parquet 전체 Schema·version·nullable | upstream drift 자동 검출 불가 |
| `FINAL-U03` | `Blocked` | HMAC canonicalization·algorithm·secret·mapping·만료 | 개별 STEP 계약 구축 불가 |
| `FINAL-U04` | `Blocked` | mail context·renderer·sender·scheduler·retry·dedupe | 실제 발송 검증 불가 |
| `FINAL-U05` | `Unknown` | Node·Python 지원 version과 tracked `.env.example` | 환경 재현성과 설정 전달 불완전 |
| `FINAL-U06` | `Unknown` | systemd unit, 실제 port·user·proxy·TLS·health | 배포·runbook 자동 검증 불가 |
| `FINAL-U07` | `Unknown` | DB·`/appdata` backup owner, RPO·RTO·retention | 복구 가능성 보증 불가 |
| `FINAL-U08` | `Unknown` | 인증·인가, rate limit, API versioning | 외부 노출·호환 정책 미확정 |

### 9.3 Risk

| ID | 우선순위 | 위험 | 현재 완화 |
|---|---|---|---|
| `FINAL-R02` | 높음 | Dashboard producer 변경이 success Schema test에 직접 잡히지 않음 | fixture·frontend shape·별도 server test 존재 |
| `FINAL-R03` | 높음 | mail sender가 외부에 있을 경우 오발송·retry·dedupe 경계 미확인 | Core test는 실제 발송 금지 |
| `FINAL-R04` | 높음 | source path·DB detail·URL query가 응답·log에 노출될 수 있음 | frontend path masking 일부 존재 |
| `FINAL-R05` | 중간 | 기존 Node 22개·Python 2개 test가 `verify-all.sh` 범위 밖 | lint·build·Core test는 실행 |
| `FINAL-R06` | 중간 | runtime DB DDL과 최소 권한·migration 정책 미확인 | 운영 DB 테스트 금지 |
| `FINAL-R07` | 중간 | file index·data·image의 부분 publish와 Schema drift | handler 오류·부분 상태 문서화 |
| `FINAL-R08` | 중간 | Vite build JavaScript chunk가 500 kB warning 초과 | build는 성공, 측정 후 분할 필요 |
| `FINAL-R09` | 중간 | 메뉴얼 이미지의 시각적 최신성 미확인 | Markdown 본문·index를 우선 기준으로 지정 |
| `FINAL-R10` | 중간 | 실제 release·rollback·backup 실행 증거 없음 | 운영 문서는 미확인 값을 `Unknown` 처리 |

기존 `FINAL-R01` 문서 snapshot drift는 기준 문서 metadata와 historical inventory banner로 완화돼 종료했다.

## 10. 수정 우선순위와 권장 후속 작업

### 완료 — P0 기준 신뢰성 회복

1. 일곱 기준 문서의 후속 산출물 상태가 현재 tree와 일치한다.
2. `system-inventory.md`는 commit `6cf9568`의 역사적 snapshot으로 분리됐고 현재 상태는 본 보고서와 `Active Baseline` 문서를 우선한다.
3. 기준 문서에 상태, 검증 branch·commit과 최신 감사 링크가 일관되게 기록됐다.

### P1 — 실행 가능한 계약 강화

1. 운영 자원 없이 호출 가능한 Dashboard pure producer 결과를 root success Schema로 검증한다.
2. `400`·`404`·`405`·`500` error body와 `HEAD` 범위를 별도 Schema 또는 contract로 결정한다.
3. 기존 `server/`, `src/`, `scripts/` test 중 운영 자원 비의존 test를 분류하고 안전한 별도 진입점에 포함할지 결정한다.
4. production-like absolute path를 fixture에 유지할 필요와 opaque synthetic path 대안을 검토한다.

### P2 — 제품 소유자 결정 필요

1. 개별 STEP HMAC 요구 자체를 확정한 뒤 canonicalization, algorithm, format, secret, mapping, 오류, 만료·rotation을 승인한다.
2. 실제 mail renderer·sender·scheduler의 저장소 밖 존재 여부와 owner를 확인하고 발송 차단·recipient 분리·retry·dedupe 계약을 정한다.
3. data producer, Parquet Schema·version, timezone·freshness, publish 완료 신호를 확인한다.
4. systemd·proxy·health·backup·RPO·RTO와 운영 승인 체계를 저장소 근거로 갱신한다.

### P3 — 운영 품질

1. 사용자 메뉴얼의 오래된 이미지를 현재 UI 기준으로 갱신한다.
2. bundle size 기준과 code splitting 필요성을 측정한다.
3. path·DB error·internal URL·forwarded address 노출 경계를 보안 검증으로 보강한다.

## 11. Core Harness 최종 완료 판정

### `READY WITH CONDITIONS`

현재 Core Harness는 다음 용도로 사용할 수 있다.

- 신규 담당자의 구조·기능·운영 경계 탐색
- Dashboard·Mailing summary success 계약 검증
- `step=ALL`·`eqpCh` 딥링크 회귀 검증
- 운영 자원 비의존 lint·build·contract 검증
- `main`과 `mock-agent`의 범위 분리
- 알려진 Mismatch·Unknown·Risk의 추적

다음 용도로는 아직 완료됐다고 표현하면 안 된다.

- 개별 STEP HMAC의 구현·보안 보장
- 실제 메일 render·발송·retry·dedupe 보장
- Dashboard 오류 응답과 actual handler의 완전한 실행 계약
- 운영 DB·`/appdata`·배포·backup·restore의 실행 검증
- 전체 기존 test suite와 browser 동작의 회귀 보장

P0 문서 drift는 해소됐지만 P1 계약 공백을 보완하기 전에는 무조건적인 `READY`로 승격하지 않는다.
HMAC과 실제 메일 발송은 제품·운영 owner 결정 없이 임의 구현하거나 `PASS`로 처리하지 않는다.

## 12. 감사 변경 및 미실행 확인

- 수정한 파일: `reports/audit/harness-final-review.md`
- 다른 문서·코드·Schema·fixture·test·script 수정: 없음
- 애플리케이션 server 실행: `Not Run`
- 운영 DB 접근: `Not Run`
- 실제 `/appdata` 접근: `Not Run`
- 실제 메일 발송: `Not Run`
- 외부 API·systemd·Docker 접근: `Not Run`
- Playwright·Chromium·`mock-agent` 접근: `Not Run`
- 실제 `.env`·secret·recipient 확인: `Not Run`
- 커밋 및 push: `Not Run`

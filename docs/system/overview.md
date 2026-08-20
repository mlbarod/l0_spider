# L0 Spider 시스템 개요

> 문서 목적: 현재 L0 Spider의 목적, 주요 기능, 시스템 경계와 Core Harness 범위를 빠르게 이해하기 위한 기준 개요
> 문서 상태: `Active Baseline`
> 검증 기준 branch: `main`
> 검증 기준 코드 commit: `2d5535366fc56ecff7a322139ddfe6f09cd4df25` + 현재 working tree 변경
> 최신 하네스 감사: [reports/audit/harness-final-review.md](../../reports/audit/harness-final-review.md)
> 검증일: 2026-08-20
> 주요 근거: `reports/audit/system-inventory.md`
> 상세 시스템·기능·운영 문서와 Core 계약·검증 진입점은 현재 tree에 존재하며, `Blocked`·`Unknown`은 각 기준 문서에서 구분한다.

## 1. 문서 목적과 범위

이 문서는 L0 Spider를 처음 접하는 사용자와 유지보수 담당자에게 현재 시스템의 상위 구조와 책임 경계를 설명한다.
현재 코드로 확인된 사실, 기존 문서의 설명, 저장소 소유자가 정한 프로젝트 운영 정책을 구분한다.
화면별 절차, API·환경변수·데이터 경로, 설치·배포·장애 대응은 관련 상세 문서와 실행 가능한 계약에서 관리한다.

## 2. 시스템 한눈에 보기

L0 Spider는 L0 공정의 이상감지 결과를 Line, SDWT, STEP, 설비와 sensor 조건으로 조회하는 웹서비스다.
사용자는 메인 대시보드에서 Line별 현황을 확인하고, 자설비·동일성·공통부 화면에서 Parquet 기반 차트와 분석 이미지를 상세 조회한다.
개인 모니터링 설비인 MY EQP, SKIP·HIT·클릭 이력, Mailing 수신 조건을 DB에 관리하는 기능도 제공한다.
React SPA가 화면을 제공하고 Node 서버가 API, 파일 검증·집계와 이미지 제공을 담당하며, DB 작업은 Python helper를 통해 수행한다.
메일용 요약 집계와 HTML 템플릿은 확인되지만 실제 메일 renderer, scheduler와 sender는 현재 저장소에서 확인되지 않았다.

## 3. 시스템 목적

| 관점 | 목적 | 상태 |
|---|---|---|
| 업무 | 분산된 이상감지 결과를 Line·설비 조건별로 조회하고 대시보드와 상세 화면의 기준을 연결한다. | Confirmed |
| 사용자 | 현황에서 차트·이미지로 이동하고 SKIP·이력을 남기며, MY EQP·Mailing 조건과 딥링크를 사용한다. | Confirmed |
| 운영·유지보수 | 기존 동작과 API 호환성을 보존하고 화면·API·데이터 근거와 운영 자원 비의존 Core 검증을 축적한다. | 프로젝트 운영 정책 |

## 4. 주요 사용자와 사용 시나리오

| 사용자 또는 역할 | 주요 목적 | 대표 기능 | 상태 |
|---|---|---|---|
| 웹 접속 사용자 | 이상감지 현황과 상세 결과 조회 | 대시보드, 자설비, 동일성, 공통부 | Confirmed |
| 모니터링 조건 등록 사용자 | 개인 설비와 수신 조건 관리 | MY EQP, Mailing 등록·조회·삭제 | Confirmed |
| 메일 수신 사용자 | 요약 결과 확인과 상세 화면 재진입 | Mailing Report와 딥링크 | Documented |
| 운영·유지보수 담당자 | 배포, 데이터·DB·계약과 장애 관리 | 환경·운영 문서와 Core Harness | Inferred |

대표 시나리오는 대시보드 현황 확인, Self Equipment 상세 조회, MY EQP 조회, STEP·장비 조건 딥링크 진입, Mailing 조건 등록과 요약 메일 확인이다.
조직명, 직무별 권한 체계와 별도 로그인 역할은 현재 자료로 확인되지 않았다.

## 5. 주요 기능

| 기능 | 사용자에게 제공하는 결과 | 주요 진입점 | 상세 문서 |
|---|---|---|---|
| Line 대시보드 | 최신 KPI, Line별 건수와 기간 추이 | `/`, `GET /api/dashboard-data` | [dashboard.md](../features/dashboard.md) — `Active Baseline` |
| Self Equipment·MY EQP | 조건별 Scatter·동일성 차트와 SKIP/HIT 기능 | `/self-equipment` | [self-equipment.md](../features/self-equipment.md) — `Active Baseline` |
| 동일성 이상감지 | STEP·sensor 조건별 분석 이미지 | `/matching-anomaly` | [abnormal-data.md](../features/abnormal-data.md) — `Baseline` |
| 공통부 이상감지 | 공통부 이미지와 설비 비교 차트 | `/common-anomaly` | [abnormal-data.md](../features/abnormal-data.md) — `Baseline` |
| 공통부 동일성 이상감지 | EQP_MODEL·sensor 조건별 공통부 분석 이미지 | `/common-commonality-anomaly` | [abnormal-data.md](../features/abnormal-data.md) — `Baseline` |
| MY EQP·Mailing 등록 | 개인 설비와 수신 조건 관리 | `/registration` | [mailing.md](../features/mailing.md) — summary 계약 존재, 실제 발송 `Blocked` |
| STEP 딥링크 | URL 조건을 자설비 필터에 적용 | `/self-equipment?...` | [step-deeplink.md](../features/step-deeplink.md) — ALL 흐름 확인, HMAC `Blocked` |
| Mailing Report | 대시보드 요약, 수신인별 표와 상세 링크 | `public/mailing-report.html` | 실제 발송 흐름은 `Unknown` |
| 사용자 메뉴얼 | 화면별 사용 절차와 이미지 | `/manual` | `docs/user-manual/USER_MANUAL.md` |

## 6. 시스템 경계

| 경계 | 포함 항목 | 상태 |
|---|---|---|
| L0 Spider 내부 | React SPA·브라우저 route·API 모듈, Node HTTP 서버·파일 처리, Python DB helper, 경로·메일 template과 실행 설정 | Confirmed |
| 외부 의존성 | 브라우저·운영 네트워크, `/appdata`의 JSON·Parquet·이미지·DB credential 파일, 업무 DB, 실제 메일 전송 시스템 후보 | 파일·DB 참조는 Confirmed, 실제 메일 연동은 Unknown |
| 범위 밖 또는 미확인 | upstream 데이터 생산, 운영 network·proxy·TLS·systemd·Docker·monitoring, `mock-agent` 구현 | Unknown 또는 Out of Scope |

## 7. 상위 구성요소

| 구성요소 | 역할 | 대표 경로 또는 진입점 | 상태 |
|---|---|---|---|
| Web UI | route, 필터, 표·차트·이미지와 등록 UI | `src/main.jsx`, `src/features/fdc-trend/` | Confirmed |
| Browser API layer | `/api/*` 요청과 일부 응답 검증 | `src/features/fdc-trend/api/` | Confirmed |
| Node server | SPA 제공, API routing, 파일 검증·집계 | `server.mjs`, `server/*.mjs` | Confirmed |
| File data layer | Parquet·JSON 읽기와 이미지 stream | `src/config/spiderDataPaths.mjs`, data handler | Confirmed |
| DB helper layer | PyMySQL 기반 조회·등록·이력 처리 | `scripts/*.py` | Confirmed |
| Mailing template | 수신인별 요약·링크의 HTML 계약 후보 | `public/mailing-report.html` | Confirmed |
| Mail delivery | 렌더링, scheduling과 실제 전송 | 저장소 밖 또는 미구현 | Unknown |

## 8. 상위 데이터 흐름

`사용자 조건 선택 → React 화면·API 모듈 → /api/* → Node handler → 파일 또는 Node→Python helper→DB → JSON·이미지 → 화면 출력`

- Node handler는 입력을 검증하고 mapping JSON, Parquet·이미지 또는 DB 데이터가 필요한지 결정한다.
- Mailing template은 대시보드 요약과 등록 조건을 요구하며 링크는 `/self-equipment`로 사용자를 되돌린다.
- 실제 메일 renderer·sender의 조합 과정은 `Unknown`이며 상세 추적은 [data-flow.md](data-flow.md)와 [mailing.md](../features/mailing.md)에서 관리한다.

## 9. 주요 데이터와 외부 자원

| 데이터 또는 자원 | 용도 | 접근 방식 | 운영상 주의사항 | 상태 |
|---|---|---|---|---|
| mapping JSON | SDWT와 Line·표시명 연결 | Node file read | 경로 override와 schema 검증 필요 | Confirmed |
| 통계·경로 Parquet | 대시보드 집계와 상세 대상 탐색 | Node와 hyparquet | `/appdata` 운영 파일을 직접 변경하지 않음 | Confirmed |
| ERD·공통부 Parquet | Scatter와 동일성 차트 데이터 | 검증된 경로의 Node read | 경로·컬럼 계약 보존 필요 | Confirmed |
| 분석 이미지 | 동일성·공통부 결과 표시 | 허용 root 검증 후 stream | 경로 노출과 traversal 방지 필요 | Confirmed |
| 업무 DB | 사용자, MY EQP, Mailing와 이력 | Node→Python helper→PyMySQL | 테스트 쓰기·DDL 금지, credential 보호 | Confirmed |
| 환경변수·credential 파일 | port, mode, 경로와 DB 연결 설정 | process environment·로컬 파일 | 실제 값과 비밀정보를 문서화하지 않음 | Confirmed |
| Mailing HTML template | KPI, 수신인별 표와 딥링크 구조 | 외부 renderer 입력 후보 | 실제 renderer·sender 계약 확인 필요 | Confirmed |

이번 개요 작성에서는 실제 `/appdata` 파일, DB, `.env`, credential 또는 이메일 주소를 확인하지 않았다.

## 10. 실행 및 운영 환경 개요

- 프론트엔드는 React 19와 Vite 6 기반 SPA이며 TanStack React Query를 사용한다. (`Confirmed`)
- 통합 진입점은 `server.mjs`이며 live reload와 `dist` 정적 제공 mode를 지원한다. (`Confirmed`)
- DB 기능은 Node가 `python3` helper를 실행하는 방식이며 PyMySQL 의존성이 선언돼 있다. (`Confirmed`)
- `PORT`, `HOST`, `LIVE_RELOAD`, 데이터 root와 `DB_INFO_PATH` 등 환경변수 참조가 있다. (`Confirmed`)
- Node.js·Python 지원 버전과 `.env.example`은 현재 확인되지 않았다. (`Unknown`)
- systemd, Docker, CI, reverse proxy와 정식 log 수집 설정은 저장소에서 확인되지 않았다. (`Unknown`)

설치·배포·운영 절차는 [environment-definition.md](environment-definition.md), [deployment.md](deployment.md), [runbook.md](../operations/runbook.md), [systemd.md](../operations/systemd.md)에 존재한다. 실제 운영 topology와 unit 값은 여전히 `Unknown`이다.

## 11. Core Harness와 mock 브랜치 경계

이 절은 소스 구현 사실이 아니라 저장소 소유자가 확정한 프로젝트 운영 정책이다.

### Core Harness

`main`은 실제 시스템과 Core Harness의 기준이다.
Core Harness는 시스템·기능·운영·사용자 문서, API·데이터 계약, 운영 자원 비의존 unit·contract 검증과 감사·변경 영향 기록을 관리한다.
개인정보와 운영 데이터가 없는 최소 synthetic 계약 샘플만 `main`에 둘 수 있다.

### Mock Validation Extension

mock 서버·데이터·Parquet·이미지, 실행 script, mock 의존 integration·E2E, Playwright Browser QA와 성능 검증은 `mock-agent`에서 관리한다.
이번 작업에서는 해당 브랜치를 checkout하거나 구현과 테스트 결과를 조사하지 않았다.
`main`은 `mock-agent`에 의존하지 않으며 기본 동기화 방향은 `main → mock-agent`다.
mock 구현은 `main`으로 병합하지 않고, 검수에서 발견된 실제 코드 수정이나 보고서만 필요할 때 별도로 선별한다.

## 12. 하네스 필수 영역 개요

### 12.1 데이터 경로와 화면 연결

화면 변경이 어떤 API와 데이터 원천에 영향을 주는지 판단하려면 `화면 → 라우트 → 컴포넌트 → API → 서버 처리 → 데이터 원천` 추적이 필요하다.
상세 기준은 [data-flow.md](data-flow.md), [dashboard.md](../features/dashboard.md), [self-equipment.md](../features/self-equipment.md), [abnormal-data.md](../features/abnormal-data.md)에 존재한다.

### 12.2 대시보드 API 계약

`GET /api/dashboard-data`는 대시보드와 Mailing 요약이 공유하는 주요 데이터 경계다.
대표적으로 `lineDashboard.summary.monitoringSensorTotal`, `changeFromPreviousDay`, `previousDateTime`과 `lineDashboard.mailingSummary`가 확인됐다.
성공 응답 기준은 [dashboard.md](../features/dashboard.md), `harness/contracts/dashboard-api.schema.json`, Dashboard success·empty fixture와 `tests/contract/dashboard-api.contract.test.mjs`에서 관리한다. 오류 응답 Schema와 실제 root producer 직접 검증은 `Partial`이다.

### 12.3 STEP 딥링크와 HMAC

딥링크는 Line·SDWT·Grade·STEP·`eqpCh` 조건을 `/self-equipment`에 전달하는 역할을 한다.
현재 `step=ALL`과 `eqpCh` 처리만 `Confirmed`이며 개별 STEP HMAC 생성·검증, 비밀키, 변조·만료 처리는 `Unknown`이다.
HMAC은 복호화 가능한 암호문으로 간주하지 않는다.
상세 기준은 [step-deeplink.md](../features/step-deeplink.md), [self-equipment.md](../features/self-equipment.md), [security.md](security.md), [ADR-003-step-hmac-token.md](../decisions/ADR-003-step-hmac-token.md)에 존재한다. `tests/unit/step-hmac.test.mjs`와 `tests/integration/step-deeplink.test.mjs`는 `step=ALL`·`eqpCh` 흐름만 검증하며 실제 HMAC은 `Blocked`다.

### 12.4 메일 생성 및 발송

대시보드의 Mailing 집계, 수신 조건 등록, HTML template과 화면 재진입 링크는 확인됐다.
목표 흐름은 `데이터 조회 → 집계 → template render → 링크 구성 → 수신자 결정 → 발송`이지만 renderer·sender·주기·재시도·발송 log는 `Unknown`이다.
Core 산출물인 [mailing.md](../features/mailing.md), `harness/contracts/mailing-summary.schema.json`, success·empty fixture와 `tests/contract/mailing-summary.contract.test.mjs`는 존재한다. 실제 renderer·sender와 mail render test는 `Blocked`다.
mock 발송 차단과 mock 의존 integration 검증은 `mock-agent` 범위다.

## 13. 현재 기준 자료와 연계 문서

| 자료 | 역할 | 상태 |
|---|---|---|
| `AGENTS.md` | 사실 판정, 안전과 Core/mock 정책 | Confirmed |
| `reports/audit/harness-final-review.md` | 현재 Core Harness 완성도·Mismatch·Risk | Confirmed |
| `reports/audit/system-inventory.md` | commit `6cf9568`의 역사적 근거 인덱스 | Historical Snapshot |
| `web_structure.md` | 코드 기반 구조·흐름 설명 | Confirmed |
| `docs/user-manual/USER_MANUAL.md` | 사용자 기능과 용어 기준 | Confirmed |
| `server.mjs`, `src/features/fdc-trend/routes.jsx` | 서버·화면 대표 진입점 | Confirmed |
| `src/config/spiderDataPaths.mjs`, `package.json` | 데이터 경로와 기술·실행 기준 | Confirmed |

현재 기준 탐색 순서는 [architecture.md](architecture.md) → [environment-definition.md](environment-definition.md) → [data-flow.md](data-flow.md) → 기능별 문서 → 계약·Core 검증 산출물이다. 안전 검증 진입점은 `scripts/verify-env.sh`, `scripts/verify-contracts.sh`, `scripts/verify-all.sh`다.

## 14. 확인되지 않은 사항과 불일치

| 항목 | 상태 | 영향 | 후속 확인 문서 |
|---|---|---|---|
| 데이터 생산 주체·주기와 운영 배포 topology | Unknown | 데이터 신선도와 복구·이관 기준을 확정할 수 없음 | `architecture.md`, `deployment.md` |
| Node.js·Python 버전, secret·log·proxy 관리 | Unknown | 재현 가능한 환경과 운영 절차가 불완전함 | `environment-definition.md`, `security.md` |
| 개별 STEP HMAC 구현과 정책 | Mismatch / Unknown | 개별 STEP 딥링크의 무결성과 오류 정책을 확정할 수 없음 | `step-deeplink.md`, `ADR-003-step-hmac-token.md` |
| 실제 메일 renderer·sender·scheduler | Unknown | 발송·재시도·감사 경계를 확정할 수 없음 | `mailing.md`, `deployment.md` |
| `lineDashboard.summary.mailingSummary` 후보 | Mismatch | 실제 위치는 `lineDashboard.mailingSummary`임 | `dashboard.md`, Dashboard JSON Schema |
| Vite와 통합 서버의 API route 범위 | Mismatch | 개발 mode에 따라 일부 기능 가용성이 다름 | `architecture.md`, `environment-definition.md` |

이 개요는 검증 기준 코드 commit `99c4361`의 현재 시스템과 확정된 프로젝트 운영 정책을 설명하며, 연계 문서는 `AGENTS.md`의 근거 우선순위와 판정 상태에 따라 갱신한다.

# Documentation Consistency Audit — 메인 에이전트 인수인계

## 1. 목적과 적용 범위

| 항목 | 내용 |
|---|---|
| 작성일 | 2026-09-05 |
| 상태 | 감사 완료 / 권장 조치 미반영 |
| 인수인계 작성 기준 | `main`, `c5ffd5eb2fef783663c3b893c9e45b66fcfc52c6` |
| 목적 | 메인 에이전트가 감사 결과를 재확인하고 문서 정합성 개선에 반영할 수 있도록 근거·기준 문서·권장 조치 제공 |
| 감사 대상 | 이 보고서 추가 전 프로젝트 Markdown 36개 전체 |
| 제외 | `node_modules/`의 외부 의존성 Markdown |
| 감사 방식 | 문서 전수 읽기, 관련 코드 정적 대조, 상대 링크 대상 파일 존재 검사 |
| 이번 작성 범위 | 이 인수인계 문서만 추가. 기존 문서·애플리케이션·설정·계약은 변경하지 않음 |

이 문서는 감사 시점의 기록이며 현재 동작이나 개발 절차의 새 Source of Truth가 아니다. 현행 작업 규칙은 [AGENTS.md](../../AGENTS.md)를 따른다. 후속 에이전트는 실제 작업 시점의 코드와 지침을 먼저 확인하고, 아래 위치가 바뀌었다면 제목·식별자·함수명으로 근거를 찾아야 한다.

사용자의 최초 요청은 읽기 전용 감사였고, 후속 요청은 결과의 문서화다. 아래 권장 조치는 구현 완료 또는 별도 실행 승인으로 해석하지 않는다. 후속 문서 반영 요청을 받으면 이 문서를 입력으로 사용한다.

## 2. 핵심 결론과 반영 순서

운영 판단에 직접 영향을 주는 불일치를 먼저 다룬다. 전체 문서를 다시 감사하거나 문서를 일괄 재작성할 필요는 없다.

| 순서 | 대상 | 목표 |
|---|---|---|
| 1 | DOC-01~03 | 설정 파일 준비·배포, 읽기 전용 점검, 환경변수 적용 시점의 잘못된 안내 해소 |
| 2 | DOC-04~09 | 현재 코드와 다른 권한·오류·캐시·기술 사용 설명 및 테스트 ID·용어 판정 충돌 해소 |
| 3 | DOC-10~13 | 낡은 근거 인용, 작성 예정 표기, 해결된 이슈, 과거 검수 모델의 적용 범위 정리 |
| 4 | DOC-14~16 | 기준 문서 소유권을 확정하고 중복 상세를 요약·링크로 정리 |

우선순위는 문서 반영 순서이며 애플리케이션 결함의 심각도 판정이 아니다. 문서를 맞추기 위해 코드·API·데이터를 변경하지 않는다. 현재 동작의 개선이 필요하다면 별도 작업으로 분리한다.

## 3. 문서별 역할 목록

모든 경로는 저장소 root 기준이다. 아래 36개는 감사 당시 목록이며 이 보고서 자체는 포함하지 않는다.

| 파일 | 역할·주요 내용 |
|---|---|
| `README.md` | 서비스 소개, 설치·실행, 환경설정 요약, 검증 명령과 문서 탐색 |
| `AGENTS.md` | 에이전트 작업 범위, 검증·독립 검수와 운영 안전 규칙 |
| `web_structure.md` | 전체 구조, 화면→API→파일·DB 연결, 캐시·메일과 변경 영향 |
| `docs/system/overview.md` | 시스템 목적·사용자·기능·외부 의존성과 범위 |
| `docs/system/architecture.md` | 프런트엔드·Node·Python 구성, 실행·데이터·신뢰 경계 |
| `docs/system/environment-definition.md` | 실행환경, 환경변수, 우선순위·적용 시점, 경로·외부 의존성 |
| `docs/system/data-flow.md` | 화면→API→저장소 흐름, Flow ID, 변환·캐시·오류 처리 |
| `docs/system/deployment.md` | 배포 산출물·설정 주입·배포 전후 확인·rollback 경계 |
| `docs/system/security.md` | 사용자 식별·권한·정보 노출과 DB·파일·메일 보안 |
| `docs/system/glossary.md` | 업무 용어와 UI·API·데이터 필드의 명칭 대응 |
| `docs/features/dashboard.md` | Dashboard API·집계·필터·응답·오류·캐시·계약 |
| `docs/features/self-equipment.md` | 자설비 필터·차트·URL, MY EQP, SKIP·조회 동작 |
| `docs/features/abnormal-data.md` | 이상감지 화면군의 데이터·이미지·경로·이력 처리 |
| `docs/features/data-reference.md` | 데이터 경로·필드·판정·집계·이력 기록 의미 |
| `docs/features/step-deeplink.md` | 현재 STEP URL, `ALL`·`eqpCh`, HMAC 미구현 경계 |
| `docs/features/mailing.md` | 수신 등록·집계·템플릿 계약과 외부 발송기 경계 |
| `docs/features/notices.md` | 공지 화면·관리자 권한·API·DB 계약 |
| `docs/operations/runbook.md` | 일상 점검·장애 대응·정상 판정·운영 기록 |
| `docs/operations/systemd.md` | systemd 적용 시 실행 계정·경로·환경·재시작 확인 |
| `docs/operations/troubleshooting.md` | 화면·API·파일·DB·배포 증상별 진단과 대응 |
| `docs/operations/backup-restore.md` | 자산별 백업·복원 책임, 복구 절차와 미확정 목표 |
| `docs/operations/release-checklist.md` | 배포 전후 확인, 중단·rollback 조건과 증거 |
| `docs/operations/sensor-exclusion-config.md` | Sensor 제외 JSON 작성·배포·갱신·오류 처리 |
| `docs/operations/development-agent-workflow.md` | 조건부 독립 검수의 입력·시점·결과·후속 처리 |
| `docs/user-manual/USER_MANUAL.md` | 사용자 화면별 조회·등록·필터·문제 신고 방법 |
| `docs/user-manual/index.md` | 매뉴얼 탐색, 기능 문서 대응, 이미지·알려진 차이 |
| `docs/decisions/ADR-001-frontend-stack.md` | 프런트엔드 기술 선택·현재 사용 범위, `Accepted As-Is` |
| `docs/decisions/ADR-002-parquet-storage.md` | Parquet 저장의 이유·대안·제약, `Accepted As-Is` |
| `docs/decisions/ADR-003-step-hmac-token.md` | STEP HMAC 설계 후보·미결정 계약, `Proposed` |
| `reports/audit/system-inventory.md` | 특정 시점의 시스템·API·데이터·테스트 조사 기록 |
| `reports/audit/harness-final-review.md` | 과거 Harness 검토 결과와 조건부 준비 판정 |
| `reports/audit/2026-08-01-p0-p1-remediation-plan.md` | P0/P1 개선 계획과 일부 후속 결정·진행 기록 |
| `reports/development-validation-subagent-adoption-plan.md` | 검증 에이전트 도입 단계별 계획 |
| `reports/development-validation-subagent-stage1-3-handoff.md` | 도입 1~3단계 결과와 당시 다음 단계 인계 |
| `reports/development-validation-subagent-workflow.md` | 도입 당시 의무 검수·전문 검증·재검수 모델과 완료 기록 |
| `src/features/fdc-trend/pages/versions/README.md` | 화면 소스 백업의 목적·복원 참고사항 |

## 4. 발견사항

위치는 감사 당시 행 번호 또는 문서 절이다. `확인됨`은 정적 근거로 확인했다는 뜻이며 실제 운영 환경에서 실행했다는 의미가 아니다. 구조·중복에 관한 조치는 편집 권고다.

### DOC-01 — Sensor 제외 설정 파일의 배포 안내 불일치

- 관련 파일: `docs/system/deployment.md`, `docs/operations/sensor-exclusion-config.md`, `server/sensorExclusionConfig.mjs`, `config/`.
- 관련 위치: deployment 55·103~104·116·131행, 운영 가이드 52행, 코드 12~18·145~153행.
- 문제 유형: `code-doc mismatch`.
- 문제 설명: 문서는 `config/sensor-exclusions.json`을 release source 필수 파일로 설명하고, 파일이 없으면 새 버전 배포를 안내한다. Git에서 관리하는 파일은 `sensor-exclusions.example.json`뿐이다. 코드는 runtime 파일을 생성하지 않으며 누락 시 같은 경로의 이전 정상 설정 또는 빈 제외 설정을 사용한다.
- Source of Truth: 준비·배포 방법은 Sensor 운영 가이드, 실제 기본 경로·fallback은 `server/sensorExclusionConfig.mjs`.
- 권장 조치: 예제와 runtime 설정을 구분하고 최초 준비 책임·방법을 명시한다. source 배포만으로 runtime 파일이 생긴다는 안내를 바로잡는다. 문서 작업에서 실제 운영 파일을 만들거나 배포 정책을 임의로 결정하지 않는다.
- 확인 상태: 저장소·코드 불일치 확인됨. 실제 운영 파일 배치 여부는 운영 환경 미검증.

### DOC-02 — 등록 목록 조회를 읽기 전용 점검으로 보장할 수 없음

- 관련 파일: `docs/operations/runbook.md`, `docs/system/deployment.md`, `docs/system/security.md`, `server/myEqpRegistration.mjs`, `scripts/my_eqp_registration.py`.
- 관련 위치: runbook 102행, deployment 152행, security 250행; Node 224~225·257~265행, Python 50~67·125~129행.
- 문제 유형: `code-doc mismatch`.
- 문제 설명: 등록 목록 조회를 안전한 DB 읽기 점검으로 안내하지만 MY EQP GET은 `list_registrations()`에서 `ensure_public_column()`을 호출한다. `is_public` 컬럼이 없으면 `ALTER TABLE`과 commit이 발생한다.
- Source of Truth: 점검 절차는 runbook, 부작용은 Python helper와 security의 runtime DDL 설명.
- 권장 조치: 점검 대상 조회 경로를 구체화하고 조건부 DDL이 있는 조회를 읽기 전용으로 분류하지 않는다. 문서 수정과 DDL 제거·migration 변경은 별도 작업이다.
- 확인 상태: 코드 경로 확인됨. 운영 DB에서 해당 조건이 충족되는지는 미검증이며 재현을 위한 운영 조회·DDL을 실행하지 않는다.

### DOC-03 — 환경변수 경로값의 적용 시점 오류

- 관련 파일: `docs/system/environment-definition.md`, `docs/system/deployment.md`, `server/mappingConfig.mjs`, `server/latestCommonalityPath.mjs`, `server/dashboardData.mjs`.
- 관련 위치: environment 104·105·107행, deployment 71·72·74행; 코드 각각 7·10·26행.
- 문제 유형: `code-doc mismatch`.
- 문제 설명: `MAPPING_CONFIG_PATH`, `COMMONALITY_ROOT_PATH`, `SPIDER_DASHBOARD_PATH_ROOT` 적용을 API 요청 시점으로 설명하지만 실제 경로값은 모듈 최상위 상수에서 읽는다. 파일 내용 조회와 경로 설정 적용이 혼동돼 있다.
- Source of Truth: 환경변수 정의는 environment-definition, 구현 근거는 해당 모듈의 상수·조회 함수.
- 권장 조치: 경로값은 프로세스 시작의 모듈 로드 시 고정되고, 내용은 요청·캐시 정책에 따라 조회됨을 분리한다. deployment는 이 기준을 참조한다.
- 확인 상태: 코드 확인됨.

### DOC-04 — 공지 관리자 권한의 보안·환경 문서 반영 누락

- 관련 파일: `docs/system/security.md`, `docs/system/environment-definition.md`, `docs/features/notices.md`, `server/notices.mjs`.
- 관련 위치: security 111행, environment §8, notices 7~9행; 코드 176·196~207·261행.
- 문제 유형: `code-doc mismatch`, `stale`.
- 문제 설명: 보안 문서는 관리자 권한 검사를 미확인으로 표시하지만 공지에는 서버 관리자 검사와 거부 응답이 존재한다. 환경 문서 본문에는 공지 설정이 있으나 레지스트리에 빠져 있고 코드의 단수 별칭 `NOTICE_ADMIN_KNOX_ID`도 정리되지 않았다.
- Source of Truth: 기능 권한은 notices, 설정 이름·우선순위는 environment-definition, 통제 요약은 security.
- 권장 조치: 공지의 구현된 권한과 전역 인증 체계의 미확인을 구분한다. `NOTICE_ADMIN_KNOX_IDS`와 단수 별칭, 파일/프로세스 설정 우선순위를 코드 기준으로 레지스트리에 반영한다. 실제 설정값은 기록하지 않는다.
- 확인 상태: 코드 확인됨.

### DOC-05 — Dashboard 오류 설명의 부분 갱신

- 관련 파일: `docs/system/security.md`, `docs/features/dashboard.md`, `server/dashboardData.mjs`, `harness/contracts/safe-api-error.schema.json`.
- 관련 위치: security 180행, dashboard 20행·§18·§20, 코드 863~885행.
- 문제 유형: `contradiction`, `code-doc mismatch`.
- 문제 설명: security는 예외 메시지 결합을 설명하지만 현재 handler는 고정 메시지·code·requestId를 반환한다. dashboard 앞부분은 오류 Schema를 범위 밖 또는 미완료처럼 묶고, 뒷부분은 공통 오류 Schema 계약을 명시한다.
- Source of Truth: dashboard §18과 공통 오류 Schema, 구현은 Dashboard handler.
- 권장 조치: 상단 범위와 보안 요약을 갱신한다. 보호 대상 예외와 기존 405 응답 등 예외 범위를 구분하고 모든 응답이 같은 형태라고 확대하지 않는다.
- 확인 상태: 코드·문서 내부 충돌 확인됨.

### DOC-06 — React Query 기본 설정을 Unknown으로 표시

- 관련 파일: `docs/features/self-equipment.md`, `src/lib/queryClient.js`, `src/components/common/AppProviders.jsx`, `src/features/fdc-trend/pages/FdcTrendPage.jsx`.
- 관련 위치: self-equipment 302·408행, queryClient 8~15행, AppProviders 9~12행.
- 문제 유형: `code-doc mismatch`, `stale`.
- 문제 설명: focus 재조회·일반 retry가 미확인으로 남았지만 공통 설정은 `staleTime: 60_000`, `retry: 1`, `refetchOnWindowFocus: false`다. 일부 query에는 별도 override가 존재한다.
- Source of Truth: 공통값은 queryClient, 기능별 예외는 해당 기능 문서와 query 선언.
- 권장 조치: 공통 기본값과 개별 override를 구분하고 해결된 Unknown을 정리한다.
- 확인 상태: 코드 확인됨.

### DOC-07 — Plotly 실제 사용 여부 충돌

- 관련 파일: `docs/system/architecture.md`, `docs/decisions/ADR-001-frontend-stack.md`, `package.json`, `src/`.
- 관련 위치: architecture 85행, ADR 70행.
- 문제 유형: `contradiction`, `code-doc mismatch`.
- 문제 설명: architecture는 Recharts·Plotly 실제 import를 Confirmed로 표시한다. ADR은 Plotly가 dependency에만 선언되고 사용 위치는 미확인이라고 설명한다. 감사 당시 `src/` 검색에서는 Recharts 사용만 확인됐다.
- Source of Truth: 현행 사용 기술은 architecture, 선택 이유는 ADR. 이번 사실 판정은 ADR 설명과 일치한다.
- 권장 조치: dependency 선언과 사용을 구분하여 architecture를 정정한다. 문서 작업을 이유로 dependency를 제거하지 않는다.
- 확인 상태: source 검색으로 확인됨.

### DOC-08 — STEP 테스트 ID의 의미 충돌

- 관련 파일: `docs/features/step-deeplink.md`, `docs/decisions/ADR-003-step-hmac-token.md`.
- 관련 위치: feature 330~343행, ADR 210~220행.
- 문제 유형: `contradiction`.
- 문제 설명: feature의 STEP-T01은 MY EQP ALL, STEP-T06은 token 매핑이다. ADR의 같은 ID는 각각 결정적 token 생성과 MY EQP ALL이다. 제안 상태라도 같은 ID로 서로 다른 결과를 추적하게 된다.
- Source of Truth: step-deeplink의 테스트 시나리오 목록.
- 권장 조치: ADR은 목록을 참조하고 독립 설계 후보가 필요하면 다른 ID를 사용한다. 구현되지 않은 HMAC 테스트를 완료된 것처럼 기록하지 않는다.
- 확인 상태: 문서 간 충돌 확인됨.

### DOC-09 — PPID와 recipe_id 명칭 차이의 판정 충돌

- 관련 파일: `docs/features/abnormal-data.md`, `docs/system/glossary.md`.
- 관련 위치: abnormal-data 321행 `ABN-M01`, glossary 68행.
- 문제 유형: `contradiction`.
- 문제 설명: ABN-M01은 명칭 차이를 Mismatch로 분류하지만 glossary는 확인된 UI/API 명칭 대응이므로 이름 차이만으로 Mismatch로 판단하지 말라고 명시한다.
- Source of Truth: 공통 용어·대응 관계는 glossary.
- 권장 조치: 확인된 alias와 미확인 업무 의미를 분리한다. 모든 경로의 `ppid`가 같은 의미라는 추가 해석은 하지 않는다.
- 확인 상태: 판정 충돌 확인됨. 모든 데이터 경로의 의미 동일성은 코드 확인 필요, 공식 업무 정의는 데이터 담당자 확인 필요.

### DOC-10 — 현재 내용을 뒷받침하지 않는 근거 인용

- 관련 파일: `docs/features/step-deeplink.md`, `docs/system/security.md`, `README.md`, `AGENTS.md`.
- 관련 위치: step-deeplink 34행, security 207행.
- 문제 유형: `stale`.
- 문제 설명: STEP 문서가 README 281~288행을 인용하지만 현 README는 147행이다. security의 HMAC 목적 근거인 AGENTS 65~71행도 현재 해당 설명이 아니다.
- Source of Truth: 현재 STEP 동작은 feature와 코드, 설계 목적은 ADR.
- 권장 조치: 제목·절 링크와 코드 식별자를 우선한다. 과거 근거를 보존할 때는 commit을 명시한다. 다른 문서의 동일 인용이 확인되는 경우에만 해당 범위로 확장한다.
- 확인 상태: 인용 불일치 확인됨. 상대 링크 대상 파일의 존재와 행 번호 정확성은 별개다.

### DOC-11 — 이미 존재하는 문서를 향후 작성 대상으로 안내

- 관련 파일: `docs/system/environment-definition.md`.
- 관련 위치: 11행, §24의 331~340행.
- 문제 유형: `stale`.
- 문제 설명: data-flow·deployment·security·features·operations 문서를 향후 산출물로 안내하지만 이미 존재한다.
- Source of Truth: 각 주제의 현재 문서와 탐색 목록.
- 권장 조치: 작성 예정 표기를 현재 링크와 책임 설명으로 바꾸고 실제 미완료 내용만 후속 항목으로 남긴다.
- 확인 상태: 문서 존재 확인됨.

### DOC-12 — 해결된 매뉴얼 문제를 인덱스가 계속 보고

- 관련 파일: `docs/user-manual/index.md`, `docs/user-manual/USER_MANUAL.md`.
- 관련 위치: index 80행 `MAN-M05`, USER_MANUAL 253·278행.
- 문제 유형: `stale`.
- 문제 설명: index는 매뉴얼이 표시된 경로를 확인하도록 안내한다고 기록하지만 현재 매뉴얼은 발생 시각·선택 조건·문의 코드를 기록하도록 변경돼 있다.
- Source of Truth: 사용자 안내는 USER_MANUAL.
- 권장 조치: 미해결 목록을 정리하고 필요한 해결 이력은 현재 문제와 분리한다.
- 확인 상태: 문서 대조로 확인됨. 실제 브라우저 화면 재현은 수행하지 않음.

### DOC-13 — 과거 독립 검수 모델의 현재 적용 범위 혼동

- 관련 파일: `reports/development-validation-subagent-workflow.md`, `AGENTS.md`, `docs/operations/development-agent-workflow.md`.
- 관련 위치: report 157·219·260·270행, AGENTS §5, 현행 workflow §2·5·6.
- 문제 유형: `stale`, `responsibility overlap`.
- 문제 설명: 과거 보고서는 의무 호출·SPECIALIST_REQUIRED·수정 후 재검토를 설명하며 현재 구현 상태도 관리한다고 적는다. 현재 지침은 조건부 최대 1회 검수와 자동 재검수 금지다. 과거 실행 기록 자체는 오류가 아니지만 적용 시점이 혼동된다.
- Source of Truth: 호출 원칙은 AGENTS, 상세 절차는 현행 operations workflow.
- 권장 조치: 당시 기록을 보존하고 Historical 또는 Superseded 표시와 현행 지침 링크를 추가한다. 과거 실행 횟수·판정을 현재 규칙에 맞춰 고쳐 쓰지 않는다.
- 확인 상태: 지침 차이 확인됨. 조치는 적용 범위 명확화 권고.

### DOC-14 — web_structure와 전문 문서의 책임 중복

- 관련 파일: `web_structure.md`, `docs/system/architecture.md`, `docs/system/data-flow.md`, `docs/features/*`, `README.md`, `AGENTS.md`.
- 관련 위치: web_structure §1~12 및 665행, architecture §4~9, data-flow §7~16.
- 문제 유형: `duplication`, `responsibility overlap`.
- 문제 설명: 구조·API·경로·DB·캐시·메일 상세를 여러 문서가 병렬로 관리한다. web_structure의 README·본 문서 동시 갱신 체크리스트도 AGENTS의 실제 부정확해지는 문서만 수정한다는 원칙보다 넓게 읽힐 수 있다. README와 AGENTS 자체는 현재 대체로 역할이 구분돼 있다.
- Source of Truth: 구조는 architecture, 연결은 data-flow, 동작은 features, 공통 데이터 의미는 data-reference.
- 권장 조치: web_structure의 고유 구조도와 탐색 기능을 보존하며 중복 상세를 링크로 대체한다. 고유 설명이 사라지지 않도록 비교 후 정리한다. README는 진입점, AGENTS는 작업 규칙 역할을 유지한다.
- 확인 상태: 중복 확인됨. 범위 축소는 편집 권고이며 일괄 삭제·파일 이동 지시가 아님.

### DOC-15 — 운영 절차와 설정 정의의 반복

- 관련 파일: `docs/system/deployment.md`, `docs/system/environment-definition.md`, `docs/operations/runbook.md`, `docs/operations/release-checklist.md`.
- 관련 위치: deployment §4·6~9, environment §7~8, runbook §4, release-checklist 배포 전후 확인 절.
- 문제 유형: `duplication`, `responsibility overlap`.
- 문제 설명: 적용 시점·준비 점검·정상 판정·rollback 조건이 반복된다. 체크리스트 요약은 유용하지만 설정 사실까지 복제되어 DOC-03과 같은 불일치가 생긴다.
- Source of Truth: 설정은 environment, 배포 순서는 deployment, 일상 점검은 runbook, 완료 확인은 release-checklist.
- 권장 조치: 체크리스트는 실행 여부·증거·기준 절 링크 중심으로 관리하고 설정값·적용 시점·명령의 중복 정의를 줄인다.
- 확인 상태: 중복 확인됨. 편집 권고.

### DOC-16 — Core/mock 정책과 HMAC 미결정 내용의 반복

- 관련 파일: `docs/system/overview.md`, `architecture.md`, `data-flow.md`, `security.md`, `docs/features/step-deeplink.md`, `docs/decisions/ADR-003-step-hmac-token.md`.
- 관련 위치: overview §11~12, architecture §9·12, data-flow §11·19, security §13, STEP feature·ADR 상세 표.
- 문제 유형: `duplication`, `responsibility overlap`.
- 문제 설명: Core/mock 정책과 HMAC 생성·검증·키·만료의 미확인 표가 반복된다. 관점별 요약을 넘어 상세 목록과 테스트 ID까지 별도로 소유하면서 갱신 지점과 충돌 가능성이 늘었다.
- Source of Truth: 에이전트 branch 규칙은 AGENTS, 현재 STEP 계약은 feature, 결정은 ADR, 보안 요구는 security.
- 권장 조치: 현재 동작·설계 후보·보안 요구·작업 규칙을 분리하고 나머지는 짧은 요약과 기준 링크를 사용한다. HMAC 미구현 자체를 이번 감사의 신규 결함으로 분류하지 않는다.
- 확인 상태: 중복 확인됨. 편집 권고.

## 5. 권장 Documentation Architecture

현재 폴더를 유지하며 아래 정보 소유권을 적용하는 것을 권고한다. 새 구조로 일괄 이동하거나 문서를 모두 합치는 작업은 필요하지 않다.

| 위치 | 소유할 기준 정보 | 다른 문서와의 경계 |
|---|---|---|
| `README.md` | 소개·최소 실행·탐색 | 상세 기능·설정은 링크 |
| `AGENTS.md` | 에이전트 행동·검증·운영 안전 | 제품/API 계약을 재정의하지 않음 |
| `docs/system/overview.md` | 목적·범위·전체 소개 | 세부 구성·흐름은 전문 문서 연결 |
| `docs/system/architecture.md` | 구성요소·실행 경계·현재 사용 기술 | 선택 이유는 ADR, 필드는 features/contracts |
| `docs/system/data-flow.md` | 화면→API→저장소 연결과 Flow/Source ID | 필드·예외·판정을 재정의하지 않음 |
| `docs/system/environment-definition.md` | 설정 이름·기본값·우선순위·적용 시점 | 운영 문서는 정의를 참조 |
| `docs/system/security.md` | 신뢰 경계·구현 통제·위험·보안 요구 | 기능 권한 상세는 해당 feature |
| `docs/system/glossary.md` | 용어·UI/API/source 명칭 대응 | 별칭을 다른 문서에서 새로 정의하지 않음 |
| `docs/features/` | 현재 기능 동작·계약·예외 | 제안·미확인을 구현 사실과 분리 |
| `docs/features/data-reference.md` | 공통 경로·필드·판정·이력 의미 | README/구조도/ADR에는 요약과 링크 |
| `harness/contracts/` | 기계 검증 가능한 스키마 | feature는 의미·예외·호환성을 설명 |
| `docs/operations/` | 배포·점검·진단·복구 절차 | 체크리스트와 상세 절차를 분리 |
| `docs/user-manual/` | 사용자 화면·수행 방법 | 내부 구현·감사 목록은 전문 문서로 연결 |
| `docs/decisions/` | 이유·대안·결정 상태 | 현재 계약·테스트 목록을 별도 소유하지 않음 |
| `reports/` | 날짜·commit에 고정된 조사·계획·인계 | 현행 지침과 과거 기록을 구분 |
| `web_structure.md` | 고유 구조도·탐색 지도 | 전문 문서의 상세 정의 참조 |
| `src/.../versions/README.md` | 보관 소스의 용도·복원 조건 | 현행 구현 기준과 구분 |

현행 문서의 상태·적용 범위·검증 기준 commit·관련 기준 문서는 한 곳에만 기록하는 편이 좋다. 과거 보고서는 원래 날짜와 commit을 보존하며 필요한 경우 Historical/Superseded와 현재 기준 링크만 추가한다. 이 보고서도 장기적인 현재 상태 목록으로 확장하지 않는다.

## 6. 후속 메인 에이전트의 작업 방법과 완료 기준

1. 현재 AGENTS와 해당 하위 지침, Git 상태를 확인하고 기존 사용자 변경을 보존한다.
2. 이 보고서의 ID별로 해당 문서와 직접 근거 코드만 확인한다. 현재 코드가 달라졌으면 감사 내용을 그대로 적용하지 말고 재판정한다.
3. 반영 요청 범위 안에서 DOC-01~03부터 수정한다. 문서를 맞추기 위한 코드·설정·Schema 변경, 운영 조회·배포는 수행하지 않는다.
4. DOC-04~13을 정리한다. 역사 기록과 명시된 Unknown은 그 자체로 오류 처리하지 않는다.
5. DOC-14~16은 고유 설명의 보존과 기준 문서 연결을 우선한다. 중복이 있다는 이유만으로 문서를 삭제하거나 이동하지 않는다.
6. 수정된 문서의 상대 링크·제목 참조와 관련 설명의 상호 일치 여부를 확인한다. `git diff --check`와 최종 diff를 확인한다. 순수 문서 수정에 전체 test/build/운영 재현을 추가하지 않는다.
7. 결과를 ID별로 `반영 / 현행 코드상 해당 없음 / 보류`로 보고하고, 보류 사유·남은 확인·수정 파일을 명시한다. 문서 일부를 정리한 것만으로 전체 감사 항목을 완료 처리하지 않는다.

이 보고서는 독립 subagent 재검수나 specialist 호출을 요구하지 않는다. 필요 여부는 작업 시점의 사용자 요청과 AGENTS를 따른다.

후속 요청에 사용할 수 있는 문구:

> `reports/audit/2026-09-05-documentation-consistency-audit-handoff.md`를 읽고 DOC-01~16을 현재 문서·직접 관련 코드와 대조하라. 확인된 문서 불일치를 최소 범위로 반영하되 애플리케이션·API·데이터·운영 설정은 변경하지 마라. 과거 기록은 보존하고 현재 지침과 구분하라. 구조 정리는 고유 내용을 유지하는 요약·링크 중심으로 수행하라. 완료 시 ID별 반영 여부, 검증 결과와 보류 사유를 보고하라.

## 7. 검증 결과와 미검증 경계

- 원 감사에서 프로젝트 Markdown 36개를 전수 읽었다. 상대 Markdown 링크의 대상 파일 누락은 발견하지 못했다. 모든 anchor나 코드 인용 행이 유효하다는 뜻은 아니다.
- 관련 Node/Python 코드와 문서를 정적으로 대조했다. 테스트·build·server 실행과 운영 DB·메일·`/appdata` 접근은 수행하지 않았다.
- 원 감사에서 파일 변경은 없었고 `git diff --check`는 통과했다.
- 이번 인수인계 작성 전 tracked diff는 없었으며 미추적 `.codex/agents/documentation-audit.toml`은 기존 사용자 파일로 보존한다.
- HMAC 미구현 설명과 Mailing 복수 recipient 순차 처리의 부분 완료 위험은 현재 코드와 일치하여 신규 불일치로 분류하지 않았다.
- 외부 메일 renderer/sender의 구현 위치는 **코드 확인 필요**다. 실제 systemd·proxy·DB schema·권한·운영 파일 배치는 **운영 환경 미검증**이다. 미검증을 근거 없이 정상·완료로 바꾸지 않는다.

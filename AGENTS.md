# L0 Spider Project Instructions

## 1. Project Mission and Status

L0 Spider는 이상감지 결과, 자설비·공통부·동일성 화면, 등록과 이력 기능을 제공하는 운영 중 웹서비스다.
신규 프로젝트가 아니므로 기존 사용자 동작, 데이터 해석과 API 호환성 보존을 최우선으로 한다.
요청 범위 밖의 대규모 리팩터링, 소스 이동 또는 시스템 교체를 수행하지 않는다.

## 2. Sources of Truth

사실 판단은 다음 우선순위를 적용한다.
1. 재현 가능한 실행 및 검증 결과
2. 현재 코드와 설정
3. 테스트와 실행 가능한 계약
4. 시스템 구조 문서
5. 사용자 메뉴얼
6. 과거 보고서와 추정
문서와 코드가 다르면 어느 한쪽을 임의로 맞추지 말고 근거와 함께 `Mismatch`로 기록한다.

## 3. Evidence Status

- `Confirmed`: 현재 코드, 설정 또는 재현 가능한 실행 결과로 확인됨
- `Documented`: 기존 문서에만 기록되고 현재 구현은 확인되지 않음
- `Inferred`: 코드 구조나 명칭을 근거로 추정함
- `Unknown`: 현재 자료와 허용된 조사로 확인할 수 없음
- `Mismatch`: 코드, 설정, 계약 또는 문서 사이에 명확한 차이가 있음
조사, 문서와 보고서에서 확인 상태를 명시하고 추정을 사실처럼 표현하지 않는다.

## 4. Harness Branch Boundary and Target Structure

`main`은 실제 코드와 전체 시스템의 기준이며 Core Harness를 반영하는 브랜치다.
Core Harness는 다음을 관리한다.
- 공통 지침과 시스템·기능·운영·사용자 문서
- 데이터 경로 추적, Dashboard 계약, STEP/HMAC와 Mailing 정의
- 환경·배포·보안 규칙과 API·데이터 계약
- 운영 자원에 의존하지 않는 unit·contract 검증과 안전한 검증 script
- audit, architecture와 change-impact 보고서
Core 목표는 `docs/{system,features,operations,user-manual,decisions}/`, `harness/contracts/`, `tests/{unit,contract}/`, `scripts/`, `reports/`다.
`main`의 fixture는 개인정보·운영 데이터가 없는 최소 synthetic 계약 샘플만 허용한다.
`mock-agent` 전용 Mock Validation Extension에는 mock 서버·API·DB·데이터·Parquet·이미지와 대규모 UI fixture를 둔다.
`scripts/bootstrap-mock.sh`, `scripts/run-mock.sh`, mock smoke·integration·E2E, Playwright Browser QA와 mock 성능 검증은 `mock-agent`에만 둔다.
따라서 `harness/mock/`, mock 전용 scenario와 mock 의존 `verify-ui.sh`는 Core 필수 목표가 아니다.
`main`의 코드·문서·빌드·검증은 `mock-agent`에 의존하지 않는다.
`mock-agent`는 `main`의 코드와 계약을 따르며 기본 동기화 방향은 `main → mock-agent`다.
mock 구현은 `main`으로 병합하지 않되, 발견된 실제 코드 수정과 보고서는 별도로 선별할 수 있다.
이 구조를 위해 기존 애플리케이션 디렉터리나 소스를 이동·교체하지 않는다.

## 5. Mandatory Harness Coverage

### Data Path to UI Traceability

`사용자 화면 → 브라우저 라우트 → 프론트엔드 컴포넌트 → API → 백엔드 서비스 → 데이터 경로`를 추적 가능하게 한다.
화면, 라우트, API, 서비스, 경로 패턴, 파라미터 출처, 데이터 생성 주체, 데이터 없음 처리, 오류, 근거 코드와 확인 상태를 기록한다.
기준 문서는 `docs/system/data-flow.md`, `docs/features/dashboard.md`, `docs/features/self-equipment.md`, `docs/features/abnormal-data.md`를 목표로 한다.
실제 `/appdata`를 조사하지 말고 코드 경로 패턴과 최소 synthetic 계약 샘플만 사용한다.

### Dashboard API Contract

메서드, 경로, 요청, 응답 타입, nullable, 빈 데이터, 오류 응답, 호환성과 프론트엔드 소비 위치를 계약으로 관리한다.
현재 코드에서 `GET /api/dashboard-data`와 `lineDashboard.summary.monitoringSensorTotal`, `changeFromPreviousDay`, `previousDateTime`은 `Confirmed`다.
현재 `mailingSummary`는 `lineDashboard.mailingSummary`이며 `lineDashboard.summary.mailingSummary` 후보는 `Mismatch`다.
산출물은 `docs/features/dashboard.md`, `harness/contracts/dashboard-api.schema.json`, 선택적 최소 synthetic 샘플과 `tests/contract/`를 목표로 한다.
API 변경 시 코드, JSON Schema, fixture와 contract test의 동시 갱신 여부를 검토한다.

### STEP Deep Link and HMAC

`/self-equipment?...&step={HMAC토큰}&eqpCh=...`와 `/self-equipment?...&step=ALL&eqpCh=...` 후보를 실제 코드와 대조한다.
쿼리 의미, 서명 원문과 정규화, 알고리즘, URL 인코딩, 비밀키 환경변수, `step=ALL`, `eqpCh`, 누락·변조 처리, 만료와 로그 노출을 정의한다.
현재 `step=ALL`과 `eqpCh` 파싱은 `Confirmed`이고 HMAC 생성·검증과 비밀키는 `Unknown`이므로, 개별 STEP HMAC 구현 후보는 `Mismatch`다.
실제 비밀키를 문서, fixture, 테스트, 로그 또는 보고서에 기록하지 않는다.
기준 문서는 `docs/features/step-deeplink.md`, `docs/features/self-equipment.md`, `docs/system/security.md`, `docs/decisions/ADR-003-step-hmac-token.md`를 목표로 한다.

### Mailing

발송 트리거·주기, 수신자, 집계·중복 제거, 템플릿 변수, 색상, 이미지·링크, 성공·실패·재시도·로그와 빈 데이터를 정의한다.
`dashboard_monitoring_sensor_total`, `dashboard_change_from_previous_day`, `dashboard_previous_date_time`, `dashboard_change_color`는 현재 템플릿에서 `Confirmed`다.
집계·수신조건 등록과 `public/mailing-report.html`은 `Confirmed`지만 실제 발송기와 스케줄러는 `Unknown`이다.
Core 검증은 실제 메일을 발송하지 않으며 mock 발송 차단·렌더링 검증은 `mock-agent`에서 수행한다.
산출물은 `docs/features/mailing.md`, `harness/contracts/mailing-summary.schema.json`, `tests/unit/`과 `tests/contract/`를 목표로 한다.

## 6. Operational Safety

- 운영 DB에 테스트용 쓰기, DDL 또는 migration을 실행하지 않는다.
- `/appdata` 운영 파일을 삭제, 이동, 변경하거나 덮어쓰지 않는다.
- fixture, 테스트 결과와 보고서를 운영 경로에 저장하지 않는다.
- 실제 메일과 운영 수신자를 테스트에 사용하지 않는다.
- 비밀번호, HMAC 키, 토큰과 실제 `.env` 값을 출력·문서화하거나 Git에 넣지 않는다.
- 운영 systemd 서비스, 네트워크, 포트, 방화벽과 프록시를 요청 없이 변경하지 않는다.
- 파괴적인 Git 명령, force push와 사용자 변경사항 되돌리기를 수행하지 않는다.
- 이 안전 규칙은 하위 `AGENTS.md`에서 완화할 수 없다.

## 7. Change Workflow

변경 전에는 관련 시스템 문서와 사용자 메뉴얼을 읽고 화면, API, 서비스와 데이터 경로의 영향 범위를 조사한다.
DB, 메일, HMAC, 환경변수와 운영 자원 영향도 함께 확인한다.
변경 후에는 변경 파일과 `git diff`를 검토하고 `git diff --check`를 실행한다.
Core에서는 확인된 lint, build, unit과 contract 명령만 실행하며 mock 의존 integration·e2e는 `mock-agent` 범위다.
문서, 계약, fixture와 scenario 갱신 필요성을 확인하고 미실행 검증과 남은 위험을 기록한다.
저장소에서 확인되지 않은 명령이나 운영 절차를 임의로 작성하지 않는다.

## 8. Documentation and Reporting

- 설명 문서와 작업 보고는 한국어로 작성하되 코드 식별자, API, 경로와 환경변수는 원문을 유지한다.
- 현재 상태와 목표 상태를 구분하고, 상세 정보를 복사하지 말고 적절한 단일 기준 문서로 연결한다.
- 보고에는 변경 파일, 실행·미실행 검증, `Unknown`, `Mismatch`와 운영 자원 변경 여부를 포함한다.
- 실행하지 않은 검증은 `Not Run`, 일부만 수행한 검증은 `Partial`로 표시한다.

## 9. Nested AGENTS.md Policy

프론트엔드, 백엔드, 메일링과 하네스 디렉터리에 범위별 하위 `AGENTS.md`를 둘 수 있다.
하위 지침은 해당 디렉터리에서 우선하지만 상위 지침과 충돌하지 않아야 한다.
운영 안전, 비밀정보 보호와 근거 상태 규칙은 어떤 하위 지침도 완화할 수 없다.


## 개인 PC Mock 및 검수 환경 추가 규칙

이 절은 `mock-agent` 브랜치와 이 브랜치에서 분기한 다음 검수 브랜치에서만 적용한다.

* `agent/browser-qa`
* `agent/code-audit`
* `agent/performance`

### 환경 목적

* 이 환경은 개인 PC의 WSL에서만 사용하는 외부 검수 환경이다.
* 사내 PC와 실제 운영 서버에서는 Mock 환경 및 검수 에이전트를 사용하지 않는다.
* 실제 서비스 코드는 `main`을 기준으로 하며, Mock 환경은 `main`의 최신 내용을 받아 검수하는 용도로만 사용한다.

### 데이터 및 보안

* 실제 회사 데이터는 사용하지 않는다.
* 실제 사내 URL, 호스트명, IP, 사용자 ID, 설비 ID, 제품명, 센서명, step, PPID, recipe, 토큰, 쿠키, HMAC 키와 DB 접속정보를 Mock 데이터와 보고서에 기록하지 않는다.
* Mock 환경에서는 합성 데이터만 사용한다.
* 민감정보로 의심되는 값은 실제 내용을 출력하지 않고 파일 경로와 유형만 기록한다.
* 실제 사내 API나 운영 시스템에 접속하지 않는다.

### 브랜치 운영

* `main`은 사내 PC와 개인 PC가 공통으로 사용하는 실제 서비스 코드 전용 브랜치다.
* `mock-agent`는 개인 PC 전용 Mock 및 에이전트 공통 기반 브랜치다.
* `agent/*` 브랜치는 `mock-agent`에서 분기한 개인 PC 전용 검수 브랜치다.
* 동기화 방향은 `main → mock-agent → agent/*`로 한정한다.
* `mock-agent` 또는 `agent/*`의 내용을 `main`으로 병합하지 않는다.
* Mock 및 에이전트 관련 파일을 `main`에 반영하지 않는다.

### 검수 에이전트 공통 역할

검수 에이전트의 실행 범위는 다음으로 한정한다.

1. 문제 탐색
2. 재현 조건 확인
3. 근거 수집
4. 우선순위 지정
5. 보고서 작성

다음 작업은 수행하지 않는다.

* 애플리케이션 소스 코드 수정
* 테스트 코드 수정
* 설정 파일 수정
* 의존성 추가 또는 업데이트
* UI 및 성능 직접 개선
* 자동 commit, push, merge, rebase
* Pull Request 생성

발견된 문제의 실제 수정은 사용자가 `main` 브랜치의 개발용 Codex에 별도로 요청한다.

### 공통 판단 원칙

* 실패를 임의의 기본값으로 치환하여 정상처럼 표시하지 않는다.
* API 실패와 정상적인 조회 결과 0건을 구분한다.
* 데이터 불일치와 판단 불가능 상태를 명시적으로 드러낸다.
* 숫자 변환 실패를 임의로 0으로 처리하지 않는다.
* 날짜 파싱 실패를 현재 날짜로 대체하지 않는다.
* 오래된 응답이 최신 응답을 덮어쓸 가능성을 정상으로 취급하지 않는다.
* 확인된 사실과 추정 또는 잠재 위험을 구분한다.
* 재현되지 않은 문제를 확정 오류로 표현하지 않는다.
* 실행하지 못한 테스트와 검수 항목을 숨기지 않는다.

### 문서 및 보고서

* Mock 및 에이전트 관련 문서와 보고서는 한글로 작성한다.
* 코드, 명령어, API path, 파일 경로, 오류 메시지와 라이브러리 이름은 원문을 유지할 수 있다.
* 역할별 상세 지침은 다음 파일을 따른다.

  * `.codex/agents/browser-qa.md`
  * `.codex/agents/code-audit.md`
  * `.codex/agents/performance.md`
* 역할별 실행 절차는 다음 파일을 따른다.

  * `.codex/tasks/run-browser-qa.md`
  * `.codex/tasks/run-code-audit.md`
  * `.codex/tasks/run-performance.md`


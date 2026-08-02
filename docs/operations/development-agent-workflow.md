# L0 Spider 개발 에이전트 검증 workflow

> 문서 목적: 메인 개발 에이전트와 두 검증 서브에이전트의 역할, 권한, 검증 gate와 업무 경계를 관리하는 단일 기준<br>
> 문서 상태: `Draft / Stage 2 Complete`<br>
> 기준 branch: `main`<br>
> 기준 commit: `eaff4b9`<br>
> 작성일: 2026-08-02<br>
> 적용 상태: custom agent 발견·직접 호출·실제 읽기 전용·무변경과 표준 출력 검증 완료, 명시적 시범 운영은 `Not Run`, 프로젝트 최상위 의무는 `Not Active`

## 1. 목적과 현재 적용 범위

이 문서는 L0 Spider 변경의 구현 주체와 검증 주체를 분리하는 상세 운영 기준이다. 메인 개발 에이전트가 구현과 최종 책임을 맡고, 상시 프리 빌드 리뷰 서브에이전트가 확정된 변경을 빠르게 독립 검토하며, 조건부 전문 검증 서브에이전트가 지정된 고위험 분야를 깊게 검증한다.

현재는 도입 계획의 2단계까지 완료한 상태다. 새 Codex 세션에서 두 project custom agent의 발견과 명시적 직접 호출을 확인했고, 부모와 서브에이전트의 실제 읽기 전용 권한, 호출 전후 무변경과 표준 출력 준수를 검증했다. 다음 항목은 아직 활성화하거나 수행하지 않았다.

- 모든 코드 변경에 대한 의무 호출
- 시범 운영과 `AGENTS.md` 최상위 의무 반영

따라서 3단계까지는 사용자가 승인한 명시적 호출에만 이 workflow를 적용한다. 3단계 시범 운영을 통과한 뒤 4단계에서만 `AGENTS.md`에 의무 절차를 연결한다.

## 2. 공통 불변 원칙

1. 메인 개발 에이전트만 application, test, config, dependency, fixture, Schema와 문서를 수정한다.
2. 두 검증 서브에이전트는 독립적으로 읽기·검증·보고만 수행하며 어떤 파일도 수정하지 않는다.
3. 메인 개발 에이전트는 검증 결과를 근거 없이 무시하거나 통과를 위해 test·계약 기준을 완화하지 않는다.
4. 검증 서브에이전트는 지정된 검증을 임의로 건너뛰거나 실패 test를 skip·완화하지 않는다.
5. 검증할 수 없는 항목은 성공으로 간주하지 않고 `Not Run`, `Partial`, `Blocked` 또는 `Unknown`과 사유를 기록한다.
6. 기존 사용자 동작, 데이터 해석, route·API 호환성, 운영 안전과 `main`·`mock-agent` 경계를 보존한다.
7. 검증 서브에이전트는 다른 에이전트를 호출하거나 자신의 검증 범위를 임의로 확대하지 않는다.

## 3. 역할과 책임

### 3.1 메인 개발 에이전트

메인 개발 에이전트는 운영 중인 L0 Spider 전체와 변경 결과의 최종 책임자이며 소스와 test를 수정할 수 있는 유일한 역할이다.

#### 시스템 책임

- Dashboard, Self Equipment·MY EQP, 동일성·공통부, 등록·이력과 Mailing 기능을 유지·개발한다.
- 기존 사용자 동작, 데이터 의미, browser route와 API 호환성을 우선 보존한다.
- `사용자 화면 → 브라우저 route → frontend component → API → Node·Python service → file·DB 경로`의 영향을 추적한다.
- 시스템·기능·운영·사용자 문서, API·데이터 계약, 최소 synthetic fixture와 unit·contract 검증으로 구성된 Core Harness를 관리한다.
- Dashboard 계약, STEP deep link·HMAC, Mailing, DB·데이터 경로와 운영 자원 영향을 현재 코드와 근거 상태에 따라 관리한다.
- 운영 DB test 쓰기·DDL·migration, `/appdata` 변경, 실제 mail·recipient를 사용한 test와 secret 출력·기록은 승인 여부와 관계없이 수행하지 않는다.
- 운영 service와 network는 사용자 요청과 명시적 승인 없이 변경하지 않는다.
- `main`을 실제 코드와 Core Harness의 기준으로 유지하고 mock 전용 구현을 `main`의 필수 의존성으로 만들지 않는다.

#### 변경 책임과 권한

- 요구사항, 승인 범위와 직접·간접 영향 경로를 조사하고 필요한 코드·계약·test·문서를 구현한다.
- 구현 후 변경을 잠시 중단하고 원 요구사항, 승인 범위, 기준 commit과 검토 대상 diff를 확정한다.
- 프리 빌드 리뷰를 요청하고 `SPECIALIST_REQUIRED` 또는 독립적인 위험 근거가 있으면 단일 전문 프로필을 지정해 전문 검증을 호출한다.
- 발견 사항을 코드 수정, 재현 가능한 반증 또는 사용자 결정으로 해소하고, 코드가 다시 바뀌면 영향받은 판정을 재검토한다.
- 해결되지 않은 `BLOCKER`가 있으면 build 또는 완료 단계로 진행하지 않는다.
- 허용된 lint, build, unit과 contract 검증을 실행하고 미실행·부분 검증과 남은 위험을 최종 보고한다.

### 3.2 상시 프리 빌드 리뷰 서브에이전트

프리 빌드 리뷰 에이전트는 메인 에이전트가 확정한 변경 diff를 build 전에 검토하는 빠른 독립 정적 gate다.

#### 필수 입력

- 원래 사용자 요구사항과 승인된 변경 범위
- 기준 branch·commit과 검토 대상 diff
- 적용되는 `AGENTS.md`
- 변경 기능의 현재 코드, 계약, test와 기준 문서

필수 입력이나 안정된 기준 diff가 없으면 범위를 추정하지 않고 `BLOCKER`와 `Not Run`을 보고한다.

#### 검토 범위

- 요구사항 누락, 요청 범위 밖 변경과 기존 사용자 동작 회귀
- route, API·Schema, 데이터 의미, nullable·빈 데이터·오류 계약
- 날짜·숫자 변환, stale response, race condition, 요청 취소와 오류 복구
- timer, listener, subscription, cache, Object URL, stream과 subprocess 정리 누락
- 불필요한 render·중복 요청·반복 계산, 대량 데이터·차트 mount와 무제한 cache 위험
- secret·내부 경로·DB detail 노출, 운영 자원과 Core·mock 경계 위반
- 필요한 test, Schema, fixture와 문서 갱신 누락
- 추가 전문 검증이 필요한 단일 프로필과 근거

#### 업무 경계

- 정적 검토만 수행하며 build, test, server, browser, DB, mail과 mock 검증을 실행하지 않는다.
- 수정 방향은 제안할 수 있지만 patch, formatting, dependency 설치와 자동 최적화를 수행하지 않는다.
- 전문 에이전트를 직접 호출하지 않고 권장 프로필과 이유만 메인 에이전트에 반환한다.

### 3.3 조건부 전문 검증 서브에이전트

전문 검증 에이전트는 프리 빌드 정적 검토만으로 판단하기 어렵거나 영향이 큰 변경을 지정된 한 분야에서 검증한다.

#### 호출 조건

- 프리 빌드 리뷰가 `SPECIALIST_REQUIRED`를 반환함
- 공유 API·Schema·집계·보안·운영 경계를 변경함
- 여러 화면이나 Node·Python 경계를 통과하는 공통 모듈을 변경함
- 비동기 상태, browser rendering, 메모리 누수 여부 또는 시스템 속도를 실행으로 확인해야 함
- 메인 에이전트가 구체적인 위험 근거로 추가 검증이 필요하다고 판단함

#### 전문 프로필

| 프로필 | 주요 검증 |
|---|---|
| `Frontend` | 상태 전환, render, query cache, cleanup, 접근성과 사용자 흐름 |
| `API-Data` | 요청·응답 Schema, 필터·집계, 데이터 정합성, 빈 데이터와 오류 계약 |
| `Security-Operations` | 권한, 입력 검증, secret·내부 정보 노출과 운영 자원 경계 |
| `Test` | 정상·빈값·오류·경계값·회귀 test의 실효성과 공백 |
| `Performance-Memory` | synthetic 반복 실행, heap·listener·query 증가와 render·API 처리 속도 |
| `Cross-layer` | 화면부터 API, Node·Python service와 데이터 경로까지의 전체 영향 |

한 번의 호출은 메인 에이전트가 지정한 정확히 한 프로필만 수행한다. 프로필이 없거나 복수 분야가 모호하게 지정되면 검증을 시작하지 않고 `Blocked`와 필요한 범위를 반환한다.

#### 필수 입력

- 원래 사용자 요구사항과 승인된 변경 범위
- 기준 branch·commit과 안정된 검토 diff
- 정확히 한 전문 프로필과 해당 프로필의 검증 범위
- 실행을 허용한 비파괴 명령 목록 또는 실행 명령 없음(`None`)
- 사용 가능한 synthetic data·환경과 호출별 금지 자원

허용 명령이나 실행 환경이 없거나 모호하면 임의로 명령을 선택하지 않는다. 정적 검토로 범위를 충족할 수 있으면 실행 항목을 `Not Run`으로 기록하고, 실행이 필수이면 `Blocked`로 반환한다.

#### 업무 경계

- 메인 에이전트가 호출마다 명시적으로 허용한 비파괴적 명령과 synthetic data만 사용한다.
- 일반 build 전체를 대신 수행하지 않으며 지정 프로필에 필요한 최소 검증만 실행한다.
- workspace를 변경할 수 있는 명령, 새 권한 승인이 필요한 명령 또는 운영 자원 접근은 실행하지 않고 `Blocked`로 기록한다.
- mock 의존 browser·성능 측정은 승인된 `mock-agent` 환경에서만 수행하며 `main`에서 실행하지 않는다.
- synthetic 측정 결과를 운영 수용량이나 실제 사용자 성능으로 일반화하지 않는다.
- 결과를 보고할 뿐 수정 patch를 적용하지 않는다.

## 4. 읽기 전용과 무변경 확인

두 custom agent는 기본값으로 `sandbox_mode = "read-only"`를 선언한다. 다만 부모 세션의 실시간 sandbox·permission override가 custom agent 설정보다 우선할 수 있으므로 TOML 선언만으로 무수정을 확정하지 않는다.

메인 에이전트와 검증 서브에이전트는 호출마다 다음을 지킨다.

1. 호출 직전에 기준 branch·commit, `git status --short`와 검토 대상 diff를 기록한다.
2. 검증 시작 시 실제 적용된 권한이 읽기 전용인지 확인한다. 확인할 수 없으면 검증을 진행하지 않고 `Blocked`로 보고한다.
3. 검증 중 `apply_patch`, formatter, dependency 설치와 파일 생성·수정 명령을 사용하지 않는다.
4. 검증 종료 시 `git status --short`와 diff를 다시 확인해 시작 기준과 대조한다.
5. 검증 에이전트에 귀속되는 변경이 하나라도 생기면 프리 빌드 리뷰는 `Gate: BLOCKER`와 `Mutation check: Fail`, 전문 검증은 `Result: Fail`과 `Mutation check: Fail`로 보고한다.
6. 검토 기준을 안정적으로 유지하기 위해 검증 중에는 메인 에이전트도 동일 작업 트리를 수정하지 않는다.

## 5. 상태와 gate

### 5.1 근거와 실행 상태

- 근거 상태: `Confirmed`, `Documented`, `Inferred`, `Unknown`, `Mismatch`
- 실행 상태: `Pass`, `Fail`, `Not Run`, `Partial`, `Blocked`

`WARNING`은 비차단 발견 사항이고 `Unknown`은 근거 상태다. 둘 다 최종 gate 값으로 사용하지 않는다.

### 5.2 프리 빌드 최종 gate

| Gate | 의미와 후속 조치 |
|---|---|
| `PASS` | build를 차단할 문제가 발견되지 않음. 비차단 `WARNING`과 잔여 `Unknown`은 별도 기록 |
| `BLOCKER` | build 전 수정, 재현 가능한 반증 또는 사용자 결정이 필요함 |
| `SPECIALIST_REQUIRED` | 지정한 단일 전문 프로필의 추가 검증이 필요함 |

필수 기준이 `Unknown`이면 `PASS`할 수 없다. 허용된 추가 검증으로 판단할 수 있으면 `SPECIALIST_REQUIRED`, 허용 범위에서 해소할 수 없고 안전한 진행 근거도 없으면 `BLOCKER`다.

### 5.3 표준 출력

프리 빌드 리뷰는 다음 항목을 반환한다.

1. `Gate`: `PASS`, `BLOCKER`, `SPECIALIST_REQUIRED` 중 하나
2. 검토 범위, 기준 branch·commit과 diff
3. 발견 사항 ID, 심각도, 근거 상태, 영향, 파일·행 근거와 권장 조치
4. 비차단 `WARNING`과 잔여 `Unknown`
5. 전문 검증 권장 프로필 하나와 이유 또는 `None`
6. `Not Run`·제약
7. 호출 전후 무변경 확인 결과

전문 검증은 다음 항목을 반환한다.

1. 지정 프로필과 결과 `Pass`, `Fail`, `Blocked`, `Partial` 중 하나
2. 검증 범위, 기준 branch·commit과 diff
3. 수행 방법·명령
4. 발견 사항 ID, 근거 상태, 영향, 파일·행 근거와 권장 조치
5. 실제 측정값과 조건 또는 `Not Run`
6. `Not Run`·제약과 잔여 위험
7. 호출 전후 무변경 확인 결과

## 6. 업무 흐름

```text
요구사항·영향 조사
→ 메인 에이전트 구현
→ 변경 중단 및 기준 diff 확정
→ 프리 빌드 독립 리뷰
    ├─ BLOCKER → 메인 수정 → diff 재확정 → 독립 재검토
    ├─ SPECIALIST_REQUIRED → 메인 지정 프로필 전문 검증
    │                         → 필요 시 메인 수정·재검토
    └─ PASS → 비차단 항목 기록
→ lint/build/unit/contract
→ 실패 시 메인 수정 → 영향받은 검증 재수행
→ 최종 결과 보고
```

- 해결되지 않은 `BLOCKER`는 build와 완료를 차단한다.
- 코드가 바뀌면 영향받은 이전 판정을 그대로 재사용하지 않는다.
- build 성공은 계약·정책 위반을 상쇄하지 않으며 리뷰 통과는 test 실패를 상쇄하지 않는다.
- `main`의 프리 빌드 리뷰는 변경 diff에 대한 정적 개발 gate이며 기존 `mock-agent` QA·Audit·Performance 검수를 대체하지 않는다.

## 7. 운영·branch 경계

- `main`에서는 운영 자원에 의존하지 않는 정적 검토와 승인된 Core 검증만 수행한다.
- mock server·data·DB, Playwright Browser QA와 mock 성능 측정은 `mock-agent` 범위다.
- 검증에 운영 DB, `/appdata`, 실제 mail·recipient, 실제 secret, 내부 주소, 운영 service와 network를 사용하지 않는다.
- 검증 서브에이전트는 commit, push, merge, rebase, branch 전환과 사용자 변경 되돌리기를 수행하지 않는다.
- 실제 코드 수정은 메인 에이전트가 별도 변경 단계에서 수행하고, mock 구현·설정은 `main`으로 병합하지 않는다.

## 8. 활성화와 문서 관리

- 1단계: 이 기준 문서와 두 custom agent 정의를 작성한다.
- 2단계: 새 세션 발견, 명시적 호출, 실제 권한·무변경과 출력 형식을 검증한다. — `Completed`
- 3단계: 승인된 사례에서 명시적 시범 운영하고 시간·오탐·결함 발견을 측정한다.
- 4단계: 앞 단계가 통과한 경우에만 `AGENTS.md`에 이 문서 링크와 의무 호출·중단 조건을 추가한다.

도입 후 상세 역할·책임·gate는 이 문서를 단일 기준으로 관리한다. `reports/development-validation-subagent-workflow.md`는 합의 배경과 의사결정 기록으로 유지하며 상세 절차를 중복 갱신하지 않는다. 프리 빌드 결과를 release 필수 증거로 사용하기로 별도 결정한 경우에만 `release-checklist.md`를 변경한다.

## 9. 관련 문서

- [개발 검증 서브에이전트 도입 계획](../../reports/development-validation-subagent-adoption-plan.md)
- [개발 검증 서브에이전트 도입 리포트](../../reports/development-validation-subagent-workflow.md)
- [프로젝트 지침](../../AGENTS.md)
- [시스템 개요](../system/overview.md)
- [릴리스 체크리스트](release-checklist.md)

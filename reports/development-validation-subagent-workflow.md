# L0 Spider 개발 검증 서브에이전트 도입 리포트

> **Historical / Superseded**: 아래 의무 호출·`SPECIALIST_REQUIRED`·수정 후 재검수·구현 상태는 2026-08-02 도입 당시 기록이다. 현재 호출 기준은 [AGENTS.md §5](../AGENTS.md#5-independent-review), 상세 절차는 [현행 workflow](../docs/operations/development-agent-workflow.md)를 따른다. 과거 실행 횟수와 판정은 보존하며 현재 의무로 적용하지 않는다.

> 문서 목적: 메인 개발과 독립 검증의 책임을 분리하는 To-Be 업무 흐름과 운영 원칙 정의<br>
> 문서 상태: `Implemented / Stage 4 Complete`<br>
> 기준 branch: `main`<br>
> 기준 commit: `642e4ce`<br>
> 작성일: 2026-08-02<br>
> 구현 상태: custom agent 구성 `Implemented`; 지침 기반 의무 호출 `Implemented`; hook·CI 기계적 자동화 `Not Implemented`<br>
> 문서 역할: 도입 배경과 합의 내용을 보존하는 의사결정 기록이며, 상세 운영 기준은 [개발 에이전트 검증 workflow](../docs/operations/development-agent-workflow.md)에서 관리

## 1. 도입 배경

현재 L0 Spider 변경 흐름에서는 메인 개발 에이전트가 요구사항 분석, 구현, 자체 검토, build와 test, 결과 보고를 주로 담당한다. 이 구조는 단순하지만 구현 주체와 검증 주체가 같아 다음 위험이 있다.

- 요구사항 누락이나 요청 범위 밖 변경을 구현 관점에서 놓칠 수 있다.
- API·데이터 계약, 비동기 상태, 메모리와 성능 위험이 build 또는 후속 검수에서 늦게 발견될 수 있다.
- 작은 변경에도 모든 전문 검증을 수행하면 개발 속도와 검증 비용이 불필요하게 증가할 수 있다.
- 검증 실패를 구현 주체가 임의로 무시하거나 test 기준을 완화하지 못하도록 독립적인 검증 경계가 필요하다.

To-Be 방향은 모든 코드 변경에 가벼운 **상시 프리 빌드 리뷰**를 적용하고, 고위험 변경에만 **조건부 전문 검증**을 추가하는 2단계 구조다. 코드 수정과 최종 판단은 메인 개발 에이전트가 담당하고, 검증 서브에이전트는 독립적인 읽기·실행 검증과 보고만 담당한다.

## 2. 목표 구조

| 역할 | 호출 방식 | 핵심 책임 | 코드 수정 |
|---|---|---|---|
| 메인 개발 에이전트 | 상시 | L0 Spider 전체 개발·운영 책임, 구현, 검증 결과 해소, 최종 판단 | 가능 |
| 프리 빌드 리뷰 서브에이전트 | 모든 코드 변경 후 build 전 | 확정된 diff의 빠른 독립 정적 검증과 전문 검증 추천 | 금지 |
| 전문 검증 서브에이전트 | 위험·변경 유형에 따라 조건부 | 특정 분야의 깊은 정적·실행 검증 | 금지 |

전문 검증은 매번 고정된 전체 검사를 실행하는 방식이 아니다. 프런트엔드, API·데이터, 보안·운영, test, 성능·메모리 또는 cross-layer 프로필 중 변경에 필요한 범위만 선택한다.

## 3. 각 에이전트의 핵심 역할

### 3.1 메인 개발 에이전트

메인 개발 에이전트는 운영 중인 L0 Spider 전체와 변경 결과에 대한 최종 책임자다.

#### 시스템 책임

- Dashboard, Self Equipment·MY EQP, 동일성·공통부, 등록·이력과 Mailing 관련 기능을 유지·개발한다.
- 기존 사용자 동작, 데이터 해석, route와 API 호환성을 최우선으로 보존한다.
- `사용자 화면 → 브라우저 route → frontend component → API → Node·Python service → file·DB 경로`의 변경 영향을 추적한다.
- 시스템·기능·운영·사용자 문서, API·데이터 계약, 최소 synthetic fixture, unit·contract 검증으로 구성된 Core Harness를 함께 관리한다.
- Dashboard 계약, STEP deep link·HMAC, Mailing과 운영 자원 영향을 현재 코드와 근거 상태에 따라 관리한다.
- 운영 DB, `/appdata`, 실제 mail, secret, service와 network를 승인 없이 변경하지 않는다.
- `main`과 `mock-agent` 경계를 보존하고 mock 전용 구현을 `main`의 필수 의존성으로 만들지 않는다.

#### 변경 책임

- 사용자 요구사항과 영향 범위를 확인한 뒤 필요한 코드·계약·test·문서를 구현한다.
- 구현이 끝나면 변경을 잠시 중단하고 검토 기준 diff를 확정한다.
- 프리 빌드 리뷰를 요청하고, 필요하면 전문 검증을 직접 호출한다.
- 검증 결과를 근거 없이 무시하지 않고 발견 사항을 코드 수정, 재현 또는 사용자 결정으로 해소한다.
- 실패한 test를 통과시키기 위해 assertion, threshold, fixture, Schema 또는 계약을 임의로 완화하지 않는다.
- 코드가 다시 바뀌면 영향을 받은 기존 검증 결과를 그대로 재사용하지 않고 재검토한다.
- 허용된 lint, build, unit, contract 검증을 실행하고 미실행·부분 검증과 남은 위험을 보고한다.

#### 최종 권한

- 소스와 test를 수정하는 유일한 역할이다.
- 전문 검증 호출 여부와 build 진행 여부를 결정한다.
- 서브에이전트 결과에 이견이 있으면 재현 가능한 반증을 제시하고 필요하면 독립 재검토를 요청한다.
- 해결되지 않은 `BLOCKER`가 있으면 완료를 선언하지 않는다.

### 3.2 상시 프리 빌드 리뷰 서브에이전트

프리 빌드 리뷰 에이전트는 모든 코드 변경에서 build 전에 호출하는 빠른 독립 검증 게이트다.

#### 입력 기준

- 원래 사용자 요구사항과 승인된 변경 범위
- 메인 에이전트가 확정한 변경 diff
- 적용되는 `AGENTS.md`
- 변경 기능의 현재 코드, 계약, test와 기준 문서

#### 검토 범위

- 요구사항 누락과 요청하지 않은 변경
- 기존 사용자 동작, route, API와 데이터 의미의 회귀 위험
- nullable, 빈 데이터, 오류, 날짜·숫자 변환과 응답 범위
- stale response, race condition, 요청 취소와 오류 복구
- timer, listener, subscription, cache, Object URL, stream과 subprocess 정리
- 불필요한 render, 중복 요청, 반복 계산, 대량 데이터·차트 mount와 무제한 cache
- 운영 안전, 비밀정보, 경로·DB detail 노출과 `main`·`mock-agent` 정책
- 필요한 test, Schema, fixture와 문서 갱신 누락
- 추가 전문 검증이 필요한 분야와 이유

#### 업무 경계

- 소스, test, config, dependency, fixture, Schema와 문서를 수정하지 않는다.
- build, server, browser, DB, mail과 mock 의존 test를 실행하지 않는다.
- 문제 해결을 위한 권장 방향은 제시할 수 있지만 patch를 적용하지 않는다.
- 전문 에이전트를 직접 호출하지 않고 `SPECIALIST_REQUIRED`와 권장 프로필을 메인 에이전트에 보고한다.
- 정적 검토로 확인할 수 없는 내용은 `Unknown`으로 남기며 추정으로 통과시키지 않는다.

### 3.3 조건부 전문 검증 서브에이전트

전문 검증 에이전트는 프리 빌드 검토만으로 판단하기 어렵거나 영향이 큰 변경을 선택적으로 깊게 검증한다.

#### 호출 조건

- 프리 빌드 리뷰가 `SPECIALIST_REQUIRED`를 보고한 경우
- 공유 API·Schema·데이터 집계·보안·운영 경계를 변경한 경우
- 여러 화면이나 Node·Python 경계를 통과하는 공통 모듈을 변경한 경우
- 비동기 상태, 브라우저 rendering, 메모리 누수 여부 또는 시스템 속도를 실행으로 확인해야 하는 경우
- 메인 에이전트가 변경 위험도를 근거로 추가 검증이 필요하다고 판단한 경우

#### 전문 검증 프로필

| 프로필 | 주요 검증 |
|---|---|
| Frontend | 상태 전환, render, query cache, cleanup, 접근성과 사용자 흐름 |
| API·Data | 요청·응답 Schema, 필터·집계, 데이터 정합성, 빈 데이터와 오류 계약 |
| Security·Operations | 권한, 입력 검증, secret·내부 정보 노출과 운영 자원 경계 |
| Test | 정상·빈값·오류·경계값·회귀 test의 실효성과 공백 |
| Performance·Memory | synthetic 반복 실행, heap·listener·query 증가, render·API 처리 속도 |
| Cross-layer | 화면부터 API, Node·Python service와 데이터 경로까지 전체 영향 |

전문 검증은 한 번의 호출에서 메인 에이전트가 지정한 단일 프로필만 수행한다. 프로필이 없거나 여러 분야가 모호하게 지정되면 임의로 범위를 확대하지 않고 메인 에이전트에 범위 확정을 요청한다.

#### 업무 경계

- 소스, test, config, dependency, fixture와 Schema를 수정하지 않는다.
- 지정된 검증을 임의로 생략하거나 실패 test를 skip·완화하지 않는다.
- 실행할 수 없는 검증은 `Not Run`, `Blocked` 또는 `Unknown`과 사유로 기록한다.
- 실행 검증은 허용된 명령과 synthetic data를 사용하며, mock 의존 browser·성능 검증은 `mock-agent` 범위에서 수행한다.
- 운영 DB, `/appdata`, 실제 mail·recipient, 실제 secret과 내부 주소를 검증에 사용하지 않는다.
- synthetic 측정 결과를 운영 수용량이나 실제 사용자 성능으로 일반화하지 않는다.

## 4. 공통 불변 원칙

### 4.1 검증 독립성

- 검증 서브에이전트는 메인 에이전트의 구현 설명이나 자체 평가를 사실로 전제하지 않는다.
- 요구사항, 현재 코드, 확정된 diff, 계약과 재현 결과를 독립적으로 대조한다.
- 발견 사항은 구현 취향이 아니라 사용자 영향, 계약, 안정성, 보안 또는 측정 근거로 설명한다.

### 4.2 무수정 원칙

- 모든 검증 서브에이전트는 읽기·검증·보고만 수행한다.
- 직접 수정, formatting, dependency 설치, test 비활성화와 자동 최적화를 수행하지 않는다.
- 수정 권장사항은 메인 개발 에이전트가 판단하고 구현한다.
- custom agent의 `sandbox_mode = "read-only"`만으로 절대적인 무수정을 가정하지 않고 부모 세션의 실시간 권한 override를 포함한 실제 적용 권한을 호출 전에 확인한다.
- 호출 전후 `git status`와 `git diff`를 대조하며 검증 에이전트가 만든 변경이 있으면 해당 검증은 `Fail`이다.

### 4.3 검증 기준 불변

- 메인 에이전트는 검증 결과를 임의로 무시하지 않는다.
- 어떤 에이전트도 결과를 통과시키기 위해 test와 계약 기준을 완화하지 않는다.
- 승인된 요구사항이나 계약 자체가 변경된 경우에만 test·Schema를 함께 변경하며 변경 근거를 기록한다.
- 필수 검증을 수행할 수 없으면 성공으로 간주하지 않고 미검증 상태와 위험을 보고한다.

### 4.4 근거 상태와 결과 상태

근거는 `Confirmed`, `Documented`, `Inferred`, `Unknown`, `Mismatch`로 구분한다. 검증 실행 결과는 `Pass`, `Fail`, `Not Run`, `Partial`, `Blocked`로 구분한다.

프리 빌드 gate의 최종 판정은 다음 세 가지만 사용한다. `WARNING`은 비차단 발견 사항이고 `Unknown`은 근거 상태이므로 최종 gate와 혼용하지 않는다.

| 판정 | 의미 |
|---|---|
| `PASS` | build를 차단할 문제가 발견되지 않음 |
| `BLOCKER` | build 전에 수정 또는 근거 있는 해소가 필요함 |
| `SPECIALIST_REQUIRED` | 특정 전문 프로필의 추가 검증이 필요함 |

필수 기준이 `Unknown`이면 `PASS`할 수 없으며 실행 또는 전문 판단이 가능하면 `SPECIALIST_REQUIRED`, 허용된 범위에서 해소할 수 없고 안전한 진행 근거도 없으면 `BLOCKER`로 판정한다. 비필수 `WARNING`과 잔여 `Unknown`은 `PASS`에 부속할 수 있지만 근거와 영향 범위를 반드시 기록한다.

### 4.5 발견 사항 해소 원칙

검증 문제는 다음 중 하나로만 해소한다.

1. 메인 에이전트가 코드를 수정하고 독립 재검토한다.
2. 현재 코드와 재현 결과로 오탐임을 입증하고 해소 근거를 기록한다.
3. 요구사항·계약 변경이 필요하면 사용자 결정을 요청한다.

## 5. 역할별 업무 경계

| 활동 | 메인 개발 | 프리 빌드 리뷰 | 전문 검증 |
|---|---:|---:|---:|
| 요구사항·영향 분석 | 수행 | 독립 대조 | 지정 분야 대조 |
| application·test·문서 수정 | 수행 | 금지 | 금지 |
| diff 정적 검토 | 수행 | 필수 | 필요 시 수행 |
| 전문 검증 결정·호출 | 최종 결정 | 추천만 가능 | 호출 확대 금지 |
| Core lint·build·unit·contract | 수행·기록 | 실행 금지 | 지정된 경우에만 검증 |
| mock browser·성능 측정 | main에서 수행하지 않음 | 실행 금지 | `mock-agent`에서만 수행 |
| test skip·기준 완화 | 금지 | 금지 | 금지 |
| 검증 결과 해소를 위한 코드 수정 | 수행 | 금지 | 금지 |
| build 진행·완료 판단 | 최종 책임 | gate 의견 | 전문 결과 제공 |
| 운영 DB·file·mail·service 변경 | 승인 없는 수행 금지 | 금지 | 금지 |

프리 빌드 리뷰가 build나 test를 실행하지 않는 것은 임의 생략이 아니라 정적 검토 역할의 명시적 경계다. 실행 검증을 배정받은 전문 에이전트는 지정된 검증을 임의로 건너뛸 수 없다.

`main`의 프리 빌드 리뷰는 변경 diff에 대한 정적 개발 gate이며 기존 `mock-agent` QA·Audit·Performance 검수를 대체하지 않는다. mock 의존 browser·성능 실행 검증은 계속 `mock-agent`에서 수행한다.

## 6. 변경되는 업무 흐름

### 6.1 As-Is

```text
요구사항 확인
→ 영향 범위 조사
→ 메인 에이전트 구현
→ 메인 에이전트 자체 diff 검토
→ lint/build/unit/contract
→ 실패 시 수정
→ 결과 보고
```

- 구현과 초기 검증의 주체가 메인 에이전트에 집중된다.
- mock QA·Audit·Performance 검수는 별도 흐름이며 모든 변경의 build 전 gate로 연결되어 있지 않다.

### 6.2 To-Be

```text
요구사항 확인
→ 영향 범위 조사
→ 메인 에이전트 구현
→ 변경 중단 및 검토 기준 diff 확정
→ 상시 프리 빌드 독립 리뷰
    ├─ BLOCKER → 메인 수정 → diff 재확정 → 독립 재검토
    ├─ SPECIALIST_REQUIRED → 메인 판단 → 전문 검증
    │                                      → 메인 수정·재검토
    └─ PASS → 비차단 WARNING·잔여 Unknown 기록
→ lint/build/unit/contract
→ 실패 시 메인 수정 → 영향 범위에 따라 재검토
→ 최종 결과 보고
```

### 6.3 Gate 규칙

- 해결되지 않은 `BLOCKER`가 있으면 build 또는 완료 단계로 진행하지 않는다.
- 코드 수정으로 검토 기준 diff가 달라지면 영향을 받은 판정을 다시 확인한다.
- 필수 기준의 `Unknown`은 `SPECIALIST_REQUIRED` 또는 `BLOCKER`로 전환한다.
- 비차단 `WARNING`과 잔여 `Unknown`은 숨기지 않고 영향과 후속 확인을 기록한다.
- build가 성공해도 독립 리뷰에서 확인한 계약·정책 위반을 상쇄하지 않는다.
- test 실패는 리뷰 통과로 상쇄할 수 없으며 원인 해소 후 다시 실행한다.

## 7. 업무 속도와 시스템 부하 영향

| 영향 영역 | 예상 | 상태 | 판단 근거 |
|---|---|---|---|
| 운영 서비스 runtime | 영향 없음 | `Inferred` | 검증 에이전트는 개발 과정에서만 동작하며 application artifact에 포함하지 않음 |
| 개발 환경 부하 | 일시적 소폭 증가 | `Inferred` | diff·관련 코드 읽기와 조건부 test·측정 작업이 추가됨 |
| 일반 변경의 선행 시간 | 소폭 증가 | `Inferred` | 모든 코드 변경에 빠른 정적 gate가 한 번 추가됨 |
| 고위험 변경의 선행 시간 | 증가 가능 | `Inferred` | 전문 검증과 수정 후 재검토가 추가될 수 있음 |
| 전체 개발 cycle | 재작업 감소 가능 | `Inferred` | build 이후 계약 오류·회귀를 앞단에서 발견하는 것이 목표임 |
| 실제 시간·효과 | 미측정 | `Unknown` | 도입 전후 데이터가 아직 없음 |

속도와 부하를 통제하기 위해 다음을 적용한다.

- 프리 빌드 리뷰는 변경 diff와 직접 영향 경로를 중심으로 수행한다.
- main과 서브에이전트가 동일한 build·test를 목적 없이 중복 실행하지 않는다.
- 전문 검증은 위험 근거와 호출 프로필이 명확할 때만 수행한다.
- 검토가 제한 시간 안에 끝나지 않더라도 임의로 `PASS`하지 않는다. 필수 범위는 `SPECIALIST_REQUIRED` 또는 `BLOCKER`로 전환하고, 비필수 범위만 잔여 `Unknown`으로 기록한다.
- 초기 운영 기간에는 리뷰 소요 시간, `BLOCKER` 발견률, 오탐률, 재검토 횟수, build 후 실패와 회귀 발견 건수를 기록한다.

따라서 도입으로 일반 변경의 선행 시간은 늘 수 있지만 운영 시스템 자체가 무거워지지는 않는다. 개발 전체 속도가 실제로 개선되는지는 시범 운영 측정 전까지 `Unknown`으로 유지한다.

## 8. 도입 상태와 후속 작업

2026-08-03 Stage 4 검증 완료 결과, custom agent 구성과 `AGENTS.md` 지침 기반 의무 호출은 `Implemented`다. hook·CI 같은 기계적 자동화는 `Not Implemented`로 유지한다. 상세 역할·책임·gate는 [개발 에이전트 검증 workflow](../docs/operations/development-agent-workflow.md)를 단일 기준으로 사용한다.

## 9. 근거 문서와 이번 리포트 작업 범위

- [AGENTS.md](../AGENTS.md) — 프로젝트 임무, 근거 상태, Core·mock 경계, 운영 안전과 변경 절차
- [시스템 개요](../docs/system/overview.md) — L0 Spider 기능·구성요소와 메인 유지보수 범위
- [릴리스 체크리스트](../docs/operations/release-checklist.md) — test 기준 완화 금지, 미실행 상태와 release gate
- [사용자 메뉴얼](../docs/user-manual/USER_MANUAL.md) — 현재 사용자 기능과 기존 동작 보존 범위
- [P0/P1 종합 조치 계획](audit/2026-08-01-p0-p1-remediation-plan.md) — QA·Audit·Performance 결과의 현재 main 재검증과 통합 기준

초기 제안 리포트 작성 작업은 이 문서만 추가했으며 당시 application, API, Schema, fixture, test, agent 설정과 지침 기반 의무 호출은 변경하지 않았다. 도입 당시 구현 상태는 8절에 보존한다. 현행 호출 기준은 문서 상단의 AGENTS·운영 workflow 링크를 따른다.

## 10. 실제 도입 시 변경 대상

이 절은 서브에이전트 구조를 실제로 구현할 때 검토하거나 변경할 대상을 구분한다. 9장의 근거 문서 전체가 자동으로 변경 대상이 되는 것은 아니다.

### 10.1 필수 변경

- 프리 빌드 리뷰 에이전트의 역할 지침과 표준 출력 형식
- 전문 검증 에이전트의 프로필, 호출 조건과 허용 검증 지침
- `docs/operations/development-agent-workflow.md`: 메인과 서브에이전트의 상세 역할·책임·업무 경계를 관리하는 단일 기준 문서
- 시범 운영 통과 후 `AGENTS.md`: 기준 문서 연결과 호출, 재검토, `BLOCKER` 해소·중단 조건을 최상위 의무로 적용
- 이 리포트의 custom agent 구성·지침 기반 의무 호출 상태와 실제 기준 문서·에이전트 경로

### 10.2 적용 방식에 따라 변경

- `.codex/config.toml`: 모델, reasoning 또는 동시 실행 수를 프로젝트 기본값으로 고정할 필요가 확인된 경우
- `docs/operations/release-checklist.md`: 프리 빌드 리뷰를 release 필수 증거로 사용하기로 별도 결정한 경우
- 추가 전문 검증 문서: 단일 기준 문서로 관리하기 어려운 별도 분야별 절차가 필요한 경우

### 10.3 일반적으로 변경 불필요

- `docs/system/overview.md`: 검증 workflow 도입만으로 application 구조가 바뀌지 않는 경우
- `docs/user-manual/USER_MANUAL.md`: 사용자 화면과 기능 동작이 바뀌지 않는 경우
- 기존 audit·조치 계획: 과거 시점의 검증과 조치 기록이므로 소급 변경하지 않음

실제 도입 과정에서 application 동작, API 계약 또는 사용자 절차까지 변경된다면 해당 기준 문서는 별도의 영향 조사 결과에 따라 갱신한다.

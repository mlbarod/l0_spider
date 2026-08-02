# L0 Spider 개발 검증 서브에이전트 도입 계획

> 문서 목적: 합의된 검증 서브에이전트 구조를 안전하게 도입하기 위한 실행 순서와 완료 기준 정의<br>
> 문서 상태: `Planned`<br>
> 기준 branch: `main`<br>
> 기준 commit: `642e4ce`<br>
> 작성일: 2026-08-02<br>
> 선행 문서: [개발 검증 서브에이전트 도입 리포트](development-validation-subagent-workflow.md)

## 1. 목표와 범위

모든 코드 변경에 읽기 전용 프리 빌드 리뷰를 적용하고, 고위험 변경에만 전문 검증을 추가하는 2단계 gate를 도입한다. 메인 개발 에이전트만 코드를 수정하며, 검증 결과 무시·test 기준 완화·검증 서브에이전트의 코드 수정과 임의 생략을 금지한다.

이번 도입은 개발 검증 workflow만 대상으로 한다. application 기능, API·데이터 계약, 운영 DB, `/appdata`, mail, service와 network는 변경하지 않는다.

## 2. 도입 산출물

| 산출물 | 목적 | 적용 시점 |
|---|---|---|
| `.codex/agents/pre-build-review.toml` | 모든 코드 변경의 빠른 독립 정적 검증 | 1단계 |
| `.codex/agents/specialist-validator.toml` | 조건부 전문 정적·실행 검증 | 1단계 |
| `docs/operations/development-agent-workflow.md` | 메인과 서브에이전트의 상세 역할·책임·gate를 관리하는 단일 기준 | 1단계 |
| `AGENTS.md` | 검증 완료된 프리 빌드 gate를 최상위 의무로 적용 | 4단계 |
| `reports/development-validation-subagent-workflow.md` | 실제 경로·검증 결과와 구현 상태 반영 | 4단계 |

조건부 산출물은 다음과 같다.

- `docs/operations/release-checklist.md`: 프리 빌드 리뷰를 release 필수 증거로 사용하기로 별도 결정한 경우에만 변경한다.
- `.codex/config.toml`: 모델, reasoning 또는 동시 실행 수의 프로젝트 기본값이 필요하다고 시범 운영에서 확인된 경우에만 추가한다.

`AGENTS.md`는 지침 기반 의무 호출을 정의하며 hook이나 CI처럼 기계적으로 호출을 강제하지 않는다. 기계적 강제가 필요하면 이 계획과 분리해 별도 승인·설계를 진행한다.

### 2.1 `AGENTS.md` 반영 원칙

`AGENTS.md` 수정은 4단계 최종 확정 시점에 수행한다. `AGENTS.md`는 단순 설명 문서가 아니라 이후 모든 작업에 적용되는 프로젝트 최상위 의무이므로, 검증되지 않은 서브에이전트 호출을 먼저 강제하면 일반 개발 흐름이 막힐 수 있다. 따라서 custom agent 정의, 직접 호출 검증과 명시적 시범 운영을 먼저 완료하고, 역할·읽기 전용 경계·gate 동작이 확인된 경우에만 최상위 의무로 반영한다.

## 3. 단계별 실행 계획

### 1단계 — 역할 기준과 에이전트 정의

1. `docs/operations/development-agent-workflow.md`에 메인·프리 빌드·전문 검증 에이전트의 상세 역할, 책임, 권한과 gate를 단일 기준으로 작성한다.
2. `AGENTS.md`에는 상세 역할을 중복하지 않고 최종 확정 시 이 기준 문서를 연결하도록 설계한다.
3. 두 custom agent를 프로젝트 범위 `.codex/agents/`에 작성한다.
4. 두 파일에 필수 `name`, `description`, `developer_instructions`를 정의하고 상세 역할 기준을 따르게 한다.
5. `sandbox_mode = "read-only"`로 직접 수정 가능성을 제한하되 부모 세션의 실시간 권한 override가 우선할 수 있음을 전제로 실제 적용 권한을 별도로 확인한다.
6. 프리 빌드 최종 gate는 `PASS/BLOCKER/SPECIALIST_REQUIRED`만 사용하고 `WARNING`과 `Unknown`은 발견·근거 상태로 분리한다.
7. 전문 검증은 메인 에이전트가 지정한 단일 프로필과 검증 범위만 수행하며, 프로필이 없거나 복수 분야가 모호하게 지정되면 범위를 다시 요청한다.

### 2단계 — 직접 호출 구성·행동 검증

1. 새 Codex 세션에서 두 project custom agent가 발견되는지 확인한다.
2. `AGENTS.md` 의무 없이 명시적으로 각 에이전트를 호출한다.
3. 프리 빌드 에이전트가 원 요구사항, 확정 diff와 직접 영향 경로만 검토하는지 확인한다.
4. 호출 시 부모 세션을 포함한 실제 sandbox·permission이 읽기 전용인지 확인한다.
5. 호출 전후 `git status`와 `git diff`를 대조하고 검증 에이전트가 소스·test·config·문서를 수정하지 않았는지 확인한다.
6. 검증 에이전트가 만든 변경이 하나라도 있으면 해당 검증을 `Fail`로 처리한다.
7. 최종 gate, 근거 상태, 전문 검증 추천과 미검증 범위가 표준 형식으로 반환되는지 확인한다.

이 단계까지는 새로운 workflow를 프로젝트 최상위 의무로 적용하지 않는다.

### 3단계 — 명시적 호출 시범 운영

1. 승인된 실제 변경 또는 application을 수정하지 않는 synthetic diff 중에서 작은 변경과 고위험 변경의 대표 사례를 선정한다. workflow 검증만을 위한 임의의 application 변경은 만들지 않는다.
2. 임시 작업 지시로 프리 빌드 리뷰와 필요한 전문 검증을 명시적으로 호출한다.
3. `BLOCKER`가 build를 중단하고 메인 수정 후 독립 재검토로 연결되는지 확인한다.
4. 전문 검증이 명확한 trigger와 지정 프로필이 있을 때만 호출되는지 확인한다.
5. mock 의존 browser·성능 검증이 `main`에서 실행되지 않고 `mock-agent` 경계를 유지하는지 확인한다.
6. `main`의 프리 빌드 정적 리뷰가 기존 `mock-agent` QA·Audit·Performance 검수를 대체하지 않는지 확인한다.
7. 리뷰 시간, `BLOCKER` 발견률, 오탐, 재검토 횟수와 build 후 실패를 기록한다.
8. 중복 검증이나 불필요한 전체 저장소 scan을 줄이되 검증 기준은 완화하지 않는다.

### 4단계 — 최상위 의무 반영과 최종 확정

1. 1~3단계가 통과한 경우에만 `AGENTS.md`에 기준 문서 링크와 build 전 프리 빌드 리뷰 의무를 추가한다.
2. 해결되지 않은 `BLOCKER`의 build·완료 진행 금지, 수정 후 재검토와 전문 검증 trigger를 명시한다.
3. 메인 에이전트의 검증 무시·test 기준 완화 금지와 검증 서브에이전트의 수정·skip 금지를 명시한다.
4. 프리 빌드 리뷰를 release 필수 증거로 사용하기로 결정한 경우에만 `release-checklist.md`에 판정과 미검증 상태 기록 항목을 추가한다.
5. `AGENTS.md` 변경은 최종 후보로 취급하고 새 Codex 세션에서 지침 기반 의무 호출과 중단 조건을 smoke 검증한다.
6. smoke가 실패하면 후보 지침을 수정해 다시 검증하고, 해결할 수 없으면 일반 개발 흐름을 막지 않도록 후보 지침을 제거한 뒤 `Partial` 또는 `Blocked`로 기록한다.
7. 완료 기준을 모두 충족하면 선행 리포트에는 구현 결과와 단일 기준 문서 링크만 추가하고, 상세 역할은 중복 갱신하지 않는다.
8. 구현 상태는 custom agent 구성과 지침 기반 의무 호출을 각각 `Implemented`로 기록하고 기계적 자동화는 `Not Implemented`로 유지한다.

## 4. 완료 기준

- 두 custom agent가 새 세션에서 정상 발견된다.
- 상세 역할·책임·업무 경계가 `docs/operations/development-agent-workflow.md`에서 단일 기준으로 관리된다.
- 두 검증 에이전트의 실제 적용 권한이 읽기 전용으로 확인되고 전후 diff에 파일 변경이 없다.
- 모든 코드 변경에서 프리 빌드 리뷰가 build 전에 수행된다.
- 해결되지 않은 `BLOCKER`가 build와 완료를 차단한다.
- 메인 에이전트가 수정한 뒤 영향받은 항목을 독립 재검토한다.
- 전문 검증은 위험 근거와 프로필이 있을 때만 호출된다.
- 필수 기준의 `Unknown`이 `SPECIALIST_REQUIRED` 또는 `BLOCKER`로 전환된다.
- 필수 검증 미실행이 성공으로 처리되지 않는다.
- Core와 `mock-agent` 경계, 운영 안전과 기존 사용자 동작이 유지된다.
- `git diff --check`와 관련 문서 링크 검증이 통과한다.

## 5. 중단 조건

다음 중 하나라도 발생하면 도입 완료를 선언하지 않는다.

- custom agent가 발견되지 않거나 다른 역할로 호출됨
- 부모 세션 권한 override를 포함한 실제 읽기 전용 상태를 확인할 수 없음
- 검증 에이전트가 코드·test·config를 수정함
- 실패 test를 skip하거나 기준을 완화함
- `BLOCKER`가 해소되지 않았는데 build 또는 완료 단계로 진행함
- mock 검증이 `main`에서 실행되거나 운영 자원에 접근함
- 실패한 `AGENTS.md` 후보 지침이 활성 상태로 남아 일반 개발 흐름을 막음
- 일반 변경에서 검토 비용이 과도하지만 범위 조정 근거가 없음

## 6. 근거

- [개발 검증 서브에이전트 도입 리포트](development-validation-subagent-workflow.md) — 합의된 역할·원칙·업무 경계와 To-Be 흐름
- [AGENTS.md](../AGENTS.md) — 현재 프로젝트 임무, 운영 안전, Core·mock 경계와 변경 절차
- [릴리스 체크리스트](../docs/operations/release-checklist.md) — test 기준과 release 중단 조건
- [Codex Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents) — project custom agent 위치, 필수 필드와 읽기 전용 sandbox
- [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) — 저장소 범위의 지속 지침과 적용 우선순위

이번 단계에서는 이 계획 문서만 추가한다. custom agent, `AGENTS.md`, release checklist, application, test와 운영 자원은 변경하지 않으며 실제 서브에이전트 검증은 `Not Run`이다.

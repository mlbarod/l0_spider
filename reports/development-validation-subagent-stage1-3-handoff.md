# L0 Spider 개발 검증 서브에이전트 1~3단계 인수인계

> 문서 목적: 4단계를 시작하지 않은 상태에서 1~3단계의 저장소 상태와 실제 실행 결과를 다음 Codex 세션에 전달<br>
> 작성일: 2026-08-03<br>
> 현재 branch: `main`<br>
> 현재 commit: `6de92fb2e63ee10e8ccf1e789ec2eae7e3890194` (`subagent add plan 3`)<br>
> 인수인계 판정: `READY` — 4단계 착수 가능, 4단계 자체는 `Not Started`<br>
> 변경 금지 확인: 이 문서 작성에서 `AGENTS.md`와 `docs/operations/release-checklist.md`는 수정하지 않음

이 문서는 현재 저장소에서 재확인한 사실과 1~3단계 수행 세션의 실제 출력만 기록한다. 저장소만으로 다시 확인할 수 없는 과거 실행 세부값은 실행 기록으로 구분하며, 확인되지 않은 항목은 `Unknown`으로 남긴다. 상세 역할과 gate의 단일 기준은 [개발 에이전트 검증 workflow](../docs/operations/development-agent-workflow.md)다.

## 1. 1~3단계 구현 파일과 주요 내용

| 단계 | commit | 파일 | 주요 내용 | 현재 상태 |
|---|---|---|---|---|
| 1단계 | `eaff4b9` | `.codex/agents/pre-build-review.toml` | build 전 독립 정적 검토, `PASS/BLOCKER/SPECIALIST_REQUIRED` gate, 수정·실행 금지의 기본 정의 | `Confirmed` |
| 1단계 | `eaff4b9` | `.codex/agents/specialist-validator.toml` | 조건부 단일 전문 프로필 검증, 읽기 전용·무수정 원칙의 기본 정의 | `Confirmed` |
| 1단계 | `eaff4b9` | `docs/operations/development-agent-workflow.md` | 메인 개발·프리 빌드·전문 검증의 역할, 원칙, 업무 경계와 To-Be workflow의 단일 기준 작성 | `Confirmed` |
| 2단계 | `18b1b16` | 위 3개 파일 | 실제 권한 확인, 호출 전후 mutation 검사, 운영 자원 hard deny, 전문 단일 프로필과 default-deny 입력, 표준 출력과 Stage 2 완료 상태 보강 | `Confirmed` |
| 3단계 | `6de92fb` | `docs/operations/development-agent-workflow.md` | 실제·synthetic 시범 사례, gate 전환, 시간·호출 횟수·test 결과·경계·잔여 `Unknown` 기록, 상태를 `Draft / Stage 3 Complete`로 갱신 | `Confirmed` |

현재 두 TOML은 모두 `sandbox_mode = "read-only"`를 선언한다. 이 선언만으로 실제 권한을 가정하지 않고 호출마다 실시간 sandbox·permission과 mutation을 확인하도록 작성됐다. 3단계에서는 application, test, agent TOML을 수정하지 않았다.

## 2. 두 custom agent의 발견 및 직접 호출 결과

### 2.1 발견

- 새 읽기 전용 Codex 세션에서 project custom agent 이름 `pre-build-review`, `specialist-validator`가 모두 발견됐다: `Confirmed`.
- 당시 CLI 버전은 `codex-cli 0.145.0`이었다: 수행 세션 출력으로 `Confirmed`; 현재 설치 버전은 이 문서 작성 시 다시 조회하지 않아 `Unknown`.
- 최초 full-history 방식의 custom agent 호출은 agent 생성 전에 거부됐다. full-history fork가 부모 agent type을 상속한다는 제약 때문이었다. 이후 `fork_turns="none"`으로 두 agent를 명시적으로 직접 호출해 성공했다: 수행 세션 출력으로 `Confirmed`.

### 2.2 직접 호출

| agent | 단계 | 호출 결과 |
|---|---|---|
| `pre-build-review` | 2단계 | 초기 정의의 gate/mutation 모순, 전문 출력 형식 차이, EOF 공백을 발견했다. 메인 수정 후 재검토는 `PASS`였다. 이후 Stage 2 상태 문구 불일치를 `BLOCKER`로 잡았고 수정 후 최종 `PASS`였다. |
| `specialist-validator` | 2단계 | `Security-Operations` 프로필로 실행 허용 범위의 default-deny 누락, 운영 금지 규칙 약화 가능성, 프리 빌드 hard deny 범위 부족을 발견했다. 수정 후 정책·권한·무변경은 확인됐으나 격리된 agent가 이전 세션 로그를 독립 열람할 수 없어 최종 결과는 `Partial`이었다. 부모 세션의 실제 호출 출력으로 2단계 완료 근거를 보완했다. |
| `pre-build-review` | 3단계 | 작은 실제 diff와 synthetic 고위험 diff에 총 7회 호출되어 `PASS`, `BLOCKER`, `SPECIALIST_REQUIRED`와 수정 후 재검토를 모두 반환했다. |
| `specialist-validator` | 3단계 | `Frontend` 프로필로 2회 호출됐다. 최초는 허용 명령 부족으로 `Blocked`, 보완 후에는 synthetic test 성공과 mutation `Pass`를 포함한 `Partial`이었다. |

한 nested 세션은 자식 완료 후 부모 최종 응답 수집이 정지해 중단했고 성공 근거에서 제외했다. CLI가 state DB 불일치와 parent transcript hook 경고도 출력했으므로 장기 호출 안정성은 `Unknown`이다.

## 3. 실제 sandbox·permission 확인 결과

- 2단계 부모 검증 세션은 `--sandbox read-only --ask-for-approval never`로 시작했다: `Confirmed`.
- 두 custom agent는 실제 적용 권한 확인에서 workspace 쓰기 불가를 확인했고, 읽기 전용 조건에서 검토했다: `Confirmed`.
- TOML의 `read-only` 선언과 별개로 부모 override가 우선할 수 있다는 전제를 workflow와 두 agent 정의에 반영했다: `Confirmed`.
- 파일 생성·수정·삭제, `apply_patch`, formatter, dependency 설치, commit·push·merge·rebase·branch 전환은 검증 agent가 수행하지 않았다: 호출 전후 상태 비교로 `Confirmed`.
- 운영 DB, `/appdata`, 실제 mail·recipient, secret, 운영 service·network, mock server·DB·browser 접근은 수행하지 않았다: 해당 시범 범위에서 `Confirmed`.
- 다른 sandbox 조합, 향후 Codex 버전 및 장시간 반복 호출에서도 동일하게 강제되는지는 `Unknown`이다.

## 4. 검증 전후 git status와 diff 비교

| 구간 | 검증 전 | 검증 후 | 판정 |
|---|---|---|---|
| 2단계 각 custom agent 호출 | 호출 직전 branch·commit, `git status`, diff를 기록 | 종료 후 동일 항목을 다시 비교 | agent 귀속 변경 0건, mutation `Pass`; 개별 과거 diff hash는 저장소 문서에 남지 않아 `Unknown` |
| 3단계 실제 diff 검토 | 기준 `eaff4b9..18b1b16` | 동일한 고정 diff | agent 귀속 변경 0건: `Confirmed` |
| 3단계 synthetic 검토 | application 밖 `/tmp/l0-spider-stage3-pilot`의 고정 baseline·target | 동일 fixture와 repo 상태 확인 | repo 변경 0건; 임시 fixture는 종료 후 삭제되고 부재 확인: `Confirmed` |
| 3단계 문서 최종 리뷰 | `docs/operations/development-agent-workflow.md`만 변경된 고정 diff | 동일 diff | 프리 빌드 `PASS`, mutation `Pass`; 98.56초. 이 시간은 3단계 955.58초 합계에서 제외 |
| 이 인수인계 작성 직전 | `main`, `6de92fb`, clean, staged 0건, `git diff --check` 통과, unstaged diff SHA-256 `e3b0c442...b855` | 이 문서만 신규 untracked가 되는 것이 기대 상태 | 작성 후 실제 상태는 아래 10절과 최종 검증에서 재확인 |

검증 agent가 만든 변경이 발견된 사례는 0건이다. 다만 과거 각 호출의 원문 `git status`와 전체 diff hash를 저장소에 보존하지 않았으므로 그 문자열의 사후 재현은 `Unknown`이며, 문서화된 mutation 판정과 부모 세션 출력만 근거로 사용한다.

## 5. 프리 빌드 판정 사례와 BLOCKER 처리

| 사례 | 프리 빌드 판정 | 처리와 결과 |
|---|---|---|
| 작은 실제 변경 `eaff4b9..18b1b16` 최초 검토 | `SPECIALIST_REQUIRED`, 162.64초 | diff 밖 2단계 실행 증거가 `Unknown`이어서 통과시키지 않았다. 증거를 입력에 추가한 재검토는 `PASS`, 114.13초였고 전문 agent는 호출하지 않았다. |
| synthetic negative 고위험 diff | `BLOCKER`, 81.00초 | resize listener·timer cleanup 누락과 `test.skip`을 발견했다. build는 실행하지 않았다. 권장 전문 프로필은 `Frontend`였다. |
| 불완전한 수정 1차 | `BLOCKER`, 47.45초 | 안정된 baseline·전체 diff·test 등록 근거 부족을 차단했다. |
| 불완전한 수정 2차 | `BLOCKER`, 140.77초 | 실제 lifecycle 연결과 test discovery가 확인되지 않아 차단했다. |
| 완전한 synthetic fixture | `SPECIALIST_REQUIRED`, 96.21초 | 정적 cleanup은 확인했으나 10,000회 반복 cleanup 실행 결과가 `Unknown`이라 전문 검증으로 넘겼다. |
| 전문 결과 반영 최종 재검토 | `PASS`, 125.52초 | synthetic 범위의 필수 `Unknown`이 해소됐다. browser 통합은 범위 밖 비차단 `Unknown`으로 남겼다. |

`BLOCKER` 동안 build를 진행하지 않았고, 메인은 test skip이나 기준 완화 대신 입력·코드·실행 근거를 보완한 뒤 독립 재검토했다. 따라서 의도한 negative blocker 발견은 1/1, 확인된 오탐은 0건이다. 표본이 작으므로 일반 오탐률과 build 후 실패 감소율은 `Unknown`이다.

## 6. 전문 검증 호출 사례, 프로필과 trigger

| 단계 | 프로필 | trigger | 결과 |
|---|---|---|---|
| 2단계 | `Security-Operations` | agent 정책 자체의 실행 허용, 운영 자원 금지와 권한 경계를 독립 확인할 필요 | 정책 결함을 발견해 메인이 수정. 최종 정책·permission·mutation은 확인됐으나 격리된 이전 로그 열람 한계로 결과 `Partial` |
| 3단계 | `Frontend` | 완전한 synthetic fixture의 정적 cleanup은 확인됐지만 반복 실행 시 listener·timer 정리가 유지되는지 `Unknown`; 프리 빌드가 `SPECIALIST_REQUIRED` 반환 | 최초 `Blocked` 82.88초. 필수 지침을 읽는 명령이 허용 목록에 없어 test를 임의 실행하지 않음 |
| 3단계 | `Frontend` 재호출 | 동일 trigger에 정확한 허용 명령과 synthetic 환경을 보완 | `Partial` 104.98초. target test `pass 1`, `fail 0`, `skip 0`, 359.464ms, mutation `Pass`; 원본 context·diff hash 제한은 잔여 한계 |

메인은 동일한 안전 명령을 재실행해 `pass 1`, `fail 0`, `skip 0`, 297.215ms를 확인했다. 3단계 전체 agent 호출은 9회(프리 빌드 7, 전문 2), agent wall-clock 합계는 955.58초였다. `API-Data`, `Test`, `Performance-Memory`, `Cross-layer` 프로필의 직접 호출 결과는 `Unknown`이다.

## 7. mock-agent 경계 확인

- `main`에서 수행한 검증은 정적 diff 검토와 application 밖 최소 synthetic Node test뿐이었다: `Confirmed`.
- mock server·API·DB·data, Playwright Browser QA, mock browser 성능 측정은 `main`에서 실행하지 않았다: `Confirmed`.
- 기존 `mock-agent`의 QA·Audit·Performance 검수를 프리 빌드 gate가 대체하지 않는다고 workflow에 명시했다: `Confirmed`.
- 이번 1~3단계에서 `mock-agent` 자체 검수는 실행하지 않았다: `Not Run`.
- 향후 mock 의존 browser·성능 검증 결과와 이 workflow의 연계 효과는 `Unknown`이다.

## 8. 미검증 항목과 해결되지 않은 문제

- 4단계는 시작하지 않았다. `AGENTS.md` 최상위 의무 호출은 아직 `Not Active`다.
- `release-checklist.md`를 release 필수 증거와 연결할지는 별도 결정이 없어 `Unknown`이며 이번에는 수정하지 않았다.
- hook·CI와 같은 기계적 자동 호출은 `Not Implemented`이며 현재 계획의 범위 밖이다.
- 실제 application의 고위험 변경 시범은 `Not Run`이다. 고위험 사례는 application 밖 synthetic fixture였다.
- Stage 3에서 application build, lint, 전체 unit·contract, browser test는 `Not Run`; blocker 이후 build 실패율은 `Unknown`이다.
- `API-Data`, `Test`, `Performance-Memory`, `Cross-layer` 전문 프로필은 `Not Run`이다.
- 장기 개발 속도, 일반 오탐률, 실제 결함 유출 감소와 시스템 자원 비용은 표본 부족으로 `Unknown`이다. 이번 9회 호출의 955.58초를 일반 개발 비용으로 일반화할 수 없다.
- 한 nested session 정지와 CLI state DB·hook 경고의 장기 재발 여부는 `Unknown`이다.
- 2단계 전문 검증의 최종 `Partial`은 격리된 agent의 과거 로그 독립 열람 한계 때문이었다. 부모의 live 출력으로 단계 완료를 판단했지만, 로그 보존 방식의 개선 여부는 미결정이다.
- 현재 workflow 문서의 `기준 commit: 18b1b16`은 3단계 시범 입력 기준을 나타낸다. 현재 저장소 HEAD가 `6de92fb`인 사실과 모순되는지 여부는 문서 의미상 `Mismatch`가 아니지만, 4단계에서 표기 정책을 명확히 할 수 있다.
- 해결되지 않은 검증 `BLOCKER`: 0건. 이는 위 `Unknown`이 해결됐다는 뜻이 아니다.

## 9. 4단계 진입 판정

**판정: `READY`**

근거는 다음과 같다.

1. 두 custom agent가 새 세션에서 발견되고 명시적으로 직접 호출됐다.
2. 실제 읽기 전용 권한과 호출 전후 무변경이 확인됐다.
3. `PASS`, `BLOCKER`, `SPECIALIST_REQUIRED`, 전문 `Blocked/Partial`과 수정·증거 보완 후 독립 재검토가 실제로 동작했다.
4. unresolved `BLOCKER` 없이 3단계 최종 문서 리뷰가 `PASS`했다.
5. `main`·`mock-agent`와 운영 자원 경계를 위반하지 않았다.

`READY`는 4단계 후보 지침을 작성하고 smoke 검증할 수 있다는 진입 판정이다. 최상위 의무가 이미 구현됐거나 장기 효과가 입증됐다는 뜻은 아니다. 4단계 smoke에서 agent 미발견, 실제 읽기 전용 불명, mutation, blocker 무시, mock·운영 경계 위반 또는 일반 개발 흐름을 막는 지침이 확인되면 완료하지 말고 계획의 중단 조건에 따라 `Partial` 또는 `Blocked`로 전환해야 한다.

## 10. 현재 branch, 마지막 commit과 미커밋 변경

인수인계 작성 직전 재확인 결과는 다음과 같다.

- branch: `main`
- HEAD: `6de92fb2e63ee10e8ccf1e789ec2eae7e3890194`
- 마지막 commit: `6de92fb subagent add plan 3`
- staged 변경: 없음
- unstaged 변경: 없음
- untracked 변경: 없음
- `git diff --check`: `Pass`
- `AGENTS.md`, `docs/operations/release-checklist.md` diff: 없음

이 문서를 추가한 뒤 최종 재확인한 현재 미커밋 변경은 다음 1건뿐이다.

- `?? reports/development-validation-subagent-stage1-3-handoff.md`

staged·unstaged tracked 변경은 없고 `AGENTS.md`와 `docs/operations/release-checklist.md`의 diff도 없다. commit, push, merge, rebase는 수행하지 않는다.

## 11. 새 Codex 세션에서 4단계만 수행할 시작 프롬프트

아래 내용을 새 Codex 세션의 첫 사용자 메시지로 그대로 사용할 수 있다.

```text
현재 저장소에서 개발 검증 서브에이전트 도입 계획의 4단계만 수행해줘. 1~3단계를 다시 구현하거나 시범 운영하지 마.

시작 전에 반드시 현재 적용되는 AGENTS.md와 다음 문서를 끝까지 읽어:
- reports/development-validation-subagent-stage1-3-handoff.md
- reports/development-validation-subagent-adoption-plan.md
- docs/operations/development-agent-workflow.md
- reports/development-validation-subagent-workflow.md

먼저 branch, HEAD, git status, staged/unstaged/untracked diff와 1~3단계 산출물을 현재 저장소에서 재확인해. 인수인계와 현재 상태가 실질적으로 다르거나 해결되지 않은 BLOCKER가 있으면 4단계를 진행하지 말고 Mismatch 또는 Blocked로 보고해. 기존 미커밋 변경은 보존하고, commit·push·merge·rebase·branch 전환은 하지 마.

4단계 범위는 다음으로 제한해:
1. AGENTS.md에 docs/operations/development-agent-workflow.md 링크와 build 전 pre-build-review 의무, unresolved BLOCKER의 build·완료 금지, 수정 후 독립 재검토, 명확한 trigger와 단일 프로필의 specialist-validator 호출을 간결하게 추가해.
2. 메인 에이전트의 검증 결과 임의 무시·test 기준 완화 금지, 검증 서브에이전트의 파일 수정·test skip 금지를 명시해. 상세 역할은 AGENTS.md에 중복하지 말고 기준 문서로 연결해.
3. AGENTS.md 변경을 최종 후보로 취급하고 새 Codex 세션에서 지침 기반 의무 호출과 중단 조건을 smoke 검증해. 실제 sandbox·permission, 호출 전후 git status·diff, 표준 gate와 mutation 결과를 확인해.
4. smoke가 실패하면 네가 만든 후보 지침만 안전하게 수정해 재검증해. 해결할 수 없으면 네 변경만 제거하고 Partial 또는 Blocked로 기록해. 실패한 의무 지침을 활성 상태로 남기지 마.
5. 완료 기준을 충족한 경우 docs/operations/development-agent-workflow.md의 Stage 4 상태와 reports/development-validation-subagent-workflow.md의 구현 결과·단일 기준 문서 링크만 갱신해. 상세 역할을 리포트에 중복하지 마.
6. custom agent 구성과 지침 기반 의무 호출은 각각 실제 결과에 따라 Implemented 또는 미완료로 기록하고, hook·CI 등 기계적 자동화는 Not Implemented로 유지해.

docs/operations/release-checklist.md는 별도 결정이 없으므로 수정하지 마. .codex/config.toml, application, test, dependency, mock 구현과 운영 자원도 수정하지 마. 4단계 smoke에서 현재 agent 정의의 구체적 결함이 Confirmed되면 먼저 근거와 영향 범위를 보고하고, 기준을 완화하지 않는 최소 수정만 수행해.

후보 diff를 고정한 뒤 pre-build-review로 최종 독립 검토하고 git diff --check를 실행해. 최종 보고에는 변경 파일, 실제 호출·검증 결과, 전후 mutation 비교, Unknown·Mismatch·Not Run, mock-agent·운영 자원 변경 여부와 4단계 최종 판정을 포함해. 확인되지 않은 항목을 성공으로 간주하지 마.
```

# 전문 검수 에이전트 환경 구축 결과

## 1. 작업 당시 브랜치

- 브랜치: `mock-agent`
- 작업 시작 상태: `git status --short` 출력 없음
- 작업 시작 기준 commit: `5308c17 Build private mock environment for agent validation`
- 브랜치 전환·생성, commit, push, merge, rebase는 수행하지 않았다.

## 2. 생성한 파일

### 역할 정의

- `.codex/agents/browser-qa.md`
- `.codex/agents/code-audit.md`
- `.codex/agents/performance.md`

### 실행 지시문

- `.codex/tasks/run-browser-qa.md`
- `.codex/tasks/run-code-audit.md`
- `.codex/tasks/run-performance.md`

### 보고서 템플릿

- `.codex/templates/browser-qa-report-template.md`
- `.codex/templates/code-audit-report-template.md`
- `.codex/templates/performance-report-template.md`

### 운영 문서

- `docs/agent-operating-guide.md`
- `docs/agent-boundaries.md`
- `docs/agent-reporting-standard.md`
- `docs/agent-worktree-guide.md`
- `docs/agent-environment-result.md`

### 빈 디렉터리 유지 파일

- `reports/browser-qa/.gitkeep`
- `reports/code-audit/.gitkeep`
- `reports/performance/.gitkeep`
- `reports/consolidated/.gitkeep`
- `artifacts/browser-qa/screenshots/.gitkeep`
- `artifacts/browser-qa/traces/.gitkeep`
- `artifacts/browser-qa/console/.gitkeep`
- `artifacts/browser-qa/network/.gitkeep`
- `artifacts/code-audit/evidence/.gitkeep`
- `artifacts/code-audit/test-output/.gitkeep`
- `artifacts/performance/metrics/.gitkeep`
- `artifacts/performance/traces/.gitkeep`
- `artifacts/performance/profiles/.gitkeep`

## 3. 수정한 파일

- `AGENTS.md`: 기존 내용을 보존하고 세 검수 에이전트의 공통 데이터 보호, 한글 보고, 코드 수정 금지, 정합성 우선, 사실/추정 구분, Git 금지 규칙을 추가했다.

## 4. Agent 1 역할 요약

Browser QA & UX Reliability Agent는 브라우저에서 보이고 조작 가능한 사용자 흐름, 화면 상태, 오류 안내, console/page/network 오류의 사용자 영향, 기본 접근성과 데스크톱 해상도를 검수한다. 최소 Chromium과 16개 필수 Mock 시나리오를 사용하고 반복 재현, 스크린샷과 trace 근거를 남긴다.

## 5. Agent 2 역할 요약

Defect, Data Integrity & Code Reliability Agent는 데이터 범위 혼합, stale response, API 실패 은폐, 합계·상세 불일치, 날짜·숫자 변환, API 계약, React Query, 비동기 처리, 타입·예외·메모리·테스트 위험을 감사한다. 확인된 오류와 잠재 위험을 분리하고 데이터 정합성을 가장 먼저 본다.

## 6. Agent 3 역할 요약

Performance & Architecture Optimization Agent는 `single`·`normal`·`large` 기준선, 로딩·시나리오 시간, API 호출과 payload, 렌더링, 차트·테이블, 번들, 메모리 및 확장성을 반복 측정한다. 추측 기반 최적화를 금지하고 프런트엔드와 백엔드 API 제안을 분리한다.

## 7. 세 역할의 경계

- Browser QA는 사용자 재현과 화면 영향을 담당하며 전체 정적 감사나 성능 최적화를 하지 않는다.
- Code Audit은 코드 원인과 데이터 정합성을 담당하며 디자인·일반 UX·성능 튜닝을 하지 않는다.
- Performance는 측정 가능한 비용과 확장성을 담당하며 일반 기능 오류나 비즈니스 정확성을 판정하지 않는다.
- 같은 현상을 발견하면 각자의 관점만 기록하고 `연관 에이전트`와 사유로 연결한다.

## 8. 공통 원칙

- 합성 Mock 데이터만 사용한다.
- 실제 회사 데이터와 내부 URL·host·IP·port·서버 경로·식별자·비밀을 기록하지 않는다.
- 모든 검수 결과와 보고서는 한글로 작성한다.
- 실패, schema 불일치, 숫자·날짜 변환 실패, 부분 데이터, 판단 불가능을 정상 기본값으로 숨기지 않는다.
- 데이터 정합성 문제를 가장 높은 위험으로 다룬다.
- 확인된 사실, 추정, 재현 불가, 추가 확인 필요를 구분한다.
- `mock-agent`와 검수 브랜치를 `main`으로 merge 또는 rebase하지 않는다.

## 9. 허용 작업

코드·문서·Git 상태 읽기, Mock·프런트엔드·기존 테스트·Playwright 실행, 브라우저 조작, console/page/network 증거 수집, 성능 측정, 지정된 `reports/`와 `artifacts/` 하위 파일 작성만 허용한다.

## 10. 금지 작업

애플리케이션 소스·테스트·설정·`package.json`·lock 파일 수정, 의존성 설치·업데이트, 포맷팅, 오류 수정, 최적화, UI 변경, 브랜치 변경·생성, commit, push, merge, rebase, reset, clean, PR 생성 및 기존 변경 삭제를 금지한다. 애플리케이션 수정은 사용자가 `main` 개발용 Codex에 별도로 요청한다.

## 11. 보고서 저장 경로

- Browser QA: `reports/browser-qa/YYYY-MM-DD_HHMM_browser-qa-report.md`
- Code Audit: `reports/code-audit/YYYY-MM-DD_HHMM_code-audit-report.md`
- Performance: `reports/performance/YYYY-MM-DD_HHMM_performance-report.md`
- 사용자 검토 후 통합본: `reports/consolidated/`

## 12. Worktree 생성 준비 상태

세 역할의 브랜치·worktree 생성 명령, 생성 전 확인, `npm ci` 설치 절차와 역할별 시작 지시문을 `docs/agent-worktree-guide.md`에 작성했다. 실제 worktree와 브랜치는 생성하지 않았다. 생성 명령은 사용자가 직접 실행해야 한다.

## 13. 동시 실행 시 포트 계획

| 역할 | Frontend | Mock API |
|---|---:|---:|
| Browser QA | 4175 | 5175 |
| Code Audit | 4176 | 5176 |
| Performance | 4177 | 5177 |

Mock API의 `MOCK_API_PORT` 지원을 확인했다. Vite는 `VITE_MOCK_FRONTEND_PORT`를 읽지만 현재 `dev:mock`의 명령행 `--port 4175`가 이를 덮는다. 따라서 Browser QA 외 worktree는 문서에 적은 별도 API/Vite 명령을 사용하거나 세 에이전트를 기본 포트에서 순차 실행해야 한다.

## 14. 현재 확인된 제한사항

- `npm run mock` 하나만으로 worktree별 프런트엔드 포트를 분리할 수 없다.
- 기존 Playwright 설정은 기본 Frontend/Mock API 포트를 사용하므로 서로 다른 포트에서 e2e를 동시에 실행할 수 없다.
- Node 버전이 저장소에 고정되어 있지 않고 별도 typecheck 명령이 없다.
- Playwright 실행은 호스트의 Chromium OS 라이브러리 상태에 영향을 받는다.
- 이번 작업은 기반 문서와 디렉터리 구축만 수행했으며 세 에이전트의 실제 검수, 브라우저 실행, 성능 측정 및 역할별 보고서 생성은 수행하지 않았다.
- 위 제한을 해결하기 위한 애플리케이션·테스트·설정 파일 수정은 이번 범위에서 수행하지 않았다.

## 15. 사용자가 다음에 실행할 명령

먼저 현재 변경을 검토한다.

```bash
cd /home/arod/project_codex/l0_spider/l0_spider
git branch --show-current
git status --short
git diff --stat
git diff --name-only
```

내용을 검토한 뒤 사용자가 직접 역할별 worktree를 만든다.

```bash
git worktree add -b agent/browser-qa ../l0_spider-qa mock-agent
git worktree add -b agent/code-audit ../l0_spider-audit mock-agent
git worktree add -b agent/performance ../l0_spider-performance mock-agent
```

각 worktree에서 사용자가 `npm ci`를 실행한 뒤 다음 지시문으로 역할을 시작한다.

- `.codex/tasks/run-browser-qa.md`
- `.codex/tasks/run-code-audit.md`
- `.codex/tasks/run-performance.md`

포트 분리 명령과 순차 실행 대안은 `docs/agent-worktree-guide.md`를 따른다.

## 16. 코드 수정 여부

`src/`, `server/`, `mock/`, `tests/`, `package.json`, `package-lock.json`, `playwright.config.*`, `vite.config.*`, `server.mjs`, `.env*`는 수정하지 않았다. 이번 변경은 허용된 `.codex/`, `reports/`, `artifacts/`, `docs/agent-*.md`, `AGENTS.md`에만 한정했다.

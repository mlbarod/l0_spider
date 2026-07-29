# 전문 검수 에이전트 Worktree 운영 가이드

## 원칙

이 문서의 명령은 사용자가 직접 실행한다. 에이전트는 worktree·브랜치를 자동 생성·전환하지 않으며 commit, push, merge, rebase를 수행하지 않는다. `mock-agent` 또는 검수 브랜치를 `main`에 병합하지 않는다.

기준 저장소는 다음과 같다.

```text
/home/arod/project_codex/l0_spider/l0_spider
```

예상 worktree는 다음과 같다.

```text
/home/arod/project_codex/l0_spider/l0_spider-qa
/home/arod/project_codex/l0_spider/l0_spider-audit
/home/arod/project_codex/l0_spider/l0_spider-performance
```

## 생성 전 확인

사용자가 기준 저장소에서 다음 읽기 명령으로 `mock-agent`와 깨끗한 작업 상태를 확인한다.

```bash
cd /home/arod/project_codex/l0_spider/l0_spider
git branch --show-current
git status --short
git log -1 --oneline
git worktree list
```

대상 브랜치나 디렉터리가 이미 존재하면 아래 생성 명령을 실행하지 말고 먼저 현재 상태를 확인한다.

## Worktree 생성

```bash
cd /home/arod/project_codex/l0_spider/l0_spider

git worktree add \
  -b agent/browser-qa \
  ../l0_spider-qa \
  mock-agent

git worktree add \
  -b agent/code-audit \
  ../l0_spider-audit \
  mock-agent

git worktree add \
  -b agent/performance \
  ../l0_spider-performance \
  mock-agent
```

## 의존성 설치

저장소에는 `package-lock.json`이 있으므로 package manager는 `npm`이고 재현 가능한 설치 명령은 `npm ci`이다. 이 단계는 에이전트가 아니라 사용자가 각 새 worktree에서 직접 실행한다.

```bash
cd /home/arod/project_codex/l0_spider/l0_spider-qa
npm ci

cd /home/arod/project_codex/l0_spider/l0_spider-audit
npm ci

cd /home/arod/project_codex/l0_spider/l0_spider-performance
npm ci
```

Node 버전은 저장소에 고정되어 있지 않다. Mock 문서에 기록된 검증 환경과 호환되는 Node/npm을 사용하되 설치 결과와 실제 버전을 각 보고서에 기록한다.

## 포트 계획

| 역할 | Frontend | Mock API |
|---|---:|---:|
| Browser QA | 4175 | 5175 |
| Code Audit | 4176 | 5176 |
| Performance | 4177 | 5177 |

Mock API는 `MOCK_API_PORT`를 환경변수 또는 `.env.mock.local`에서 읽는다. Vite 설정도 `VITE_MOCK_FRONTEND_PORT`를 읽지만 현재 `npm run dev:mock`은 명령행의 `--port 4175`로 프런트엔드 포트를 고정한다. 따라서 `npm run mock`만으로 세 worktree의 프런트엔드 포트를 동시에 분리할 수 없다. 이번 환경 구축에서는 `package.json`이나 Vite 설정을 수정하지 않았다.

## 충돌 없이 별도 실행

Browser QA는 기존 기본 명령을 사용할 수 있다.

```bash
cd /home/arod/project_codex/l0_spider/l0_spider-qa
npm run mock
```

Code Audit과 Performance를 동시에 운영해야 할 때는 각 worktree에서 Mock API와 Vite를 별도 터미널로 실행한다. `npx --no-install`은 해당 worktree에 사용자가 `npm ci`로 이미 설치한 Vite만 사용하며 새 의존성을 내려받지 않는다.

Code Audit:

```bash
cd /home/arod/project_codex/l0_spider/l0_spider-audit
MOCK_API_PORT=5176 npm run mock:server
```

```bash
cd /home/arod/project_codex/l0_spider/l0_spider-audit
VITE_USE_MOCK_API=true \
VITE_API_BASE_URL=http://127.0.0.1:5176 \
npx --no-install vite --mode mock --host 127.0.0.1 --port 4176
```

Performance:

```bash
cd /home/arod/project_codex/l0_spider/l0_spider-performance
MOCK_API_PORT=5177 npm run mock:server
```

```bash
cd /home/arod/project_codex/l0_spider/l0_spider-performance
VITE_USE_MOCK_API=true \
VITE_API_BASE_URL=http://127.0.0.1:5177 \
npx --no-install vite --mode mock --host 127.0.0.1 --port 4177
```

모든 host는 loopback으로 유지한다. 실행 전 해당 포트가 비어 있는지 확인하고, 종료 시 시작한 프로세스를 모두 종료한다. Playwright 설정은 기본 `4175`/`5175`를 고정 사용하므로 Code Audit·Performance 포트로 기존 e2e를 동시에 실행할 수 없다. 설정을 수정하지 말고 순차 실행하거나 해당 제한을 보고한다.

## 순차 실행 대안

동시 실행이 필요하지 않다면 충돌 가능성이 가장 낮은 방법은 한 번에 하나의 worktree만 기본 포트로 실행하는 것이다.

1. Browser QA worktree에서 `npm run mock`과 검수를 실행하고 모든 프로세스를 종료한다.
2. Code Audit worktree에서 `npm run mock`과 감사를 실행하고 모든 프로세스를 종료한다.
3. Performance worktree에서 `npm run mock`과 측정을 실행하고 모든 프로세스를 종료한다.
4. 다음 worktree를 시작하기 전에 loopback `4175`와 `5175`가 더 이상 사용 중이 아닌지 확인한다.

## 역할별 시작 지시문

- Browser QA: `.codex/tasks/run-browser-qa.md`
- Code Audit: `.codex/tasks/run-code-audit.md`
- Performance: `.codex/tasks/run-performance.md`

각 에이전트는 자기 브랜치와 역할별 쓰기 경로를 확인한 뒤 실행한다.

# 전문 검수 에이전트 운영 가이드

## 목적

이 문서는 개인 PC의 합성 Mock 환경에서 Browser QA, Code Audit, Performance 에이전트를 안전하게 운영하는 공통 절차를 정의한다. 세 에이전트는 문제 탐색, 재현 조건 확인, 근거 수집, 우선순위 지정, 한글 보고서 작성까지만 수행한다. 애플리케이션 결함 수정은 별도 요청을 받은 `main` 개발 환경에서 수행한다.

## 운영 전제

- `mock-agent`와 여기서 직접 분기한 `agent/browser-qa`, `agent/code-audit`, `agent/performance`에서만 사용한다.
- 실제 회사·운영·공정·품질·사용자·조직 데이터를 사용하지 않는다.
- 내부 URL, host, IP, port, 서버 경로, 실제 식별자, credential, token, secret을 출력·보고·아티팩트에 기록하지 않는다.
- 에이전트별 worktree와 포트 운영은 `docs/agent-worktree-guide.md`를 따른다.
- 시작 전에 브랜치, 현재 변경, 최근 commit을 읽기 명령으로 확인한다.
- 기존 변경은 사용자 소유로 간주하고 수정하거나 삭제하지 않는다.

## 공통 실행 흐름

1. `AGENTS.md`와 해당 `.codex/agents/*.md`를 읽는다.
2. 역할별 `.codex/tasks/run-*.md`를 전체 실행 지시문으로 사용한다.
3. 브랜치와 시작 변경 목록을 확인한다.
4. 합성 Mock 환경과 이미 설치된 도구만 사용한다.
5. 기준선 뒤에 역할별 시나리오를 실행한다.
6. 실제 관찰 또는 코드·측정 근거를 수집한다.
7. 재현성을 확인하고 상태·심각도·신뢰도를 판정한다.
8. 역할별 템플릿으로 한글 보고서를 작성한다.
9. 실행 프로세스를 종료한다.
10. 종료 시 Git 변경 범위를 확인해 보고서·아티팩트 외 변경이 없음을 검증한다.

## 공통 판단 원칙

실패를 숨기거나 임의의 기본값으로 정상처럼 표시하지 않는다.

- API 실패를 빈 데이터로 처리하지 않는다.
- 스키마 불일치를 기본값으로 덮지 않는다.
- 숫자 변환 실패를 `0`, 날짜 파싱 실패를 현재 날짜로 치환하지 않는다.
- 일부 누락, 합계 불일치, 다른 기준 시각을 전체 정상으로 표시하지 않는다.
- 판단 불가능 상태를 정상·이상 중 하나로 임의 분류하지 않는다.
- 오래된 응답이 최신 응답을 덮는 가능성을 정상으로 취급하지 않는다.
- 재현되지 않은 문제는 확정 오류로 쓰지 않는다.
- 확인된 사실과 추정, 도구 제한을 명확히 분리한다.

## 허용 작업

- 코드, 문서, Git status/diff/log/worktree 정보 읽기
- Mock 서버와 프런트엔드 실행 및 종료
- 기존 lint·test·Playwright 실행
- 브라우저 조작, console/page/network 증거 수집
- 성능·메모리·렌더링 측정
- 역할별 `reports/` 문서와 `artifacts/` 증거 작성

## 금지 작업

- 애플리케이션 소스, 테스트, 설정, `package.json`, lock 파일 변경
- 의존성 설치·업데이트, 코드 포맷팅, 오류 수정, 최적화, UI 변경
- 브랜치 생성·전환, commit, push, merge, rebase, reset, clean, PR 생성
- 기존 변경 삭제·덮어쓰기
- 다른 에이전트의 보고서 수정
- 실행하지 않은 테스트나 측정을 실행한 것처럼 기록

## 파일 경로

| 역할 | 지시문 | 보고서 | 아티팩트 |
|---|---|---|---|
| Browser QA | `.codex/tasks/run-browser-qa.md` | `reports/browser-qa/` | `artifacts/browser-qa/` |
| Code Audit | `.codex/tasks/run-code-audit.md` | `reports/code-audit/` | `artifacts/code-audit/` |
| Performance | `.codex/tasks/run-performance.md` | `reports/performance/` | `artifacts/performance/` |

종합 검토 결과가 필요하면 사람이 확인한 뒤 `reports/consolidated/`에 둔다. 개별 에이전트는 다른 에이전트 보고서를 임의로 통합하거나 수정하지 않는다.

## 중단 조건

예상하지 않은 브랜치, 실제 데이터나 비밀의 노출 위험, 역할별 허용 경로 밖의 신규 변경, 기존 변경과의 충돌, 의존성 미설치로 인한 실행 불가가 확인되면 오류를 숨기지 말고 중단 사유를 보고한다. 기존 파일을 되돌리거나 삭제하지 않는다.

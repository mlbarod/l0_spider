# Code Audit 전체 감사 실행 지시문

당신은 `.codex/agents/code-audit.md`의 Defect, Data Integrity & Code Reliability Agent다. 해당 역할 문서, `AGENTS.md`, `docs/agent-operating-guide.md`, `docs/agent-reporting-standard.md`를 먼저 읽고 아래 순서대로 한 번의 전체 감사를 수행하라. 보고서는 한글로 작성하고 애플리케이션·테스트·설정·의존성 파일을 수정하지 마라.

## 1. 사전 안전 확인

1. `git branch --show-current`, `git status --short`, `git log -1 --oneline`을 실행한다.
2. 브랜치가 `agent/code-audit`인지 확인한다. `main` 또는 예상하지 않은 브랜치면 어떤 파일도 쓰지 않고 중단한다.
3. 시작 시 기존 변경을 목록으로 보존한다. 기존 변경을 삭제하거나 수정하지 않는다.
4. 합성 데이터만 사용하고 실제 회사 데이터, 내부 URL·host·IP·port·식별자·서버 경로·비밀을 읽어 보고서에 옮기지 않는다.

## 2. 구조와 계약 파악

1. `package.json`, 프런트엔드 요청 생성부, 응답 필드 접근부, React Query hooks와 query client, router와 Error Boundary, `mock/contracts/`, `docs/mock-api-inventory.md`를 읽는다.
2. API 계약은 프런트엔드가 실제 사용하는 method, 상대 path, request shape, response field까지만 도출한다.
3. 현재 Git diff가 있다면 변경 전후 위험을 읽되 다른 사람의 변경을 수정하지 않는다.

## 3. 정적 분석

다음을 체계적으로 검색하고 실제 도달 조건과 관련 line을 확인한다.

1. 다른 라인·설비·센서·등급 범위의 데이터 혼합
2. stale response/state, 요청 취소 누락, out-of-order response와 race condition
3. React Query `queryKey`, 캐시 범위, 무효화와 필터 누락
4. API 실패를 빈 배열이나 성공 상태로 숨기는 분기
5. `null`, `undefined`, 빈 배열, `NaN`, 타입 단언과 schema 불일치
6. 날짜 파싱, 시간대, 기준 시각과 숫자 문자열 변환·정렬
7. 합계/상세, 필터/응답, 요약/행 데이터 불일치
8. 직접 URL 파라미터 검증, 예외 처리와 Error Boundary
9. timer, listener, 구독, 비동기 작업 해제와 메모리 누수 가능성
10. console, 오류, UI 또는 네트워크로 민감정보가 노출될 가능성
11. 죽은·중복·복잡한 핵심 로직과 테스트가 없는 핵심 판단

## 4. 재현과 기존 테스트

1. 의존성이 이미 있을 때만 기존 `npm run lint`, `npm run test:unit`, `npm run test:contract`, 필요 시 `npm run test:e2e`를 실행한다. 테스트나 설정을 수정하지 않는다.
2. Mock 환경에서 `normal`, `partial`, `error-500`, `timeout`, `race-condition`, `inconsistent`, `edge-values`를 우선 사용해 코드 위험을 제한적으로 재현한다.
3. 실행 불가, 실패, 불안정 결과를 숨기지 않는다. 테스트 통과만으로 위험이 없다고 단정하지 않는다.
4. 코드 발췌는 최소화하고 파일·line·함수와 입력 조건을 우선 근거로 남긴다.
5. 증거는 `artifacts/code-audit/evidence/`, 테스트 출력은 `artifacts/code-audit/test-output/`에 저장하며 민감정보를 제거한다.

## 5. 판정과 우선순위

1. 실행 또는 결정적 코드 경로로 입증한 항목은 `확인됨`, 계약·도달 조건이 미확인인 항목은 `잠재 위험`으로 분리한다.
2. 재현 실패는 `재현 불가`, 요구사항 또는 외부 계약 확인이 필요하면 `추가 확인 필요`로 쓴다.
3. 데이터 정합성 우선순위 목록과 공통 Critical/High/Medium/Low 기준으로 심각도를 결정한다.
4. 확인된 사실과 추정을 별도 문단으로 작성하고 한 근거로 결론을 과장하지 않는다.
5. 사용자 화면 재현은 `Browser QA Agent`, 측정 가능한 병목은 `Performance Agent`를 연관 에이전트로 표시한다.

## 6. 보고와 종료 확인

1. `.codex/templates/code-audit-report-template.md`를 사용해 `reports/code-audit/YYYY-MM-DD_HHMM_code-audit-report.md`를 작성한다.
2. 한 줄짜리 일반론이 아니라 조건, 경로, line, 결과, 검증 기준을 포함한다.
3. 권장 수정 방향만 제안하고 실제 코드는 수정하지 않는다.
4. `git status --short`, `git diff --stat`, `git diff --name-only`로 시작 상태와 비교한다.
5. 이번 실행에서 새로 쓸 수 있는 경로는 `reports/code-audit/`와 `artifacts/code-audit/`뿐이다. 그 밖의 변경은 되돌리지 말고 명시한 뒤 중단한다.
6. 코드·테스트·설정·의존성 수정이 없었는지 최종 확인한다.

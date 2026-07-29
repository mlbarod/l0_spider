# Performance 전체 측정 실행 지시문

당신은 `.codex/agents/performance.md`의 Performance & Architecture Optimization Agent다. 해당 역할 문서, `AGENTS.md`, `docs/agent-operating-guide.md`, `docs/agent-reporting-standard.md`를 먼저 읽고 아래 순서대로 한 번의 전체 측정을 수행하라. 모든 결과는 한글로 작성하며 애플리케이션·테스트·설정·의존성 파일을 수정하지 마라.

## 1. 사전 안전 확인

1. `git branch --show-current`, `git status --short`, `git log -1 --oneline`을 실행한다.
2. 브랜치가 `agent/performance`인지 확인한다. `main` 또는 예상하지 않은 브랜치면 파일을 쓰지 않고 중단한다.
3. 기존 변경 목록을 기준선으로 보존하고 삭제·수정하지 않는다.
4. 합성 Mock 데이터만 사용하고 실제 회사 데이터와 내부 URL·host·IP·port·식별자·서버 경로·비밀을 기록하지 않는다.

## 2. 환경과 기준선

1. OS, CPU, 메모리, 브라우저·버전, Node·npm 버전, 실행 모드, viewport, 측정 도구와 조건을 기록한다. 장치나 계정의 실제 식별자는 기록하지 않는다.
2. 의존성이 이미 설치됐는지 확인한다. 설치하지 않으며 부족하면 제한사항으로 보고한다.
3. `npm run mock`을 실행하고 health를 확인한다. 실행 실패를 성공이나 빈 결과로 바꾸지 않는다.
4. 캐시, cold/warm, throttling, background tab 여부를 정하고 모든 시나리오에 동일하게 적용한다.

## 3. 규모별 측정

1. `single`을 small 대용 기준으로 측정한다.
2. 같은 흐름과 조건으로 `normal`을 측정한다.
3. 같은 흐름과 조건으로 `large`를 측정한다.
4. 각 조건을 최소 5회 권장 측정한다. warm-up을 제외하면 그 기준을 적는다.
5. 초기 페이지 로딩, 주요 화면 표시, 대표 사용자 시나리오 완료시간의 평균·중앙값·최솟값·최댓값을 계산한다.
6. 데이터 행 수와 차트 포인트 수를 합성 fixture 또는 응답에서 확인한다. 실제 운영 규모로 일반화하지 않는다.

## 4. 비용 분석

1. 시나리오별 API 호출 횟수, 중복·직렬 호출, 불필요한 재조회, cache hit 여부, 요청별 payload와 전체 전송량을 기록한다.
2. React DevTools 또는 이용 가능한 profiler로 주요 컴포넌트, Recharts, 테이블의 렌더링 횟수와 비용을 측정한다.
3. 기존 build 명령으로 번들 결과를 생성할 수 있으면 크기와 초기 로딩 chunk를 분석한다. 설정이나 소스는 수정하지 않는다.
4. 반복 페이지 이동·필터 변경·차트 조작 전후의 메모리를 측정하고 반복 횟수, 안정화 대기시간, GC 조건을 쓴다.
5. `slow`와 `race-condition`은 호출 중첩과 사용자 체감 시간을 보는 보조 시나리오로 사용하되 기능 정확성을 판정하지 않는다.

## 5. 병목 판정

1. 실제 측정값, 사용자 영향, `single`→`normal`→`large` 증가율과 재현성을 기준으로 병목 순위를 매긴다.
2. 추측만 있는 항목은 확정 성능 문제로 표현하지 않는다.
3. 개선 예상효과는 측정 근거가 허용하는 범위로 쓰고 수정 후 동일 조건 비교 기준을 제시한다.
4. 프런트엔드 개선과 백엔드 API 개선 제안을 분리한다. 백엔드 구현이나 운영 용량은 추측하지 않는다.
5. 기능 현상은 `Browser QA Agent`, 정합성 원인은 `Code Audit Agent`를 연관 에이전트로 표시한다.

## 6. 증거와 보고

1. 원시 지표는 `artifacts/performance/metrics/`, trace는 `artifacts/performance/traces/`, profile은 `artifacts/performance/profiles/`에 저장한다.
2. 증거에 내부 주소, 실제 데이터, 식별자, 비밀이 없는지 확인한다.
3. `.codex/templates/performance-report-template.md`를 사용해 `reports/performance/YYYY-MM-DD_HHMM_performance-report.md`를 작성한다.
4. 측정하지 않은 항목과 도구 제한, 실패한 명령을 숨기지 않는다.

## 7. 종료와 변경 범위 확인

1. Mock과 브라우저·profiler 프로세스를 정상 종료하고 종료 여부를 확인한다.
2. `git status --short`, `git diff --stat`, `git diff --name-only`로 시작 상태와 비교한다.
3. 이번 실행에서 새로 쓸 수 있는 경로는 `reports/performance/`와 `artifacts/performance/`뿐이다.
4. 그 밖의 변경은 임의로 되돌리지 말고 보고서에 명시한 뒤 중단한다.
5. 코드·테스트·설정·의존성 수정이 없었음을 확인한다.

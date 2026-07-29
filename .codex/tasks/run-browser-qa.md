# Browser QA 전체 검수 실행 지시문

당신은 `.codex/agents/browser-qa.md`의 Browser QA & UX Reliability Agent다. 해당 역할 문서, `AGENTS.md`, `docs/agent-operating-guide.md`, `docs/agent-reporting-standard.md`를 먼저 읽고 아래 순서대로 한 번의 전체 검수를 수행하라. 결과와 보고서는 한글로 작성하며 애플리케이션·테스트·설정·의존성 파일을 수정하지 마라.

## 1. 사전 안전 확인

1. `git branch --show-current`, `git status --short`, `git log -1 --oneline`을 실행한다.
2. 브랜치가 `agent/browser-qa`인지 확인한다. `main`이거나 예상하지 않은 브랜치면 어떤 파일도 쓰지 말고 중단하여 보고한다.
3. 시작 시 변경 파일 목록을 기록한다. 기존 변경을 삭제하거나 덮어쓰지 않는다.
4. 실제 회사 데이터, 내부 URL·host·IP·port·식별자·경로·비밀이 입력 또는 출력에 포함되지 않는지 확인한다. 합성 Mock 데이터만 사용한다.

## 2. Mock 환경 확인과 실행

1. `package.json`, `mock/README.md`, `.env.mock`의 변수 이름과 기존 실행 지침을 읽는다. `.env*`는 수정하거나 그 값을 보고서에 기록하지 않는다.
2. 필요한 의존성이 이미 설치되어 있는지 확인한다. 없으면 설치하지 말고 제한사항으로 보고한다.
3. `npm run mock`으로 Mock API와 프런트엔드를 실행한다. 실패하면 오류를 숨기지 말고 원문 오류에서 민감정보를 제거해 기록한다.
4. health와 활성 시나리오를 loopback 주소로 확인한다.

## 3. 기준선과 필수 시나리오

1. `npm run mock:scenario -- normal`로 기준선을 만들고 주요 페이지 진입, 메뉴, 버튼, 탭, 검색, 필터, 정렬, 모달, 드롭다운, 툴팁, 차트, 직접 URL, 새로고침, 뒤로/앞으로 가기를 확인한다.
2. Chromium을 최소 브라우저로 사용한다. `1920×1080`, `1440×900`, `1366×768` 데스크톱 해상도를 우선한다.
3. 다음 시나리오를 빠짐없이 순차 검수한다: `normal`, `empty`, `single`, `partial`, `slow`, `error-400`, `error-401`, `error-403`, `error-404`, `error-500`, `error-502`, `timeout`, `race-condition`, `inconsistent`, `edge-values`, `large`.
4. 각 시나리오에서 로딩, 빈 상태, 부분 상태, 실패 안내, 잘못된 기본값, 기준 시각, 합계 불일치, 긴 텍스트, 대량 목록을 확인한다.
5. `race-condition`에서는 빠른 필터 전환, `slow`와 `timeout`에서는 연속 클릭과 화면 이탈을 확인한다.
6. 모바일 요구사항이 확인되지 않았다면 모바일 문제를 높은 우선순위로 올리지 않는다.

## 4. 오류와 증거 수집

1. 각 주요 흐름에서 console error, page error, failed request를 수집한다.
2. method와 상대 API path, 상태 또는 실패 유형, 사용자 영향만 기록한다. 요청·응답 전체 본문이나 실제 식별자를 저장하지 않는다.
3. 문제별로 원칙상 3회 재현하고 성공 횟수를 적는다. Critical 후보와 간헐 문제는 가능하면 5회 확인한다.
4. 스크린샷은 `artifacts/browser-qa/screenshots/`, trace는 `artifacts/browser-qa/traces/`, console은 `artifacts/browser-qa/console/`, network는 `artifacts/browser-qa/network/`에 저장한다.
5. 증거 파일에 민감정보가 없음을 확인한다. 불확실한 증거는 첨부하지 말고 수집 제한으로 기록한다.

## 5. 판정과 보고

1. `.codex/templates/browser-qa-report-template.md`를 복사해 `reports/browser-qa/YYYY-MM-DD_HHMM_browser-qa-report.md` 형식으로 작성한다.
2. 각 항목에 상태, 심각도, 신뢰도, 재현 횟수, 사용자 영향, 기대/실제 결과, 근거를 쓴다.
3. 재현되지 않은 문제를 확정하지 않고 사실과 추정을 구분한다.
4. 코드 원인은 `Code Audit Agent`, 측정 병목은 `Performance Agent`를 연관 에이전트로 표시한다.
5. 수정 방향은 제안만 하고 코드를 수정하지 않는다. 실패한 명령과 미검수 항목도 숨기지 않는다.

## 6. 종료와 변경 범위 확인

1. 실행한 Mock과 브라우저 프로세스를 정상 종료하고 종료 여부를 확인한다.
2. `git status --short`, `git diff --stat`, `git diff --name-only`로 시작 상태와 비교한다.
3. 이번 실행에서 새로 쓸 수 있는 경로는 `reports/browser-qa/`와 `artifacts/browser-qa/`뿐이다.
4. 그 밖의 파일 변경이 있으면 임의로 되돌리지 말고 보고서에 명시한 뒤 중단한다.
5. 코드·테스트·설정·의존성 수정이 없었다는 사실을 확인 가능한 근거와 함께 보고한다.

# Browser QA & UX Reliability 검수 보고서

## 실행 개요

- 보고서 작성 시각: 2026-07-30 13:07~13:15 KST
- 브랜치: `agent/browser-qa`
- 기준 브랜치: `mock-agent`가 현재 HEAD의 조상임을 확인
- 기준 commit: `c8e9ee9` (`Add read-only multi-agent review environment`)
- 작업 경로: `/home/arod/project_codex/l0_spider/l0_spider-qa`
- 검수자: Agent 1 — Browser QA & UX Reliability
- 운영체제: Ubuntu 26.04, Linux 6.18.33.2 WSL2
- Node/npm: Node.js `v22.22.1`, npm `9.2.0`
- Playwright: `1.61.1`
- 브라우저 및 버전: Playwright 번들 Chromium `149.0.7827.55`가 설치되어 있으나 필수 공유 라이브러리 부재로 실행 실패
- viewport: 브라우저 실행 전 실패하여 `1920×1080`, `1440×900`, `1366×768` 모두 미적용
- Mock 실행 명령: `npm run mock`, `npm run mock:reset`, `npm run mock:scenario -- <scenario>`
- 검수 시나리오: 16개 시나리오의 Mock 전환 및 대표 API 준비 상태만 확인. 브라우저 UI 검수는 전 시나리오 미실행
- 검수 범위: 사전 안전 확인, 라우터·기존 E2E 범위 확인, Mock health·시나리오 전환·직접 URL HTML 제공 확인, Playwright 실행 가능성 확인
- 제외 또는 미검수 범위: 실제 화면 렌더링과 모든 브라우저 사용자 흐름

## 전체 요약

핵심 질문인 “실제 사용자가 이 웹서비스를 문제없이 사용할 수 있는가?”에 이번 실행만으로 답할 수 없다. Mock API와 프런트엔드 프로세스는 정상 기동했고 16개 시나리오가 전환됐지만, Chromium이 페이지를 열기 전에 필수 공유 라이브러리 오류로 종료됐다.

의존성 설치 또는 업데이트는 이번 역할에서 절대 금지되어 있으므로 환경을 변경하지 않았다. 브라우저를 실제로 열지 못한 상태에서 앱 결함을 추정하거나 HTTP 준비 상태를 UI 통과로 간주하지 않았다. 따라서 앱의 확인된 문제 수는 0건이며, 이는 문제가 없다는 뜻이 아니라 검수 판정 보류를 뜻한다.

## 결과 요약

- Critical: 0
- High: 0
- Medium: 0
- Low: 0
- 확인됨: 0
- 잠재 위험: 0
- 재현 불가: 0
- 추가 확인 필요: 1건(브라우저 실행 환경 복구 후 전체 재검수 필요, 앱 결함 건수에 미포함)

## 시나리오 실행표

| 시나리오 | Mock 준비 확인 | 브라우저 실행 여부 | 대표 API 관찰 | 결과 및 제한 |
|---|---|---|---|---|
| `normal` | 예 | 아니요 | HTTP 200 | UI 기준선 미검수 |
| `empty` | 예 | 아니요 | HTTP 200 | 빈 상태 표현 미검수 |
| `single` | 예 | 아니요 | HTTP 200 | 단일 행·차트 미검수 |
| `partial` | 예 | 아니요 | HTTP 200 | 누락 필드 표현 미검수 |
| `slow` | 예 | 아니요 | HTTP 200, 약 1초 | 로딩·이탈·연속 클릭 미검수 |
| `error-400` | 예 | 아니요 | HTTP 400 | 오류 안내·복구 미검수 |
| `error-401` | 예 | 아니요 | HTTP 401 | 오류 안내·복구 미검수 |
| `error-403` | 예 | 아니요 | HTTP 403 | 오류 안내·복구 미검수 |
| `error-404` | 예 | 아니요 | HTTP 404 | 오류 안내·복구 미검수 |
| `error-500` | 예 | 아니요 | HTTP 500 | 오류 안내·복구 미검수 |
| `error-502` | 예 | 아니요 | HTTP 502 | 오류 안내·복구 미검수 |
| `timeout` | 예 | 아니요 | 12초 무응답 후 클라이언트 중단 | timeout UI·화면 이탈 미검수 |
| `race-condition` | 예 | 아니요 | HTTP 200 | 빠른 필터 변경과 stale 응답 미검수 |
| `inconsistent` | 예 | 아니요 | HTTP 200 | 요약·상세 불일치 안내 미검수 |
| `edge-values` | 예 | 아니요 | HTTP 200 | 날짜·숫자·긴 텍스트 표현 미검수 |
| `large` | 예 | 아니요 | HTTP 200 | 대량 목록·차트 조작성 미검수 |

각 시나리오 전에 `npm run mock:reset`을 수행했고, 종료 전 다시 reset하여 `normal`로 복원했다.

## 검수한 화면과 사용자 흐름

### 저장소에서 확인한 실제 라우트

`/`, `/self-equipment`, `/my-eqp`, `/registration`, `/matching-anomaly`, `/common-anomaly`, `/manual`, `/recipients`, `/defect-spider`, `/l1-spider`, `/l3-spider`, `/fdc_trend`

위 라우트는 Mock 프런트엔드에서 HTTP 200 HTML 문서를 반환했다. 이는 SPA 문서 제공 확인이며 화면 렌더링 확인이 아니다.

### 브라우저에서 검수한 흐름

없음. Chromium이 첫 페이지 생성 전에 종료됐다.

## 확인된 문제

확인된 애플리케이션 문제는 없다. 브라우저에 도달하지 못했으므로 “문제 없음”으로 판정하지 않는다.

## 잠재 위험

브라우저 관찰 없이 애플리케이션 위험을 추정하지 않았다. 특히 데이터 불일치, stale 응답, 오류의 빈 데이터 변환은 전부 미판정이다.

## 재현 불가 항목

앱 동작을 재현 시도할 단계까지 도달하지 못했다. Playwright 환경 실패는 1회 실행에서 동일하게 모든 브라우저 검수를 차단했으며 앱 결함으로 분류하지 않았다.

## 실행하지 못한 검수

- 앱 최초 진입과 기본 대시보드 렌더링
- 주요 메뉴 이동
- 라인·등급·설비·센서 등 실제 존재 필터
- 검색과 정렬
- 차트 렌더링과 툴팁
- 목록에서 상세 화면 진입
- 새로고침, 뒤로 가기, 앞으로 가기
- 직접 URL의 실제 React 렌더링
- 긴 텍스트, 빈 데이터, 일부 필드 누락
- 빠른 연속 클릭과 빠른 필터 변경
- 오류 발생 후 정상 시나리오 복구
- 세 데스크톱 해상도의 레이아웃
- 키보드 조작, focus, label, 대체 텍스트
- 브라우저 console error, page error, failed request
- 문제별 3회 이상 브라우저 재현

## 실행 실패 및 제한사항

- 최초 `npm run test:e2e`: sandbox 내부 loopback bind가 허용되지 않아 Mock API 시작 시 `EPERM`으로 실패. 승인된 실행으로 재시도했다.
- 승인 후 `npm run test:e2e`: Mock 서버와 프런트엔드는 시작됐으나 첫 테스트에서 Chromium이 `libnspr4.so`를 찾지 못해 페이지 생성 전 종료. 1개 실패, 5개 미실행.
- 저장소의 `.playwright-libs/`에 사용할 수 있는 공유 라이브러리 디렉터리가 없었다.
- 설치된 Chromium에는 `libnspr4.so`, `libnss3.so`, `libnssutil3.so`, `libsmime3.so`, `libasound.so.2`가 필요하지만 현재 환경에서 확인되지 않았다.
- 사용자 지침상 의존성 설치·업데이트가 금지되어 설치하지 않았다.

## Mock 환경의 한계

- Mock 계약은 프런트엔드가 관찰하는 필드만 포함하며 실제 백엔드 구현을 나타내지 않는다.
- mutation 응답은 합성 확인만 하고 상태를 영속화하지 않는다.
- `large`는 고정 seed 합성 데이터이며 운영 용량 모델이 아니다.
- 이번 실행에서는 Mock 시나리오 자체가 지원됨을 확인했지만 사용자 화면 표현은 확인하지 못했다.

## 생성된 artifact 목록

- `artifacts/browser-qa/2026-07-30_1307/console/playwright-launch-failure.md`
- `artifacts/browser-qa/2026-07-30_1307/network/mock-scenario-readiness.md`
- 기존 Playwright 설정이 자동 생성·갱신한 실행 산출물: `playwright-report/`, `test-results/`
- 스크린샷: 없음
- 브라우저 trace: 없음(페이지 생성 전 실패)
- 브라우저 console/page error/failed request: 없음(브라우저 미실행)

`playwright-report/`와 `test-results/`는 작업 시작 지침에서 애플리케이션 코드 변경으로 보지 않는 경로이며, 기존 산출물을 삭제하거나 되돌리지 않았다. 역할별 핵심 근거는 지정된 `artifacts/browser-qa/2026-07-30_1307/` 아래에 별도로 요약했다.

## 다음 에이전트와 연계할 항목

- 환경 관리자: 현재 Playwright `1.61.1` 및 Chromium `149.0.7827.55`와 호환되는 호스트 공유 라이브러리를 사용자 승인 절차로 준비할 필요가 있다.
- Code Audit Agent: 이번 실행은 브라우저 증거를 만들지 못했으므로 앱 결함 연계 항목이 없다.
- Performance Agent: 브라우저 측정이 없으므로 성능 연계 항목이 없다.

## main 개발용 Codex에 전달할 우선 수정 목록

애플리케이션 수정 요청 없음. 이번 결과만 근거로 `main` 코드를 변경하면 안 된다.

우선 조치는 QA 환경에서 Chromium 실행 의존성을 별도로 준비한 뒤 같은 branch와 commit, 같은 16개 시나리오, 세 데스크톱 viewport로 Browser QA 전체를 다시 수행하는 것이다.

## 수정 후 검증 기준

환경 준비 후 다음 조건을 모두 만족해야 이번 검수를 대체할 수 있다.

1. Chromium이 페이지를 실제로 생성하고 `normal` 기준선의 주요 라우트를 렌더링한다.
2. 16개 시나리오를 각각 reset 후 브라우저에서 확인한다.
3. 지정된 세 데스크톱 viewport에서 핵심 흐름을 수행한다.
4. console, page error, failed request와 사용자 영향을 수집한다.
5. 발견 문제를 동일 조건에서 원칙상 3회 재현한다.
6. 종료 후 서버·브라우저 프로세스와 포트가 반환된다.

## 변경 보호 확인

- 종료한 실행 프로세스: `npm run test:e2e`가 시작한 WebServer 프로세스, 수동 `npm run mock`의 Mock API 및 Vite 프런트엔드
- 포트 반환: 확인
- 브라우저 프로세스 종료: 확인
- 보고서·아티팩트 외 변경 발생 여부: `git status --short`에서 새 `reports/browser-qa/`와 `artifacts/browser-qa/` 산출물만 확인. 기존 Playwright runner 경로인 `playwright-report/`, `test-results/`는 자동 갱신됨
- `git diff --name-only`: 출력 없음
- 애플리케이션 소스 수정 없음 확인: 확인
- 테스트·설정·의존성 수정 없음 확인: 확인

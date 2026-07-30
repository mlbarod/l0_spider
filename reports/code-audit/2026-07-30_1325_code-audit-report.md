# Defect, Data Integrity & Code Reliability 감사 보고서

## 실행 개요

- 보고서 작성 시각: 2026-07-30 13:25:48 KST
- 브랜치: `agent/code-audit`
- 기준 브랜치: `mock-agent`
- 기준 commit: `c8e9ee9 Add read-only multi-agent review environment`
- 감사자: Agent 2 — Defect, Data Integrity & Code Reliability
- 검토 범위: 프런트엔드 API client, React Query queryKey·placeholder·오류 상태, 대시보드·자설비·공통부·동일성 데이터 흐름, 서버 숫자·날짜 변환, Mock 계약·시나리오, 오류 응답 정보 노출, 테스트 공백
- 실행한 테스트: `npm run lint`, `npm run test:unit`, `npm run test:contract`
- 사용한 Mock 시나리오: `normal`, `empty`, `partial`, `race-condition`, `inconsistent`, `edge-values`, 오류·timeout 계약 동작
- 제외 또는 미검토 범위: 브라우저 E2E 사용자 재현, 픽셀·디자인·일반 UX, 성능 측정·튜닝, 실제 백엔드·운영 데이터
- 시작 상태: 애플리케이션 코드 미커밋 변경 없음
- 데이터 보호: 합성 Mock 식별자만 사용했으며 실제 내부 주소·식별자·데이터·비밀은 기록하지 않음

## 결과 요약

- Critical: 2
- High: 5
- Medium: 2
- Low: 0
- 확인됨: 6
- 잠재 위험: 3
- 재현 불가: 0
- 추가 확인 필요: 0

핵심 질문에 대한 답은 **예**다. 응답 범위와 합계의 교차 검증이 없어 다른 라인의 데이터와 모순된 합계를 그대로 표시할 수 있다. 잘못된 숫자와 날짜를 정상값으로 바꾸는 경로, 성공 응답의 스키마 오류를 정상 빈 결과로 바꾸는 경로, 필터 변경 중 이전 라인 데이터를 유지하는 경로도 확인됐다.

## 데이터 정합성 우선 확인 결과

| 우선 위험 | 확인 범위 | 결과 | 근거 또는 제한 |
|---|---|---|---|
| 다른 범위 데이터 표시 | 대시보드·자설비 | 확인됨 / Critical | `inconsistent`에서 요청 외 합성 라인이 응답에 포함되고 프런트가 차단하지 않음 |
| stale response가 최신 상태를 덮음 | React Query key·placeholder·signal | 확인됨 / High | queryKey 분리는 되어 있으나 대시보드가 새 필터 요청 중 이전 필터 데이터를 명시적으로 표시 |
| API 실패가 빈 데이터로 표시됨 | 목록·필터 API client | 확인됨 / High | 성공 상태 스키마 불일치를 `[]` 또는 `{}`로 정상 처리 |
| 합계와 상세 불일치 | 대시보드 | 확인됨 / Critical | 합성 요약 105, 상세 합 15를 별도 렌더링하며 교차 검증 없음 |
| 날짜 기준 불일치 | scatter payload | 확인됨 / High | 범위를 벗어난 날짜가 `Date.UTC`로 정상화되어 유효 포인트로 채택 |
| 잘못된 정상·이상 판단 유도 | 숫자·날짜·합계 | 확인됨 / High | 변환 불가 센서 합계를 0으로 표시하고 잘못된 날짜를 최근 구간 계산에 포함 가능 |
| 화면 중단·작업 유실·민감정보 | Error Boundary·debug 오류 응답 | 잠재 위험 / Medium | 전역 Error Boundary 부재와 debug 세부정보 렌더링 경로 확인, 실제 데이터 재현은 금지 |

## DCR-001 요청 범위를 벗어난 라인 데이터가 그대로 표시됨

- 상태: 확인됨
- 심각도: Critical
- 신뢰도: 높음
- 분류: 데이터 범위 혼합
- 대상 화면 또는 기능: 메인 대시보드, 자설비 이상감지
- 관련 파일: `mock/generators/synthetic-data.mjs:140-148,256-260`, `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:331-340,435-533`, `src/features/fdc-trend/pages/FdcTrendPage.jsx:1516-1567,1611-1629`, `src/features/fdc-trend/api/selfEquipmentApi.js:3-29`
- 관련 API: `GET /api/dashboard-data`, `GET /api/self-equipment-data`
- 연관 에이전트: Browser QA Agent
- 연관 사유: 브라우저에서 빠른 라인 선택과 혼합 행의 실제 표시 상태를 별도 확인할 필요가 있음
- 최초 발견 시나리오: `inconsistent`
- 재현 횟수: 1 / 1

### 문제 요약

요청한 라인과 응답의 `lineSummary[].lineId` 또는 `rows[].line_rev`가 일치하는지 프런트엔드가 검증하지 않는다. 합성 `inconsistent` 응답은 의도적으로 다른 라인을 포함하며 해당 행이 그대로 차트 데이터가 된다.

### 사용자 또는 시스템 영향

사용자가 선택하지 않은 라인·설비 범위의 이상 데이터를 선택 범위의 결과로 오인할 수 있다. 최우선 데이터 정합성 위반이다.

### 재현 절차

1. 합성 `inconsistent` 대시보드를 `LINE_A` 조건으로 생성한다.
2. 합성 자설비 필터 응답도 같은 라인 조건으로 생성한다.
3. 요청 라인과 응답 행의 고유 라인을 비교하고 프런트 렌더링 경로의 재검증 여부를 확인한다.

### 기대 결과

응답에 요청 범위 밖의 라인이 하나라도 있으면 오류 또는 명시적 정합성 경고로 처리하고 해당 데이터를 표시하지 않아야 한다.

### 실제 결과

대시보드 응답에는 `LINE_C`, 자설비 응답 행에는 `LINE_B`와 `LINE_C`가 추가로 존재했다. 프런트엔드는 응답 배열을 그대로 렌더링·그룹화한다.

### 수집된 근거

- 관련 코드 위치: 위 관련 파일 참조
- 테스트 출력: `artifacts/code-audit/evidence/2026-07-30_code-audit-evidence.md`
- network·스크린샷·trace: 브라우저 E2E 미실행

### 원인 분석

- 확인된 코드 사실: 클라이언트는 요청 파라미터를 만들지만 응답 범위 검증을 수행하지 않는다.
- 실행으로 확인된 사실: 요청 `LINE_A`와 다른 합성 라인 행이 결과에 포함됐다.
- 추정 원인: 서버 계약을 전적으로 신뢰하고 프런트엔드 경계 검증을 생략한 구조다.
- 실제 운영에서 추가 확인할 사항: 서비스 API가 혼합 범위를 절대 반환하지 않는다는 보장과 관측·알림 여부.

### 권장 수정 방향

API 경계에서 응답의 라인·SDWT·설비·센서·등급이 요청 조건에 포함되는지 검증하고, 불일치는 성공 데이터에서 제거하지 말고 명시적 오류로 처리한다.

### 수정 후 검증 기준

`inconsistent`에서 다른 라인 행이 화면에 표시되지 않고 정합성 오류가 표시되며, `normal`의 선택 라인 결과는 유지되어야 한다.

## DCR-002 요약과 상세 합계 불일치를 검증 없이 동시에 표시함

- 상태: 확인됨
- 심각도: Critical
- 신뢰도: 높음
- 분류: 합계 정합성
- 대상 화면 또는 기능: 메인 대시보드
- 관련 파일: `src/features/fdc-trend/api/dashboardApi.js:19-31`, `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:435-533`, `mock/generators/synthetic-data.mjs:148-165,227-246`
- 관련 API: `GET /api/dashboard-data`
- 연관 에이전트: Browser QA Agent
- 연관 사유: KPI와 차트가 모순될 때 사용자에게 보이는 상태 확인
- 최초 발견 시나리오: `inconsistent`
- 재현 횟수: 1 / 1

### 문제 요약

대시보드 client는 필수 배열 존재만 확인하고 `summary.totalAbnormalCount`와 `lineSummary[].totalCount` 합계를 비교하지 않는다. 화면도 KPI와 라인 차트를 독립적으로 렌더링한다.

### 사용자 또는 시스템 영향

같은 조회 조건에서 전체 이상 건수와 라인별 합계가 다르게 보이며, 이상 규모와 우선 대응 라인 판단을 잘못 유도한다.

### 재현 절차

1. `inconsistent` 대시보드를 생성한다.
2. `summary.totalAbnormalCount`와 `lineSummary`의 합을 계산한다.
3. client 검증과 렌더링 분기를 확인한다.

### 기대 결과

요약과 상세 합계가 불일치하면 데이터 표시를 중단하거나 명시적 정합성 오류를 보여야 한다.

### 실제 결과

합성 응답의 요약은 105, 라인 상세 합은 15였지만 둘 다 정상 렌더링 경로에 들어간다. `partial`도 요약은 양수인데 상세 배열은 비어 있는 형태를 계약 테스트가 허용한다.

### 수집된 근거

- 관련 코드 위치: 위 관련 파일 참조
- 테스트 출력: `artifacts/code-audit/evidence/2026-07-30_code-audit-evidence.md`

### 원인 분석

- 확인된 코드 사실: 형태 검증은 있으나 합계·라인 집합·등급 부분합 검증이 없다.
- 실행으로 확인된 사실: 요약과 상세 합계가 90건 차이 났다.
- 추정 원인: 응답 스키마 검증과 비즈니스 불변식 검증이 분리되지 않았다.
- 실제 운영에서 추가 확인할 사항: 각 KPI의 중복 제거 기준이 모두 동일한지와 허용 가능한 차이의 정의.

### 권장 수정 방향

중복 제거 기준을 계약에 명시하고, 전체·라인·등급·메일링 상세 사이의 불변식을 API 경계에서 검증한다. 기준이 다르면 화면에 기준과 차이를 명시한다.

### 수정 후 검증 기준

`inconsistent`와 `partial`에서 모순된 KPI·차트가 정상 표시되지 않아야 하며, `normal`에서는 각 합계가 정의된 기준으로 일치해야 한다.

## DCR-003 달력상 잘못된 날짜가 정상 시각으로 변환됨

- 상태: 확인됨
- 심각도: High
- 신뢰도: 높음
- 분류: 날짜 파싱·정렬
- 대상 화면 또는 기능: 자설비·공통부 scatter 및 동일성 차트
- 관련 파일: `server/selfEquipmentData.mjs:558-573,598-623,662-680`, `server/commonAnomalyData.mjs:113-142,452-492`
- 관련 API: `GET /api/erd-scatter-data`, `GET /api/common-anomaly-scatter-data`
- 연관 에이전트: Browser QA Agent
- 연관 사유: 잘못된 포인트가 실제 시간축과 최근 구간에 표시되는지 확인
- 최초 발견 시나리오: `edge-values` 확장 직접 재현
- 재현 횟수: 1 / 1

### 문제 요약

정규식은 숫자 자리만 확인하고 달·일·시·분·초 범위를 확인하지 않는다. 이후 `Date.UTC`가 범위를 넘는 값을 다른 정상 날짜로 자동 보정한다.

### 사용자 또는 시스템 영향

잘못된 시각이 정상 포인트로 정렬되고 “최근” 구간 및 기간 필터의 기준이 될 수 있어 추세 판단을 왜곡한다.

### 재현 절차

1. 달력 및 시간 범위를 벗어난 합성 날짜 문자열을 두 scatter payload 생성 함수에 전달한다.
2. 반환 포인트 수와 invalid-date 진단 수를 확인한다.
3. 생성된 epoch 값이 유효 숫자인지 확인한다.

### 기대 결과

잘못된 날짜는 포인트에서 제외되고 진단 건수가 증가하거나 요청 전체가 명시적으로 실패해야 한다.

### 실제 결과

두 생성기 모두 포인트 1건을 반환했고 공통부 invalid-date 진단은 0이었다.

### 원인 분석

- 확인된 코드 사실: 날짜 구성요소 재검증과 정규식 끝 경계가 없다.
- 실행으로 확인된 사실: 잘못된 합성 날짜가 유효 epoch 값으로 변환됐다.
- 추정 원인: `Date.UTC`가 입력 유효성 검사도 수행한다고 가정한 것으로 보인다.
- 실제 운영에서 추가 확인할 사항: 원천 데이터의 날짜 타입과 허용 시간대.

### 권장 수정 방향

구성요소 범위와 변환 후 역검증을 수행하고, 전체 문자열 일치를 강제한다. 실패는 제외 건수와 이유로 노출한다.

### 수정 후 검증 기준

잘못된 월·일·시간, 잘린 날짜, 뒤에 쓰레기 문자가 붙은 날짜가 포인트에서 제외되고 진단 값에 반영되어야 한다.

## DCR-004 HTTP 성공 응답의 스키마 불일치를 정상 빈 결과로 처리함

- 상태: 확인됨
- 심각도: High
- 신뢰도: 높음
- 분류: API 계약·오류 은폐
- 대상 화면 또는 기능: My EQP 등록 목록, Mailing 등록 목록, 자설비·공통부 필터 및 차트
- 관련 파일: `src/features/fdc-trend/api/myEqpRegistrationApi.js:29-40`, `src/features/fdc-trend/api/mailingRegistrationApi.js:49-59`, `src/features/fdc-trend/api/selfEquipmentApi.js:3-29`, `src/features/fdc-trend/pages/FdcTrendPage.jsx:1569-1576,1611-1616`, `src/features/fdc-trend/pages/MailingRegistrationPage.jsx:269-280,620-624`
- 관련 API: `GET /api/my-eqp-registration`, `GET /api/mailing-registration`, `GET /api/self-equipment-data`
- 연관 에이전트: Browser QA Agent
- 연관 사유: 스키마 오류가 실제 “0건” 문구로 보이는지 확인
- 최초 발견 시나리오: 성공 상태 빈 객체 직접 주입
- 재현 횟수: 1 / 1

### 문제 요약

HTTP가 성공이면 필수 필드 누락을 오류로 처리하지 않는다. 두 목록 API는 누락된 `registrations`를 `[]`로 바꾸며, 자설비 API는 빈 객체를 반환한 뒤 화면이 여러 필드를 빈 배열로 바꾼다.

### 사용자 또는 시스템 영향

API 배포 불일치·부분 응답·파싱 결함이 “등록 없음” 또는 “표시할 데이터 없음”으로 오인되어 장애 탐지가 늦어진다.

### 재현 절차

1. HTTP 성공과 빈 JSON 객체를 반환하는 합성 `fetch`를 주입한다.
2. 각 API client 함수를 호출한다.
3. 반환값과 화면의 빈 결과 분기를 확인한다.

### 기대 결과

필수 필드가 없거나 타입이 다르면 스키마 오류를 발생시키고 정상 빈 결과와 분리해야 한다.

### 실제 결과

My EQP와 Mailing은 빈 배열, 자설비는 빈 객체를 정상 반환했다.

### 원인 분석

- 확인된 코드 사실: 대시보드·매핑 일부를 제외하면 런타임 응답 검증이 거의 없다.
- 실행으로 확인된 사실: 세 API client가 예외 없이 정상 반환했다.
- 추정 원인: HTTP 상태 검사를 응답 계약 검증으로 간주했다.
- 실제 운영에서 추가 확인할 사항: 점진 배포 중 구·신 응답이 섞일 가능성.

### 권장 수정 방향

프런트엔드가 실제 사용하는 필드에 한정해 런타임 스키마를 검증하고, 정상 빈 배열과 스키마 불일치를 다른 상태로 처리한다.

### 수정 후 검증 기준

빈 객체·필수 배열 누락·중첩 필드 타입 오류가 사용자에게 명시적 데이터 형식 오류로 표시되어야 한다.

## DCR-005 숫자 변환 실패를 모니터링 센서 0개로 표시함

- 상태: 확인됨
- 심각도: High
- 신뢰도: 높음
- 분류: 숫자 변환·판단 불가능 은폐
- 대상 화면 또는 기능: 메인 대시보드 모니터링 센서 총합
- 관련 파일: `server/dashboardData.mjs:48-55,289-296,507-522`, `server/dashboardData.test.mjs:69-76`, `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:482-488`
- 관련 API: `GET /api/dashboard-data`
- 연관 에이전트: Browser QA Agent
- 연관 사유: 0과 집계 불가능 상태의 화면 구분 확인
- 최초 발견 시나리오: 기존 unit test 및 정적 코드 경로
- 재현 횟수: 1 / 1

### 문제 요약

`normalizeNumber`는 `null`, 빈 값뿐 아니라 숫자로 변환할 수 없는 값도 모두 0으로 반환한다. 기존 테스트도 이 동작을 기대값으로 고정한다.

### 사용자 또는 시스템 영향

집계 불가능 상태가 실제 센서 0개로 표시되어 모니터링 공백을 정상 상태로 오인할 수 있다.

### 재현 절차

1. 숫자로 변환할 수 없는 합성 TL total을 `buildDashboardSummary`에 전달한다.
2. 반환된 `monitoringSensorTotal`을 확인한다.
3. 화면의 KPI 렌더링을 확인한다.

### 기대 결과

변환 실패는 오류·누락 진단으로 분리하고, 정상적인 숫자 0과 구분해야 한다.

### 실제 결과

변환 실패 값은 0에 합산되며 기존 unit test도 최종 합계 0을 기대한다.

### 원인 분석

- 확인된 코드 사실: 모든 비유한 숫자를 0으로 치환한다.
- 실행으로 확인된 사실: unit test 21개 통과에 이 동작이 포함돼 있다.
- 추정 원인: 집계 편의를 위해 결측·오류·실제 0을 하나로 합쳤다.
- 실제 운영에서 추가 확인할 사항: 원천 컬럼의 null 허용 여부와 숫자 문자열 규격.

### 권장 수정 방향

정상 0, 결측, 변환 실패를 분리하고 변환 실패 건수와 원본 행 위치를 진단에 포함한다.

### 수정 후 검증 기준

실제 0은 0으로 집계되되 잘못된 문자열은 오류 또는 “집계 불가”로 표시되고 테스트가 이를 구분해야 한다.

## DCR-006 새 라인 조회 중 이전 라인 데이터를 계속 표시함

- 상태: 확인됨
- 심각도: High
- 신뢰도: 높음
- 분류: 비동기·stale 표시
- 대상 화면 또는 기능: 메인 대시보드 라인 필터와 추이 기간
- 관련 파일: `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:326-364,390-412,435-480`
- 관련 API: `GET /api/dashboard-data`
- 연관 에이전트: Browser QA Agent
- 연관 사유: `race-condition`에서 로딩 중·실패 후 이전 데이터의 실제 표시 시간 확인
- 최초 발견 시나리오: `race-condition` 코드 경로
- 재현 횟수: 결정적 코드 경로 1 / 1

### 문제 요약

라인 필터가 queryKey에 포함되어 캐시 자체는 분리되지만 `placeholderData: previousData`가 다른 라인 쿼리에도 이전 응답을 전달한다. 화면은 로딩 중에도 KPI·차트를 계속 렌더링한다.

### 사용자 또는 시스템 영향

새 라인 선택 직후 또는 느린 요청 동안 현재 필터와 다른 라인의 수치가 보인다. 요청 실패 시에는 오류와 이전 데이터가 동시에 남는다.

### 재현 절차

1. 첫 라인 결과가 있는 상태에서 다른 라인을 조회한다.
2. 두 번째 요청이 진행되는 동안 `dashboardQuery.data`와 렌더링 분기를 추적한다.
3. 두 번째 요청 실패 경로도 확인한다.

### 기대 결과

범위가 바뀌면 이전 범위 데이터는 숨기거나 명확히 “이전 조회 결과”로 격리해야 한다.

### 실제 결과

버튼의 spinner와 `aria-busy`만 바뀌고 이전 KPI·차트·표는 계속 렌더링된다.

### 원인 분석

- 확인된 코드 사실: placeholder 함수가 queryKey 범위를 비교하지 않고 이전 데이터를 항상 반환한다.
- 실행으로 확인된 사실: React Query 설정과 렌더링 분기상 이전 데이터 유지가 필연적이다.
- 추정 원인: 레이아웃 깜빡임을 줄이기 위한 설정이 범위 정합성을 침해했다.
- 실제 운영에서 추가 확인할 사항: 사용자 평균 요청 지연과 실패 빈도.

### 권장 수정 방향

같은 범위의 refetch에서만 이전 데이터를 유지하고 라인·기간이 달라지면 placeholder를 비운다. 화면에는 적용된 응답 필터를 함께 표시한다.

### 수정 후 검증 기준

`race-condition`에서 새 라인 선택 직후 이전 라인 값이 표시되지 않고, 실패 시 오류만 남아야 한다.

## DCR-007 숫자 문자열을 차트 domain 계산에서 제외함

- 상태: 잠재 위험
- 심각도: Medium
- 신뢰도: 중간
- 분류: 타입 경계·차트 정합성
- 대상 화면 또는 기능: scatter 및 동일성 차트
- 관련 파일: `docs/mock-api-inventory.md`의 Chart points 계약, `src/features/fdc-trend/pages/FdcTrendPage.jsx:313-329,462-469,1128-1134`
- 관련 API: `GET /api/erd-scatter-data`, `GET /api/common-anomaly-scatter-data`
- 연관 에이전트: Browser QA Agent
- 연관 사유: 숫자 문자열만 있는 응답에서 실제 점 누락·축 범위 확인
- 최초 발견 시나리오: `edge-values` 정적 분석
- 재현 횟수: 브라우저 재현 0 / 0

### 문제 요약

관찰 계약은 `value:number|string`을 허용하지만 `numericDomain`은 변환 없이 `Number.isFinite(value)`를 검사해 숫자 문자열을 제외한다.

### 사용자 또는 시스템 영향

숫자 문자열 비중이 높으면 축이 `[0,1]` fallback으로 계산되어 정상 포인트가 보이지 않거나 잘못된 축으로 표시될 수 있다.

### 원인 분석

- 확인된 코드 사실: tooltip은 `Number(value)`로 변환하지만 domain 계산은 변환하지 않아 처리 기준이 다르다.
- 추정: 실제 차트 라이브러리의 문자열 coercion과 원천 응답 비율에 따라 사용자 영향이 달라진다.
- 도달 조건 또는 미확인 계약: 실제 서비스가 숫자 문자열을 반환하는 빈도.

### 권장 수정 방향

API 경계에서 유한 숫자로 정규화하고 실패를 진단한다. 차트 내부의 변환 기준도 하나로 통일한다.

### 수정 후 검증 기준

숫자·숫자 문자열 혼합 및 숫자 문자열만 있는 데이터에서 동일한 domain과 포인트 수가 나와야 한다.

## DCR-008 저장 실패 응답의 debug 데이터와 DB 세부 오류를 화면에 표시함

- 상태: 잠재 위험
- 심각도: Medium
- 신뢰도: 중간
- 분류: 민감정보·내부 구현 노출
- 대상 화면 또는 기능: My EQP 등록, Mailing 등록
- 관련 파일: `server/myEqpRegistration.mjs:248-300`, `server/mailingRegistration.mjs:166-216`, `src/features/fdc-trend/api/myEqpRegistrationApi.js:20-24`, `src/features/fdc-trend/api/mailingRegistrationApi.js:21-27`, `src/features/fdc-trend/pages/MyEqpRegistrationPage.jsx:344-351,893-923`, `src/features/fdc-trend/pages/MailingRegistrationPage.jsx:313-321,777-803`
- 관련 API: `POST /api/my-eqp-registration`, `POST /api/mailing-registration`
- 연관 에이전트: 없음
- 연관 사유: 코드 감사 범위의 정보 노출
- 최초 발견 시나리오: 오류 처리 정적 분석
- 재현 횟수: 실제 데이터 재현 금지로 0 / 0

### 문제 요약

서버는 실패 시 저장 예정 행과 DB 오류 세부정보를 응답하고, 프런트엔드는 이를 dialog에 렌더링한다. 경로 문자열 일부만 정제하며 사용자·설비·기준정보 유형의 필드는 그대로 표시될 수 있다.

### 사용자 또는 시스템 영향

오류 화면을 볼 수 있는 사용자의 권한 범위에 따라 내부 테이블 구조, 사용자 식별자 유형, 설비·기준정보 유형이 필요 이상으로 노출될 수 있다.

### 원인 분석

- 확인된 코드 사실: debug payload 생성·응답·렌더링 경로가 연결돼 있다.
- 추정: 접근 통제와 실제 필드 민감도에 따라 보안 영향이 달라진다.
- 도달 조건 또는 미확인 계약: 오류 응답 접근 권한, 운영에서 debug 필드 활성 여부.

### 권장 수정 방향

운영 응답에서 debug 행과 DB 세부 오류를 제거하고 correlation ID만 제공한다. 상세 진단은 접근 통제된 서버 로그에 최소 필드로 남긴다.

### 수정 후 검증 기준

500 응답과 UI에 내부 테이블·DB 세부정보·식별자 유형의 원문이 포함되지 않아야 한다.

## DCR-009 매핑 API 실패 후 내장 fallback으로 데이터 조회를 계속함

- 상태: 잠재 위험
- 심각도: High
- 신뢰도: 중간
- 분류: 부분 실패·범위 정합성
- 대상 화면 또는 기능: 동일성, 공통부, 자설비, 등록 화면의 라인·SDWT 선택
- 관련 파일: `src/features/fdc-trend/pages/CommonalityAnomalyPage.jsx:214-253`, `src/features/fdc-trend/pages/CommonAnomalyPage.jsx:294-342`, `src/features/fdc-trend/pages/FdcTrendPage.jsx:1478-1512`, `src/features/fdc-trend/pages/MyEqpRegistrationPage.jsx:325-368`
- 관련 API: `GET /api/mapping-config` 및 후속 데이터 API
- 연관 에이전트: Browser QA Agent
- 연관 사유: `mapping-config`만 실패한 상태에서 후속 조회와 표시 범위를 확인
- 최초 발견 시나리오: 일부 API 실패 정적 분석
- 재현 횟수: 브라우저 재현 0 / 0

### 문제 요약

매핑 쿼리가 실패해도 페이지는 내장 매핑 fallback으로 라인·SDWT 옵션을 만들고 후속 데이터 쿼리를 활성화한다. 오류 문구는 표시하지만 데이터 표시를 차단하지 않는다.

### 사용자 또는 시스템 영향

내장 매핑이 최신 기준정보와 다르면 잘못된 SDWT·라인 조합으로 데이터를 조회하거나 현재 기준과 다른 범위를 표시할 수 있다.

### 원인 분석

- 확인된 코드 사실: `mappingQuery.data`가 없으면 fallback을 사용하며 후속 `enabled`는 fallback에서 만든 값으로 참이 된다.
- 추정: fallback과 서비스 매핑이 항상 동일하다는 보장이 없으면 범위 오염이 발생한다.
- 도달 조건 또는 미확인 계약: 내장 매핑의 갱신 정책과 서비스 매핑과의 동일성 보장.

### 권장 수정 방향

기준정보 API 실패 시 후속 데이터 조회를 중단하고, fallback 사용이 제품 요구라면 버전·동일성 검증과 명확한 제한 모드를 제공한다.

### 수정 후 검증 기준

매핑 API만 실패한 시나리오에서 후속 데이터 요청과 정상 결과 렌더링이 발생하지 않아야 한다.

## 확인된 오류

- DCR-001 요청 범위를 벗어난 라인 데이터 표시
- DCR-002 요약·상세 합계 불일치 표시
- DCR-003 잘못된 날짜 정상화
- DCR-004 성공 응답 스키마 불일치의 빈 결과 처리
- DCR-005 숫자 변환 실패의 0 치환
- DCR-006 필터 변경 중 이전 라인 데이터 표시

## 잠재 위험

- DCR-007 숫자 문자열과 차트 domain 처리 불일치
- DCR-008 오류 debug 데이터·DB 세부정보 노출
- DCR-009 매핑 API 실패 후 fallback 데이터 조회 지속

## 추가 확인 필요 항목

- 독립 문제로 분류한 항목 없음.
- 운영 계약 확인이 필요한 조건은 각 잠재 위험의 “도달 조건 또는 미확인 계약”에 기록했다.

## 재현 불가 항목

- 재현을 시도하고 실패한 독립 항목은 없음.
- 브라우저 E2E는 허용 경로 밖 산출물 생성 제한 때문에 시도하지 않았으며 “미실행 검사”로 분리했다.

## 데이터 정합성 위험 요약

1. 응답이 요청 범위를 위반해도 라인·SDWT·설비·센서 기준을 재검증하지 않는다.
2. 요약·상세·등급 합계의 불변식이 없어 모순된 수치가 정상 표시된다.
3. 숫자·날짜 변환 실패를 0 또는 정상 시각으로 바꾸어 판단 불가능 상태를 숨긴다.
4. 기준정보 API가 실패해도 fallback을 이용해 후속 조회를 계속할 수 있다.

## API 계약 위험 요약

- 대시보드 일부를 제외하면 HTTP 성공 응답의 필수 필드와 중첩 타입을 검증하지 않는다.
- 정상 빈 배열과 스키마 누락이 같은 UI 결과로 합쳐진다.
- 계약 테스트는 Mock이 의도한 형태를 반환하는지만 검증하고 프런트엔드의 거부 동작은 검증하지 않는다.

## 비동기·캐시 위험 요약

- 주요 데이터 queryKey에는 현재 필터가 대체로 포함되어 있어 다른 key의 늦은 응답이 현재 cache를 직접 덮는 경로는 확인하지 못했다.
- 대시보드는 범위가 달라져도 `placeholderData`로 이전 결과를 유지해 stale 데이터를 현재 선택과 함께 표시한다.
- dashboard와 identity 요청은 signal을 전달하지만 주요 필터 API는 signal을 받지 않는다. queryKey 분리로 현재 observer 덮어쓰기는 방지되나 불필요 요청과 side-effect 경로는 남는다.

## 테스트 공백

- 성공 상태의 필수 필드 누락·잘못된 중첩 타입을 client가 거부하는 테스트
- 요청 라인·SDWT·설비·센서와 응답 행 범위가 일치하는지 검증하는 테스트
- 요약·상세·등급 합계 불변식 테스트
- 잘못된 월·일·시간 및 뒤 문자가 붙은 날짜 테스트
- 라인 변경 중 placeholder와 요청 실패 후 stale 데이터 브라우저 테스트
- 숫자 문자열만 있는 차트 domain 테스트
- 매핑 API만 실패한 부분 실패 테스트
- 렌더링 예외를 격리할 전역 route Error Boundary 테스트

## 민감정보 검토 결과

- 토큰·credential을 저장하거나 출력하는 프런트 경로는 확인하지 못했다.
- 테마 설정 외 업무 데이터를 localStorage/sessionStorage에 저장하는 경로는 확인하지 못했다.
- DCR-008의 debug 오류 응답 렌더링은 잠재 노출 위험이다.
- 실제 민감값은 읽거나 보고서·아티팩트에 복사하지 않았다.

## 다른 에이전트로 넘길 항목

- Browser QA Agent: DCR-001, DCR-002, DCR-003, DCR-004, DCR-005, DCR-006, DCR-007, DCR-009의 실제 화면 상태와 오류·로딩 문구 재현
- Performance Agent: 전달 항목 없음. 이번 감사에서 데이터 누락을 야기하는 측정 가능한 성능 병목은 별도로 확인하지 않았다.

## main 개발용 Codex 우선 수정 목록

1. DCR-001: 요청·응답 범위 검증과 혼합 데이터 차단
2. DCR-002: 요약·상세·등급 합계 불변식 검증
3. DCR-003: 날짜 파서의 전체 문자열·달력 구성요소 역검증
4. DCR-005: 숫자 0·결측·변환 실패 분리
5. DCR-004: 프런트엔드 관찰 계약의 런타임 스키마 검증
6. DCR-006: 필터 범위 변경 시 placeholder 제거
7. DCR-009: 매핑 실패 시 후속 데이터 조회 차단
8. DCR-008: 운영 오류 응답의 debug 세부정보 제거
9. DCR-007: 숫자 문자열 정규화 기준 통일

## 테스트 및 명령 결과

| 명령 | 성공/실패/미실행 | 핵심 결과 | 증거 경로 |
|---|---|---|---|
| `pwd`, `git branch --show-current`, `git status --short`, `git log -1 --oneline` | 성공 | 경로·브랜치 일치, 시작 변경 없음 | 본 보고서 실행 개요 |
| `rg --files`, `find`, `sed`, `nl`, `rg -n` 정적 감사 | 성공 | API·queryKey·변환·오류·리소스 경로 조사 | `artifacts/code-audit/evidence/2026-07-30_code-audit-evidence.md` |
| `git diff --stat mock-agent...HEAD` | 성공 | 기준 브랜치와 감사 브랜치 차이 없음 | 본 보고서 실행 개요 |
| `npm run lint` | 성공 | 오류 없음 | `artifacts/code-audit/test-output/2026-07-30_test-summary.md` |
| `npm run test:unit` | 성공 | 21 / 21 통과 | 같은 경로 |
| `npm run test:contract` 최초 실행 | 환경 실패 | 샌드박스 loopback bind 제한 | 같은 경로 |
| `node tests/contract/mock-api.test.mjs` | 환경 실패 | `EPERM` 원인 확인 | 같은 경로 |
| 승인된 샌드박스 외 `npm run test:contract` | 성공 | 39 / 39 통과 | 같은 경로 |
| 합성 `inconsistent` 직접 생성·비교 | 성공 | 혼합 라인과 합계 불일치 확인 | `artifacts/code-audit/evidence/2026-07-30_code-audit-evidence.md` |
| 성공 상태 빈 객체 직접 주입 | 성공 | 빈 배열·빈 객체 정상 반환 확인 | 같은 경로 |
| 잘못된 합성 날짜 직접 주입 | 성공 | 유효 포인트로 채택됨 | 같은 경로 |
| `npm run test:e2e` | 미실행 | 허용 경로 밖 결과물 생성 방지 | `artifacts/code-audit/test-output/2026-07-30_test-summary.md` |
| `npm run build` | 미실행 | 허용 경로 밖 build 산출물 생성 방지 | 같은 경로 |

## 실행 실패 및 제한사항

- 실패한 명령: 샌드박스 내부 계약 테스트는 loopback bind 제한으로 실패했다. 동일 명령을 승인된 샌드박스 외 환경에서 재실행해 39개 모두 통과했다.
- 분석할 수 없었던 영역: 브라우저 E2E, 실제 서비스 응답, 실제 접근 권한과 운영 오류 payload.
- 외부 계약 또는 요구사항 확인 필요: 숫자 문자열 허용 범위, fallback 매핑의 동일성 보장, debug 응답의 운영 활성 여부.

## 변경 보호 확인

- 보고서·아티팩트 외 변경 발생 여부: 없음. 신규 파일 3개가 모두 `reports/code-audit/` 또는 `artifacts/code-audit/` 아래에 있음
- 애플리케이션 소스 수정 없음 확인: 확인함
- 테스트·설정·의존성 수정 없음 확인: 확인함
- `git diff --name-only`: 추적 파일 변경 없음
- 실행 프로세스 종료: Mock·Vite·Playwright·Node test 프로세스 없음

## 판정 기준

- Critical: 잘못된 범위 데이터의 정상 표시 또는 숨겨진 합계 불일치
- High: 주요 데이터 결과 오류, stale 범위 표시, 실패·변환 오류의 정상값 위장
- Medium: 조건부 타입·정보 노출 위험과 추가 환경 확인이 필요한 구조
- 신뢰도 높음: 결정적 코드 경로 또는 직접 합성 재현
- 신뢰도 중간: 도달 가능한 코드 위험이나 브라우저·운영 조건 미확인

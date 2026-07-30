# Code Audit 근거 요약

- 수집 시각: 2026-07-30 13:25:48 KST
- 브랜치 / commit: `agent/code-audit` / `c8e9ee9`
- 데이터: 저장소의 합성 Mock 데이터만 사용
- 실제 회사·운영 데이터, 내부 주소, credential, token, secret: 수집·기록하지 않음

## 합성 `inconsistent` 재현

직접 생성한 합성 응답을 프런트엔드 요청 조건과 비교했다.

- 대시보드 요청 라인: `LINE_A`
- 대시보드 응답 라인: `LINE_A`, `LINE_C`
- 대시보드 요약 합계: 105
- 라인 상세 합계: 15
- 자설비 요청 라인: `LINE_A`
- 자설비 응답 행의 라인: `LINE_A`, `LINE_B`, `LINE_C`
- 결과: 프런트엔드에는 응답 범위 및 합계 교차 검증이 없어 해당 응답이 그대로 표시 경로에 들어간다.

## 성공 응답 스키마 불일치 재현

HTTP 성공 상태와 빈 객체를 반환하는 합성 `fetch`를 주입했다.

- `fetchMyEqpRegistrations`: 빈 배열 반환
- `fetchMailingRegistrations`: 빈 배열 반환
- `fetchSelfEquipmentData`: 빈 객체 반환
- 결과: 일부 조회는 스키마 오류를 발생시키지 않고 정상 0건 또는 빈 화면 경로로 진행한다.

## 잘못된 날짜 재현

달력과 시간 범위를 벗어난 합성 날짜 문자열을 자설비 및 공통부 scatter payload 생성 함수에 전달했다.

- 자설비: 포인트 1건으로 채택
- 공통부: 포인트 1건으로 채택
- 공통부 invalid-date 진단 건수: 0
- 결과: `Date.UTC` 정규화 값이 유효 시각처럼 사용되어 정렬·최근 구간 판단이 오염될 수 있다.

## 결정적 코드 근거

- `server/dashboardData.mjs:48-55`: 숫자 변환 실패를 `0`으로 치환
- `server/dashboardData.test.mjs:69-76`: 잘못된 숫자를 0으로 처리하는 현재 동작을 테스트가 고정
- `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:331-340`: 필터별 쿼리에서 이전 데이터를 placeholder로 유지
- `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:435-533`: 응답 범위·합계 검증 없이 요약과 라인 상세를 별도 렌더링
- `src/features/fdc-trend/pages/FdcTrendPage.jsx:1516-1567`: 필터 queryKey와 ch_step 전환 placeholder 처리
- `src/features/fdc-trend/pages/FdcTrendPage.jsx:1611-1629`: 응답 행의 라인 재검증 없이 차트 그룹 생성
- `src/features/fdc-trend/api/myEqpRegistrationApi.js:29-40`: 등록 목록 스키마 불일치를 빈 배열로 치환
- `src/features/fdc-trend/api/mailingRegistrationApi.js:49-59`: Mailing 목록 스키마 불일치를 빈 배열로 치환
- `src/features/fdc-trend/pages/MyEqpRegistrationPage.jsx:344-351,893-923`: 오류 응답의 debug 행을 화면에 렌더링
- `src/features/fdc-trend/pages/MailingRegistrationPage.jsx:313-321,777-803`: 오류 응답의 debug 행과 DB 세부 오류를 화면에 렌더링


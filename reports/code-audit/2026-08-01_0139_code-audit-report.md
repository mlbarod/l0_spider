# L0 Spider 결함·데이터 무결성·코드 신뢰성 종합 감사 보고서

## 실행 개요

- 작성 시각: 2026-08-01 01:39 KST
- 브랜치: `agent/code-audit`
- 기준 commit: `66347f3`
- 검토 범위: React 화면·상태·API client, Node handler·집계·파일 경계, Python DB helper, Mock 계약, 단위·통합·계약 테스트, 의존성과 모듈 경계
- 데이터: 합성 값만 사용
- 제외: 실제 DB·운영 파일·메일·내부 시스템, 브라우저 시각 검수, 성능 측정·튜닝
- 심각도: `P0=Critical`, `P1=High`, `P2=Medium`, `P3=Low`

## 종합 결론

- 문제점: P0는 없고 P1 8건, P2 4건, P3 3건을 확인했다. 최우선 문제는 Mailing 권한 경계 부재, 내부 경로·DB 진단 노출, 잘못된 날짜·숫자의 정상값 변환, 이전 필터 데이터 표시와 My EQP 라인 혼합 가능성이다.
- 권장 수정: 사용자·행 권한을 서버에서 강제하고 오류·경로 응답을 축소한 뒤, 날짜·숫자·응답 스키마를 fail-closed로 검증한다. 이후 query 범위, 테스트 script, API route를 정합화하고 대형 모듈과 반복 helper는 회귀 테스트를 먼저 만든 뒤 단계적으로 분리한다.

## 결과 요약

| 우선순위 | 건수 | 핵심 영역 |
|---|---:|---|
| P0 | 0 | 확인된 전체 서비스 중단·즉시 데이터 파괴 없음 |
| P1 | 8 | 권한, 정보 노출, 날짜·숫자, stale data, mapping fallback, 사용자 식별, 라인 범위 |
| P2 | 4 | 성공 스키마 은폐, 부분 커밋, 테스트 누락, 실행 모드 API 차이 |
| P3 | 3 | 대형 컴포넌트, 반복 handler/subprocess, 미사용 dependency |

모든 문제는 현재 코드의 결정적 경로 또는 합성 재현으로 확인했다. 실제 운영 발생 빈도와 외부 접근 가능성은 별도 확인이 필요하며, 이를 확인된 사실로 확대하지 않았다.

## 우선순위 목록

| ID | 심각도 | 제목 | 상태 |
|---|---|---|---|
| CA-001 | P1 | Mailing API가 호출자와 대상 행의 권한을 확인하지 않음 | 확인됨 |
| CA-002 | P1 | 내부 파일 경로·DB 진단·등록 행이 API와 화면에 노출됨 | 확인됨 |
| CA-003 | P1 | 잘못된 날짜가 유효 시각으로 자동 보정됨 | 확인됨 |
| CA-004 | P1 | 숫자 변환 실패가 모니터링 센서 0개로 집계됨 | 확인됨 |
| CA-005 | P1 | 필터 변경 중 이전 범위 데이터가 현재 결과처럼 유지됨 | 확인됨 |
| CA-006 | P1 | mapping 실패 중 내장 기준정보로 조회·등록 흐름이 계속됨 | 확인됨 |
| CA-007 | P1 | 사용자 조회 실패를 접속 주소 기반 ID로 대체함 | 확인됨 |
| CA-008 | P1 | My EQP payload가 요청 외 라인 행을 허용함 | 확인됨 |
| CA-009 | P2 | HTTP 200 스키마 불일치를 정상 빈 데이터로 처리함 | 확인됨 |
| CA-010 | P2 | 복수 Mailing 수신자 저장이 부분 커밋될 수 있음 | 확인됨 |
| CA-011 | P2 | 중복 test script가 기존 단위 테스트 대부분을 제외함 | 확인됨 |
| CA-012 | P2 | Vite dev와 full server의 API surface가 다름 | 확인됨 |
| CA-013 | P3 | 핵심 React page에 과도한 책임이 결합됨 | 확인됨 |
| CA-014 | P3 | API handler와 Node→Python helper 구조가 반복됨 | 확인됨 |
| CA-015 | P3 | 직접 사용 근거가 없는 dependency가 다수 유지됨 | 확인됨 |

## CA-001 Mailing API가 호출자와 대상 행의 권한을 확인하지 않음

- 심각도: P1
- 분류: 인증·행 권한
- 실제 영향: 애플리케이션에 도달 가능한 호출자는 문법상 유효한 다른 수신자 ID를 지정해 등록 조건을 조회·추가·삭제할 수 있다.
- 발생 조건: `GET`, `POST`, `DELETE /api/mailing-registration`에 대상 ID를 query 또는 body로 전달한다.
- 관련 위치: `server/mailingRegistration.mjs:53-82,160-217`, `src/features/fdc-trend/pages/MailingRegistrationPage.jsx:205-207,269-275,325-336,760-764`, `src/routes/router.jsx:13-19`, `src/features/fdc-trend/routes.jsx:25-43`
- 판단 근거: handler는 `getRemoteIp`·`resolveCurrentUser`·role 검사를 호출하지 않고 요청의 ID를 DB helper에 전달한다. 화면도 임의 ID 조회와 해당 행 삭제 흐름을 제공한다.
- 추측·판단 불가: 외부 gateway가 서비스 접근 자체를 제한하는지는 판단 불가다. 그러나 gateway 유무와 별개로 application row authorization 부재는 확인됐다.
- 권장 수정: 서버가 호출자 identity를 결정하고 자기 행만 허용하되, 타인 지정이 업무 요구라면 명시적 관리자/위임 권한과 audit log를 둔다. 조회·삭제의 owner는 body가 아니라 서버 identity에서 결정한다.
- 회귀 테스트: 본인 조회·등록·삭제 성공, 다른 사용자 행의 GET/POST/DELETE는 `403`, 권한 사용자의 위임만 성공, body ID 변조 무효화를 검증한다.

## CA-002 내부 파일 경로·DB 진단·등록 행이 API와 화면에 노출됨

- 심각도: P1
- 분류: 민감정보·오류 응답
- 실제 영향: 브라우저 network 응답과 실패 dialog에 서버 저장 구조, DB 오류 상세, 수신자·등록 조건이 노출될 수 있다. 경로 마스킹이 사용자 메시지에만 적용돼 원본 JSON은 남는다.
- 발생 조건: 정상 데이터·mapping 응답 또는 파일/DB/등록 실패 응답을 수신한다.
- 관련 위치: `server/mappingConfig.mjs:35-39,59-68`, `server/dashboardData.mjs:778-782`, `server/selfEquipmentData.mjs:340-347,429-445,785-799`, `server/commonAnomalyData.mjs:373-385,395-403,505-524,609-614`, `server/myEqpRegistration.mjs:248-300`, `server/mailingRegistration.mjs:166-216`, `src/features/fdc-trend/pages/MailingRegistrationPage.jsx:313-321,777-800`, `src/features/fdc-trend/pages/MyEqpRegistrationPage.jsx:344-351`
- 판단 근거: `sourcePath(s)`, `source_path`, `debugRow(s)`, `dbErrorDetail`과 원문 `error.message`가 response에 포함되고 일부가 화면에 렌더링된다. 보안 문서도 이 항목을 확인된 위험으로 기록한다.
- 호환성 구분: 일부 경로는 현재 차트 API의 입력 계약이므로 단순 필드 삭제는 호환성을 깨뜨린다.
- 권장 수정: 화면에는 opaque resource ID만 제공하고 실제 경로는 서버에서 해석한다. DB detail·debug row는 사용자 응답에서 제거하고 마스킹된 request ID와 일반 오류 code만 반환한다.
- 회귀 테스트: 성공·404·500 body가 절대 경로, DB detail, 사용자 식별값을 포함하지 않는지 검사하고 기존 이미지·scatter 조회의 opaque ID round trip을 검증한다.

## CA-003 잘못된 날짜가 유효 시각으로 자동 보정됨

- 심각도: P1
- 분류: 날짜 파싱·정렬·데이터 무결성
- 실제 영향: 존재하지 않는 날짜·시간이 차트 포인트로 들어가 정렬, 최근 26시간 표시와 N일 동일성 범위를 왜곡한다.
- 발생 조건: 원천 `act_time`이 형식은 비슷하지만 월·일·시·분·초 범위를 벗어나거나 뒤에 추가 문자가 붙는다.
- 관련 위치: `server/selfEquipmentData.mjs:558-574,588-623,654-685`, `server/commonAnomalyData.mjs:113-143,452-503`
- 판단 근거: 정규식이 문자열 끝과 구성요소 범위를 검증하지 않고 `Date.UTC`가 초과값을 다른 날짜로 보정한다. 합성 재현에서 두 builder 모두 포인트 1건과 유한 epoch를 반환했고 공통부 invalid 진단은 0이었다.
- 권장 수정: 전체 문자열 일치, 구성요소 범위, 변환 후 역검증을 공통 parser로 구현하고 실패 행을 진단에 포함하거나 응답을 실패 처리한다.
- 회귀 테스트: 잘못된 월·일·윤일·시간·suffix를 모두 거부하고 정상 문자열·Date·허용 epoch 변환은 유지한다.

## CA-004 숫자 변환 실패가 모니터링 센서 0개로 집계됨

- 심각도: P1
- 분류: 숫자 변환·판단 불가능 은폐
- 실제 영향: 원천 집계값이 손상돼 계산할 수 없는 상태가 실제 센서 0개와 동일하게 표시된다.
- 발생 조건: Dashboard stats의 `TL.total`에 null, 빈 값 또는 숫자로 변환할 수 없는 값이 존재한다.
- 관련 위치: `server/dashboardData.mjs:42-55,282-304,507-523`, `server/dashboardData.test.mjs:69-79`, `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:482-488`
- 판단 근거: `normalizeNumber`가 모든 변환 실패를 0으로 반환하며 기존 테스트도 이 결과를 기대값으로 고정한다. 합성 재현에서도 결과가 0이었다.
- 권장 수정: 실제 0, 결측, 변환 실패를 분리하고 실패 건수·source 상태를 응답 진단에 포함한다. KPI는 계산 불가를 `null` 또는 명시적 오류로 표시한다.
- 회귀 테스트: 숫자 0·숫자 문자열·null·잘못된 문자열을 각각 구분하고 UI가 0과 계산 불가를 다르게 표시하는지 검증한다.

## CA-005 필터 변경 중 이전 범위 데이터가 현재 결과처럼 유지됨

- 심각도: P1
- 분류: stale state·React Query
- 실제 영향: 새 라인 또는 추이 기간을 선택한 직후 이전 범위의 KPI·차트가 새 필터 아래 계속 보여 잘못된 판단을 유도한다.
- 발생 조건: 첫 조회 성공 뒤 다른 라인 또는 기간으로 변경하고 새 요청이 지연되거나 실패한다.
- 관련 위치: `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:326-365,390-412,435-480,624-629`
- 판단 근거: 두 query가 key 범위를 비교하지 않고 `placeholderData: previousData`를 항상 반환한다. QueryObserver 합성 재현에서 새 key 요청 중 이전 라인 데이터와 `isPlaceholderData=true`가 동시에 확인됐다.
- 권장 수정: 동일 범위 refetch에서만 이전 데이터를 유지하고 라인·기간이 바뀌면 비운다. 유지가 필요하면 데이터에 적용된 응답 필터를 고정 표시한다.
- 회귀 테스트: 지연·오류 promise로 라인 및 기간 변경을 재현해 이전 범위 값이 새 선택 아래 표시되지 않는지 검증한다.

## CA-006 mapping 실패 중 내장 기준정보로 조회·등록 흐름이 계속됨

- 심각도: P1
- 분류: 오류 은폐·계약 fallback
- 실제 영향: mapping API 장애 또는 Schema 오류 때 오래된 내장 mapping으로 데이터 조회와 My EQP 등록 조회·저장이 진행될 수 있다.
- 발생 조건: mapping query가 pending 또는 error인 상태에서 fallback에 존재하는 첫 라인·그룹이 자동 선택된다.
- 관련 위치: `src/features/fdc-trend/pages/FdcTrendPage.jsx:1480-1508`, `src/features/fdc-trend/pages/CommonAnomalyPage.jsx:294-343`, `src/features/fdc-trend/pages/CommonalityAnomalyPage.jsx:214-254`, `src/features/fdc-trend/pages/MyEqpRegistrationPage.jsx:325-369`, `src/features/fdc-trend/utils/fdcTrendMockData.js:19-53`
- 판단 근거: 네 화면이 `line_mapping ?? SPIDER_LINE_REV`를 사용하고 후속 query의 `enabled`는 mapping 성공 여부가 아니라 fallback으로 계산된 값만 확인한다. My EQP 화면도 같은 값으로 등록 목록과 mutation 입력을 구성한다.
- 호환성 구분: 의도적인 가용성/호환 fallback일 가능성은 있으나 버전·유효기간·정합성 계약은 확인되지 않았다. 현재 근거만으로 안전한 제거 또는 통합은 불가하다.
- 권장 수정: 데이터 조회·write는 mapping 성공 후에만 활성화한다. 호환 snapshot이 업무상 필요하면 version, 생성 시각, 적용 범위와 사용자 경고를 명시하고 write에는 사용하지 않는다.
- 회귀 테스트: mapping 500·빈 객체·잘못된 타입에서 후속 조회와 mutation이 호출되지 않고 명시적 오류만 보이는지 검증한다.

## CA-007 사용자 조회 실패를 접속 주소 기반 ID로 대체함

- 심각도: P1
- 분류: identity fail-open·오류 은폐
- 실제 영향: 승인 사용자 조회 장애가 인증 실패로 끝나지 않고 주소 문자열 소유자의 등록 조회·저장으로 바뀌어 사용자 데이터가 분리되거나 잘못 귀속될 수 있다.
- 발생 조건: `resolveCurrentUser`가 DB 오류, timeout 또는 사용자 없음으로 실패한다.
- 관련 위치: `server/myEqpRegistration.mjs:179-185,242-300`, `server/selfEquipmentData.mjs:368-377`, `server/myEqpRegistration.test.mjs:117-123`
- 판단 근거: 모든 예외를 catch한 뒤 remote address를 반환하며 기존 unit test가 이를 호환 동작으로 고정한다. 호출자는 fallback 여부를 알 수 없다.
- 호환성 구분: 의도적 호환 코드임은 테스트명으로 확인되지만, 실패와 정상 identity를 구분하지 않는 데이터 신뢰성 문제는 남는다.
- 권장 수정: 사용자 확인 실패는 fail-closed로 처리하고 안정적 오류 code를 반환한다. legacy 주소 소유 데이터가 존재한다면 별도 migration으로만 연결한다.
- 회귀 테스트: 사용자 없음·DB 오류·timeout은 write와 목록 조회를 실행하지 않고 401/403/503으로 구분하며, 정상 identity만 DB helper로 전달되는지 검증한다.

## CA-008 My EQP payload가 요청 외 라인 행을 허용함

- 심각도: P1
- 분류: 데이터 범위 혼합
- 실제 영향: 선택 라인의 My EQP 화면에 다른 라인의 설비·센서 행이 섞여 표시될 수 있다.
- 발생 조건: 선택 라인용으로 읽은 source 안에 등록 EQP와 일치하지만 `line_rev`가 다른 행이 포함된다.
- 관련 위치: `server/selfEquipmentData.mjs:196-202,356-440`, `tests/integration/step-deeplink.test.mjs:49-62`
- 판단 근거: My EQP handler가 `includeAllLines: true`를 전달해 base row의 line 조건을 무조건 통과시킨다. 합성 혼합 행 재현에서 요청 라인 외 행이 결과에 포함됐다.
- 추측·판단 불가: 실제 운영 source가 라인 단위로 완전히 격리된다는 외부 계약과 위반 감시는 확인할 수 없다.
- 권장 수정: 파일 경로를 신뢰하더라도 row의 라인을 요청과 대조하고 불일치를 성공 결과에서 조용히 제거하지 말고 정합성 오류와 진단 건수로 처리한다.
- 회귀 테스트: 한 source에 요청 라인과 다른 라인을 섞어 My EQP 응답이 실패하거나 명시적 불일치로 처리되는지 검증한다.

## CA-009 HTTP 200 스키마 불일치를 정상 빈 데이터로 처리함

- 심각도: P2
- 분류: 프런트엔드/API 계약·오류 은폐
- 실제 영향: 점진 배포 불일치나 부분 응답이 “등록 없음” 또는 “표시할 데이터 없음”으로 보인다.
- 발생 조건: HTTP는 성공하지만 필수 배열·객체가 누락되거나 잘못된 타입이다.
- 관련 위치: `src/features/fdc-trend/api/myEqpRegistrationApi.js:29-40`, `src/features/fdc-trend/api/mailingRegistrationApi.js:49-59`, `src/features/fdc-trend/api/selfEquipmentApi.js:3-64`, `src/features/fdc-trend/api/commonAnomalyApi.js:3-24`, `src/features/fdc-trend/pages/FdcTrendPage.jsx:1571-1578`, `src/features/fdc-trend/pages/CommonAnomalyPage.jsx:344-349`
- 판단 근거: 합성 성공 빈 객체에서 등록 API는 빈 배열, 데이터 API는 빈 객체를 예외 없이 반환했다. 화면은 optional chaining과 빈 배열 기본값으로 정상 empty UI에 진입한다.
- 권장 수정: 프런트가 실제 소비하는 필드만 runtime Schema로 검증하고 정상 빈 값과 계약 오류를 다른 상태·오류 code로 처리한다.
- 회귀 테스트: 빈 객체, 필수 필드 누락, 배열 대신 객체, 중첩 타입 오류를 모두 거부하고 유효한 empty payload만 허용한다.

## CA-010 복수 Mailing 수신자 저장이 부분 커밋될 수 있음

- 심각도: P2
- 분류: transaction·부분 성공
- 실제 영향: 앞선 수신자는 저장됐지만 후반 수신자 실패로 전체 API가 500을 반환할 수 있어 사용자는 전체 실패로 오인한다.
- 발생 조건: 복수 수신자 순차 저장 중 두 번째 이후 DB helper가 실패한다.
- 관련 위치: `server/mailingRegistration.mjs:104-109,186-216`, `scripts/mailing_registration.py:153-206`
- 판단 근거: Node가 수신자별 helper를 순차 await하고 Python helper는 각 호출에서 별도 connection으로 commit한다. 후반 예외를 앞선 commit과 묶어 rollback하는 경계가 없다.
- 권장 수정: 한 요청을 한 DB transaction으로 처리하거나 수신자별 성공·실패를 명시한 partial-success 계약과 안전한 retry key를 제공한다.
- 회귀 테스트: 두 번째 수신자 실패를 주입해 atomic rollback 또는 명시적 부분 성공 목록, 재시도 중복 방지를 검증한다.

## CA-011 중복 test script가 기존 단위 테스트 대부분을 제외함

- 심각도: P2
- 분류: 테스트 신뢰성·중복 설정
- 실제 영향: 표준 `npm run test:unit`이 green이어도 서버·프런트 핵심 단위 테스트가 실행되지 않아 회귀를 놓친다.
- 발생 조건: package manager가 중복 JSON key의 마지막 값을 사용한다.
- 관련 위치: `package.json:13-14,21-23`, `scripts/verify-all.sh:50-62`, `scripts/verify-env.sh:109-121`
- 판단 근거: 앞쪽 `test:unit` 정의가 뒤쪽 정의로 덮인다. 표준 명령은 1개, 원래 경로 직접 실행은 22개 테스트 파일을 실행했고 모두 통과했다. verify script는 key 존재만 검사해 범위 축소를 탐지하지 않는다.
- 권장 수정: script 이름을 중복 없이 분리하고 `test:unit`이 Core unit 전체를 호출하도록 구성한다. verify script는 대표 서버·API·utility test가 포함됐는지 검증한다.
- 회귀 테스트: 표준 unit 명령이 `tests/unit`, `server`, frontend API·utils의 대표 테스트를 모두 실행하고 중복 JSON key 검사도 통과해야 한다.

## CA-012 Vite dev와 full server의 API surface가 다름

- 심각도: P2
- 분류: 실행 모드·API handler 분산
- 실제 영향: `npm run dev`에서는 일부 등록·My EQP·클릭 이력 기능이 full server와 달리 동작하지 않는다.
- 발생 조건: Mock 모드가 아닌 Vite dev middleware로 애플리케이션을 실행하고 누락된 API를 호출한다.
- 관련 위치: `vite.config.mjs:37-117`, `server.mjs:134-263`, `package.json:6-19`
- 판단 근거: full server에는 존재하지만 Vite middleware에 등록되지 않은 API route가 5개 있으며 해당 frontend 화면은 이 route들을 호출한다.
- 권장 수정: 단일 route registry를 두 entrypoint가 공유하거나 개발 표준 진입점을 full server 하나로 제한하고 `npm run dev`의 의미를 명확히 바꾼다.
- 회귀 테스트: 두 실행 모드의 method/path 집합 비교 contract test와 등록·My EQP·클릭 이력 smoke test를 추가한다.

## CA-013 핵심 React page에 과도한 책임이 결합됨

- 심각도: P3
- 분류: 유지보수·테스트 가능성
- 실제 영향: 필터, query, mutation, pagination, 차트, 이력과 dialog 변경이 한 파일에서 충돌해 작은 수정도 넓은 회귀 범위를 만든다.
- 발생 조건: Self Equipment 또는 등록 화면의 필터·차트·이력 로직을 변경한다.
- 관련 위치: `src/features/fdc-trend/pages/FdcTrendPage.jsx` 2,257줄, `MyEqpRegistrationPage.jsx` 941줄, `MailingRegistrationPage.jsx` 813줄
- 판단 근거: `FdcTrendPage` 한 파일에 23개의 top-level 함수/컴포넌트와 다수의 query·mutation·side effect가 결합돼 있다. 즉시 성능 문제를 측정한 결과는 없으며 단순 스타일 차이보다 변경 격리·테스트 부담 문제다.
- 안전한 통합 여부: 현재 근거만으로 대규모 분리는 안전하지 않다. 화면·API·query key·URL·이력 계약을 먼저 고정해야 한다.
- 권장 수정: 순수 filter/payload state, server-state hook, chart card, history mutation을 기능 단위로 분리하되 외부 동작은 유지한다.
- 회귀 테스트: URL 초기화, 종속 필터, query key, skip/history, ALL 조합, off-page 차트 미마운트를 component·hook 단위로 고정한다.

## CA-014 API handler와 Node→Python helper 구조가 반복됨

- 심각도: P3
- 분류: 유지보수상 중복·모듈 경계
- 실제 영향: 같은 종류의 오류가 route마다 다른 상태·문구·노출 필드로 처리되고 timeout·부분 성공 정책도 달라진다.
- 발생 조건: JSON body 제한, subprocess timeout, 오류 응답 또는 DB helper 프로토콜을 변경한다.
- 관련 위치: `server/*.mjs`, `server.mjs:134-263`, `scripts/*.py`
- 판단 근거: `sendJson` 12개, `readJsonBody` 5개, Python spawn 구조 7개가 분산돼 있고 원문 오류 response 지점도 다수다. CA-002, CA-010과 입력 오류 500 재현은 중복 구조가 실제 동작 차이로 이어진 근거다.
- 구분: 실제 성능 문제는 측정하지 않았다. 일부 업무별 timeout·payload 차이는 의도적일 수 있어 하나의 거대 helper로 단순 통합하는 것도 안전하지 않다.
- 권장 수정: 공통 transport 층에는 body byte limit, typed error, child exit/timeout/output limit과 sanitization만 두고 업무 validation·transaction은 도메인 모듈에 유지한다.
- 회귀 테스트: 모든 write handler에 malformed JSON, oversize, spawn error, timeout, nonzero/invalid output, 민감정보 제거와 상태 code matrix를 공통 contract로 적용한다.

## CA-015 직접 사용 근거가 없는 dependency가 다수 유지됨

- 심각도: P3
- 분류: 미사용 dependency·공급망 유지보수
- 실제 영향: 설치·lock 검토·취약점 대응 범위가 실제 코드보다 넓어지고 의존성 변경 판단이 어려워진다.
- 발생 조건: 설치, dependency audit, framework upgrade 또는 lock 갱신을 수행한다.
- 관련 위치: `package.json:25-68`, `package-lock.json`
- 판단 근거: 실행 코드·테스트의 정적 import 검색에서 `@heroicons/react`, `@tabler/icons-react`, `@tanstack/react-table`, `date-fns`, `framer-motion`, `plotly.js-dist-min`, `quill`, `react-icons`, `react-is`, `react-use`, `vis-data`, `vis-timeline`, `zustand`의 참조를 찾지 못했다. 반면 `pages/versions/*.bak`은 README에 복구 자산으로 문서화되어 이 문제에서 제외했다.
- 구분: 현재 build 성능 문제는 측정하지 않았다. 일부 package가 peer/runtime 요구일 수 있어 현 근거만으로 일괄 삭제는 안전하지 않다.
- 권장 수정: package별 direct import, peer dependency, code generation 사용을 확인한 뒤 한 묶음씩 제거하고 lock·lint·build·unit·contract를 검증한다.
- 회귀 테스트: clean install, production build, route import, lint, 전체 unit·contract와 dependency tree 무결성을 확인한다.

## 테스트 및 명령 결과

| 명령 | 결과 | 핵심 결과 | 증거 |
|---|---|---|---|
| `npm run lint` | 성공 | 오류 없음 | `artifacts/code-audit/test-output/2026-08-01_test-summary.md` |
| `npm run test:unit` | 성공 | 1 pass | 동일 |
| 기존 서버·프런트 unit 경로 직접 실행 | 성공 | 22 pass | 동일 |
| `npm run test:integration` | 성공 | 1 pass | 동일 |
| Python helper unit 2개 모듈 | 성공 | 6 pass | 동일 |
| `npm run test:contract` | 실패 | dependency 상태와 sandbox 제한으로 3개 중단 | 동일 |
| Mock API contract 단독 sandbox 밖 재실행 | 성공 | 39 pass | 동일 |
| 합성 직접 재현 | 성공 | 6개 코드 경로 확인 | `artifacts/code-audit/evidence/2026-08-01_code-audit-evidence.md` |

통과한 legacy test는 위 문제의 반증이 아니다. CA-004의 잘못된 0 변환과 CA-007의 주소 fallback은 오히려 현재 unit test가 기대 동작으로 고정하며, 권한·malformed success·stale placeholder·혼합 라인 회귀 테스트는 찾지 못했다.

## 판단 불가 및 제한사항

- 외부 gateway, TLS, firewall, trusted proxy와 직접 Node 접근 차단 여부는 판단 불가다. 따라서 forwarded header spoofing의 실제 도달 가능성은 확정하지 않았다.
- 실제 DB 계정 권한·TLS·runtime DDL 영향, 운영 파일 ACL·symlink·생산자 Schema와 데이터 발생 빈도는 판단 불가다.
- 개별 STEP HMAC은 문서상 제안·Mismatch 상태이므로 구현 부재를 확정 결함으로 재분류하지 않았다.
- `ajv` major 불일치와 `ajv-formats` 누락 때문에 Dashboard·Mailing Schema contract 2개는 이번 checkout에서 실행 불가였다. 의존성 설치는 금지되어 복구하지 않았다.
- 브라우저 화면, Error Boundary 체감, race 시각 증거와 E2E는 Browser QA 범위로 남겼다.
- 성능·메모리·번들 비용은 측정하지 않았으므로 P3 유지보수 항목을 실제 성능 문제로 표현하지 않았다.

## 변경 보호 확인

- 애플리케이션 소스·테스트·설정·의존성 수정: 없음
- 생성 파일: 본 보고서와 `artifacts/code-audit/` 증거·테스트 요약만 생성
- Python unit test가 만든 bytecode cache: 정확한 신규 파일만 제거해 시작 상태 복원
- commit, push, merge, rebase, branch 변경: 수행하지 않음

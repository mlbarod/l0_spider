# L0 Spider QA·Code Audit·Performance P0/P1 종합 조치 계획

## 1. 보고 목적과 범위

이 보고서는 2026-08-01 기준 세 검수 에이전트의 최신 보고서에서 P0와 P1로 분류한 모든 항목을 현재 `main` 코드·계약·기준 문서와 다시 대조하고, 중복·의존성·호환성 위험을 반영한 조치 순서와 검증 기준을 정의한다.

| 항목 | 기준 |
|---|---|
| 현재 기준 branch | `main` |
| 현재 기준 commit | `b01e06d2eaa1fe9350141dbae1af9849c728c21c` |
| 분석일 | 2026-08-01 KST |
| 변경 범위 | 본 조치 계획 보고서 1개 |
| 애플리케이션 코드 변경 | 없음 |
| 운영 DB·`/appdata`·메일·systemd·네트워크 변경 | 없음 |

입력 보고서는 다음과 같다.

| 검수 | 최신 보고서 | 보고서 기준 | 보고된 P0/P1 |
|---|---|---|---:|
| Browser QA | `agent/browser-qa:reports/browser-qa/2026-08-01_0233_browser-qa-report.md` | `agent/browser-qa`, `6beba6d` | P0 2, P1 1 |
| Code Audit | `agent/code-audit:reports/code-audit/2026-08-01_0139_code-audit-report.md` | `agent/code-audit`, `66347f3` | P0 0, P1 8 |
| Performance | `agent/performance:reports/performance/2026-08-01_1132_performance-report.md` | `agent/performance`, `536a5a7` | P0 0, P1 2 |

세 보고서는 끝까지 읽었으며, 보고서에 연결된 원시 artifact는 해당 검수 worktree에 보존한다. 이 보고서에는 실제 경로·사용자 식별값·원본 응답을 복사하지 않는다.

## 2. 판정 기준

- `Confirmed`: 현재 `main` 코드·계약 또는 검수의 반복 가능한 합성 실행으로 확인됨
- `Documented`: 기준 문서나 사용자 매뉴얼에만 요구 또는 동작이 기록됨
- `Inferred`: 코드 구조로 영향이 예상되지만 실행 또는 외부 계약은 확인되지 않음
- `Unknown`: 운영 데이터, 외부 gateway, DB 권한 또는 업무 정책 없이는 판단할 수 없음
- `Mismatch`: 코드·테스트·문서·검수 권고 사이에 충돌이 있음

보고서의 심각도는 유지하되, “취약한 코드 경로가 존재함”과 “운영에서 실제 사고가 발생함”을 구분한다. 운영 발생 빈도, 외부 접근 가능성, 운영 파일 I/O와 실제 사용자 체감 SLA는 이번 분석에서 확인하지 않았다.

## 3. 종합 결론

### 3.1 건수

| 구분 | 보고 원건수 | 중복 제거 후 | `main` 조치 | `mock-agent` 조치 |
|---|---:|---:|---:|---:|
| P0 | 2 | 2 | 2 | 0 |
| P1 | 11 | 11 | 10 | 1 |
| 합계 | 13 | 13 | 12 | 1 |

제목과 발생 화면이 같은 완전 중복은 없다. 다만 P0 2건은 모두 Dashboard 성공 응답 신뢰 경계 문제이고, CA-003·004·005·006·008은 같은 “잘못된 범위를 정상 데이터처럼 사용하지 않는다”는 fail-closed 원칙으로 묶어 설계해야 한다.

### 3.2 핵심 판단

1. **Dashboard P0 2건은 즉시 방어해야 한다.** 현재 서버 builder는 자체 생성 응답을 요청 Line 범위에 맞춰 조립하므로 정상 코드 경로에서는 정합성이 유지된다. 그러나 프런트엔드는 구조만 검사하고 합계-상세 및 요청-응답 범위를 검증하지 않는다. Mock에서 각각 5/5 재현됐으므로 방어 계약 부재는 `Confirmed`, 운영에서 불일치 응답이 실제 발생했는지는 `Unknown`이다.
2. **보안·identity P1은 기능 요구 결정과 함께 처리해야 한다.** Mailing의 타 수신인 지정은 사용자 매뉴얼에 존재하므로 단순 self-only 변경은 호환성을 깨뜨린다. actor·recipient·위임·관리자 권한 모델을 먼저 결정해야 한다.
3. **내부 경로 노출은 즉시 오류 응답부터 축소하고, 성공 응답은 단계적으로 전환해야 한다.** `sourcePath(s)`는 현재 JSON Schema와 chart 후속 조회에 포함돼 있어 한 번에 삭제할 수 없다.
4. **My EQP Line 범위는 현재 테스트와 감사 권고가 `Mismatch`다.** `includeAllLines: true`를 제거하기 전에 요청 Line과 원천 `line_rev`의 공식 alias 계약을 확정해야 한다.
5. **공통부 전체 mount는 가장 큰 실측 성능 병목이다.** 1,200건에서 약 15초, DOM 34,040개가 확인돼 client pagination을 우선 적용할 근거가 충분하다.
6. **Dashboard LRU 문제는 cache thrash 자체는 `Confirmed`지만 운영 영향은 `Unknown`이다.** 메모리 한도와 실제 I/O 측정 없이 entry 수만 확대하지 않는다.
7. **BQA-003은 `main` 제품 결함이 아니다.** Mock query parser와 generator의 Line 타입 계약 불일치이며 `mock-agent`에서 고쳐야 한다. 이 문제 때문에 자설비 정상 chart Browser QA 결과는 여전히 `Unknown`이다.

## 4. 항목별 상세 분석과 조치

### 4.1 BQA-001 — Dashboard 합계와 상세 불일치

- 원 심각도: P0
- 현재 판정: 방어 계약 부재 `Confirmed`, 운영 발생 `Unknown`
- 현재 근거: `dashboardApi.js`는 필수 object·array 존재만 검사한다. `LineAnomalyDashboard.jsx`는 `summary`와 `lineSummary`를 독립 렌더링한다. Dashboard JSON Schema는 타입과 구조를 확인하지만 배열 합계 같은 교차 불변조건은 확인하지 않는다.
- 완화 근거: 현재 `buildLineDashboardPayloadFromAggregates()`는 `lineSummary`에서 `totalAbnormalCount`, 최신일 합계와 top Line을 계산하므로 native producer의 정상 경로는 내부적으로 일치한다.

조치 계획:

1. `summary.totalAbnormalCount === sum(lineSummary[].totalCount)`를 필수 불변조건으로 정의한다.
2. `summary.latestDateCount`, `abnormalLineCount`, `topLine`, `topLineCount`와 `dailyTrend` 합계도 같은 producer 규칙에 맞춰 검증한다.
3. 서버는 성공 body를 보내기 직전에 pure invariant assertion을 실행하고 위반 시 안정적 code의 non-2xx 오류로 fail-closed 처리한다.
4. 프런트 API 경계에서도 동일한 최소 불변조건을 검증한다. 불일치 payload는 KPI·표·차트를 전혀 렌더링하지 않는다.
5. UI는 원본 내부 값을 노출하지 않고 “데이터 정합성 오류”, 재조회 버튼과 문의 시 필요한 안전한 request ID만 표시한다.
6. `docs/features/dashboard.md`에 교차 불변조건을 추가한다. JSON Schema로 표현하기 어려운 합계 규칙은 contract test가 기준이 되도록 명시한다.

완료 기준:

- `partial` 합성 응답에서 KPI와 빈 상세가 동시에 정상 표시되지 않는다.
- producer unit test, API negative contract test, Browser QA가 모두 불일치를 오류로 판정한다.
- 유효 success·empty fixture와 기존 정상 Dashboard 집계는 유지된다.

### 4.2 BQA-002 — 요청하지 않은 Dashboard Line 표시

- 원 심각도: P0
- 현재 판정: 방어 계약 부재 `Confirmed`, 운영 발생 `Unknown`
- 현재 근거: 서버 native producer는 요청 Line을 `selectedLines`로 사용하지만, 프런트는 요청 Line과 응답 `filters.lines`, `lineSummary`, `dailyTrend`, `mailingSummary`의 포함 관계를 검증하지 않는다.

조치 계획:

1. 요청에 Line이 있으면 응답 `filters.lines`가 정규화된 요청 집합과 일치하는지 확인한다.
2. `lineSummary[].lineId`, `dailyTrend[].lineId`, `mailingSummary[].lineId`, nullable `summary.topLine`이 요청 집합의 부분집합인지 검증한다.
3. `options.lines`는 전체 선택지 의미이므로 범위 위반 판정 대상에서 제외한다.
4. 서버 builder에 다른 Line이 섞인 합성 aggregate를 넣는 회귀 test를 추가한다.
5. 프런트는 범위 불일치 응답을 일부 필터링해 사용하지 않고 전체를 신뢰 불가로 처리한다.

완료 기준:

- `line=LINE_A` 요청에서 다른 Line을 포함한 응답은 정상 화면에 한 건도 표시되지 않는다.
- 서버와 프런트 양쪽 negative test가 존재하고 `inconsistent` Browser QA가 오류 상태를 확인한다.

### 4.3 BQA-003 — 자설비 정상 Mock이 최종 row를 모두 제거

- 원 심각도: P1
- 현재 판정: `Mismatch`, 실제 제품 chart 동작 `Unknown`
- 담당 경계: `mock-agent`
- 원인: Mock query parser는 반복 `line`을 배열로 만들지만 generator는 scalar 문자열과 비교한다.

조치 계획:

1. Mock API의 `line` 계약을 Core API와 동일한 단일 값 또는 명시적 배열 중 하나로 통일한다.
2. parser→generator contract test에 일반 Line, 반복 query, 빈 query를 추가한다.
3. `Sensor=ALL`, `ch_step=ALL` 최종 응답에 합성 rows가 존재하는지 contract test로 고정한다.
4. 수정 후 자설비 chart, 숫자 pagination, page 밖 query 미발생, tooltip·dialog·empty/error를 Browser QA로 재검증한다.

완료 기준:

- `normal` 시나리오의 최종 자설비 응답과 화면 chart가 0건이 아니다.
- 이 수정은 Mock Validation Extension에만 남고 Mock 구현을 `main`으로 병합하지 않는다.

### 4.4 CA-001 — Mailing API 행 권한 부재

- 원 심각도: P1
- 현재 판정: 코드 경로 `Confirmed`, 외부 gateway·공식 권한 모델 `Unknown`
- 현재 근거: `handleMailingRegistrationRequest()`는 GET/POST/DELETE의 대상 `knoxId`를 요청에서 받아 DB helper로 전달하며 server-side caller identity와 role을 확인하지 않는다.
- 호환성 `Mismatch`: 사용자 매뉴얼은 다른 수신인 추가 기능을 안내한다. 따라서 “타인 ID 입력 가능” 자체를 결함으로 단정할 수 없지만, actor 인증·위임 권한·감사 기록 부재는 확인된다.

선행 결정:

- caller, 등록 owner, 최종 recipient, 위임자와 관리자의 의미
- 다른 recipient 추가를 일반 사용자에게 허용할지
- 조회·삭제 권한은 recipient 본인, 등록 actor 또는 관리자 중 누구에게 있는지
- actor를 저장할 DB column 또는 별도 audit 저장소가 필요한지

권장 기본안:

1. 서버가 `resolveCurrentUser`로 caller를 확정하지 못하면 모든 Mailing write를 차단한다.
2. GET·DELETE는 기본적으로 caller 본인 행만 허용한다.
3. 타 recipient POST는 명시적 위임 권한 또는 관리자 정책이 확정된 경우만 허용하고 actor·recipient를 분리 기록한다.
4. 정책 확정 전 임시 containment가 필요하면 self-only로 제한하되 사용자 매뉴얼의 타 수신인 기능 중단을 승인받는다.
5. body의 ID를 owner 결정에 사용하지 않고 서버 identity·권한 결과에서 결정한다.

완료 기준:

- 본인 작업 성공, 무권한 타인 GET/POST/DELETE `403`, identity 장애 fail-closed가 synthetic adapter test로 검증된다.
- 위임 기능을 유지한다면 actor·recipient·권한·audit 계약과 사용자 매뉴얼이 일치한다.
- 실제 운영 DB migration은 별도 승인·백업·rollback 계획 없이 실행하지 않는다.

### 4.5 CA-002 — 내부 경로·DB 진단·등록 행 노출

- 원 심각도: P1
- 현재 판정: CORE-03A error/debug 부분 `Remediated`, success path 부분 `Confirmed`/잔존
- 현재 근거: CORE-03A에서 실패 payload의 `debugRow(s)`·`dbErrorDetail`·원문 `error.message`·실패 경로와 helper stderr 전달을 제거하고 공통 안전 오류 계약을 추가했다. 성공 payload의 `sourcePath(s)`·`source_path`는 CORE-03B 호환 범위로 남아 있다.
- 호환성 제약: Dashboard Schema와 Self/Common chart 후속 조회가 현재 절대 경로를 계약으로 사용한다.

2단계 조치 계획:

1. **즉시 축소:** 등록 API error body에서 debug row, DB detail, table/schema 진단을 제거한다. 서버 log에도 실제 값 대신 안정적 error code와 request ID만 남긴다.
2. 모든 handler의 client 오류와 server/source 오류를 typed error로 분리하고 원문 exception을 응답에 결합하지 않는다.
3. 성공 payload에는 절대 경로 대신 서버가 검증 가능한 opaque `resourceId` 또는 root-relative resource key를 추가한다.
4. chart/image/history client를 새 resource 계약으로 전환한 뒤 legacy path field를 제거한다. 단순 Base64 경로는 opaque 경계로 인정하지 않는다.
5. Dashboard 문서·Schema·fixture·contract test와 Self/Common 데이터 흐름 문서를 같은 변경에서 갱신한다.

전체 CA-002 완료 기준:

- success·400·403·404·500 body에 절대 운영 경로, DB detail, 등록 입력 행과 사용자 식별값이 없다.
- resource ID round trip으로 기존 chart·image·history가 동일하게 동작한다.
- legacy field 제거 전후 호환 기간과 rollback 경로가 문서화된다.

CORE-03A 완료 기준은 보호 대상 실패 body에 path·DB detail·등록 입력 행이 없고 `code`·`requestId` 계약 test가 통과하는 것이다. 성공 body의 legacy path 제거는 CORE-03B gate다.

### 4.6 CA-003 — 잘못된 날짜의 자동 보정

- 원 심각도: P1
- 현재 판정: `Confirmed`
- 현재 근거: Self와 Common parser의 정규식이 문자열 끝을 고정하지 않고 구성요소 범위를 역검증하지 않는다. `Date.UTC`가 초과 월·일·시간을 정상 epoch로 보정한다.

조치 계획:

1. 서버 공통 strict parser를 만들되 대규모 handler 통합은 하지 않는다.
2. 전체 문자열 일치, 월·일·윤일·시·분·초 범위와 `Date.UTC` 변환 후 round trip을 검증한다.
3. Common에서 허용 중인 Date와 numeric epoch 단위 규칙은 별도 함수로 보존하고 경계값을 명시한다.
4. invalid chart row는 조용히 정상값으로 바꾸지 않는다. 제외 건수를 diagnostics에 기록하고, 전체 point가 invalid이면 일반 empty가 아닌 데이터 품질 오류로 표시한다.
5. 사용자 응답 diagnostics에는 원본 값과 경로를 포함하지 않는다.

완료 기준:

- 잘못된 월·일·윤일·시간·suffix가 모두 거부된다.
- 정상 문자열, Date, 허용 epoch와 fractional second 동작이 유지된다.
- invalid row가 0건 차트로 조용히 위장되지 않는다.

### 4.7 CA-004 — Dashboard 숫자 변환 실패를 0으로 집계

- 원 심각도: P1
- 현재 판정: `Confirmed`
- 현재 근거: `dashboardData.mjs`의 `normalizeNumber()`는 null·빈값·변환 실패를 모두 0으로 반환하며 success Schema는 `monitoringSensorTotal`을 non-null number로 고정한다.

승인 결정(D-04):

1. `TL.total`은 기존 업무 정의대로 실제 `0`, 결측, 빈 문자열과 숫자 변환 실패를 모두 `0`으로 보정한다.
2. 이 동작은 CA-004의 fail-closed 권고보다 우선하는 명시적 업무 예외이며, CORE-02와 후속 release에서 변경하지 않는다.
3. `monitoringSensorTotal`의 non-null number 계약과 Dashboard·메일 KPI 소비 동작을 유지한다.
4. 다른 숫자 field나 strict source integrity 정책으로 이 결정을 확대 적용하지 않는다.

완료 기준:

- `TL.total`의 기존 0 보정과 non-null number 계약이 유지된다.
- 정상 Dashboard 화면·mail summary 소비자 동작이 바뀌지 않는다.
- 향후 정책 변경은 D-04를 다시 승인하고 Schema·fixture·contract·UI를 함께 갱신한다.

### 4.8 CA-005 — 필터 변경 중 이전 Dashboard 범위 표시

- 원 심각도: P1
- 현재 판정: `Confirmed`
- 현재 근거: 기본·추이 query 모두 key가 바뀌어도 `placeholderData: previousData`를 반환한다. 화면은 새 filter state 아래 이전 payload를 표시한다.

조치 계획:

1. Line 또는 기간 key가 바뀌면 이전 payload를 사용하지 않는다.
2. 같은 key의 수동 refetch만 현재 데이터를 유지하고 `재조회 중`으로 표시한다.
3. 응답 `filters`와 화면에 표시하는 적용 조건을 payload와 함께 고정해 draft/applied filter를 구분한다.
4. 새 범위 요청 실패 시 이전 범위 화면으로 되돌아가거나 정상 결과처럼 유지하지 않고 오류·재시도 상태를 표시한다.

완료 기준:

- 지연·오류 promise에서 이전 Line/KPI가 새 Line 선택 아래 나타나지 않는다.
- 기본 Dashboard와 10/30/90/180일 추이 query가 모두 같은 규칙을 따른다.

### 4.9 CA-006 — Mapping 실패 시 내장 mapping으로 계속 진행

- 원 심각도: P1
- 현재 판정: 동작 `Confirmed`, fallback의 공식 가용성 정책 `Unknown`
- 현재 근거: Self, Common, Commonality와 My EQP 등록 화면이 mapping 실패·미완료 시 `SPIDER_LINE_REV`를 사용하고 후속 read/write query를 활성화할 수 있다.

권장 조치:

1. mapping API success와 최소 Schema 검증을 operational query의 선행 조건으로 둔다.
2. mapping 실패 시 read·write 모두 중단하고 명시적 기준정보 오류와 재시도를 제공한다.
3. 호환 snapshot이 반드시 필요하면 version, 생성 시각, 허용 기간과 적용 범위를 응답 계약에 넣고 화면에 stale 경고를 표시한다.
4. fallback snapshot은 조회 전용으로 한정하고 My EQP/Mailing 등록·삭제에는 사용하지 않는다.
5. 네 화면의 중복 gating 규칙을 작은 공통 hook 또는 pure validator로 맞추되 화면 전체 리팩터링은 하지 않는다.

완료 기준:

- mapping 500, 빈 object, 잘못된 type에서 후속 데이터 API와 mutation이 호출되지 않는다.
- fallback을 유지할 경우 stale/version 상태가 사용자와 로그에서 구분되고 write는 차단된다.

### 4.10 CA-007 — 사용자 조회 실패를 접속 주소 ID로 대체

- 원 심각도: P1
- 현재 판정: `Confirmed`
- 현재 근거: `resolveRegistrationUserId()`는 사용자 없음과 resolver 예외를 모두 remote address로 대체하며 현재 unit test가 이를 호환 동작으로 고정한다.

조치 계획:

1. current-user 결과를 `authenticated`, `not-authorized`, `lookup-unavailable`로 구분한다.
2. 사용자 없음은 401/403, DB·timeout은 503으로 처리하고 등록 조회·write를 실행하지 않는다.
3. remote address는 lookup input과 안전한 audit correlation 용도로만 사용하고 owner ID로 저장하지 않는다.
4. legacy 주소 소유 레코드가 존재할 가능성은 `Unknown`으로 유지한다. 필요 시 별도 read-only inventory와 승인된 migration 계획으로만 정리한다.
5. 현재 fallback을 기대하는 test를 fail-closed 계약 test로 교체한다.

완료 기준:

- 정상 identity만 helper payload에 전달된다.
- 사용자 없음·DB 오류·timeout에서 DB write와 개인 목록 조회가 발생하지 않는다.
- 실제 주소 또는 forwarded header 값은 응답·보고서·fixture에 기록하지 않는다.

### 4.11 CA-008 — My EQP 요청 외 Line 혼합 가능성

- 원 심각도: P1
- 현재 판정: bypass 코드 `Confirmed`, 올바른 `line_rev` 의미 `Mismatch`/`Unknown`
- 현재 근거: My EQP handler는 `includeAllLines: true`를 사용한다. 반면 기존 unit test는 요청 Line과 다른 `INTERNAL-LINE-NAME`도 의도적으로 허용한다. 일반 Self와 Common은 row Line을 filter한다.

선행 결정:

- path의 `{line}`과 row `line_rev` 중 어느 값이 권위 원천인지
- 표시 Line과 내부 Line alias가 존재하는지, 존재한다면 어느 mapping이 기준인지
- source 안의 혼합 Line을 전체 오류, 부분 제외 또는 진단 중 무엇으로 처리할지

권장 조치:

1. 요청 Line에 허용되는 canonical `line_rev` 집합을 mapping 계약으로 만든다.
2. source provenance와 row Line을 대조하고 허용 집합 밖 행이 있으면 조용히 포함하거나 제거하지 않고 정합성 오류로 처리한다.
3. `includeAllLines` boolean bypass를 제거하고 명시적 allowed Line set을 builder에 전달한다.
4. 기존 테스트의 `INTERNAL-LINE-NAME` 기대값을 공식 alias 계약에 맞게 수정한다.

완료 기준:

- 합성 source에 허용 Line과 외부 Line을 섞었을 때 외부 행이 success payload에 포함되지 않는다.
- 공식 alias 행은 정상 유지되고, alias가 아닌 mismatch는 안정적 오류와 안전한 count로 확인된다.

### 4.12 PERF-001 — 공통부 결과 1,200개 전체 mount

- 원 심각도: P1
- 현재 판정: `Confirmed`
- 현재 근거: `CommonAnomalyPage.jsx`는 `chartGroups.map → group.rows.map`으로 모든 card를 즉시 mount한다. 합성 large 5회 중앙값은 약 15초, DOM 34,040개, heap 91 MB였다.

단계별 조치:

1. 우선 final row를 EQP 순서대로 펼쳐 client에서 페이지당 최대 20개 card만 mount한다.
2. 차트 영역 상단에 숫자 pagination과 현재/전체 row 범위를 표시한다. 페이지 밖 card·dialog·image query는 mount하지 않는다.
3. group이 페이지 경계에서 나뉠 때 EQP header와 전체 건수를 보존한다.
4. sensor/filter 변경 시 1페이지로 초기화하고 현재 page가 범위를 벗어나면 안전하게 보정한다.
5. 기존 sensor 선택 클릭이력은 전체 선택 category 의미를 잃지 않도록 별도 계약을 유지한다. 서버 pagination을 도입할 때 page 1 path만 기록하는 회귀를 허용하지 않는다.
6. client pagination 후 payload·network가 여전히 병목일 때만 additive `page`, `pageSize`, `totalRows` 서버 계약을 검토한다.

검증 기준:

- mounted `CommonAnomalyImageCard`가 페이지당 20개를 넘지 않는다.
- 1,200건의 총 의미와 page 이동·SKIP·이미지 오류가 유지된다.
- 같은 fixture·viewport·5회 조건으로 완료 시간, main-thread task, DOM, listener, heap을 전후 비교한다.
- 공식 SLA가 없으므로 초기 engineering target은 기존 중앙값 대비 70% 이상 단축, DOM 3,000 이하로 제안하되 최종 release budget은 성능 담당과 확정한다.

### 4.13 PERF-002 — Dashboard 90/180일 LRU scan thrash

- 원 심각도: P1
- 현재 판정: cache 동작 `Confirmed`, 운영 I/O 영향 `Unknown`
- 현재 근거: 일별 aggregate LRU는 32 entry이고 오래된 날짜부터 순차 scan한다. 같은 90/180일 범위의 두 번째 scan에서도 합성 hit가 0이었다.

조치 계획:

1. synthetic Parquet 10/30/90/180일 cold·warm 측정으로 file open/read count, hit, p50/p95, event-loop delay와 RSS 기준선을 먼저 만든다.
2. entry 수를 무조건 180 이상으로 늘리지 않는다. 실제 aggregate byte와 process memory budget을 먼저 정한다.
3. 우선 후보는 날짜별 raw row가 아니라 기간 aggregate response cache다. key에는 날짜 범위, Line 집합, 선택 file fingerprint와 mapping version을 포함한다.
4. cache는 byte-aware eviction, 유한 TTL과 file/mapping 변경 무효화를 가져야 한다.
5. 기간 response cache가 부적합하면 일별 aggregate scan 순서 개선과 byte-aware daily cache를 비교 측정한다.
6. read concurrency 변경은 저장장치 특성과 event-loop 측정 후 별도 결정한다.

완료 기준:

- 동일 90/180일 warm 재조회에서 불필요한 Parquet read가 실제로 감소한다.
- p95가 개선되고 peak RSS·cache byte가 승인된 상한 안에 있다.
- 파일 또는 mapping 변경 후 stale aggregate를 반환하지 않는다.

## 5. 통합 작업 패키지와 순서

| 순서 | 작업 패키지 | 포함 항목 | 성격 | 선행 조건 |
|---:|---|---|---|---|
| 0 | `MX-01` Mock 계약 복구 | BQA-003 | `mock-agent` | 없음, Core 계약 준수 |
| 1 | `CORE-01` Dashboard 응답 무결성 guard | BQA-001, BQA-002 | 즉시 구현 | 불변조건 문서화 |
| 2 | `CORE-02` Dashboard stale 표시 제거 | CA-005; CA-004는 D-04로 0 보정 유지 | 적용 완료 | 없음 |
| 3 | `CORE-03A` 오류 응답 긴급 축소 | CA-002 error/debug 부분 | 적용 완료 | 없음 |
| 4 | `CORE-04` Mapping fail-closed | CA-006 | 다음 구현 단위 | D-05 승인 완료 |
| 5 | `CORE-05` Identity·Mailing authorization | CA-001, CA-007 | 보안 계약 변경 | 위임·관리자·legacy 정책 승인 |
| 6 | `CORE-03B` opaque resource 전환 | CA-002 success path 부분 | 호환 migration | resource ID 설계 |
| 7 | `CORE-06` strict source integrity | CA-003, CA-008 | 데이터 계약 변경 | timezone·Line alias 결정 |
| 8 | `CORE-07` 공통부 20개 pagination | PERF-001 | 성능·UI | 클릭이력 의미 보존 |
| 9 | `CORE-08` Dashboard cache 측정·개선 | PERF-002 | 측정 선행 | memory·latency budget |

1차 Core 조치 범위는 `CORE-01`과 `CORE-02`다. `CORE-01`과 `MX-01`은 독립적으로 진행할 수 있다. `CORE-03A`는 전체 resource ID 전환을 기다리지 않고 먼저 적용한다. `CORE-05`, `CORE-03B`, `CORE-06`은 선행 계약을 생략하고 구현하지 않는다.

각 작업 패키지는 별도 review 단위로 유지한다. P0 guard, 보안 권한, resource migration과 성능 변경을 한 번에 배포하지 않는다.

## 6. 검증 계획

### 6.1 Core unit·contract

| 영역 | 필수 검증 |
|---|---|
| Dashboard 무결성 | 정상·empty·partial·합계 불일치·범위 밖 Line·필터 echo mismatch |
| 숫자 | D-04에 따라 `TL.total`의 0·유효 숫자 문자열은 값이 유지되고, null·빈 문자열·NaN형 문자열·overflow는 0으로 보정되는지 검증 |
| 날짜 | 정상, 월·일·윤일·시각 경계, suffix, Date, epoch 단위 |
| identity/권한 | 본인, 타인, 위임, 관리자, 사용자 없음, DB 오류, timeout, body 변조 |
| 오류 노출 | CORE-03A error body의 path·DB detail·사용자 행 부재; CORE-03B success body의 legacy path 부재 |
| Mapping | 500, empty, 잘못된 type, stale snapshot, write 차단 |
| My EQP Line | 정상 Line, 공식 alias, 혼합 Line, 전부 mismatch |
| pagination | 0·1·20·21·1,200 row, EQP 경계 분할, filter/page reset, off-page 미마운트 |
| cache | 10·30·90·180일 cold/warm, invalidation, byte eviction, 동시 요청 dedupe |

### 6.2 현재 `main`에서 사용하는 검증 진입점

- `npm run lint`
- `npm run test:unit`
- `npm run test:contract`
- `npm run test:integration`
- `npm run build`
- `git diff --check`

현재 `npm run test:unit`이 colocated server·frontend unit 전체를 포함하지 않는 P2 공백이 별도로 보고돼 있다. 이 공백이 해소되기 전에는 P0/P1 변경 증거에 기존 colocated `node:test` 실행 결과도 별도로 기록해야 한다. test 범위를 줄이거나 assertion을 완화해 통과시키지 않는다.

### 6.3 `mock-agent` 재검증

- `normal`, `partial`, `inconsistent`, `slow`, `error-*`, `large` 시나리오
- P0 각 5회 반복
- 자설비 `Sensor=ALL/ch_step=ALL`, 숫자 pagination, page 밖 network 요청
- 공통부 1,200건 pagination과 성능 5회 비교
- 운영 DB·운영 파일·실제 메일 미사용

Mock E2E·Playwright와 browser 성능 측정은 `main` Core 필수 검증에 포함하지 않고 `mock-agent`에서 수행한다.

## 7. 문서·계약 동시 갱신 계획

| 변경 | 동시 갱신 대상 |
|---|---|
| Dashboard 불변조건·숫자 오류 | `docs/features/dashboard.md`, Dashboard Schema/fixture, contract test, 사용자 오류 안내 |
| Mailing 권한 | `docs/features/mailing.md`, `docs/system/security.md`, 사용자 매뉴얼, API 권한 contract |
| opaque resource | `docs/system/data-flow.md`, `docs/features/{dashboard,self-equipment,abnormal-data}.md`, Schema/fixture, API client test |
| strict 날짜 | Self/Common 데이터 문서, diagnostics/error contract, unit test |
| Mapping fail-closed | 각 기능 문서, troubleshooting, 사용자 매뉴얼 |
| My EQP Line | Self·abnormal data 문서, integration test, 사용자 매뉴얼 영향 확인 |
| 공통부 pagination | abnormal data 문서, 사용자 매뉴얼, UI/component test |
| Dashboard cache | dashboard·data-flow 문서, performance evidence, runbook 관찰 항목 |

## 8. 선행 결정이 필요한 항목

| 결정 ID | 질문 | 권장안 | 미결정 시 처리 |
|---|---|---|---|
| D-01 | Mailing 타 recipient 등록·조회·삭제 권한 | actor 인증, 본인 조회/삭제, 위임은 명시 권한과 audit | 타인 작업 차단 또는 CA-001 미해결 유지 |
| D-02 | 등록 actor 저장 방법 | additive audit field/table 후 migration | 운영 DB 변경 금지, self-only 임시안 검토 |
| D-03 | success payload resource 표현 | 검증 가능한 opaque ID/root-relative key | legacy path 제거 금지 |
| D-04 | invalid `TL.total` 정책 | **승인:** 기존 정의대로 `0` 보정 유지 | CA-004 fail-closed 미적용; 현행 계약 유지 |
| D-05 | mapping fallback 정책 | **승인:** read/write fail-closed; 필요 시 versioned read-only snapshot | CORE-04에서 구현; write에는 fallback 사용 금지 |
| D-06 | Line path와 `line_rev` 관계 | 공식 alias set 후 mismatch fail-closed | `includeAllLines` 임의 제거 금지 |
| D-07 | cache memory·latency budget | byte 상한과 warm p95를 먼저 확정 | entry 수 확대 금지 |

## 9. Release gate와 중단 조건

다음 중 하나라도 발생하면 관련 패키지의 release를 중단한다.

- 합계·상세 또는 요청·응답 범위 불일치를 정상 Dashboard로 표시함
- 새 filter 아래 이전 범위 KPI·추이를 정상값처럼 표시함
- 무권한 사용자가 다른 사용자의 Mailing/My EQP 행을 조회·변경함
- CORE-03A 보호 대상 실패 응답에 절대 운영 경로, DB detail, debug registration row가 남음. 성공 path는 CORE-03B gate로 분리한다.
- invalid 날짜가 정상 point로 보정됨. 단, `TL.total`의 0 보정은 D-04 승인 예외다.
- Mapping 실패 중 write가 실행됨
- My EQP success payload에 허용되지 않은 Line 행이 포함됨
- 공통부 한 페이지에 20개를 초과하는 card가 mount됨
- cache 변경 후 stale 응답 또는 승인된 memory 상한 초과가 발생함
- Schema·fixture·contract·문서와 코드가 같은 변경에서 갱신되지 않음

## 10. Unknown, Mismatch와 잔여 위험

### Unknown

- 외부 gateway, SSO, proxy와 실제 API 접근 통제
- 운영에서 Dashboard 부분·범위 불일치가 발생한 적이 있는지
- 실제 DB의 legacy remote-address owner row와 권한·migration 조건
- 운영 데이터의 invalid 날짜·숫자 발생 빈도와 upstream Schema
- `line_rev` alias master와 원천 파일의 Line 격리 보장
- 운영 filesystem의 90/180일 read 비용, 메모리 한도와 동시접속
- 공식 성능 SLA와 browser/device 분포

### Mismatch

- Mailing 감사의 self-only 방향과 사용자 매뉴얼의 타 수신인 지정 기능
- 내부 경로 제거 목표와 현재 Dashboard Schema·chart path 소비 계약
- My EQP Line 격리 권고와 `includeAllLines`를 기대하는 기존 unit test
- 자설비 제품 검수 요구와 row를 0으로 만드는 Mock Line 타입 계약

### 잔여 위험

- 프런트 검증은 손상 응답 표시를 막지만 서버 권한·원천 무결성을 대신하지 않는다.
- opaque resource 전환 중 legacy path를 병행하면 노출 위험이 완전히 해소되지 않는다.
- client pagination은 DOM 병목을 줄이지만 1,200-row payload와 서버 집계를 줄이지 않는다.
- cache hit 개선은 메모리·staleness trade-off를 새로 만들 수 있다.

## 11. 최종 권고

`CORE-01`과 `CORE-02` 적용 후 다음 release 단위는 `CORE-03A`로 제한한다. 등록·파일·Dashboard·history API의 server/dependency 실패는 고정된 사용자 메시지, 안정적 `code`, `requestId`만 반환하고 DB detail·debug row·원문 exception·실패 경로를 반환하거나 helper stderr로 기록하지 않는다. 정상 성공 응답의 `sourcePath(s)`는 호환 전환이 필요한 `CORE-03B` 범위로 유지한다.

D-04에 따라 `TL.total`의 기존 0 보정은 유지한다. D-05는 권장안대로 승인됐으므로 `CORE-03A` 검증 후 `CORE-04`에서 mapping read/write를 fail-closed하고, versioned snapshot이 필요하더라도 조회 전용으로만 허용하며 모든 write에는 fallback을 사용하지 않는다. 권한·resource ID·Line alias처럼 별도 계약이 필요한 변경은 승인된 정책과 additive migration을 준비한 뒤 진행한다.

이 계획은 P0 2건과 P1 11건을 모두 추적하며, 운영 자원을 직접 조사하거나 변경하지 않고 Core와 `mock-agent` 경계를 유지한다.

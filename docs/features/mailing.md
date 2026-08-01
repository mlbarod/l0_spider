# L0 Spider 메일 생성 및 발송 계약 기준

> 문서 목적: 메일 관련 현재 구현, template 요구, 계약 가능 범위와 발송 공백을 구분한다.
> 문서 상태: `Baseline`
> 기능 범위: `As-Is`
> 기준 브랜치: `main`
> 작업 시작 기준 commit: `ab2e27c`
> 관련 Flow ID: `DF-MAIL-01`, `DF-MAIL-02`, `DF-STEP-01`
> 조사 방식: 저장소 정적 조사만 수행했으며 실제 DB·`/appdata`·메일 시스템을 사용하지 않았다.
> 브랜치 경계: `mock-agent`의 mock SMTP·recipient·renderer·E2E는 `External Branch / Out of Scope`다.

## 1. 문서 목적과 범위

이 문서는 메일 수신 조건 등록, Dashboard 요약 생산, HTML template, 링크와 실제 발송 사이의 현재 경계를 정의한다.
현재 코드에서 확인된 생산 구조와 template에 기록된 요구를 분리하고, 확인되지 않은 sender 동작을 구현 사실로 확대하지 않는다.
상태는 `Confirmed`, `Documented`, `Inferred`, `Unknown`, `Mismatch`, 위험은 `Risk`로 표시한다.
계약 준비도는 `Schema Ready`, `Needs Confirmation`, `Blocked`를 사용한다.

이번 단계의 실행 가능한 계약 대상은 `lineDashboard.mailingSummary` 배열 fragment다.
전체 template context, 렌더링 결과와 전송 요청·응답은 생산자가 없어 계약 대상에서 제외한다.
메일 등록 API의 전체 명세도 이번 `mailing-summary` Schema 범위가 아니다.

## 2. 조사 결과 요약

| 영역 | 현재 결과 | 상태 | 준비도 |
|---|---|---|---|
| Dashboard 메일 요약 | `lineDashboard.mailingSummary` 생산자와 집계 규칙 존재 | `Confirmed` | `Schema Ready` |
| 수신 조건 등록 | `email`, `myeqp_regist` DB 등록·조회 코드 존재 | `Confirmed` | 이번 Schema 범위 밖 |
| HTML template | Jinja 호환 변수·loop·link·빈 상태 존재 | template `Confirmed` | context는 `Blocked` |
| context 조립 | Dashboard·등록 조건을 수신자별 row로 결합하는 코드 없음 | `Unknown` | `Blocked` |
| renderer | Jinja renderer와 호출 가능한 render 함수 없음 | `Unknown` | `Blocked` |
| trigger·scheduler | job·CLI·API·systemd·cron 진입점 없음 | `Unknown` | `Blocked` |
| sender·transport | SMTP·메일 API·credential·전송 함수 없음 | `Unknown` | `Blocked` |
| 발송 결과 | timeout·retry·중복 방지·audit log 없음 | `Unknown` | `Blocked` |

`public/mailing-report.html`의 존재는 실제 렌더링이나 자동 발송을 증명하지 않는다.
`/api/mailing-registration`은 수신 조건 관리 API이며 메일 생성 또는 발송 trigger가 아니다.

## 3. 현재 구성요소와 책임

| 구성요소 | 위치 | 확인된 책임 | 하지 않는 일 | 상태 |
|---|---|---|---|---|
| Dashboard producer | `server/dashboardData.mjs` | KPI와 `mailingSummary` 생성 | recipient 결합·render·send | `Confirmed` |
| Mailing 등록 API | `server/mailingRegistration.mjs` | 입력 검증, Python helper 호출 | 메일 주소 변환·send | `Confirmed` |
| Mailing DB helper | `scripts/mailing_registration.py` | `email` row merge·list·delete | report row 생성 | `Confirmed` |
| MY EQP 등록 API | `server/myEqpRegistration.mjs` | 수신 식별자·EQP·기간 등록 | mail context 생성 | `Confirmed` |
| MY EQP DB helper | `scripts/my_eqp_registration.py` | `myeqp_regist` 접근과 active query 지원 | sender recipient union | `Confirmed` |
| 메일 template | `public/mailing-report.html` | 표시 변수, 표, 링크와 빈 상태 정의 | 실행 가능한 renderer·sender | `Confirmed` |
| 브라우저 등록 화면 | `MailingRegistrationPage`, `MyEqpRegistrationPage` | 조건 입력·조회·삭제 | 메일 발송 | `Confirmed` |

## 4. 실행 진입점, trigger와 주기

저장소에서 확인된 메일 관련 HTTP 진입점은 조건 관리용 `GET`, `POST`, `DELETE /api/mailing-registration`이다.
Dashboard 요약은 `GET /api/dashboard-data` 요청 시 생성되지만 이 요청이 메일 job을 시작하지는 않는다.
메일 생성 전용 endpoint, CLI, import 가능한 job 함수, cron, systemd timer와 scheduler 설정은 발견되지 않았다.

| 항목 | 확인 결과 | 상태 |
|---|---|---|
| 생성 trigger | 확인된 실행 진입점 없음 | `Unknown` |
| 발송 trigger | 확인된 실행 진입점 없음 | `Unknown` |
| 발송 주기 | 설정·코드 없음 | `Unknown` |
| 수동 재실행 | command·API 없음 | `Unknown` |
| 동시 실행 제어 | lock·lease·leader election 없음 | `Unknown` |
| 중복 job 방지 | idempotency key·run ID 없음 | `Unknown` |

template footer의 “자동 발송” 문구는 표시 문구이며 현재 저장소의 scheduler 근거가 아니다.

## 5. 기준 날짜, 시각과 timezone

Dashboard는 `YYYY-MM-DD hh:mm:ss` 형식의 detail filename을 데이터 기준 시각으로 사용한다.
기간별로 각 날짜의 최신 filename을 선택하고, 전일 비교는 D-1의 동일 `hh:mm` 중 가장 늦은 초 파일을 선택한다.
날짜 유효성 검사와 D-1 계산에 UTC 기반 `Date`를 사용하지만 filename의 업무 timezone을 UTC로 선언한 코드는 없다.

| context·기준 | 후보 원천 | 형식·nullable | timezone | 상태 |
|---|---|---|---|---|
| `start_date` | `lineDashboard.filters.startDate` 후보 | `YYYY-MM-DD` | 업무 의미 `Unknown` | `Inferred` |
| `end_date` | `lineDashboard.filters.endDate` 후보 | `YYYY-MM-DD` | 업무 의미 `Unknown` | `Inferred` |
| `latest_date_time` | `lineDashboard.summary.latestDateTime` 후보 | string 또는 `null` | `Unknown` | `Inferred` |
| `dashboard_previous_date_time` | `lineDashboard.summary.previousDateTime` | string 또는 `null` | `Unknown` | mapping `Documented` |
| `generated_at` | renderer clock 후보 | 형식·nullable 미정 | `Unknown` | `Unknown` |
| MY EQP active 기준 | DB `NOW()`과 `exec_date + periode` | DB timestamp | DB timezone `Unknown` | 코드 `Confirmed` |

메일 생성 날짜와 Dashboard 데이터 기준 날짜가 다를 때의 허용 범위, stale data 정책과 timezone 표시 규칙은 `Unknown`이다.

## 6. 데이터 원천

| 데이터 | 원천 | 읽기 주체 | 메일에서의 역할 | 상태 |
|---|---|---|---|---|
| Dashboard detail | 날짜별 Parquet | `dashboardData.mjs` | 이상 고유건과 `mailingSummary` | `Confirmed` |
| Dashboard stats | 최신 시각 stats Parquet | 같은 module | monitoring sensor total | `Confirmed` |
| Line·SDWT mapping | mapping JSON | 같은 module | SDWT→Line·표시 SDWT | `Confirmed` |
| 전체설비 수신 조건 | DB `email` | Python helper | recipient별 SDWT·Grade 후보 | 저장 `Confirmed`, 결합 `Unknown` |
| MY EQP 조건 | DB `myeqp_regist` | Python helper | recipient별 EQP·기간 후보 | 저장 `Confirmed`, 결합 `Unknown` |
| template | `public/mailing-report.html` | 외부 renderer 후보 | HTML 구조 | `Confirmed` |

실제 운영 파일과 DB row는 조사하지 않았으며 데이터 생산 주기·완료 신호·신선도 SLA는 `Unknown`이다.

## 7. Dashboard 메일 요약 집계 계약

`lineDashboard.mailingSummary`는 `lineDashboard.summary`의 하위가 아니라 sibling 배열이다.
생산자는 detail row의 SDWT를 mapping으로 Line과 표시 SDWT에 연결한다.
mapping에 없는 row는 집계에서 제외되고 `meta.unmappedRows`에 반영된다.

고유건 식별 key는 다음 5개 field를 순서대로 정규화한 조합이다.

```text
desc | recipe_id | priority | sensor | eqp
```

실제 구현 구분자는 내부 `\u0000`이며 외부 JSON에 노출되지 않는다.
각 날짜 안에서 같은 5-key 조합을 중복 제거하고 `Line + SDWT + 원본 priority`별 count를 만든다.
조회 기간의 날짜별 count를 같은 group에 합산하므로 같은 조합도 서로 다른 날짜에서는 각각 1건으로 합산된다.
요청 `line` filter가 있으면 선택 Line만 남긴다.

| field | 타입 | required | nullable·빈값 | 생산 규칙 |
|---|---|---|---|---|
| `lineId` | string | 예 | non-empty | mapping된 Line 원문 |
| `sdwt` | string | 예 | non-empty | mapping display 값, 없으면 정규화 key |
| `sensorGrade` | string enum | 예 | non-null | `A`, `B`, `D`, `M`, `N`만 허용 |
| `abnormalCount` | integer | 예 | 0 이상 | 날짜별 고유 5-key count 합 |

정렬은 `lineId` 자연 정렬, `sdwt` 자연 정렬, Grade `A → B → D → M → N` 순서다.
A와 B는 이 배열에서 `A/B`로 합치지 않는다.
유효 row가 없으면 `mailingSummary`는 빈 배열이다.

## 8. Template context 인벤토리

template에서 이름 또는 소비가 확인된 context는 다음과 같다.

| 변수 | template 소비 | 타입 근거 | 생산·mapping | 상태 |
|---|---|---|---|---|
| `spider_base_url` | 메인·상세 link prefix | string 요구 | 값 결정 주체 없음 | 소비 `Confirmed`, 생산 `Unknown` |
| `generated_at` | 생성 시각 표시 | string 후보 | renderer clock 후보 | `Unknown` |
| `latest_date_time` | preheader·header | string 후보 | Dashboard latest 후보 | `Inferred` |
| `start_date`, `end_date` | 조회 기간 표시 | string 후보 | Dashboard filters 후보 | `Inferred` |
| `dashboard_monitoring_sensor_total` | integer format | raw number 요구 | `summary.monitoringSensorTotal` | mapping `Documented` |
| `total_abnormal_count` | integer format | raw number 요구 | `summary.totalAbnormalCount` 후보 | `Inferred` |
| `ab_grade_count` | integer format | raw number 요구 | `summary.abGradeCount` 후보 | `Inferred` |
| `d_grade_count` | integer format | raw number 요구 | `summary.dGradeCount` 후보 | `Inferred` |
| `n_grade_count` | integer format | raw number 요구 | `summary.nGradeCount` 후보 | `Inferred` |
| `m_grade_count` | integer format | raw number 요구 | `summary.mGradeCount` 후보 | `Inferred` |
| `dashboard_previous_date_time` | 조건부 비교시각 | nullable 후보 | `summary.previousDateTime` | mapping `Documented` |
| `dashboard_change_from_previous_day` | 이미 format된 표시 text | string | numeric change 변환 주체 없음 | format `Documented`, 생산 `Unknown` |
| `dashboard_change_color` | inline CSS color | 3개 hex 후보 | numeric change에서 파생 | 규칙 `Documented`, 생산 `Unknown` |
| `recipient_knox_id` | 두 row list filter | string | 최종 recipient 결정 없음 | 소비 `Confirmed`, 생산 `Unknown` |
| `rows` | 전체설비 table | object array | 조건+summary 결합 없음 | shape `Documented`, 생산 `Unknown` |
| `my_eqp_rows` | MY EQP table | object array, default `[]` | 별도 집계·결합 없음 | shape `Documented`, 생산 `Unknown` |

full context의 required, nullable, 기본값과 잘못된 타입 처리 방식은 renderer가 없어 확정할 수 없다.
따라서 template context 전체는 `Blocked`이며 이번 JSON Schema의 대상이 아니다.

## 9. KPI 변수 규칙

template 주석은 다음 세 값을 같은 무필터 `GET /api/dashboard-data` 응답에서 가져오도록 요구한다.

- `dashboard_monitoring_sensor_total` ← `lineDashboard.summary.monitoringSensorTotal`
- `dashboard_previous_date_time` ← `lineDashboard.summary.previousDateTime`
- `dashboard_change_from_previous_day` ← `lineDashboard.summary.changeFromPreviousDay`의 numeric 의미를 보존한 표시 문자열

`dashboard_change_color`는 numeric change가 증가면 `#d97706`, 감소면 `#059669`, 동일·비교 없음이면 `#667085`로 기록돼 있다.
실제 formatter 함수와 renderer가 없으므로 화살표·문구·색상 생성은 `Documented`이며 실행 검증은 `Blocked`다.
sender가 stats file이나 전일 파일을 독자적으로 다시 선택해서는 안 된다는 규칙도 template 주석에만 존재한다.

## 10. 전체설비 `rows` 결합 후보

template이 소비하는 field는 `knox_id`, `line_name`, `sdwt`, `sensor_grade`, `dashboard_abnormal_count`다.
`dashboard_abnormal_count`는 `lineDashboard.mailingSummary[].abnormalCount`에서 가져오도록 명시돼 있다.
나머지 field는 `email` 등록 조건과 `mailingSummary`를 결합해 생성해야 하지만 해당 join 구현은 없다.

예상 join key는 이름상 SDWT·Grade이며 Line은 mapping 또는 summary에서 얻을 수 있지만 실제 선택 규칙은 `Unknown`이다.
등록 조건에 존재하지만 이상건이 0인 row를 포함할지, summary에 존재하는 row만 포함할지도 `Unknown`이다.
따라서 `rows` context Schema와 fixture는 생성하지 않는다.

## 11. MY EQP `my_eqp_rows` 결합 후보

template은 `knox_id`, `line_name`, `sdwt`, `prc_group`, `eqp`, `sensor_grade`, `dashboard_abnormal_count`를 소비한다.
주석은 active `myeqp_regist`를 recipient별로 filter하고 Dashboard와 같은 5-key 고유건 규칙으로 별도 집계하도록 요구한다.
그룹 후보는 날짜·Line·SDWT·EQP·Sensor Grade지만 실제 생산 함수는 없다.
이 count를 `lineDashboard`에 추가하지 않는다는 경계가 문서화돼 있다.

active의 정확한 mail 실행 시점, public row 처리, 0건 포함, 중복 등록과 부분 mapping 처리는 `Unknown`이다.
따라서 MY EQP summary Schema와 fixture도 이번 단계에서 생성하지 않는다.

## 12. Link 계약

| 목적 | template URL | 상태 | 비고 |
|---|---|---|---|
| SPIDER 메인 | `{spider_base_url}/` | template `Confirmed` | base URL 생산 `Unknown` |
| 전체설비 | `/self-equipment?line={LINE}&sdwt={SDWT}&grade={GRADE}` | template `Confirmed` | `urlencode`, 새 tab, `noreferrer` |
| MY EQP | `/self-equipment?line={LINE}&sdwt=MY_EQP&grade={GRADE}&step=ALL&eqpCh={EQP}` | template `Confirmed` | `ALL` 정상 분기 |
| 개별 STEP | `step={HMAC_TOKEN}` 후보 | `Mismatch` | 현재 template link 없음 |

MY EQP link는 `row.prc_group`을 URL에 넣지 않고 `row.eqp`을 `eqpCh`로 전달한다.
`step=ALL`은 HMAC 우회가 아니라 현재 구현된 MY EQP 전체 STEP sentinel이다.
개별 STEP HMAC 생성·검증은 없으며 메일도 개별 STEP token을 생산하지 않는다.

## 13. 발신자와 수신자 결정

`email.email` column에는 현재 API가 받은 `knox_id` 문자열이 저장되며 실제 이메일 주소 변환은 확인되지 않았다.
Mailing 등록은 `knoxId` 또는 `knoxIds`, SDWT와 고정 priority `A`, `B`, `D`, `M`, `N`을 저장한다.
MY EQP 등록은 Line·SDWT·PRC Group·EQP·기간·`knox_id`를 저장한다.

template 주석은 `email.email`과 active `myeqp_regist.knox_id`의 합집합을 recipient set으로 사용하도록 요구한다.
이 union, 주소 directory lookup, 발신자 주소와 envelope/header recipient를 결정하는 코드는 없다.
다른 recipient의 `rows`나 `my_eqp_rows`를 포함하지 말라는 분리 규칙은 `Policy`지만 sender 적용은 `Needs Validation`이다.

| 항목 | 상태 |
|---|---|
| recipient identifier 등록 | `Confirmed` |
| 실제 이메일 주소 해석 | `Unknown` |
| recipient union·dedupe | `Documented`, 실행 `Unknown` |
| 발신자 identity | `Unknown` |
| CC·BCC·reply-to | `Unknown` |
| 수신 동의·권한 검증 | `Unknown` / `Risk` |

실제 이메일 주소나 수신 식별값은 이 문서와 fixture에 포함하지 않는다.

## 14. Renderer와 실제 전송

저장소에는 Jinja package, template environment, auto-escape 설정 또는 import 가능한 render 함수가 없다.
Python dependency 파일에는 PyMySQL만 선언돼 있으며 Node manifest에도 mail transport가 없다.
SMTP host·port·TLS·credential, mail API endpoint, sender 함수와 전송 command를 발견하지 못했다.

| 전송 항목 | 상태 |
|---|---|
| HTML renderer | `Unknown` / `Blocked` |
| auto-escape 실제 적용 | `Policy` / `Needs Validation` |
| subject·from·to header | `Unknown` |
| SMTP/API transport | `Unknown` |
| connection timeout | `Unknown` |
| 전송 timeout | `Unknown` |
| retry·backoff | `Unknown` |
| 중복 발송 방지 | `Unknown` |
| 성공·실패 audit log | `Unknown` |
| 실제 발송 차단 flag | `Unknown` |

등록 helper의 15초 timeout은 DB 조건 관리용이며 메일 전송 timeout이 아니다.
안전하게 호출할 renderer가 없으므로 `tests/unit/mailing-render.test.mjs`는 `Blocked`로 미생성한다.

## 15. 빈 데이터와 부분 실패

`mailingSummary`는 생산자에서 빈 배열이 가능하며 existing Dashboard empty fixture와 builder 결과가 이를 뒷받침한다.
template의 전체설비·MY EQP loop는 각각 `{% else %}` 빈 행을 표시한다.
한 section이 비어도 다른 section의 row를 렌더링하라는 규칙은 template 주석에 있다.

전체 context가 없을 때 메일을 발송할지, 두 section이 모두 비면 발송을 생략할지, Dashboard 일부 실패 시 이전 데이터를 사용할지는 `Unknown`이다.
recipient 일부 전송 성공 뒤 실패했을 때 retry 범위와 중복 방지도 `Unknown`이다.
Mailing 등록의 복수 recipient 저장은 순차 실행되므로 후반 실패 시 앞선 DB commit을 묶어서 rollback하지 못할 수 있다(`Risk`).

## 16. 계약 대상과 Schema Ready 판정

### 16.1 선택한 계약 대상

파일 `harness/contracts/mailing-summary.schema.json`은 다음 값 하나만 검증한다.

```text
GET /api/dashboard-data 성공 body의 lineDashboard.mailingSummary
```

Schema root는 array이며 full Dashboard body, template context, `rows`, `my_eqp_rows`, recipient와 전송 결과를 포함하지 않는다.
현재 Dashboard Schema가 item 추가 field를 허용하므로 focused Schema도 추가 property를 차단하지 않는다.

### 16.2 준비도 판정

| 계약 후보 | 판정 | 근거 |
|---|---|---|
| `lineDashboard.mailingSummary` | `Schema Ready` | 생산 함수, field·타입·필수·빈 배열·정렬 확인 |
| Dashboard KPI 원본 | 기존 Dashboard Schema 범위 | 별도 중복 Schema를 만들지 않음 |
| formatted KPI context | `Blocked` | formatter·renderer 없음 |
| 전체설비 `rows` | `Blocked` | DB 조건 join producer 없음 |
| MY EQP `my_eqp_rows` | `Blocked` | 별도 집계·join producer 없음 |
| recipient·send payload | `Blocked` | 주소 해석·transport 없음 |
| 전송 결과·오류 | `Blocked` | sender protocol 없음 |

`mailingSummary` item은 네 field가 모두 required이고 null을 허용하지 않는다.
빈 성공 구조 `[]`가 확인돼 success와 empty synthetic fixture를 모두 작성한다.

## 17. Fixture와 contract test

fixture는 운영 정보가 없는 synthetic 값만 사용한다.
success fixture는 허용 Grade와 정렬된 row shape를 제공하고 empty fixture는 `[]`다.
contract test는 기존 Ajv 2020 validator와 `node:test`, `npm run test:contract`를 재사용한다.

검증 범위는 다음과 같다.

- Schema compile
- success·empty fixture validation
- root·required·enum·integer·minimum 오류 거부
- synthetic `buildLineDashboardPayload()` 결과 validation
- 5-key 중복 제거, 날짜별 합산, Grade filtering과 정렬
- 빈 producer 결과

실제 API, 파일, DB 또는 sender는 test에서 호출하지 않는다.

## 18. 오류와 관찰성

Dashboard API 실패는 `400`, `404`, `500`에서 `{ok:false,code,error,requestId}` 보호 오류 구조를 사용하지만 이 문서의 Mailing summary Schema는 성공 fragment만 다룬다.
Mailing 등록 helper stderr는 Node process log에 전달하지 않고, API error body는 고정 메시지·안정적 code·request ID만 반환한다. DB detail·debug row·table·recipient 입력값은 실패 body에 포함하지 않는다.
sender log, recipient별 delivery status와 보존 정책은 `Unknown`이다.

메일 계약 test 실패는 Schema drift를 의미할 뿐 운영 발송 실패를 검증하지 않는다.

## 19. Mismatch

| ID | 코드·현재 구조 | 다른 자료·표현 | 영향 |
|---|---|---|---|
| `MAIL-M01` | 실제 위치는 `lineDashboard.mailingSummary` | `lineDashboard.summary.mailingSummary` 후보 | 잘못된 consumer path 가능 |
| `MAIL-M02` | `email.email`에 `knox_id` 저장 | column 이름은 실제 mail address처럼 보임 | 주소 해석·개인정보 오해 |
| `MAIL-M03` | sender·scheduler 구현 없음 | template footer는 자동 발송 문구 표시 | 저장소만으로 실행 사실 확정 불가 |
| `MAIL-M04` | 개별 STEP HMAC producer 없음 | 개별 token link 후보 | mail 개별 STEP link 불가 |

## 20. Unknown과 Risk

### 주요 Unknown

- job owner, trigger, schedule, timezone과 실행 환경
- full template context producer와 field nullable·default
- recipient union, 실제 주소 lookup, sender identity와 권한
- My EQP mail count producer와 active/public 처리
- renderer, auto-escape 실제 설정, subject와 attachment
- SMTP/API transport, credential, timeout, retry와 rate limit
- idempotency, 중복 방지, partial failure와 audit log
- 두 section 모두 빈 경우의 발송 정책

### 주요 Risk

- recipient별 row 분리가 구현에서 검증되지 않아 오발송 가능성이 있다.
- query link는 Line·SDWT·Grade·EQP 정보를 주소·메일·log에 노출할 수 있다.
- 등록 API 오류는 문의 코드만 사용자에게 제공하므로 상세 원인 확인에는 보호된 server-side 관찰 체계가 추가로 필요하다.
- 실제 발송 차단 flag가 확인되지 않아 sender가 별도 환경에 있다면 안전 경계 확인이 필요하다.
- 날짜 filename, DB `NOW()`와 renderer 시각의 timezone 불일치 가능성이 있다.

위 위험은 공식 수용된 위험이 아니라 확인·결정이 필요한 항목이다.

## 21. 변경 영향과 보존 규칙

- `lineDashboard.mailingSummary`의 위치, field, Grade와 집계 key 변경 시 Dashboard 문서·Schema·fixture·contract test를 함께 갱신한다.
- 5-key 고유건 규칙 변경은 Dashboard KPI, 전체설비 mail count와 향후 MY EQP count를 함께 검토한다.
- template 변수 변경 시 context producer가 확인되기 전에는 required·nullable을 추정하지 않는다.
- recipient join 변경 시 다른 recipient 데이터가 섞이지 않는 격리 test가 필요하다.
- `step=ALL`·`eqpCh` 링크 변경 시 Self Equipment, STEP 문서와 ADR을 함께 검토한다.
- sender 도입 시 기본 발송 차단, synthetic recipient, timeout·retry·idempotency와 audit 계약을 먼저 정의한다.
- 실제 발송 검증과 운영 recipient를 Core unit·contract test에 사용하지 않는다.

## 22. Core Harness와 mock-agent 경계

- `main`은 `mailingSummary` Schema, synthetic fixture, contract test와 이 문서의 기준이다.
- Core test는 운영 파일·DB·메일 transport에 의존하지 않는다.
- mock SMTP, mock recipient, mock renderer와 browser mail QA는 `mock-agent` 전용이다.
- 이번 조사에서 `mock-agent`를 checkout하거나 구현을 확인하지 않았다.
- mock 구현 자체는 `main`으로 병합하지 않으며 `mock-agent`가 `main` 계약을 따른다.

## 23. 후속 확인 순서

1. 실제 운영 mail job의 저장소·실행 주체·schedule을 확인한다.
2. full context producer와 recipient join을 현재 코드 기준으로 확보한다.
3. timezone, empty send, partial failure와 idempotency 정책을 결정한다.
4. side-effect 없는 renderer entrypoint와 발송 차단 경계를 분리한다.
5. 그 근거가 생긴 뒤 context Schema와 render test 준비도를 다시 판정한다.
6. sender가 확인되면 transport contract와 운영 runbook을 별도 작성한다.

## 24. 근거 자료

- `AGENTS.md` — Core Harness, 안전, 증거 상태와 mailing 범위
- `docs/system/architecture.md` — Dashboard·template·sender 경계
- `docs/system/environment-definition.md` — mail 환경변수와 timezone 공백
- `docs/system/data-flow.md:259-276` — `DF-MAIL-01/02` 흐름
- `docs/system/security.md:258-275` — recipient·escaping·sender 위험
- `docs/features/dashboard.md:225-249,321-328` — `mailingSummary` 계약과 KPI 원천
- `docs/features/self-equipment.md`, `docs/features/step-deeplink.md` — mail link 소비
- `docs/decisions/ADR-003-step-hmac-token.md` — `ALL`, `eqpCh`, 개별 HMAC 경계
- `server/dashboardData.mjs:317-385,475-526` — 집계·정렬·응답 producer
- `server/mailingRegistration.mjs`, `scripts/mailing_registration.py` — 전체설비 조건 등록
- `server/myEqpRegistration.mjs`, `scripts/my_eqp_registration.py` — MY EQP 조건 등록
- `public/mailing-report.html:20-80,82-267` — context 요구와 HTML 소비
- `harness/contracts/dashboard-api.schema.json` — 기존 Dashboard contract 정책
- `server/dashboardData.test.mjs`, `tests/contract/dashboard-api.contract.test.mjs` — 기존 test 방식

이 문서는 `ab2e27c` 시점의 저장소 기준 메일 구조를 기록한다.
현재 `Schema Ready` 판정은 `lineDashboard.mailingSummary` fragment에만 적용한다.
실제 renderer·sender·trigger·recipient 전달은 `Blocked`이며 구현됐다고 간주하지 않는다.
실제 이메일 주소, credential, 운영 데이터, secret과 token은 포함하지 않는다.

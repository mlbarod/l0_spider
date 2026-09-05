# L0 Spider STEP 딥링크 및 HMAC 기준

| 항목 | 내용 |
|---|---|
| 문서 목적 | `/self-equipment` STEP 딥링크의 현재 URL 계약과 HMAC 구현 경계를 정의한다. |
| 문서 상태 | `Active Baseline` |
| 기능 범위 | `As-Is` |
| 검증 기준 branch | `main` |
| 검증 기준 코드 commit | `99c4361164d4109a71f0153a5c963fa4f5d52cb4` |
| 최신 하네스 감사 | [reports/audit/harness-final-review.md](../../reports/audit/harness-final-review.md) |
| 관련 Flow ID | `DF-STEP-01` |
| 추적 완성도 | `Partial` |
| 주요 근거 | `AGENTS.md`, 시스템 문서, 인벤토리, Self Equipment·Dashboard 문서와 현재 코드 |
| 핵심 판정 | `step=ALL`, `eqpCh`와 MY EQP URL은 `Confirmed`; 개별 STEP HMAC 후보는 `Mismatch` |
| 조사 제한 | 실제 secret, 운영 token, `.env`, 운영 데이터와 메일 실행 결과를 조사하지 않았다. |
| 연계 범위 | 전체 보안 정의와 설계 결정은 [security.md](../system/security.md)와 [ADR-003-step-hmac-token.md](../decisions/ADR-003-step-hmac-token.md)에 존재하며 HMAC 결정은 `Proposed`다. |
| 제외 범위 | `mock-agent`의 mock key·token·브라우저 검증은 조사하지 않았다. |

## 1. 문서 목적과 범위

이 문서는 딥링크 생성부터 browser query 해석, Self Equipment 초기 상태와 서버 조회 조건까지 현재 연결을 정의한다.
현재 `main` 코드 기준 As-Is 문서이며, 실제 secret·token과 운영 식별값은 포함하지 않는다.
HMAC은 복호화 가능한 암호문이 아니며 생성·검증 근거가 없는 계약을 관례로 채우지 않는다.
메일 발송 전체 구조, 시스템 보안 정책과 설계 대안은 각각 [mailing.md](mailing.md), [security.md](../system/security.md), [ADR-003-step-hmac-token.md](../decisions/ADR-003-step-hmac-token.md)에서 관리한다.

## 2. 기능 목적

| 목적 | 사용 시나리오 | 링크 생성 주체 | 링크 소비 주체 | 상태 | 근거 |
|---|---|---|---|---|---|
| 일반 상세 진입 | Dashboard Line 상세에서 조건 적용 | `buildSelfEquipmentDetailUrl` | `FdcTrendPage` | `Confirmed` | `LineAnomalyDashboard.jsx:287-301`; `dashboardLinks.mjs:6-13` |
| 전체설비 메일 진입 | 메일의 일반 행에서 조건 적용 | Mailing template | `FdcTrendPage` | template `Confirmed` | `mailing-report.html:180-190` |
| MY EQP 전체 STEP 진입 | 등록 EQP의 모든 STEP 범위 조회 | Mailing template·MY EQP URL helper | `FdcTrendPage`·MY EQP API | `Confirmed` | `mailing-report.html:229-241`; `dashboardLinks.mjs:15-28` |
| 개별 STEP 직접 진입 | token이 가리키는 STEP 조회 후보 | 생성 주체 미확인 | 현재 소비 불가 | `Mismatch` | 제공된 후보 URL; parser·page 코드 |
| STEP 원문 비노출 | MY EQP 메일에 STEP 이름 대신 `ALL` 사용 | Mailing template | Self Equipment | `Documented`/`Confirmed` | `public/mailing-report.html`의 MY EQP 링크·template comment |

## 3. 주요 용어

| 용어 | 현재 문서에서의 의미 | 코드 표현 | 상태 | 근거 |
|---|---|---|---|---|
| STEP 원문 | 조회 filter로 쓰는 STEP 설명값 | API `desc`, row `desc` | `Confirmed` | `selfEquipmentData.mjs:203-217,308-318` |
| HMAC 입력 | 비밀키와 HMAC 함수에 전달할 message | 구현 없음 | `Unknown` | crypto 제한 검색 |
| HMAC token·digest | HMAC 계산 결과의 문자열 표현 후보 | URL `step`, `stepToken` 이름 | `Unknown` | 생성 코드 부재 |
| 서명 생성 | key와 message로 HMAC을 계산하는 절차 | 구현 없음 | `Unknown` | `createHmac` 부재 |
| 검증 | 수신 token과 예상 HMAC의 일치 판정 | 구현 없음 | `Unknown` | 비교 코드 부재 |
| 매핑 | token에 대응하는 STEP 후보를 찾는 절차 | 구현 없음 | `Unknown` | lookup 부재 |
| `step=ALL` | MY EQP의 모든 STEP을 선택하는 literal 예약값 | `MY_EQP_URL_STEP`, `ALL_STEPS` | `Confirmed` | URL utility·page·server |
| `eqpCh` | server row `eqp`와 매칭하는 단일 URL filter | `selectedEqpCh`, API `eqpCh` | `Confirmed` | Self Equipment 코드 |
| canonicalization | 서명 전 message를 결정적으로 만드는 규칙 | HMAC용 규칙 없음 | `Unknown` | 생성 코드 부재 |
| 비밀키 | HMAC 생성·검증에 필요한 server-side key 후보 | 설정 없음 | `Unknown` | 환경변수 제한 검색 |

현재 흐름에는 암호화·복호화 구현이 확인되지 않았다.

## 4. 생산자와 소비자

| 구분 | 구성요소 | 역할 | 입력 | 출력 | 상태 | 근거 |
|---|---|---|---|---|---|---|
| 생산자 | `buildSelfEquipmentDetailUrl` | 일반 상세 URL 생성 | Line·SDWT·Grade | 일반 URL | `Confirmed` | `dashboardLinks.mjs:6-13` |
| 생산자 후보 | `buildMyEqpDetailUrl` | MY EQP ALL URL 생성 | Line·Grade·eqpCh | MY EQP URL | 구현 `Confirmed`, runtime 연결 `Unknown` | `dashboardLinks.mjs:15-28`; importer 검색 |
| 생산 template | `public/mailing-report.html` | 일반·MY EQP anchor 조립 | renderer context | HTML link | template `Confirmed` | `mailing-report.html:180-241` |
| 전달자 | browser·메일 client | URL navigation | anchor | route request | 실행 `Unknown` | runtime 미검증 |
| 소비자 | `readSelfEquipmentUrlFilters` | query parse·정규화 | `URLSearchParams` | requested filters | `Confirmed` | `selfEquipmentUrlFilters.mjs:23-32` |
| 소비자 | `FdcTrendPage` | 초기 state·API query 결정 | requested filters·options | `desc`, `eqpCh` | `Confirmed` | `FdcTrendPage.jsx:1435-1558` |
| 조회 서비스 | Self Equipment handlers | `desc`·EQP filter로 payload 생성 | API query | option·rows | `Confirmed` | `selfEquipmentData.mjs:196-293,321-446` |
| HMAC 생산·검증 | 발견하지 못함 | token 생성·판정 후보 | `Unknown` | `Unknown` | `Unknown` | 제한 검색 |

## 5. URL 계약

현재 확인된 일반 상세 URL은 다음과 같다.

```text
/self-equipment?line={LINE}&sdwt={SDWT}&grade={GRADE}
```

MY EQP 전체 STEP URL은 다음과 같다.

```text
/self-equipment?line={LINE}&sdwt=MY_EQP&grade={GRADE}&step=ALL&eqpCh={EQP_CH}
```

개별 STEP 후보는 다음과 같지만 현재 구현 계약이 아니다.

```text
/self-equipment?line={LINE}&sdwt={SDWT}&grade={GRADE}&step={HMAC_TOKEN}&eqpCh={EQP_CH}
```

| 항목 | 계약 | 상태 | 근거 |
|---|---|---|---|
| route | `/self-equipment`; `/fdc_trend/self-equipment` alias | `Confirmed` | `routes.jsx:11-19,58-67` |
| navigation | Dashboard는 React Router `Link`, 메일은 HTML anchor | `Confirmed` | Dashboard·template |
| query 순서 | `URLSearchParams` lookup에 순서 의존 없음 | `Confirmed` | URL parser |
| URL encoding | JavaScript는 `URLSearchParams`, template은 `urlencode` | `Confirmed`/template `Confirmed` | builders·template |
| 직접 진입·새로고침 | production server가 SPA index로 fallback | 코드 `Confirmed` | `server.mjs:89-128` |
| 링크 공유 | 같은 최초 query를 다시 parse 가능 | `Partial` | UI 변경은 URL 미갱신 |
| fragment | 생성·소비 코드 없음 | `Confirmed` | 제한 검색 |
| base URL | JavaScript는 relative path; template은 `spider_base_url` | `Confirmed`, 값 출처 `Unknown` | builders·template |

## 6. Query parameter 계약

모든 wire 값은 URL-decoded 문자열이며 browser route 자체에서는 선택 항목이다.

| 파라미터 | 의미·반복 | 생성 주체 | 소비·누락 처리 | encoding | HMAC 포함 | 상태 | 근거 |
|---|---|---|---|---|---|---|---|
| `line` | Line; 첫 값 | builder·template | 빈 값 후 첫 유효 Line으로 보정 | URL encoding | `Unknown` | `Confirmed` | parser·page |
| `sdwt` | SDWT/MY_EQP; 반복·dedupe 후 page는 첫 값 | builder·template | 유효하지 않으면 첫 option | URL encoding | `Unknown` | `Confirmed` | parser·page |
| `grade` | Sensor Grade; 반복·dedupe | builder·template | 유효값 없으면 `A/B` | URL encoding | `Unknown` | `Confirmed` | URL utility |
| `step` | `ALL` 또는 token 후보; 첫 값 | MY EQP template·helper | 일반 누락은 빈 값, MY EQP는 항상 `ALL` | token 형식 미확인 | 대상 자체 | `Confirmed`/`Mismatch` | parser·page |
| `eqpCh` | EQP filter; 단일 첫 값 | MY EQP template·helper | 누락은 빈 값; option 불일치 시 미선택 | URL encoding | `Unknown` | `Confirmed` | parser·server |
| `eqp_ch` | `eqpCh` fallback alias | 생산자 미확인 | `eqpCh` 없을 때 소비 | browser decoding | `Unknown` | `Confirmed` | parser |

Query 이름은 대소문자 구분 방식이며 `eqpCh` 외 alias는 확인되지 않았다.
빈 parameter는 trim 후 빈 문자열이고 parameter 생략도 내부에서는 빈 문자열로 수렴한다.

## 7. 개별 STEP 흐름

| 단계 | 입력 | 처리 주체 | 처리·출력 | 신뢰 경계 | 상태 | 근거 |
|---|---|---|---|---|---|---|
| 1. STEP 결정 | STEP 원문 후보 | 생성 주체 미확인 | 입력 출처 미확인 | producer | `Unknown` | 코드 부재 |
| 2. canonicalization | STEP·기타 field 후보 | 미확인 | message 형식 미확인 | producer secret | `Unknown` | 코드 부재 |
| 3. HMAC 생성 | message·key | 미확인 | digest 미확인 | secret boundary | `Unknown` | crypto 부재 |
| 4. 문자열 변환 | digest | 미확인 | token 형식 미확인 | producer | `Unknown` | 코드 부재 |
| 5. URL 조립 | token 후보 | 실제 생산자 미확인 | `step={HMAC_TOKEN}` 후보 | URL | `Documented` | 제공 후보 |
| 6. query parsing | URL `step` | URL utility | 비-MY EQP이면 `stepToken` 보존 | browser | `Confirmed` | URL utility |
| 7. 초기 state | `stepToken` | `FdcTrendPage` | 정확히 `ALL`만 적용, 비-ALL은 빈 STEP | browser | `Confirmed` | page |
| 8. server 전달 | selected STEP | API client | `desc`만 전달; token 미전달 | browser→server | `Confirmed` | page·API client |
| 9. 검증·매핑 | token | 구현 없음 | 조회 STEP 없음 | server 후보 | `Unknown` | handler 검색 |
| 10. 데이터 조회 | `desc` | Self handler | Parquet row `desc` filter | server→file | `Confirmed` | payload builder |

`DF-STEP-01`의 개별 STEP 경로는 생성·검증 경계가 없어 `Blocked`다.

## 8. 전체 STEP(`step=ALL`) 흐름

| 항목 | 확인 결과 | 상태 | 근거 |
|---|---|---|---|
| 예약 문자열 | 정확히 `ALL` | `Confirmed` | URL constant·page |
| MY EQP parser | step 누락·다른 값도 `ALL`로 정규화 | `Confirmed` | URL utility·test |
| 대소문자 | MY EQP는 입력값을 무시해 `ALL`; 일반 SDWT는 정확한 `ALL`만 page가 인식 | `Confirmed` | parser·page |
| HMAC 생성 | 없음 | `Confirmed` | 현재 link builder·template |
| server 분기 | MY EQP handler만 `allowAllSteps=true` | `Confirmed` | `selfEquipmentData.mjs:420-428` |
| filter 처리 | `selectedDesc=ALL`이면 모든 base row 사용 | `Confirmed` | payload builder |
| `eqpCh` 결합 | 전체 STEP row에서 EQP option을 매칭 | `Confirmed` | payload builder |
| 일반 SDWT의 ALL | 일반 handler가 ALL을 허용하지 않아 빈 `desc`로 보정 | `Confirmed` | payload builder |
| API 요청 | URL `step`이 아니라 page state의 `desc=ALL` 전송 | `Confirmed` | page·API client |
| 준비도 | 현재 정상·보정 동작을 unit test로 작성 가능 | `Test Ready` | 기존 tests |

`step=ALL`은 HMAC 검증을 “우회”하는 값이 아니라 현재 코드가 정의한 예약값의 별도 정상 처리다.

## 9. HMAC 생성 위치

| 생성 위치 | 호출 주체 | 입력 | 비밀키 | algorithm | digest | 사용처 | 상태 |
|---|---|---|---|---|---|---|---|
| browser | 없음 | 미확인 | 미확인 | 미확인 | 미확인 | 없음 | `Unknown` |
| Node server | 없음 | 미확인 | 미확인 | 미확인 | 미확인 | 없음 | `Unknown` |
| Mailing 관련 코드 | template은 `ALL`만 생성 | `ALL` | 해당 없음 | 해당 없음 | 해당 없음 | MY EQP URL | `Confirmed` |
| 저장소 밖 renderer | 구현 미확인 | 미확인 | 미확인 | 미확인 | 미확인 | 개별 링크 후보 | `Unknown` |

`createHmac`, `digest()` 또는 동등한 application crypto 호출을 발견하지 못했다.
Node built-in crypto는 package dependency가 없어도 사용할 수 있으므로 manifest만으로 구현 여부를 판단하지 않았다.

## 10. HMAC 입력과 canonicalization

현재 HMAC 생성 코드가 없어 입력 계약은 `Unknown`이다. 서명 field·순서·구분자·빈 값·encoding의 결정은 [ADR-003 §4.2](../decisions/ADR-003-step-hmac-token.md#42-hmac-입력)에서 관리한다.
URL parser의 NFKC·trim 규칙을 HMAC canonicalization으로 확대 해석하지 않는다. JSON·locale 변환이나 URL encoding 전후의 message 조합도 확정하지 않는다.

## 11. 알고리즘과 token 표현

현재 algorithm·key/message encoding·digest·token 길이·대소문자·padding·prefix/version과 비교 전 변환은 정의되지 않았다. 상세 결정은 [ADR-003 §4.3](../decisions/ADR-003-step-hmac-token.md#43-알고리즘과-token-표현)을 따른다. 관례로 특정 알고리즘이나 token 형식을 추정하지 않는다.

## 12. URL encoding과 전달

| 단계 | 값 형태 | 처리 주체 | 변환 결과 | 상태 | 근거 |
|---|---|---|---|---|---|
| 일반 URL 생성 | 원문 Line·SDWT·Grade | `URLSearchParams` | percent encoding·반복 query | `Confirmed` | Dashboard builder |
| MY EQP helper | `ALL`, 선택적 eqpCh | `URL`, `searchParams.set` | encoded relative URL | `Confirmed` | `dashboardLinks.mjs:15-28` |
| 메일 URL 생성 | template variable | Jinja `urlencode` 후보 | encoded HTML attribute | template `Confirmed` | template |
| HTML separator | `&` | template | `&amp;` | `Confirmed` | template anchor |
| browser parsing | query | `URLSearchParams` | decoded strings | `Confirmed` | URL utility |
| 중복 query | `sdwt`, `grade` | `getAll`·dedupe | 배열; page는 SDWT 첫 값 | `Confirmed` | URL utility·page |
| token | 표현 형식 미확인 | 생성·parser 없음 | `+`, `/`, `=` 처리 여부 미확인 | `Unknown` | HMAC 부재 |
| double encoding | 확인된 처리 없음 | 미확인 | 결과 미확인 | `Unknown` | test 부재 |

Query parameter 순서는 소비 결과에 의미가 없고 fragment는 사용하지 않는다.

## 13. 검증 또는 STEP 매핑

| 단계 | 입력 | 처리 함수 | 비교·조회 방식 | 성공·실패 결과 | 상태 | 근거 |
|---|---|---|---|---|---|---|
| browser parse | 비-MY EQP `step` | URL utility | 문자열 보존 | `stepToken` | `Confirmed` | URL utility |
| page 소비 | `stepToken` | state initializer | `=== "ALL"` | ALL 또는 빈 STEP | `Confirmed` | page |
| API 전달 | 선택 STEP | API client | `desc` query | token은 전달 안 됨 | `Confirmed` | page·client |
| server 검증 | token 후보 | 함수 없음 | expected HMAC 비교 없음 | 판정 없음 | `Unknown` | handler 검색 |
| 후보 매핑 | token·STEP 목록 | 함수 없음 | 순회·map·DB 조회 없음 | STEP 결정 없음 | `Unknown` | 제한 검색 |
| 안전 비교 | token bytes | 함수 없음 | `timingSafeEqual` 없음 | 판정 없음 | `Unknown` | crypto 검색 |

후보 STEP 목록, 복수 매칭, token 형식 오류와 최종 `step_seq`/`step_desc` 결정 계약도 확인되지 않았다.
Token에서 STEP을 복호화하는 흐름은 없다.

## 14. 비밀키 및 환경설정

현재 STEP HMAC key loader와 생성·검증 진입점이 없어 환경변수·기본값·누락 시 동작은 정의되지 않았다. 실제 `.env`와 운영 secret은 확인하지 않았다.
설정의 구현 여부는 [환경 정의 레지스트리](../system/environment-definition.md#8-환경변수-레지스트리), 도입 시 결정 사항은 [ADR-003 §4.4](../decisions/ADR-003-step-hmac-token.md#44-secret-경계), 키·로그 보호 요구는 [보안 문서 §13~14](../system/security.md#13-step-딥링크와-hmac)를 따른다.

## 15. `eqpCh`와 서명 범위

| 단계 | `eqpCh` 처리 | HMAC 관계 | 조회 영향 | 상태 | 근거 |
|---|---|---|---|---|---|
| 생성 | MY EQP helper·template의 단일 query | 서명 포함 여부 미확인 | 초기 EQP 후보 | `Confirmed`/`Unknown` | builder·template |
| parsing | `eqpCh`, fallback `eqp_ch`; NFKC+trim | token과 별도 처리 | page state | `Confirmed` | URL utility |
| API | `eqpCh` query | token 미전달 | server filter | `Confirmed` | API client |
| server | row `eqp` exact match; MY EQP는 표기 정규화 | 암호학적 결합 없음 | sensor option 범위 | `Confirmed` | payload builder |
| 유효하지 않은 값 | server option과 불일치 시 빈 선택 | token 판정 없음 | eqp_ch 재선택 | `Confirmed` | payload builder |
| 누락 | 빈 문자열 | token 판정 없음 | EQP 미선택 | `Confirmed` | parser·page |
| 값만 변경 | 별도 filter로 처리 | token 유효성 개념 없음 | 다른 EQP 또는 미선택 | `Unknown`/`Risk` | HMAC 부재 |

코드는 `eqpCh`를 row `eqp`에 대응시키지만 정확한 장비·chamber 도메인 의미는 `Unknown`이다.

## 16. 실패 및 예외 처리

| 상황 | 감지 위치 | server·HTTP 결과 | frontend·사용자 결과 | log | 상태 | 근거 |
|---|---|---|---|---|---|---|
| route 불일치 | router/server | 명시적 client wildcard 미확인 | 결과 미확인 | 미확인 | `Unknown` | route 조사 |
| Line·SDWT·Grade 누락 | page option 보정 | active 조건으로 API 구성 | 첫 유효 option 또는 기본 Grade | 없음 | `Confirmed` | page |
| 빈 `step` | parser/page | token API 없음 | STEP 미선택; MY EQP는 ALL | 없음 | `Confirmed` | parser·page |
| 잘못된 token·길이 | validator 없음 | 전용 status 없음 | 일반 STEP 미선택과 구분 안 됨 | 미확인 | `Unknown` | 구현 부재 |
| token 매핑 실패·변조 | validator 없음 | 전용 status 없음 | 별도 오류 없음 | 미확인 | `Unknown`/`Risk` | 구현 부재 |
| 비밀키 누락 | loader 없음 | 전용 startup/API 오류 없음 | 별도 오류 없음 | 미확인 | `Unknown` | 구현 부재 |
| 후보 STEP 없음·복수 매칭 | mapping 없음 | 전용 결과 없음 | 별도 오류 없음 | 미확인 | `Unknown` | 구현 부재 |
| `ALL` 오타 | MY EQP는 입력 무시, 일반은 불인정 | 일반 server `desc=""` | STEP 재선택 | 없음 | `Confirmed` | parser·server |
| 잘못된 `eqpCh` | server option match | 성공 payload의 빈 filter | eqp_ch 재선택 | 없음 | `Confirmed` | payload builder |
| 데이터 없음·서버 오류 | Self handler | 빈 option 또는 `500` | query empty/error UI | 일반 error | `Confirmed` | Self 문서 |
| URL decoding 오류 | browser/server runtime | 명시 contract 없음 | 미확인 | 미확인 | `Unknown` | custom 처리 부재 |
| 메일 링크 생성 실패 | renderer 미확인 | 미확인 | 미확인 | 미확인 | `Unknown` | sender 부재 |

## 17. Token 만료·재사용·회전

현재 `step=ALL` literal에는 발급·만료 개념이 없으며 링크를 반복 사용할 수 있다. 개별 token은 미구현이므로 TTL·nonce·사용자/세션 결합·replay 방지·key version·이전 key 동시 검증과 교체 영향은 미정이다.
이 항목들은 [ADR-003 운영 고려사항](../decisions/ADR-003-step-hmac-token.md#10-운영-고려사항)에서 결정하고 [보안 요구](../system/security.md#13-step-딥링크와-hmac)를 충족해야 한다.

## 18. 브라우저와 로그 노출 경계

| 노출 경계 | 포함 가능 정보 | 현재 보호·처리 | 위험 | 상태 | 후속 |
|---|---|---|---|---|---|
| 주소 표시줄·기록 | Line·SDWT·Grade·step·eqpCh | URL encoding | 복사·공유·기록 노출 | `Risk` | security |
| 메일 본문·DOM | 수신 조건 query | HTML escaping, `noopener noreferrer` | 전달·보관·source 노출 | `Risk` | mailing·security |
| referrer | 대상 navigation URL | mail anchor는 `noreferrer` | 다른 진입점 정책 미확인 | `Partial` | security |
| server access log | path·query 가능 | 저장소에 redaction 설정 없음 | token·식별값 노출 | `Risk` | operations·security |
| reverse proxy log | path·query 가능 | proxy 설정 미확인 | 노출 범위 미확인 | `Unknown` | deployment |
| application error log | 현재 token 처리 없음 | masking 정책 미확인 | 향후 token 도입 시 위험 | `Risk` | security |
| analytics | 설정 발견 못함 | 해당 구현 미확인 | 노출 여부 미확인 | `Unknown` | operations |
| screenshot·공유 | browser URL 가능 | 기술적 보호 확인 안 됨 | 사용자 전파 | `Risk` | user guidance |

HMAC은 무결성 도구 후보이며 URL 자체의 기밀성을 제공하지 않는다.

## 19. 대시보드·메일·Self Equipment 연계

| 출발 기능 | 링크 생성 위치 | URL 계약 | 전달 방식 | 소비 위치 | 상태 | 근거 |
|---|---|---|---|---|---|---|
| Dashboard | `buildSelfEquipmentDetailUrl` | Line·반복 SDWT·반복 Grade | React Router `Link` | URL parser | `Confirmed` | Dashboard code |
| 전체설비 메일 | template 일반 anchor | Line·SDWT·Grade | `spider_base_url`+path | URL parser | template `Confirmed` | template |
| MY EQP 메일 | template MY EQP anchor | MY_EQP·Grade·ALL·eqpCh | 새 tab anchor | URL parser | template `Confirmed` | template |
| 개별 STEP 메일 | 생성 anchor 없음 | 후보만 존재 | 미확인 | 현재 소비 불가 | `Unknown`/`Mismatch` | 제한 검색 |
| 다른 상세 화면 | 직접 producer 미확인 | 미확인 | 미확인 | URL parser | `Unknown` | importer 검색 |
| 직접 URL | 사용자·외부 source 후보 | 같은 query 계약 | browser navigation | URL parser | `Confirmed` | route |

Template base URL 변수의 값 결정, renderer와 sender는 `Unknown`이다.

## 20. 기존 링크 호환성

| 변경 항목 | 기존 링크 영향 | 현재 호환 방식 | 위험 | 상태 | 근거 |
|---|---|---|---|---|---|
| key·algorithm·digest | 현재 token link 없음; 후보 영향 산정 불가 | 없음 | 도입 후 기존 token 무효 가능 | `Unknown` | HMAC 부재 |
| canonicalization | producer/consumer 불일치 가능 | 공통 구현 없음 | 정상 링크 거부 가능 | `Risk` | 계약 부재 |
| STEP 원문 표현 | 향후 token·mapping 영향 | 현재 UI는 `desc` option match | 후보 불일치 | `Unknown` | payload builder |
| query 이름 | 모든 builder·template·parser 영향 | `eqpCh`만 alias 제공 | 기존 링크 깨짐 | `Confirmed` | code |
| route | 모든 producer 영향 | `/fdc_trend` alias만 존재 | 외부 링크 깨짐 | `Confirmed` | routes |
| `step=ALL` | MY EQP template·parser·server 영향 | 정확한 literal과 강제 보정 | 전체 STEP 진입 실패 | `Confirmed` | code |
| `eqpCh` 형식 | MY EQP target 선택 영향 | MY EQP 표기 정규화 | 미선택 가능 | `Confirmed` | server |
| URL encoding | 특수문자 round-trip 영향 | 현재 producer별 encoding 사용 | double/mismatch 위험 | `Partial` | builders·template |
| 후보 STEP 목록 | 개별 mapping 구현 없음 | 없음 | 영향 미정 | `Unknown` | mapping 부재 |

Backward compatibility용 key version이나 이전 token 검증 코드는 없다.

## 21. 테스트 시나리오 준비도

| Test ID | 시나리오 | 예상 결과 | 계층 | 준비도 | 남은 확인 |
|---|---|---|---|---|---|
| `STEP-T01` | MY EQP `step=ALL` | ALL 초기 state | unit | `Test Ready` | 실행만 필요 |
| `STEP-T02` | MY EQP step 누락·다른 값 | ALL로 정규화 | unit | `Test Ready` | 실행만 필요 |
| `STEP-T03` | `eqpCh`와 alias | 같은 초기 state | unit | `Test Ready` | 실행만 필요 |
| `STEP-T04` | 반복 query·encoding round-trip | 값 보존·dedupe | unit | `Test Ready` | 실행만 필요 |
| `STEP-T05` | 개별 token 결정적 생성 | 동일 입력·key에 동일 token | unit | `Blocked` | 입력·algorithm·key 계약 |
| `STEP-T06` | token 매핑 성공 | 정확한 STEP 결정 | unit/integration | `Blocked` | mapping 방식 |
| `STEP-T07` | 변조·길이·미존재 STEP | 명시적 거부 | unit/contract | `Blocked` | 오류 contract |
| `STEP-T08` | `eqpCh` 변경 | 서명 범위에 따른 거부·허용 | contract | `Blocked` | 서명 field |
| `STEP-T09` | key 누락 | fail-closed 결과 | unit/contract | `Blocked` | loader·오류 정책 |
| `STEP-T10` | 만료·rotation | 경계·이전 key 정책대로 판정 | unit | `Blocked` | 시간·version 정책 |
| `STEP-T11` | browser 직접 진입·새로고침 | filter 재현 | browser/E2E | `Needs Confirmation` | `mock-agent` 검증 |
| `STEP-T12` | Unicode·공백·double encoding | canonical vector대로 판정 | unit | `Blocked` | canonicalization |

현재 기존 utility test와 `tests/unit/step-hmac.test.mjs`, `tests/integration/step-deeplink.test.mjs`가 URL·ALL·`eqpCh`·payload 연결 회귀를 포함한다.
파일명과 별개로 HMAC generator·validator를 실행하는 test와 producer/consumer 공통 synthetic HMAC vector는 존재하지 않으며 `STEP-T05`~`STEP-T10`, `STEP-T12`는 `Blocked`다.

## 22. 변경 영향 규칙

| 변경 유형 | 생산자 영향 | 소비자 영향 | 기존 링크·보안 영향 | 문서·테스트 영향 |
|---|---|---|---|---|
| route·query | Dashboard·template·helper | router·parser | 외부 링크 호환 | 메뉴얼·URL tests |
| HMAC 입력·canonicalization | 모든 token producer | validator·mapping | 기존 token 무효·변조 경계 | ADR·vector |
| algorithm·digest | producer | validator | token 형식·호환 | security·unit |
| secret 이름·주입 | 생성 process | 검증 process | 배포·누락·노출 | environment·operations |
| key rotation | producer | 현재·이전 key validator | 기존 링크 수명 | ADR·rotation tests |
| 비교·mapping | 없음/신규 producer | server | side-channel·충돌·오류 | security·unit |
| `step=ALL` | MY EQP template·helper | parser·page·server | 기존 전체 STEP 링크 | Self 문서·unit |
| `eqpCh` | MY EQP producer | parser·server filter | 서명 범위·target | STEP·Self tests |
| log·오류 | producer metadata | API·UI·proxy | token 노출·fail-open | security·contract |

URL 계약 변경 시 모든 생산자와 소비자를 함께 검토하고, mock 구현을 이유로 `main` 계약을 변경하지 않는다.

## 23. 보안 문서와 ADR 준비도

| 결정·보안 영역 | 현재 확인 결과 | 상태 | 후속 문서에서 다룰 내용 |
|---|---|---|---|
| HMAC 사용 목적 | 개별 STEP 후보 외 구현 없음 | `Needs Confirmation` | 무결성 대상·기능 필요성 |
| secret 신뢰 경계 | key·process 미확인 | `Blocked` | server-only 저장·주입·권한 |
| canonicalization | 없음 | `Blocked` | field·순서·encoding·version |
| algorithm·digest | 없음 | `Blocked` | 선택 근거·token 형식 |
| 검증·매핑 | 없음 | `Blocked` | 직접 비교·후보 매핑·map 중 선택 |
| `step=ALL` | MY EQP 예약값 정상 처리 | `Test Ready` | HMAC 경로와의 독립성·호환성 |
| `eqpCh` 서명 | 미확인 | `Blocked` | 변조 시 target 변경 허용 여부 |
| 만료·replay | 미확인 | `Blocked` | 필요성·TTL·nonce |
| key rotation | 미확인 | `Blocked` | version·이전 key·폐기 |
| URL·log 노출 | query 노출 가능, 정책 미확인 | `Needs Confirmation` | masking·referrer·보관 |
| 오류 처리 | 전용 contract 없음 | `Blocked` | status·code·UI·audit log |
| 기존 링크 | ALL만 확인 | `Needs Confirmation` | token 도입·변경 호환 |

ADR은 대안을 미리 결정하지 않고 As-Is와 남은 선택지를 입력으로 사용해야 한다.

## 24. Core Harness와 mock-agent 경계

- 이 문서는 `main`의 실제 URL, parser, template과 server 계약을 기준으로 한다.
- mock key, mock token, mock mail과 browser deep-link 검증은 `mock-agent` 범위다.
- `main` 문서와 운영 자원 비의존 unit·contract test는 `mock-agent`에 의존하지 않는다.
- `mock-agent`가 `main`의 URL·token 계약을 따라야 하며 mock 구현 자체는 `main` 병합 대상이 아니다.
- 이번 단계에서 다른 브랜치나 mock 구현을 조사하지 않았다.

## 25. Mismatch

| 항목 | 현재 코드·설정 | 기존 후보·문서 | 영향 | 후속 조치 |
|---|---|---|---|---|
| MY EQP 개별 token | `sdwt=MY_EQP`이면 모든 `step`을 `ALL`로 덮어씀 | `step={HMAC_TOKEN}` 후보 URL | 개별 STEP 선택 불가 | 기능 요구 재확정 |
| HMAC 생성·검증 | generator·validator·key·mapping 없음 | 개별 HMAC STEP 링크 후보 | 진위·무결성 판정 불가 | security·ADR 결정 |
| `DF-STEP-01` 완성도 | MY EQP ALL만 end-to-end 확인 | 개별 STEP까지 포함한 목표 flow | 전체 flow `Partial` | 구현 후 상태 갱신 |

README와 사용자 메뉴얼의 “MY EQP는 `step=ALL`” 설명은 현재 코드와 일치한다.

## 26. Unknown과 Risk

| 항목 | 상태 | 기능·보안 영향 | 확인 방법 | 우선순위 |
|---|---|---|---|---|
| 정확한 서명 원문·canonicalization | `Unknown` | producer/consumer 일치 불가 | 설계·코드 owner 확인 | 높음 |
| algorithm·digest·token 형식 | `Unknown` | 생성·검증·URL 계약 불가 | ADR·구현 확인 | 높음 |
| `eqpCh` 서명 포함 | `Unknown` | URL target 변조 경계 미정 | 요구·위협 범위 확정 | 높음 |
| 검증·mapping·안전 비교 | `Unknown` | 개별 STEP 판정 불가 | server 구현 확인 | 높음 |
| key 환경·누락·rotation | `Unknown` | 배포·장애·기존 링크 영향 | environment·operations | 높음 |
| 만료·replay·이전 key | `Unknown` | 링크 수명·재사용 불명 | ADR | 높음 |
| 잘못된 token HTTP·UI 결과 | `Unknown` | 오류와 공격 구분 불가 | contract 결정 | 높음 |
| token 충돌·복수 매칭 | `Unknown` | 잘못된 STEP 가능성 | mapping 방식 결정 | 중간 |
| Unicode·double encoding | `Unknown` | 정상 링크 불일치 | canonical vectors | 중간 |
| URL·proxy log masking | `Risk` | token·식별값 노출 가능 | 배포·log 설정 확인 | 높음 |
| referrer·메일 전달 | `Risk` | query 재노출 가능 | browser·메일 정책 확인 | 중간 |
| 중복 query | `Confirmed`/`Risk` | 첫 값·복수 값 처리 차이 | 계약 test 유지 | 중간 |
| 사용자 메뉴얼 | MY EQP ALL은 최신 | `Documented` | 개별 token 안내 없음 | 낮음 |

## 27. 연계 산출물

| 산출물 | 담당 범위 | 상태 |
|---|---|---|
| `docs/features/self-equipment.md` | URL→state→API 소비 | 작성됨 |
| `docs/features/step-deeplink.md` | 현재 STEP/HMAC As-Is 기준 | 작성됨 |
| [mailing.md](mailing.md) | renderer·sender·link 생산 책임 | 작성됨; renderer·sender `Blocked` |
| [security.md](../system/security.md) | secret·URL·log·referrer trust boundary | 작성됨 |
| [ADR-003-step-hmac-token.md](../decisions/ADR-003-step-hmac-token.md) | 기능 필요성·생성·검증·호환 결정 | `Proposed`; HMAC 미구현 |
| `tests/unit/step-hmac.test.mjs` | MY EQP ALL·query round trip | 작성됨; actual HMAC test는 `Blocked` |
| `tests/integration/step-deeplink.test.mjs` | 운영·mock 비의존 딥링크→payload | 작성됨 |
| `scripts/verify-all.sh` | 위 Core test의 안전 검증 진입점 | 작성됨 |
| `harness/scenarios/self-equipment-smoke.yaml` | mock 의존 browser scenario이면 `mock-agent` 전용 | 현재 `main` 범위 아님 |

## 28. 근거 자료

| 자료 | 사용 목적 | 상태 |
|---|---|---|
| `AGENTS.md` | 안전·판정·Core/mock 기준 | `Confirmed` |
| `reports/audit/system-inventory.md` | HMAC·환경·test 근거 인덱스 | `Confirmed` |
| `docs/system/architecture.md` | HMAC trust boundary 후보 | `Documented` |
| `docs/system/environment-definition.md` | key 환경 계약의 Unknown | `Confirmed` |
| `docs/system/data-flow.md` | `DF-STEP-01` | `Confirmed` |
| `docs/features/self-equipment.md` | query→state→API 소비 | `Confirmed` |
| `docs/features/dashboard.md` | Dashboard link 생산 범위 | `Confirmed` |
| `docs/user-manual/USER_MANUAL.md`, `README.md` | MY EQP ALL 사용자·기존 설명 | `Documented` |
| `routes.jsx`, `server.mjs` | route·SPA 직접 진입 | `Confirmed` |
| `selfEquipmentUrlFilters.mjs`와 test | query parse·MY EQP ALL | `Confirmed` |
| `dashboardLinks.mjs`와 test | URL 생성·encoding | `Confirmed` |
| `FdcTrendPage.jsx`, `selfEquipmentApi.js` | token 소비 중단·API query | `Confirmed` |
| `server/selfEquipmentData.mjs` | `desc`, ALL, eqpCh server 처리 | `Confirmed` |
| `public/mailing-report.html` | 일반·MY EQP link template | template `Confirmed` |
| HMAC 생성·검증 코드 | 현재 source에서 발견하지 못함 | `Unknown` |
| HMAC 환경변수 예제 | tracked `.env.example` 없음 | `Unknown` |

이 문서는 검증 기준 코드 commit `99c4361`의 STEP 딥링크와 HMAC As-Is 계약을 설명한다.
실제 secret과 운영 token은 조사하거나 기록하지 않았다.
URL, HMAC 입력, secret 또는 token 처리가 바뀌면 생산자, 소비자, 기존 링크와 관련 테스트를 함께 검토해야 한다.
시스템 보안 경계는 [security.md](../system/security.md)를 기준으로 하며, HMAC이 도입되면 이 문서와 ADR·test를 함께 갱신한다.

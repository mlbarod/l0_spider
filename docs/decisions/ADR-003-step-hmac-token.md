# ADR-003: STEP 딥링크의 HMAC token 사용

## 상태

`Proposed`

개별 STEP HMAC은 문서화된 후보이나 현재 코드에는 생성, 검증, STEP 매핑과 secret 설정이 없다.
현재 구현은 일반 상세 링크와 MY EQP의 `step=ALL`만 지원하므로 HMAC 계약은 프로젝트 소유자의 후속 결정이 필요하다.

## 결정 날짜

2026-07-31

## 적용 범위

- 브라우저 route `/self-equipment`와 호환 alias `/fdc_trend/self-equipment`
- query `line`, `sdwt`, `grade`, `step`, `eqpCh`·`eqp_ch`, 개별 STEP token 후보와 `step=ALL`
- Dashboard·메일 producer, browser·API consumer와 향후 server-side HMAC 경계

## 관련 문서

- `docs/features/step-deeplink.md`, `docs/features/self-equipment.md`
- `docs/system/security.md`, `docs/system/data-flow.md`
- `docs/system/environment-definition.md`, `docs/system/architecture.md`

## 1. 컨텍스트

L0 Spider는 Dashboard와 메일 링크에서 Self Equipment 화면으로 직접 진입한다.
일반 Dashboard 링크는 `line`, 반복 `sdwt`, 반복 `grade`를 전달하고 STEP은 화면에서 선택한다.
MY EQP 메일 링크는 `sdwt=MY_EQP`, `step=ALL`, `eqpCh`를 전달하여 등록 장비의 전체 STEP 범위를 연다.
개별 STEP 원문 대신 HMAC token을 `step`에 넣는 URL은 문서 후보이나 server 생산·검증 흐름은 확인되지 않았다.
운영 route와 query 이름은 공유 링크·메일 호환성에 영향을 주므로 임의로 변경하지 않는다.
HMAC 도입 시 secret은 브라우저가 아닌 서버 신뢰 경계에 둔다.
도입 역사, 과거 장애와 현재 운영에서의 개별 token 사용 여부는 `Unknown`이다.

## 2. 문제 정의

- 개별 STEP 직접 진입 요구는 문서에 후보로 기록됐지만 현재 구현 요구로 확정되지 않았다(`Documented`).
- URL query는 사용자가 복사하거나 변경할 수 있으므로 개별 STEP을 신뢰하려면 서버 측 판정 계약이 필요하다.
- 결정적 token 필요 여부와 token 저장소 허용 여부는 `Unknown`이다.
- 생산자와 소비자는 같은 HMAC input, canonicalization, algorithm과 encoding을 사용해야 한다.
- 기존 일반 링크와 MY EQP `step=ALL` 링크를 유지하면서 개별 STEP 계약을 도입할 migration 기준이 필요하다.
- 잘못된 token을 거부할지 STEP 미선택으로 처리할지 결정되지 않았다.

## 3. 결정 동인

| 결정 동인 | 중요성 | 현재 근거 |
|---|---|---|
| Self Equipment 직접 링크 호환성 | 높음 | 일반 Dashboard 링크와 MY EQP 메일 링크가 코드에 존재함 |
| query 변조 경계 | 높음 | browser가 `step`과 `eqpCh`를 직접 수신함 |
| 서버 측 secret 유지 | 높음 | `AGENTS.md`와 보안 문서의 강제 정책 |
| STEP 원문 노출·token 저장소 | 확인 필요 | 결정적 HMAC 구현과 요구가 확인되지 않음 |
| `step=ALL` 호환성 | 높음 | MY EQP 생산자·parser·page·server에서 확인됨 |
| `eqpCh` 초기 선택 호환성 | 높음 | 메일 URL에서 서버 row filter까지 연결됨 |
| 운영·rotation 복잡도 | 높음 | secret 주입·rotation·이전 key 지원이 모두 미정 |

## 4. 결정

- 현재 구현 사실: 일반 상세 URL과 MY EQP의 `step=ALL`·`eqpCh` 흐름이 존재한다.
- 유지할 설계 결정: route와 현재 query 호환 계약은 migration 없이 변경하지 않는다.
- 후속 결정 필요: 개별 STEP HMAC 방식은 채택 전 아래 `Unknown` 계약을 확정해야 한다.

### 4.1 URL 계약

```text
/self-equipment?line={LINE}&sdwt={SDWT}&grade={GRADE}
```

```text
/self-equipment?line={LINE}&sdwt=MY_EQP&grade={GRADE}&step=ALL&eqpCh={EQP_CH}
```

개별 STEP 링크는 다음 후보이며 구현 계약이 아니다.

```text
/self-equipment?line={LINE}&sdwt={SDWT}&grade={GRADE}&step={HMAC_TOKEN}&eqpCh={EQP_CH}
```

`line`, `step`, `eqpCh`는 첫 값을 읽고 `sdwt`, `grade`는 반복 값을 정규화·중복 제거한다.
`eqpCh`가 없을 때만 `eqp_ch`를 호환 alias로 읽는다.
생산자는 `URLSearchParams` 또는 template `urlencode`로 query 값을 URL encoding한다.

### 4.2 HMAC 입력

| 항목 | 현재 결과 | 상태 |
|---|---|---|
| 서명 대상 STEP 원문 | 정의 없음 | `Unknown` |
| 포함 field·순서·구분자 | `step`, `line`, `sdwt`, `grade`, `eqpCh` 모두 미정 | `Unknown` |
| 공백·대소문자·Unicode | URL parser의 NFKC를 HMAC 규칙으로 볼 근거 없음 | `Unknown` |
| message encoding | 정의 없음 | `Unknown` |

후속 결정은 producer와 verifier가 공유할 byte-level canonicalization을 명시해야 한다. null·빈 문자열·prefix/version, URL encoding 전후, JSON·locale 변환 순서도 포함한다.

### 4.3 알고리즘과 token 표현

| 항목 | 현재 결과 | 상태 |
|---|---|---|
| HMAC algorithm·digest encoding | 코드·설정 없음 | `Unknown` |
| token 길이·문자 집합·padding | 정의 없음 | `Unknown` |
| URL encoding round trip | HMAC token용 계약 없음 | `Unknown` |

key/message encoding, token 대소문자·URL-safe 표현·prefix/version과 비교 전 변환도 결정 대상이다. algorithm이나 digest를 관례로 선택하지 않는다.
HMAC token은 암호문이 아니며 복호화 대상으로 정의하지 않는다.

### 4.4 Secret 경계

- HMAC 환경변수 이름, 주입 위치와 누락 동작은 `Unknown`이다.
- tracked `.env.example`과 `.env.mock.example`은 없으며, 도입 시 secret을 server runtime에 두고 `VITE_*`나 build artifact에 넣지 않는다.
- 실제 secret과 운영 token은 Git, 문서, fixture, 테스트 출력과 로그에 기록하지 않는다.
- 운영 secret과 mock secret은 분리하되 mock 변수명과 값은 이 ADR에서 확정하지 않는다.

### 4.5 검증 또는 STEP 매핑

HMAC 직접 비교, 후보 STEP별 계산, token map과 timing-safe 비교 구현은 발견되지 않았다.
`readSelfEquipmentUrlFilters()`는 비-MY EQP `step`을 `stepToken` 문자열로 읽지만 진위를 판정하지 않는다.
`FdcTrendPage`는 `stepToken === "ALL"`일 때만 `selectedDesc`를 초기화하므로 다른 token은 무시된다.
Self Equipment API client는 `stepToken`을 서버에 보내지 않고 실제 선택된 `desc`만 보낸다.
따라서 정상 token 성공 결과, 변조 token 거부와 오류 응답은 모두 `Unknown`이다.

### 4.6 `step=ALL`

`ALL`은 MY EQP의 모든 STEP을 선택하는 literal 예약 sentinel이다(`Confirmed`).
MY EQP parser는 `step` 누락이나 다른 값과 관계없이 `stepToken`을 `ALL`로 강제한다.
page는 `ALL`을 초기 `desc`로 사용하고 MY EQP server builder는 `allowAllSteps: true`로 전체 STEP row를 허용한다.
현재 `ALL`에는 HMAC 생성·검증, 발급, 만료 또는 replay 개념이 없다.
이는 HMAC 우회가 아니라 현재 구현된 독립적인 정상 분기다.

### 4.7 `eqpCh`

`eqpCh`는 MY EQP 링크에서 장비 후보를 초기 선택하고 API에서 row의 `eqp`와 매칭하는 단일 filter다(`Confirmed`).
MY EQP server path는 표기 차이를 정규화해 matching하고 일반 path는 option의 정확한 값과 비교한다.
`eqpCh`가 HMAC input에 포함되는지와 token에 결합되는지는 `Unknown`이다.
현재 `eqpCh`는 token과 별도로 처리되며 변경값에 대한 HMAC 판정은 없다.
정확한 장비·chamber 도메인 의미와 허용 형식은 후속 확인이 필요하다.

## 5. 보안 속성과 비목표

현재 HMAC 구현이 없으므로 아래 일반 속성은 구현 완료를 전제로 한 조건부 설명이다.

| 항목 | HMAC이 조건부로 제공하는 범위 | 제공하지 않는 범위 |
|---|---|---|
| 서명 input 무결성 | secret 보유자가 계산한 input과 token의 일치 판정 | input 밖 query의 보호 |
| STEP 원문 기밀성 | 제공하지 않음 | 암호화·복호화와 원문 은닉 보장 |
| 인증·인가 | 제공하지 않음 | 사용자 신원·session·데이터 접근 권한 |
| 만료·replay | expiry·nonce·상태 정책이 있을 때만 가능 | HMAC 자체의 자동 만료·재사용 방지 |
| URL 노출 | 제공하지 않음 | 주소 기록·메일·referrer·proxy log 기밀성 |

HMAC token만으로 사용자의 접근 권한을 보장하지 않는다.
서명 input에 포함되지 않은 parameter는 그 HMAC으로 보호되지 않는다.
현재 개별 STEP 경로는 HMAC 무결성을 제공한다고 판단할 수 없다.

## 6. 고려한 대안

다음은 과거 검토 기록이 아니라 현재 기준선 평가와 후속 결정용 비교다.

| 대안 | 장점 | 단점 | 기존 링크 영향 | 현재 판단 |
|---|---|---|---|---|
| STEP 원문 직접 전달 | 단순, server mapping 불필요 | 원문 URL 노출, query 변조 가능 | 새 개별 링크 계약 필요 | 요구·인가 경계 확인 전 미채택 |
| 결정적 HMAC token | 상태 저장 없이 진위 판정 가능 | key·canonicalization·rotation 필요, 기밀성 없음 | HMAC 계약 도입 필요 | `Proposed`, 세부 결정 필요 |
| 암호화 또는 서버 저장형 token | 기밀성 또는 server 통제 가능 | key·상태·수명·가용성 운영 복잡 | 새 format과 migration 필요 | 현재 요구 근거 부족 |
| context-bound HMAC | 여러 query의 변조 범위 축소 | field 변경마다 token 무효, canonicalization 복잡 | `eqpCh` 등 기존 링크 영향 큼 | 위협 모델 확정 후 비교 |
| expiry·version 포함 token | 만료·rotation migration 표현 가능 | clock·이전 key·version 정책 필요 | 영구 링크 동작 변경 | 운영 요구 확정 후 비교 |

## 7. 결정 결과와 장점

- 일반 상세 링크는 Dashboard 조건을 전달하고 MY EQP 링크는 `ALL`·`eqpCh`의 결정적 URL 계약을 가진다.
- URL 생성은 표준 encoding을 사용하고 parser는 query 호환 규칙을 한 곳에 모은다.
- HMAC 미구현을 `Proposed`로 명시해 존재하지 않는 보안 보장을 운영 기준으로 오해하지 않게 한다.
- HMAC 채택 전 server-side secret과 생산자·소비자 공통 계약이 필요함을 고정한다.

## 8. 제약과 부정적 결과

- 현재 비-`ALL` token은 parsing 후 무시되어 개별 STEP 직접 진입을 제공하지 않는다(`Mismatch`).
- 변조·형식 오류·secret 누락을 구별하는 오류 계약이 없다.
- query는 주소 표시줄, 공유·메일, history, referrer와 log에 노출될 수 있다(`Open Risk`).
- `eqpCh`는 독립 filter이므로 현재 token으로 보호된다고 볼 수 없다.
- 만료, replay, rotation과 이전 key 지원은 `Unknown`이며 key·canonicalization 변경은 token을 무효화할 수 있다.
- HMAC은 인증·인가를 대체할 수 없으므로 데이터 접근 통제는 별도 경계에서 유지해야 한다.

## 9. 호환성과 변경 영향

| 변경 항목 | 기존 링크 영향 | 필요한 동시 변경 | 검토 대상 |
|---|---|---|---|
| route | 직접·메일 링크 단절 가능 | router, 모든 producer, 배포 fallback | Dashboard·메일·SPA |
| query 이름 | 기존 parser가 값을 잃음 | producer, parser, 문서, test | `step`, `eqpCh`, alias |
| HMAC input·canonicalization·algorithm·digest | 기존 token 무효 가능 | generator, verifier, vector, migration | field·format·version |
| secret·rotation | 결정적 token 무효 가능 | 주입, 이전 key 정책 | 운영 배포 |
| 검증·매핑 방식 | 성공·실패 의미 변경 | server, browser 오류 UX, 계약 | 직접 비교·후보 map |
| `step=ALL` | MY EQP 링크와 전체 STEP 진입 실패 | template, helper, parser, server | 예약 sentinel |
| `eqpCh`·URL encoding | target 또는 round trip 변경 | producer, parser, API, server | 서명·encoding test |

생산자와 소비자를 동시에 검토하고 변경 전에 기존 링크 유효성 영향을 확인한다.
호환되지 않는 변경은 명시적 migration과 rollback 계획 없이 적용하지 않는다.
`mock-agent`는 변경된 `main` 계약을 따라야 하며 mock 동작을 기준으로 계약을 바꾸지 않는다.

## 10. 운영 고려사항

| 항목 | 현재 상태 | 운영 고려 |
|---|---|---|
| secret 주입·이름 | `Unknown` | server runtime 전용 계약 필요 |
| secret 누락·query log | `Unknown` | fail-closed, 오류와 마스킹 정의 필요 |
| 메일 링크 | MY EQP `ALL` 확인 | 전달·보관·만료 정책은 sender와 함께 검토 |
| rotation·환경별 key | `Unknown` / 정책만 존재 | 이전 key·version, 운영/mock 분리 필요 |
| 장애 영향 | 비-`ALL` 흐름 미구현 | 도입 후 verifier 장애와 기존 링크 영향 정의 필요 |

만료·rotation 결정에는 발급/만료 시각·TTL, nonce·일회성·사용자/세션 결합·replay 방지, token/key version과 이전 key 동시 검증, key 교체 시 기존 링크 영향을 포함한다.

실제 운영 환경, `.env`, secret, 로그와 발송 시스템은 이번 조사에서 확인하지 않았다.

## 11. 검증 의무

테스트 ID·대상·준비도는 [STEP 계약 §21](../features/step-deeplink.md#21-테스트-시나리오-준비도)에서만 관리한다. 이 ADR에서는 같은 ID를 별도 의미로 정의하지 않는다.
HMAC을 채택하면 해당 목록의 결정적 생성·정상 매핑·변조 거부·키 누락·만료와 rotation·encoding 검증을 충족해야 한다. 서로 다른 STEP의 token 구분과 기존 일반·MY EQP 링크 호환도 함께 확인해야 한다.

기존 URL 테스트와 HMAC 검증을 구분한다. HMAC generator·validator와 공통 synthetic vector는 없으며 관련 시나리오는 `Blocked`다. 이번 문서 수정에서 테스트를 실행하거나 HMAC 구현 완료로 판정하지 않았다.

## 12. 재검토 조건

- HMAC input, canonicalization, algorithm, digest, token format을 결정·변경할 때
- secret 주입, rotation, 이전 key, expiry, replay, version 또는 binding을 도입할 때
- `eqpCh`를 서명 범위에 추가하거나 제거할 때
- route, query 이름, `step=ALL`, encoding 또는 링크 노출 정책을 변경할 때
- 인증·인가, Dashboard·메일 producer 또는 Self Equipment consumer가 변경될 때
- token 매핑 성능·가용성 문제 또는 새로운 보안 요구가 확인될 때

## 13. Open Questions와 후속 결정

| 항목 | 현재 상태 | 영향 | 필요한 결정 |
|---|---|---|---|
| 개별 STEP 요구·producer | `Unknown` | 기능 범위 | 발급 주체와 사용자 흐름 확정 |
| HMAC input·canonicalization·format | `Unknown` | 상호운용·무결성 | field, byte 규칙, algorithm, encoding |
| 검증·매핑·오류 | `Unknown` | 성능·UX·데이터 경계 | server 판정과 실패 계약 |
| secret·rotation·이전 key | `Unknown` | 배포·기존 링크 | 환경 계약, fail-closed, migration |
| expiry·replay | `Unknown` | 공유 링크 수명 | 시간·nonce·상태 필요성 |
| `eqpCh` 서명 포함 | `Unknown` | target 변조 | context-bound 범위 |
| Unicode·URL·log 처리 | `Unknown` | 재현성·노출 | 정규화, 마스킹, referrer 정책 |

## 14. Core Harness와 mock-agent 경계

- 이 ADR은 `main`의 실제 URL 코드와 계약을 기준으로 한다.
- mock secret, mock token과 mock 의존 검증은 `mock-agent` 범위이며 이번 단계에서 조사하지 않았다.
- `main`의 ADR과 운영 자원 비의존 test는 `mock-agent`에 의존하지 않으며 `mock-agent`가 `main` 계약을 따른다.
- mock 구현은 `main`으로 병합하지 않고 계약을 완화하지 않으며, 운영·mock secret을 분리한다.

## 15. Mismatch

| 항목 | 코드·설정 | 기존 문서 | 결정 영향 | 후속 조치 |
|---|---|---|---|---|
| 개별 STEP token | 비-`ALL` token을 읽은 뒤 화면 선택에 사용하지 않음 | `{HMAC_TOKEN}` URL 후보 | 개별 STEP 직접 진입 불가 | 요구와 producer 확정 |
| HMAC 생성·검증 | generator, validator, key, mapping 없음 | 개별 STEP HMAC 후보 | 무결성·오류·호환 계약 부재 | 세부 설계 결정 후 구현 |
| MY EQP 개별 STEP | parser가 모든 `step`을 `ALL`로 강제 | 개별 token 후보와 함께 해석 가능 | MY EQP는 개별 STEP 선택 불가 | `ALL` 계약과 요구 분리 |
| `DF-STEP-01` | MY EQP ALL만 end-to-end 확인 | 개별 HMAC 흐름 포함 후보 | 전체 흐름 `Partial` | 구현 전 상태 유지 |

README와 사용자 메뉴얼의 MY EQP `step=ALL` 설명은 현재 코드와 일치하므로 Mismatch가 아니다.

## 16. 근거 자료

- [STEP 계약](../features/step-deeplink.md) — 현재 STEP 동작과 구현 경계
- [AGENTS.md §6](../../AGENTS.md#6-operational-safety) — 비밀정보 보호·운영 안전
- `docs/features/step-deeplink.md` — URL, HMAC `Unknown`, `ALL`, `eqpCh` 기준
- `docs/features/self-equipment.md`, `docs/system/data-flow.md:241-257` — browser·API filter와 `DF-STEP-01`
- `docs/system/security.md:199-218`, `docs/system/environment-definition.md:183-187` — 보안 속성과 환경 계약 공백
- `docs/system/architecture.md:168-172`, `reports/audit/system-inventory.md:255-272` — trust boundary와 감사 근거
- `src/features/fdc-trend/utils/dashboardLinks.mjs:6-28`, `src/features/fdc-trend/utils/selfEquipmentUrlFilters.mjs:13-32` — URL builder와 parser
- `src/features/fdc-trend/pages/FdcTrendPage.jsx:1435-1558` — URL 초기 state와 API filter 소비
- `src/features/fdc-trend/api/selfEquipmentApi.js:3-55`, `server/selfEquipmentData.mjs:196-293,308-318,420-428` — server filter
- `public/mailing-report.html:69-80,229-241` — MY EQP 메일 URL 계약
- `src/features/fdc-trend/utils/dashboardLinks.test.mjs`, `src/features/fdc-trend/utils/selfEquipmentUrlFilters.test.mjs` — URL·parser test, `Not Run`
- HMAC 생성·검증 코드와 HMAC 환경변수 예제 — 제한 검색에서 발견하지 못함, `Unknown`

이 ADR은 `d2c7eec` commit 시점의 As-Is 구현과 미결정 경계를 기록하며 실제 secret, 운영 token과 운영 식별값은 포함하지 않는다.
이 결정은 HMAC을 인증·인가 또는 암호화의 대체 수단으로 정의하지 않는다.
설계 계약 변경 시 관련 기능 문서, 보안 문서, producer·consumer와 테스트를 함께 검토한다.

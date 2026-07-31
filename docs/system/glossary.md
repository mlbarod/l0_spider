# L0 Spider 용어 사전

## 1. 목적과 적용 범위

이 문서는 `main`의 L0 Spider 코드·계약·기능 문서에서 사용하는 업무 용어와 코드 표현의 단일 탐색 기준이다.
용어의 사용 위치는 설명하지만 데이터 소유자의 공식 업무 정의를 임의로 확정하지 않는다.
사용자 절차는 [사용자 메뉴얼 인덱스](../user-manual/index.md), 상세 데이터 연결은 [data-flow.md](data-flow.md)와 기능 문서를 따른다.
`mock-agent`의 화면·mock 데이터 용어는 범위 밖이다.

## 2. 상태와 작성 원칙

- `Confirmed`: 현재 코드·설정·계약에서 사용과 연결이 확인됨
- `Documented`: 기존 문서에서만 의미가 설명됨
- `Inferred`: 명칭·구조를 근거로 한 추정이며 확정 정의가 아님
- `Unknown`: 저장소 근거만으로 정의나 책임을 확인할 수 없음
- `Mismatch`: 코드·설정·문서가 서로 다른 의미나 위치를 제시함
- `Risk`: 혼동이나 변경이 호환성·보안·운영 문제를 만들 수 있음

코드 식별자는 대소문자와 표기를 보존한다. `STEP`, `step`, `step_desc`, `ch_step`처럼 비슷한 이름은 같은 값으로 간주하지 않는다.

## 3. 핵심 용어

| 용어 | 분류 | 한글 설명 | 코드 표현 | 사용 영역 | 혼동 주의 | 상태·근거 |
|---|---|---|---|---|---|---|
| Line | 업무 용어 | 화면 필터·집계·파일 경로에서 사용하는 상위 Line 구분값 | `line`, `lineId`, `line_rev` | Dashboard, Self Equipment, 이상 데이터 | 표시 Line과 원천 `line_rev`는 mapping을 거칠 수 있다. 공식 master와 소유자는 `Unknown`이다. | 사용 `Confirmed` — `data-flow.md:157`; `abnormal-data.md:168` |
| SDWT | 업무 용어 | Line 아래에서 조회·등록 범위를 나누는 단위 | `sdwt`, `pathSdwt` | Self Equipment, 이상 데이터, Mailing | 약어의 공식 확장명은 `Unknown`; 표시값 `sdwt`와 경로 key `pathSdwt`를 구분한다. | 사용 `Confirmed`, 정의 `Unknown` — `data-flow.md:158-159`; `abnormal-data.md:169` |
| Grade | 업무 용어 | 화면에 `Sensor Grade`로 표시되는 이상 등급 필터 | URL `grade`, API·Parquet `priority` | Dashboard, Self Equipment, Mailing | 화면의 `A/B`는 조회 시 `A`, `B`로 확장되지만 `mailingSummary`는 원본 Grade를 유지한다. | `Confirmed` — `self-equipment.md:63`; `dashboard.md:249` |
| STEP | 업무 용어 | 설비 이상 결과를 공정 STEP 단위로 선택하는 화면 개념 | UI `STEP`, row `desc`, query `step` | Self Equipment, 동일성, 딥링크 | URL `step`은 STEP 설명이 아니라 `ALL` 예약값 또는 token 후보일 수 있다. `ch_step`과 다르다. | 사용 `Confirmed`; 비-`ALL` 연결 `Mismatch` — `self-equipment.md:224-232` |
| `step_seq` | 코드·경로 식별자 | 동일성 결과 디렉터리에서 읽어 image row metadata로 전달하는 순서 값 | `stepSeq`, path `step_seq` | 동일성 이상감지 | 브라우저 query나 Self Equipment STEP 선택값이 아니다. 업무상 순서 의미는 `Unknown`이다. | 전달 `Confirmed`, 정의 `Unknown` — `abnormal-data.md:171,185` |
| `step_desc` | 코드·경로 식별자 | STEP 설명을 나타내는 경로·데이터 표현 | row `desc`, API `stepDesc`, path `step_desc` | Self Equipment, 동일성 | `step`, `step_seq`, `ch_step`과 구분한다. | `Confirmed` — `abnormal-data.md:172,185` |
| `desc` | 코드 식별자 | Self/Dashboard row에서 STEP 설명을 담고 고유 이상건 key에 참여하는 필드 | `desc` | Dashboard, Self Equipment, Mailing 집계 | 일반 설명(description) 필드로 해석하지 않는다. UI에서는 STEP으로 표시된다. | `Confirmed` — `abnormal-data.md:181-182`; `data-flow.md:180` |
| `eqpCh` | query·API 식별자 | Self Equipment에서 초기 EQP 선택과 row 필터에 쓰는 단일 query 값 | `eqpCh`, 호환 alias `eqp_ch`, state `selectedEqpCh` | 딥링크, Self Equipment | 서버 row `eqp`에 대응하지만 정확한 equipment/chamber 업무 의미는 `Unknown`이다. | 사용 `Confirmed`, 도메인 정의 `Unknown` — `step-deeplink.md:100-109,237-249` |
| PPID | 업무·화면 용어 | 화면의 chart/card에서 레시피 식별 맥락으로 표시하는 값 | UI `PPID`, source `recipe_id`, path `ppid` | Dashboard, Self Equipment, 동일성 | 약어의 공식 정의와 모든 경로 `ppid`가 `recipe_id`와 동일하다는 보장은 `Unknown`이다. | 표시 매핑 `Confirmed` — `abnormal-data.md:179-182` |
| `recipe_id` | 데이터 식별자 | Dashboard/Self row의 레시피 식별 필드이며 고유 이상건 key에 포함됨 | `recipe_id` | Dashboard 집계, Self Equipment | UI는 PPID로 표시한다. 공통부 `prc_group`과 같은 값으로 확정하지 않는다. | `Confirmed` — `data-flow.md:169,180`; `abnormal-data.md:181` |
| `priority` | 데이터 식별자 | Parquet row에 저장된 Grade 코드 | `priority`, query 반복 `priority` | Dashboard, Self Equipment, Mailing | 일반 우선순위 정렬값이 아니라 현재 이상 Grade 원천으로 사용된다. | `Confirmed` — `data-flow.md:160`; `self-equipment.md:155-159` |
| `sensor` | 업무·코드 용어 | 측정 sensor를 선택하고 chart axis를 구성하는 값 | `sensor` | Self Equipment, 동일성, 공통부, 집계 | `sensor=ALL`은 실제 sensor 이름 목록이 아니라 상위 조건 전체를 뜻하는 예약 선택값이다. | `Confirmed` — `data-flow.md:163`; `self-equipment.md:104-106` |
| `ch_step` | 업무·화면 용어 | 선택 sensor 아래의 channel STEP 차원 | UI `ch_step`, API `chStep`, row `step` | Self Equipment, 동일성, 공통부 | 공정 `STEP`/`step_desc`와 다르다. point column은 `${sensor}_${chStep}` 형태로 선택된다. | `Confirmed` — `data-flow.md:164`; `abnormal-data.md:175` |
| EQP | 업무 용어 | 이상 결과와 등록 조건에서 설비 또는 설비 채널을 식별하는 값 | row `eqp`, point `eqp_id`·`eqp_cb`, query `eqp`·`eqpCh` | Self Equipment, My EQP, 공통부 | `EQP`, `eqpCh`, `eqp_id`, `eqp_cb` 사이의 공식 master 관계는 `Unknown`이다. | 사용 `Confirmed`, 관계 `Unknown` — `abnormal-data.md:176,194-196` |
| `mailingSummary` | API 식별자 | Dashboard 고유 이상건을 Line·SDWT·원본 Grade별로 합산한 메일용 요약 배열 | `lineDashboard.mailingSummary` | Dashboard API, 메일 계약 | `lineDashboard.summary.mailingSummary`가 아니다. 실제 위치는 `summary`의 sibling이다. | `Confirmed`/`Mismatch` — `dashboard.md:166-167,242-249`; `mailing.md:307` |
| HMAC token | 보안·설계 용어 | 개별 STEP 원문 대신 `step` query에 넣는 서명 token 후보 | 후보 `step={HMAC_TOKEN}` | STEP 딥링크 | 현재 생성·검증·mapping·secret은 없다. `step=ALL`은 HMAC token이 아니다. 암호화·복호화로 표현하지 않는다. | 후보 `Documented`, 구현 `Unknown`/`Mismatch` — `step-deeplink.md:43-48,390-399`; `ADR-003-step-hmac-token.md` |
| Parquet | 저장 형식 | Dashboard·index·point·history 결과를 저장하고 서버가 필요한 column을 읽는 columnar 파일 형식 | `.parquet`, 일부 stats `.parquets` | Dashboard, Self Equipment, 이상 데이터 | 전체 파일 Schema, producer, 보존기간은 `Unknown`; 이미지 PNG와 역할이 다르다. | 사용 `Confirmed`, 운영 계약 `Unknown` — `abnormal-data.md:188-215`; `ADR-002-parquet-storage.md` |
| `latest_date` | 경로·시각 식별자 | 파일명·디렉터리 또는 index path에서 결정되는 최신 결과 날짜 segment | `latest_date`, `latestDate`, `latestDateTime` | Dashboard, 동일성, ERD | 모든 기능이 같은 최신성·timezone 규칙을 공유한다고 확정하지 않는다. | 전파 `Confirmed`, 공통 timezone `Unknown` — `data-flow.md:165`; `abnormal-data.md:167` |
| `pathSdwt` | 내부 경로 식별자 | mapping key로부터 얻어 index 파일 경로 조립에 사용하는 SDWT 값 | `pathSdwt` | Self Equipment, 공통부 | 사용자 표시 `sdwt`와 값이 항상 같다고 가정하지 않는다. | `Confirmed` — `data-flow.md:159` |
| `MY EQP` | 예약 업무 값 | 현재 사용자의 유효 등록 설비를 모아 Self Equipment에서 조회하는 virtual SDWT | query `sdwt=MY_EQP`, 내부 `__MY_EQP__` | 등록, Self Equipment, 메일 링크 | 실제 filesystem SDWT가 아니며 MY EQP 링크는 `step=ALL`을 사용한다. | `Confirmed` — `data-flow.md:221-225`; `step-deeplink.md:73-76` |
| `SKIP LIST` | 예약 업무 값 | 활성 SKIP 이력을 기준으로 별도 조회하는 virtual SDWT 선택지 | UI `SKIP LIST`, DB `pass_history` | Self Equipment | SDWT master나 파일 경로 segment로 해석하지 않는다. 정확한 보존 정책은 별도 운영 범위다. | 사용 `Confirmed` — `self-equipment.md`; `USER_MANUAL.md:80` |
| `ALL` | 예약 선택값 | 해당 상위 필터 범위의 모든 하위 값을 선택하는 literal | `ALL_STEPS`, `MY_EQP_URL_STEP`, sensor/ch_step `ALL` | Self Equipment, 동일성 | 적용 범위가 필터마다 다르다. `step=ALL`은 MY EQP 정상 분기이고 HMAC 검증 우회가 아니다. | `Confirmed` — `step-deeplink.md:132-144`; `self-equipment.md:106` |
| `prc_group` | 데이터·화면 식별자 | 공통부 이상감지에서 SDWT 아래의 PRC Group 필터 | `prc_group`, API `prcGroup` | 공통부 이상감지 | ERD 경로의 `ppid` 또는 Self의 `recipe_id`와 동일하다고 확정할 근거가 없다. | 사용 `Confirmed`, 관계 `Unknown` — `abnormal-data.md:181` |
| `lineDashboard` | API 객체 | Dashboard 화면·메일 요약에 필요한 filter, summary와 배열을 묶는 응답 객체 | `lineDashboard` | `GET /api/dashboard-data` | 상위 `summary`·`metrics`와 같은 객체가 아니다. | `Confirmed` — `dashboard.md:150-169` |

## 4. 기준 명칭 매핑

| 사용자 표기 | URL·API 표기 | 저장·경로 표기 | 기준 해석 |
|---|---|---|---|
| Sensor Grade | `grade`, 반복 `priority` | `priority`, 경로 `grade` | UI Grade를 조회 시 원천 `priority`로 변환한다. |
| STEP | query `step`, API `desc`·`stepDesc` | row `desc`, path `step_desc` | 선택 STEP 설명과 URL token 후보를 문맥으로 구분한다. |
| PPID | 직접 query 없음 | `recipe_id`, path `ppid` | UI 표시 매핑은 확인됐지만 모든 원천의 동일성은 확정하지 않는다. |
| eqp_ch | `eqpCh`, alias `eqp_ch` | row `eqp` | query 이름과 화면 label, 원천 column이 다르다. |
| ch_step | `chStep` | row `step`, path `ch_step` | 공정 STEP이 아닌 sensor 하위 차원이다. |
| Line | `line`, `lineId` | `line_rev`, mapping | mapping을 거치는 표시·집계 단위다. |

## 5. 확인된 Mismatch

| 항목 | 차이 | 영향 |
|---|---|---|
| `mailingSummary` 위치 | 후보는 `lineDashboard.summary.mailingSummary`, 현재 계약은 `lineDashboard.mailingSummary` | consumer·Schema가 잘못된 경로를 사용할 수 있다. |
| 개별 STEP HMAC | 후보 URL은 존재하지만 generator·validator·mapping·secret이 현재 코드에 없다. | 개별 STEP token 링크를 정상 기능으로 안내할 수 없다. |

명칭이 다른 것만으로 `Mismatch`로 판정하지 않는다. `Grade`↔`priority`, `PPID`↔`recipe_id` 등은 현재 코드에서 확인된 매핑이며 공식 업무 정의가 필요한 부분만 `Unknown`으로 남긴다.

## 6. 주요 Unknown과 Risk

- `SDWT`, `PPID`, `EQP`, `eqpCh`의 공식 업무 정의와 master 소유자: `Unknown`
- Parquet 전체 Schema, producer, timezone, publish 완료 신호와 보존기간: `Unknown`
- 개별 STEP HMAC의 필요성, 입력, algorithm, digest, 만료와 key rotation: `Unknown`
- URL의 `step`, `eqpCh`와 식별값이 browser history·proxy log에 남을 가능성: `Risk`
- 유사 표기 변경 시 URL, API, 파일 경로, 메일 link와 기존 사용자 북마크의 동시 호환성: `Risk`

## 7. 유지보수 기준

용어를 추가·변경할 때는 실제 route·API·데이터 column과 [사용자 메뉴얼](../user-manual/USER_MANUAL.md)을 함께 확인한다.
상세 정의를 이 문서에 중복 복사하지 않고 [dashboard.md](../features/dashboard.md), [self-equipment.md](../features/self-equipment.md), [step-deeplink.md](../features/step-deeplink.md), [mailing.md](../features/mailing.md), [abnormal-data.md](../features/abnormal-data.md)를 기준으로 연결한다.
확인되지 않은 약어 확장이나 데이터 소유권은 정답처럼 추가하지 않는다.

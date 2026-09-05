# L0 Spider 이상 데이터 및 결과 조회 기준

| 항목 | 내용 |
|---|---|
| 문서 목적 | 이상 데이터의 화면·API·파일 경로·출력 연결과 현재 조회 책임을 정의한다. |
| 문서 상태 | `Baseline` |
| 기능 범위 | `As-Is` |
| 기준 브랜치 | `main` |
| 기준 commit | `2d553536` + 현재 working tree 변경 |
| 관련 Flow ID | `DF-DASH-01`, `DF-SELF-01~03`, `DF-ABN-01~03` |
| 조사 방식 | 저장소 정적 조사만 수행했으며 실제 `/appdata`, DB와 운영 서비스를 사용하지 않았다. |
| 브랜치 경계 | `mock-agent`의 mock Parquet·이미지·E2E는 `Out of Scope`다. |

## 1. 목적과 범위

이 문서는 Dashboard, Self Equipment, 동일성 이상감지, 공통부 이상감지와 공통부 동일성 이상감지가 파일 기반 분석 결과를 어떻게 조회·변환·표시하는지 정의한다.
경로 문자열만 나열하지 않고 `화면 → 프론트엔드 조회 → API → handler → 파일·DB → 화면 출력`을 현재 코드 기준으로 연결한다.
전체 Parquet Schema, upstream 생성 작업, 운영 mount와 보존 정책은 확인하지 않았으므로 구현 사실로 확정하지 않는다.
STEP 딥링크, Dashboard 응답 계약과 보안 원칙은 각 기준 문서를 우선하며 이 문서는 데이터 결과 연결에 집중한다.

상태는 `Confirmed`, `Documented`, `Inferred`, `Unknown`, `Mismatch`를 사용하고 운영 검토가 필요한 항목은 `Risk`로 구분한다.

## 2. 기능과 데이터 방식 요약

| 기능 | 브라우저 route | 핵심 원천 | 선택 방식 | 최종 출력 | 상태 |
|---|---|---|---|---|---|
| Line Dashboard | `/`, `/fdc_trend` | detail·stats Parquet, mapping JSON | 날짜별 최신 detail과 최신 시각 stats | KPI, 막대, 추이, 상세표 | `Confirmed` |
| Self Equipment | `/self-equipment`, `/fdc_trend/self-equipment` | team `df_path.parquet`, ERD `data.parquet`, history Parquet | index row와 종속 필터 | scatter, 동일성 chart, 변경이력 | `Confirmed` |
| MY EQP | 같은 route의 `sdwt=MY_EQP` | 등록 DB, mapping, 복수 team Parquet | active 등록 EQP와 path row 매칭 | 등록 EQP용 필터·chart | `Confirmed` |
| 동일성 이상감지 | `/matching-anomaly` | `erd_commonality` 디렉터리·PNG | 최신 시각 디렉터리와 계층 필터 | 페이지된 분석 이미지 | `Confirmed` |
| 공통부 이상감지 | `/common-anomaly` | `path_common` Parquet, common `data.parquet`·PNG, SKIP DB | index row와 종속 필터 | 이미지, scatter, 동일성 chart | `Confirmed` |
| 공통부 동일성 이상감지 | `/common-commonality-anomaly` | `path_common_commonality` 디렉터리·PNG | 최신 `YYYY-MM-DD` 디렉터리와 EQP_MODEL 계층 필터 | 페이지된 분석 이미지 | `Confirmed` |

분석 결과 파일은 Node가 읽고 stream한다. 사용자·등록·SKIP·조회 이력은 Python helper가 DB에서 읽거나 쓴다.

기본 `config/sensor-exclusions.json` 또는 `SENSOR_EXCLUSION_CONFIG_PATH`가 가리키는 JSON은 `selfEquipment`, `matchingAnomaly`,
`commonAnomaly`, `commonCommonalityAnomaly`별 `contains` 배열을 제공한다.
서버는 실제 row·directory에서 얻은 `sensor`를 대소문자 구분 없이 비교하고, 포함문자가 일치하는 row를 종속 filter option과 최종 결과 생성 전에 제외한다.
자설비의 일반 조회와 MY EQP는 같은 `selfEquipment` 규칙을 사용하며 App별 규칙은 서로 상속하지 않는다.

## 3. 화면에서 데이터까지의 연결

### 3.1 Line Dashboard

```text
LineAnomalyDashboard
→ fetchDashboardSummary()
→ GET /api/dashboard-data
→ handleDashboardDataRequest()
→ getDashboardSummary()
→ 날짜명 detail Parquet + stats Parquet + mapping JSON
→ lineDashboard
→ KPI·막대·추이·상세표
```

| 단계 | 구현 | 확인된 동작 | 근거 |
|---|---|---|---|
| 화면 | `LineAnomalyDashboard` | Line과 추이 기간을 선택하고 두 React Query를 사용 | `LineAnomalyDashboard.jsx:326-365` |
| 요청 | `fetchDashboardSummary` | `startDate`, `endDate`, 반복 `line`을 직렬화 | `dashboardApi.js:3-12` |
| route | `GET/HEAD /api/dashboard-data` | 통합 server와 Vite middleware가 handler 호출 | `server.mjs:134-139`; `vite.config.mjs:42-45` |
| 날짜 선택 | `listDashboardDateFiles`, `selectLatestDashboardFilePerDate` | 유효한 시각 파일을 나열하고 날짜별 마지막 파일 선택 | `dashboardData.mjs:664-690` |
| 집계 | `getDashboardSummary` | 최신 stats와 기간 detail을 읽고 mapping을 적용 | `dashboardData.mjs:712-783` |
| 출력 | `LineAnomalyDashboard` | 요약 KPI, Line별 bar·trend·상세 table | `LineAnomalyDashboard.jsx:435-622` |

고유 이상건은 `desc`, `recipe_id`, `priority`, `sensor`, `eqp` 조합으로 계산한다.
Dashboard 상세 링크는 Line·SDWT·Grade를 Self Equipment route로 넘기며 STEP·EQP는 이후 화면에서 선택한다.

### 3.2 Self Equipment와 MY EQP

```text
FdcTrendPage
→ fetchSelfEquipmentData() 또는 fetchMyEqpEquipmentData()
→ GET /api/self-equipment-data 또는 /api/my-eqp-equipment-data
→ readTeamErdRows() + pass_history
→ path/{line}/{pathSdwt}/df_path.parquet
→ buildSelfEquipmentPayload()
→ path row의 file_path
→ GET /api/erd-scatter-data
→ sibling data.parquet·{eqp}.parquet
→ scatter·동일성 chart·변경이력
```

일반 조회는 `line`, `pathSdwt`, 표시 `sdwt`가 필수이며 `priority`, `desc`, `eqpCh`, `sensor`, `chStep`을 순서대로 좁힌다.
`df_path.parquet` row는 최종 chart의 위치와 metadata를 제공하고, 선택 row의 `file_path`는 다음 scatter 요청의 `path`가 된다.
서버는 직접 ERD 또는 backup root인지 확인한 뒤 image와 같은 directory의 `data.parquet`를 선택한다.

MY EQP는 요청 사용자의 active `myeqp_regist`와 mapping을 먼저 조회한다.
등록 SDWT를 path key로 바꿔 여러 team Parquet를 읽고 등록 EQP와 row EQP를 정규화해 매칭한 다음 같은 payload builder를 사용한다.
`step=ALL`은 MY EQP에서만 `allowAllSteps: true`로 전체 STEP row를 허용한다.

### 3.3 동일성 이상감지

```text
CommonalityAnomalyPage
→ fetchCommonalityData()
→ GET /api/commonality-data
→ getLatestCommonalityPath()
→ erd_commonality/{latest_date}의 최신 유효 디렉터리
→ collectCommonalityRows()
→ SDWT/Grade/step_seq/step_desc/ppid/sensor_ch_step 계층
→ GET /api/commonality-image
→ img.png stream
→ STEP별 이미지 카드
```

화면은 mapping으로 Line별 SDWT 후보를 만든 뒤 `stepDesc`, `sensor`, `chStep`을 API에 보낸다.
CORE-04 이후 mapping API가 성공하고 최소 runtime 계약을 통과하기 전에는 동일성·공통부·Self의 종속 조회를 시작하지 않는다. 빈 `line_mapping`, 잘못된 dictionary type과 API 실패는 일반 empty가 아니라 기준정보 오류로 표시하며 사용자가 다시 조회할 수 있다.
서버 경로에는 Line segment가 없으며 Line은 화면에서 SDWT 후보를 제한하고 응답 filter에 유지된다.
서버는 `stepDesc → sensor → chStep` 종속 option을 만들고 최종 row의 `filePath`를 image endpoint에 전달한다.
화면은 한 페이지에 최대 18개 row를 렌더링하며 `stepDesc`로 그룹화한다.

### 3.4 공통부 이상감지

```text
CommonAnomalyPage
→ fetchCommonAnomalyData()
→ GET /api/common-anomaly-data
→ readCommonPathRows() + pass_history
→ path_common/{line}/{pathSdwt}/df_path.parquet
→ file_path를 common data.parquet·PNG로 변환
→ image 또는 GET /api/common-anomaly-scatter-data
→ EQP별 이미지·scatter·동일성 chart
```

화면 filter는 `Line → SDWT → prcGroup → eqp → sensor` 순서다.
path row의 `file_path`가 `.png`이면 같은 directory의 `data.parquet`로 변환하고 원래 basename을 EQP image 후보로 사용한다.
scatter와 identity는 `sensor`와 path row의 `step`을 합친 `${sensor}_${chStep}` Parquet column을 읽는다.
최근 72시간의 공통부 SKIP record는 index row에서 제외되며 DB 자체는 분석 point의 저장소가 아니다.

### 3.5 공통부 동일성 이상감지

```text
CommonalityAnomalyPage variant="commonCommonality"
→ fetchCommonCommonalityData()
→ GET /api/common-commonality-data
→ path_common_commonality/{latest_date}의 최신 `YYYY-MM-DD` 디렉터리
→ SDWT/EQP_MODEL/Grade/Sensor@ch_step 계층
→ GET /api/common-commonality-image
→ img.png stream
→ EQP_MODEL별 이미지 카드
```

Line은 기존 동일성 화면처럼 mapping에서 SDWT 후보를 제한하며 실제 파일 경로 segment에는 포함되지 않는다.
root는 `COMMON_COMMONALITY_ROOT_PATH`를 우선하고, 없으면 `COMMONALITY_ROOT_PATH` 또는
`SPIDER_DASHBOARD_PATH_ROOT`의 형제 `path_common_commonality`, 이후 코드 기본 경로 순으로 결정한다.
서버는 `eqpModel → sensor → chStep` 종속 option을 만들고 `Sensor=ALL`이면 `chStep=ALL`만 허용한다.
화면은 기존 동일성 화면과 같은 방식으로 한 페이지에 최대 18개 이미지를 렌더링하고 최종 row를 `EQP_MODEL`로 그룹화한다.
공통부 동일성에 한해 `latest_date` 경로 segment는 시각을 제외한 `YYYY-MM-DD`만 사용한다.
최신 날짜 directory가 없을 때와 선택 SDWT directory가 없을 때는 서로 다른 안전한 오류 코드·문구를 반환한다.

동일성·공통부·공통부 동일성의 각 결과 카드에는 자설비와 같은 **이력저장** action이 있다.
브라우저는 카드의 결과 이미지 경로와 선택 Line을 `POST /api/hit-history`로 보내며, 서버는 현재 사용자를 결합해 기존 `hit_history`의
`update_date`, `line_id`, `sdwt`, `file_path`, `knox_id`, `exec_date` 여섯 column에 저장한다.
공통부는 같은 data path를 공유하는 EQP를 구분하기 위해 `data.parquet`가 아니라 카드별 `{eqp_cb}.png` 경로를 저장한다.

## 4. API와 데이터 원천

| 메서드 | API | handler | 주요 원천 | 결과 |
|---|---|---|---|---|
| `GET/HEAD` | `/api/dashboard-data` | `handleDashboardDataRequest` | detail·stats Parquet, mapping | Dashboard JSON |
| `GET` | `/api/self-equipment-data` | `handleSelfEquipmentDataRequest` | team Parquet, `pass_history` | filter option·chart row |
| `GET` | `/api/my-eqp-equipment-data` | `handleMyEqpEquipmentDataRequest` | registration DB, mapping, team Parquet | MY EQP chart row |
| `GET` | `/api/erd-scatter-data` | `handleErdScatterDataRequest` | ERD `data.parquet`, history Parquet | scatter·identity JSON |
| `GET/HEAD` | `/api/erd-file` | `handleErdFileRequest` | ERD image | image stream |
| `GET/HEAD` | `/api/latest-commonality-path` | `handleLatestCommonalityPathRequest` | commonality root directory | 최신 path·date |
| `GET` | `/api/commonality-data` | `handleCommonalityDataRequest` | commonality directory tree | filter option·image row |
| `GET/HEAD` | `/api/commonality-image` | `handleCommonalityImageRequest` | `img.png` | PNG stream |
| `GET` | `/api/common-commonality-data` | `handleCommonCommonalityDataRequest` | 공통부 동일성 directory tree | filter option·image row |
| `GET/HEAD` | `/api/common-commonality-image` | `handleCommonCommonalityImageRequest` | 공통부 동일성 `img.png` | PNG stream |
| `GET` | `/api/common-anomaly-data` | `handleCommonAnomalyDataRequest` | common path Parquet, `pass_history` | filter option·image/chart row |
| `GET` | `/api/common-anomaly-scatter-data` | `handleCommonAnomalyScatterRequest` | common `data.parquet` | scatter·identity JSON |
| `GET/HEAD` | `/api/common-anomaly-image` | `handleCommonAnomalyImageRequest` | common PNG | PNG stream |
| `POST` | `/api/hit-history` | `handleHitHistoryRequest` | 현재 사용자, 결과 이미지 path, `hit_history` | 카드별 결과 이력 저장 |

`GET /api/latest-commonality-path`는 현재 화면의 직접 호출 위치가 확인되지 않았지만 같은 최신 path 함수는 commonality data/image handler에서 사용된다.

## 5. 대표 경로 패턴

아래 경로는 코드의 template·조립·검증 근거다. 실제 파일 존재나 내용은 확인하지 않았다.

| ID | 대표 pattern | 용도 | runtime 선택 방식 | 상태 |
|---|---|---|---|---|
| `ABN-P01` | `/appdata/abnormal_trend/pic/path/{latest_date}` | Dashboard detail Parquet | root의 시각 파일명 나열 | `Confirmed` |
| `ABN-P02` | `/appdata/abnormal_trend/pic/stats/{latest_date}_spider_step_stats.parquets` | Dashboard stats | 최신 detail 시각으로 조립 | `Confirmed` |
| `ABN-P03` | `/appdata/abnormal_trend/pic/path/{line}/{sdwt}/df_path.parquet` | Self/MY EQP index | Line·path SDWT로 조립 | `Confirmed` |
| `ABN-P04` | `/appdata/abnormal_trend/pic/erd/{latest_date}/{sdwt}/{step_desc}/{ver}/{ppid}/{grade}/{sensor}/{ch_step}/data.parquet` | ERD point 원천 | 실제 runtime은 index image의 sibling으로 선택 | pattern·runtime `Confirmed` |
| `ABN-P05` | 같은 ERD directory의 `{eqp}.png` | ERD 결과 image·path identity | `file_path` 원문 | row 계약 `Confirmed` |
| `ABN-P06` | 같은 ERD directory의 `{eqp}.parquet` | 변경점 이력 | 선택 EQP 이름으로 조립 | `Confirmed` |
| `ABN-P07` | `/appdata/abnormal_trend/pic/backup/#appdata#...#{eqp}.png` | backup ERD image 후보 | backup path도 sibling data로 변환 | `Confirmed` |
| `ABN-P08` | `/appdata/abnormal_trend/pic/erd_commonality/{latest_date}/{sdwt}/{grade}/{step_seq}/{step_desc}/{ppid}/{ppid}/{sensor}_{ch_step}/img.png` | 동일성 이미지 | 최신 directory 계층 탐색 | `Confirmed` |
| `ABN-P09` | `/appdata/abnormal_trend/pic/path_common/{line}/{sdwt}/df_path.parquet` | 공통부 index | Line·path SDWT로 조립 | `Confirmed` |
| `ABN-P10` | `/appdata/abnormal_trend/pic/common/{latest_date}/{sdwt}/{step_desc}/{grade}/{sensor}/{ch_step}/data.parquet` | 공통부 point 원천 | index PNG/data path를 sibling data로 변환 | `Confirmed` |
| `ABN-P11` | 같은 common directory의 `{eqp_cb}.png` | 공통부 결과 image | data path와 EQP로 조립 | `Confirmed` |
| `ABN-P12` | `..._spider_step_stats_except_v.parquets` | 제외-V stats 후보 | runtime 사용 위치 미확인 | 선언 `Confirmed`, 소비 `Unknown` |
| `ABN-P13` | `/appdata/abnormal_trend/pic/path_common_commonality/{latest_date}/{sdwt}/{eqp_model}/{grade}/{sensor}@{ch_step}/img.png` | 공통부 동일성 이미지 | `latest_date=YYYY-MM-DD` 최신 directory 계층 탐색 | `Confirmed` |

`src/config/spiderDataPaths.mjs`는 대표 pattern을 모으지만 runtime 전체가 builder를 사용하지는 않는다.
Self와 공통부의 후속 데이터는 index row의 절대 `file_path`를 기준으로 sibling 경로를 파생한다.

## 6. 경로·필드 전파 관계

| 값 | 최초 근거 | 프론트엔드/API | 서버·경로 반영 | 화면 출력 | 상태 |
|---|---|---|---|---|---|
| `latest_date` | Dashboard filename, 최신 directory, index `file_path` | Dashboard date filter 외에는 직접 전달하지 않음 | stats/detail 선택, commonality root, ERD/common path segment | 최신 시각 badge·동일성 날짜 | `Confirmed` |
| `line` | mapping의 Line 값 | Dashboard 반복 `line`; 다른 화면 단일 `line` | team/common index path; matching은 SDWT 후보 제한에만 사용 | Line filter·summary | `Confirmed` |
| `sdwt` | mapping key·display, path row | `pathSdwt`와 표시 `sdwt`를 분리 | index path·row filter·directory segment | SDWT filter·label | `Confirmed` |
| `grade` | URL/UI Grade 또는 row `priority` | API에는 주로 반복 `priority` | detail·path row와 directory `grade` | badge·KPI·filter | `Confirmed` |
| `step_seq` | commonality directory | query로 직접 전달하지 않음 | directory metadata | 동일성 image card 보조 정보 | `Confirmed` |
| `step_desc` | row `desc` 또는 directory | `desc`·`stepDesc` | row filter와 path segment | STEP filter·group title | `Confirmed` |
| `ppid` | ERD/commonality path | 직접 query로 전달하지 않음 | ERD `{ppid}`, commonality duplicate PPID directory | chart/card PPID | `Confirmed` |
| `sensor` | row·directory | `sensor` | row filter와 axis column | filter·card·axis | `Confirmed` |
| `ch_step` | row `step`·directory suffix | query `chStep` | path segment, `${sensor}_${chStep}` column | filter·chart title | `Confirmed` |
| `eqp` | index row·image basename·DB 등록 | query `eqp` 또는 `eqpCh` | EQP row filter, image·history filename | EQP group·chart | `Confirmed` |
| `eqp_model` | 공통부 동일성 directory | query `eqpModel` | directory segment와 종속 filter | EQP_MODEL filter·group title | `Confirmed` |
| `ver` | team index row·ERD path | query로 직접 전달하지 않음 | ERD path와 history identity | 일부 chart metadata·이력 | `Confirmed` |

결과 이력의 `file_path`는 네 App 모두 slash를 `#`로 바꿔 보존한다. App별 image root는 다르지만 DB column 구조와 현재 사용자 결정 방식은 동일하다.

### 6.1 명칭 대응

- Self index와 Dashboard detail은 `recipe_id`를 사용하고 UI는 이를 PPID로 표시한다.
- Self index의 `desc`는 STEP 설명이며 `step` column은 `ch_step`에 해당한다.
- 공통부 index의 `prc_group`은 공통부 화면 filter이고 ERD `{ppid}`와 동일하다고 확정할 근거는 없다.
- scatter Parquet은 선택 `sensor`·`chStep`으로 동적 column 이름을 만든다.
- commonality의 `sensorChStep` directory는 마지막 `_`를 기준으로 Sensor와 `chStep`을 나눈다.

## 7. 확인된 column projection과 변환

| 원천 | 코드가 요청하는 column | 주요 변환 | 전체 Schema 상태 |
|---|---|---|---|
| Dashboard stats | `exec_date`, `recipe_id`, `priority`, `ng`, `total` | 숫자 합계·Grade 분류 | projection `Confirmed`, 타입·nullable `Unknown` |
| Dashboard detail | `sdwt`, `desc`, `recipe_id`, `priority`, `sensor`, `eqp` | 5-key 중복 제거·Line mapping | projection `Confirmed`, 전체 Schema `Unknown` |
| Self index | `sdwt`, `desc`, `ver`, `recipe_id`, `priority`, `sensor`, `step`, `eqp`, `file_path`, `line_rev` | 문자열 정규화·종속 filter | projection `Confirmed`, 전체 Schema `Unknown` |
| ERD point | `act_time`, `eqp_cb`, `eqp_id`, `disp_name`, `wafer_id`, `root_lot_id`, 동적 axis | 날짜·숫자 변환·EQP grouping | projection `Confirmed`, axis 타입 `Unknown` |
| ERD history | `date`, `ctttm_url`, `work_type`, `desc` | 날짜 정렬·부분 실패 분리 | projection `Confirmed`, 전체 Schema `Unknown` |
| Common index | `file_path`, `sdwt`, `prc_group`, `date`, `priority`, `sensor`, `step`, `eqp`, `line_rev` | path→data/image, 종속 filter | projection `Confirmed`, 전체 Schema `Unknown` |
| Common point | `eqp_id`, `disp_name`, `lotid`, `wafer_id`, `act_time`, `eqp_cb`, 동적 axis | EQP matching·invalid row 제외 | projection `Confirmed`, 전체 Schema `Unknown` |

코드는 `hyparquet`와 `hyparquet-compressors`로 필요한 column만 읽는다.
파일 producer와 consumer가 공유하는 실행 가능한 전체 파일 Schema는 현재 Core Harness에 없다.

## 8. 데이터 생성·소유권과 읽기·쓰기

| 자원 | 생성·관리 책임 | L0 Spider 읽기 | L0 Spider 쓰기 | 판정 |
|---|---|---:|---:|---|
| Dashboard·index·point Parquet | `Unknown` | 예 | runtime data module에서 미확인 | 읽기 `Confirmed` |
| ERD·동일성·공통부 PNG | `Unknown` | stream·경로 확인 | 미확인 | 읽기 `Confirmed` |
| mapping JSON | 생성 책임 `Unknown` | 예 | 미확인 | 읽기 `Confirmed` |
| sensor 제외 JSON | 개발자·배포 담당자 관리 | API 요청 시 읽기 | 애플리케이션 쓰기 없음 | 읽기·적용 `Confirmed`, 운영 owner·경로 `Unknown` |
| 사용자·기준정보 DB | DB 관리 주체 `Unknown` | 예 | scoped 조회에서는 아니오 | 사용 `Confirmed` |
| 등록·이력 DB | L0 Spider가 일부 row 생성·변경 | 예 | INSERT/UPDATE/DELETE, 일부 DDL | `Confirmed` |
| browser cache | L0 Spider frontend | memory 조회 cache | process/browser memory만 | `Confirmed` |

L0 Spider의 확인된 책임은 파일 결과를 선택·검증·읽기·집계·JSON 변환하거나 image로 stream하는 것이다.
운영 분석 파일의 계산·생성·배치 완료·publish는 저장소에서 확인되지 않아 외부 책임으로 확정하지 않고 `Unknown`으로 둔다.

## 9. 최신 데이터와 cache

| 영역 | 최신 판단 | server cache | browser cache·query | 영향 |
|---|---|---|---|---|
| Dashboard | 유효 시각 filename의 날짜별 마지막 값 | file list root mtime, Parquet 1개, aggregate 32개; mtime·size 검사 | main 60초, trend 5분 stale | overwrite 시 mtime·size 기준 갱신 |
| Self index | `df_path.parquet` row 자체 | LRU 1개; mtime·size 검사 | 기본 stale 60초 | 새 row는 재조회 시 반영 |
| ERD chart | index image의 sibling data; path 첫 segment를 latestDate로 사용 | scatter 1개, history 1개; mtime·size 검사 | chart query `staleTime: Infinity` | 같은 query key의 file 교체는 자동 refetch되지 않음 |
| 동일성 | 최신 유효 `YYYY-MM-DD hh:mm:ss` directory | directory index 5분 TTL, latest path 포함 key | 기본 stale 60초 | 동일 latest directory 내부 변경은 최대 TTL 영향 가능 |
| 공통부 동일성 | 최신 유효 `YYYY-MM-DD` directory | directory index 5분 TTL, latest path 포함 key | 기본 stale 60초 | 동일 latest directory 내부 변경은 최대 TTL 영향 가능 |
| 공통부 index·chart | index row `file_path`가 가리키는 결과 | path 1개, scatter 1개; mtime·size 검사 | 기본 stale 60초, 일부 history 30초 | file 교체는 server mtime·size로 판정 |
| sensor 제외 설정 | 기본 또는 override JSON의 App별 `contains` | 마지막 정상값; mtime·size 검사 | 기존 query cache는 다음 refetch 전 유지 가능 | 다음 API 요청부터 새 규칙 적용 |
| 이미지 HTTP | path가 직접 가리키는 file | 별도 memory cache 없음 | commonality/common `private,max-age=300`; ERD `no-cache` | endpoint별 정책 상이 |

Dashboard의 날짜 연산은 UTC 기반 검증·증감을 사용하지만 filename이 표현하는 업무 timezone은 `Unknown`이다.
Self·공통부는 모든 root를 최신순으로 탐색하지 않고 upstream index row가 가리키는 결과를 신뢰한다.

## 10. 화면 출력과 원천 연결

| 화면 출력 | 직접 원천 | 변환 | 빈 상태 |
|---|---|---|---|
| Dashboard KPI·표 | stats/detail Parquet | 합계·고유조합·Line mapping | 숫자 0·빈 row 또는 전체 오류 |
| Dashboard trend | 날짜별 detail | 누락 날짜 count 0 | `EmptyChart` |
| Self filter option | team index Parquet | 종속 option·SKIP 제외 | 다음 filter placeholder |
| Self scatter | ERD `data.parquet` | EQP·axis 선택, 날짜·숫자 정규화 | point 없는 chart 상태 |
| Self 동일성 | 같은 `data.parquet` | EQP별 grouping·기간 filter·sampling | group 없음 안내 |
| 변경점 이력 | sibling `{eqp}.parquet` | 날짜 정렬 | history만 실패해도 chart는 유지 |
| 동일성 image card | `erd_commonality/.../img.png` | directory metadata와 lazy image | image error card |
| 공통부 image | common `{eqp_cb}.png` | path row·EQP image 변환 | image error UI |
| 공통부 scatter·identity | common `data.parquet` | EQP matching·axis selection | point/group 없는 chart 상태 |

## 11. 파일 없음·빈 데이터·부분 결과·오류

| 상황 | server 동작 | 화면 영향 | 상태 |
|---|---|---|---|
| Dashboard 유효 시각 파일 없음 | `404` | Dashboard 오류 | `Confirmed` |
| Dashboard 잘못된 날짜·범위 | `400` | API 오류 표시 | `Confirmed` |
| 기간 중 특정 날짜 파일 없음 | 해당 날짜 count 0 | trend에 0 표시 가능 | `Confirmed` |
| stats/detail 읽기 실패 | `500` | Dashboard 오류 | `Confirmed` |
| team/common index 누락 | 현재 handler에서 `500` | filter·결과 오류 | `Confirmed` |
| 필수 Self/common query 누락 | `400` | 오류 표시 | `Confirmed` |
| filter 값 불일치 | 선택값을 빈 문자열로 보정, 하위 row 빈 배열 | 다음 filter placeholder | `Confirmed` |
| ERD history만 읽기 실패 | scatter `200`과 `historyError` | chart 유지, history 오류 분리 | `Confirmed` |
| ERD/common scatter 주 파일 실패 | `500` | chart 오류 | `Confirmed` |
| 동일성 latest/SDWT directory 없음 | `404` | 화면 오류 | `Confirmed` |
| 동일성 image 없음 | image endpoint `404` | 카드가 일반 오류 표시 | `Confirmed` |
| 공통부·ERD image 없음 | image endpoint `404` | image error UI | `Confirmed` |
| common point의 invalid date/value | row 제외, diagnostics count | 유효 point만 부분 반환 | `Confirmed` |

동일성 index는 `sensorChStep` directory마다 `img.png` path를 조립하며 index 생성 시 file 존재를 검사하지 않는다.
따라서 목록 성공 후 개별 image 요청이 `404`가 되는 부분 결과가 가능하다.

## 12. 보안과 경로 경계

- `line`, `pathSdwt`, `sensor`, `chStep`, `eqp` 등 path segment는 `/`, `\`, `..`를 제한하는 위치가 있다.
- ERD·common data와 image handler는 `resolve()`와 허용 root·확장자 검사를 사용한다.
- 실제 `realpath`·symlink 탈출 방지, mount ACL과 read-only 설정은 `Unknown`이다.
- API는 다음 조회를 위해 성공 payload에 `file_path`, `sourcePath`, `latest.path`를 포함할 수 있다.
- CORE-03A 보호 대상 실패 응답은 고정 `error`, 안정적 `code`, `requestId`만 반환하며 원문 exception·실패 경로를 network response에 포함하지 않는다. 외부 access log 정책은 별도 `Unknown`이다.
- 운영 파일의 절대 path를 API 계약에서 제거하려면 opaque ID 또는 server-side mapping으로 producer·consumer를 함께 변경해야 한다.

## 13. Mismatch

| ID | 코드 기준 | 다른 표현·구조 | 영향 |
|---|---|---|---|
| `ABN-M02` | path template 중 일부는 runtime builder가 아니라 index `file_path` sibling 변환으로 조회 | 중앙 template만 보면 실제 선택 경로를 오해할 수 있음 | 경로 변경 시 registry만 수정해서는 동작하지 않음 |
| `ABN-M03` | 통합 server에는 MY EQP·clicked history route가 있음 | Vite 단독 middleware에는 두 route가 없음 | 같은 화면이 실행 모드에 따라 일부 다르게 동작 |

`ABN-M01`은 명칭 차이만으로 분류한 Mismatch에서 제외했다. 확인된 UI `PPID` ↔ Self·Dashboard 필드 `recipe_id` 대응은 [용어집](../system/glossary.md)을 따른다. 모든 경로의 `ppid`가 같은 업무 의미인지는 별도 확인이 필요하며 공식 정의는 `Unknown`이다.

사용자 메뉴얼의 Dashboard, Self, 동일성·공통부 filter와 출력 설명은 이번 코드 조사에서 명확한 불일치가 확인되지 않았다.

## 14. Unknown

- Parquet·stats·이미지의 실제 생성 process, owner, schedule, 완료 신호와 재처리 절차
- 전체 file Schema, type, nullable, column version과 호환 migration 계약
- `/appdata` mount 방식, 권한, symlink, 용량, 보존기간, backup·restore와 정리 주체
- filename·directory `latest_date`, DB 시각과 화면 표시의 업무 timezone
- upstream이 index와 sibling data/image를 원자적으로 publish하는지 여부
- stats `except_v` 파일의 현재 runtime consumer
- backup image가 언제·어떤 process에서 생성되고 direct ERD와 어떻게 전환되는지
- commonality directory 내부 변경과 5분 index cache의 허용 freshness 기준
- 분석 데이터의 분류 등급, 사용자별 조회 권한과 운영 감사 정책

## 15. Risk

- index row가 absolute path를 전달하므로 경로 변경·mount 이전이 API와 browser query까지 전파될 수 있다.
- 성공 payload의 source path가 network에서 운영 구조를 노출할 수 있다. 보호 대상 실패 payload의 source path·원문 exception은 CORE-03A에서 제거됐다.
- path prefix 검사가 lexical 비교 중심이어서 symlink 구성은 별도 운영 검증이 필요하다.
- upstream publish가 원자적이지 않으면 index는 존재하지만 data/image가 아직 없는 부분 결과가 발생할 수 있다.
- 동적 `${sensor}_${chStep}` column이 없거나 타입이 다르면 chart 전체가 실패할 수 있다.
- `staleTime: Infinity` chart query는 같은 key의 file 내용 변경을 자동 감지하지 않는다.
- mtime·size 기반 cache invalidation은 filesystem timestamp·동일 크기 overwrite 정책에 의존한다.
- 파일 Schema version과 producer-consumer 호환 계약이 없어 drift가 request-time 오류로 나타날 수 있다.

## 16. 변경 영향과 보존 규칙

- path segment·root·filename을 바꿀 때 `spiderDataPaths.mjs`, index producer, server path resolver, API payload와 DB history parser를 함께 검토한다.
- `recipe_id`·PPID, `desc`·`step_desc`, `step`·`ch_step` mapping을 바꿀 때 화면 label, filter, history key와 Dashboard 집계를 함께 갱신한다.
- Parquet column을 바꿀 때 projection, 동적 axis, JSON builder, fixture·unit·contract test를 함께 검토한다.
- latest 선택 규칙을 바꿀 때 Dashboard 비교, commonality cache, 사용자 표시 시각과 timezone을 함께 결정한다.
- absolute path를 opaque ID로 바꾸면 모든 image/scatter producer와 consumer의 migration·rollback이 필요하다.
- 분석 파일 runtime write를 도입할 경우 운영 read-only 원칙, 원자적 publish, 권한과 복구 절차를 별도 승인한다.
- mock Parquet·이미지 동작을 근거로 `main`의 실제 계약을 변경하지 않는다.

## 17. 근거 자료

- `src/config/spiderDataPaths.mjs:1-90` — 대표 path template·Dashboard column
- `server/dashboardData.mjs:568-825` — 날짜 선택·Parquet·cache·오류
- `server/selfEquipmentData.mjs:137-162,196-291,321-834` — team index·ERD data·image·chart
- `server/latestCommonalityPath.mjs:13-89` — 최신 commonality directory
- `server/commonalityData.mjs:83-290` — directory index·filter·PNG stream
- `server/commonCommonalityData.mjs` — 공통부 동일성 directory index·filter·PNG stream
- `server/commonAnomalyData.mjs:223-615` — common index·data/image 변환·chart
- `src/features/fdc-trend/api/{dashboardApi,selfEquipmentApi,commonalityApi,commonAnomalyApi}.js` — browser query
- `src/features/fdc-trend/pages/{FdcTrendPage,CommonalityAnomalyPage,CommonAnomalyPage}.jsx` — filter·출력
- `src/features/fdc-trend/components/LineAnomalyDashboard.jsx` — Dashboard 출력
- `docs/system/data-flow.md`, `docs/system/security.md` — 상위 흐름과 보안 경계
- `docs/user-manual/USER_MANUAL.md:37-120,167-192` — 사용자 관점

이 문서는 `2d553536`과 현재 working tree 변경의 코드 경로 조립·정적 호출 관계를 기준으로 한다.
실제 운영 파일의 존재·내용·성능과 upstream 생성 동작은 검증하지 않았다.

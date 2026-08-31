# L0 Spider Data Reference

## 문서 목적

이 문서는 L0 Spider가 읽는 운영 파일의 대표 경로와 참조 컬럼, DB 이력 테이블의
저장 규칙을 모아 설명합니다. 실제 전체 Parquet Schema, 운영 파일의 존재 여부,
`VARCHAR` 길이, DB 기본키·인덱스·NULL 허용 여부는 확인된 범위를 넘어 가정하지 않습니다.

파일 경로와 컬럼의 코드 기준은 `src/config/spiderDataPaths.mjs`, 화면과 API의 상세 연결은
[이상 데이터 및 결과 조회 기준](abnormal-data.md)을 우선합니다. 이 문서를 변경할 때는
관련 경로 builder, 서버 parser와 기능 문서를 함께 확인합니다.

## 파일 데이터 참조

`latest_date`는 `/appdata/abnormal_trend/pic/path`에 있는 파일명 중
`yyyy-mm-dd hh:mm:ss` 형식과 일치하는 가장 최신 파일명으로 결정한다.

자설비 Scatter chart의 ERD 데이터 경로는 `df_path.parquet`의 `file_path`에서
부모 경로를 유지하고 마지막 `/` 뒤 파일명만 `data.parquet`으로 바꾸어 사용한다.

| 구분 | 참조 파일 | 경로 | 참조 컬럼/키 |
| --- | --- | --- | --- |
| ERD 이상감지 데이터 | `data.parquet` | `/appdata/abnormal_trend/pic/erd/{latest_date}/{sdwt}/{step_desc}/{ver}/{ppid}/{grade}/{sensor}/{ch_step}/data.parquet` | `act_time` (x축), `{sensor}_{ch_step}` (y축), `eqp_cb` (차트별 EQP 필터), `eqp_id`, `disp_name`, `wafer_id`, `root_lot_id` (hover 표시) |
| EQP 변경점 이력 | `{eqp}.parquet` | ERD `data.parquet`과 같은 디렉터리의 `{eqp}.parquet` | `date` (세로 점선 위치), `work_type` (점선 라벨), `ctttm_url`, `desc` |
| stats 파일 | `{latest_date}_spider_step_stats.parquets` | `/appdata/abnormal_trend/pic/stats/{latest_date}_spider_step_stats.parquets` | `exec_date`, `recipe_id`, `priority`, `ng`, `total` |
| V제외 stats 파일 | `{latest_date}_spider_step_stats_except_v.parquets` | `/appdata/abnormal_trend/pic/stats/{latest_date}_spider_step_stats_except_v.parquets` | 미정 (개발하면서 순차 정의) |
| 동일성 기준 이상 감지 그래프 | `img.png` | `/appdata/abnormal_trend/pic/erd_commonality/{latest_date}/{sdwt}/{grade}/{step_seq}/{step_desc}/{ppid}/{ppid}/{sensor}_{ch_step}/img.png` | 미정 (개발하면서 순차 정의) |
| 공통부 동일성 기준 이상 감지 그래프 | `img.png` | `/appdata/abnormal_trend/pic/path_common_commonality/{latest_date}/{sdwt}/{eqp_model}/{grade}/{sensor}@{ch_step}/img.png` | 해당 없음 (이미지 파일) |
| 이상감지 이력 이미지 | `#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png` | `/appdata/abnormal_trend/pic/backup/#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png` | 해당 없음 (이미지 파일) |
| `latest_date` 결정 및 대시보드 세부 파일 | `{latest_date}` | `/appdata/abnormal_trend/pic/path/{latest_date}` | `sdwt`, `desc`, `recipe_id`, `priority`, `sensor`, `eqp` |
| 분임조별 ERD 이상감지 경로 데이터 | `df_path.parquet` | `/appdata/abnormal_trend/pic/path/{line}/{sdwt}/df_path.parquet` | `sdwt`, `desc`, `ver`, `recipe_id`, `priority`, `sensor`, `step`, `eqp`, `file_path`, `line_rev` |
| 공통부 이상감지 경로 테이블 | `df_path.parquet` | `/appdata/abnormal_trend/pic/path_common/{line}/{sdwt}/df_path.parquet` | `file_path`, `sdwt`, `prc_group`, `date`, `priority`, `sensor`, `step`, `eqp`, `line_rev` |
| 공통부 이상감지 데이터 | `data.parquet` | `/appdata/abnormal_trend/pic/common/{latest_date}/{sdwt}/{step_desc}/{grade}/{sensor}/{ch_step}/data.parquet` | `eqp_id`, `disp_name`, `lotid`, `wafer_id`, `act_time` (x축), `{sensor}_{ch_step}` (y축), `eqp_cb` (차트별 EQP 필터) |
| 공통부 이상감지 이미지 | `{eqp_cb}.png` | `/appdata/abnormal_trend/pic/common/{latest_date}/{sdwt}/{step_desc}/{grade}/{sensor}/{ch_step}/{eqp_cb}.png` | 해당 없음 (메인 카드 이미지 출력) |
| 기준정보 매핑 | `mapping_config.json` | `/appdata/l0_spider/mapping_config.json` | `root.line_mapping` (`key`: SDWT 식별자, `value`: 라인), `root.sdwt_mapping` (`key`: SDWT 식별자, `value`: 표시명, key가 없으면 원본 SDWT 사용) |

새 데이터 파일이나 참조 컬럼/키가 추가되면 이 표와
`src/config/spiderDataPaths.mjs`를 함께 업데이트한다.

위 표는 기존 `README.md`의 Data References 표를 내용 변경 없이 옮긴 것입니다.

### 화면별 최신 데이터 판단

- Dashboard는 `/appdata/abnormal_trend/pic/path`의 유효한 시각 파일명 중 날짜별 마지막
  파일을 사용하고, 선택한 최신 detail 시각으로 stats 경로를 만듭니다.
- 동일성 이상감지는 `erd_commonality` 바로 아래의 유효한
  `YYYY-MM-DD hh:mm:ss` 디렉터리 중 최신 디렉터리를 사용합니다.
- 공통부 동일성 이상감지는 `path_common_commonality` 바로 아래의 유효한
  `YYYY-MM-DD` 디렉터리 중 최신 디렉터리를 사용합니다.
- 자설비와 공통부 이상감지는 무조건 전체 root를 최신순으로 탐색하지 않고
  `df_path.parquet`의 `file_path`를 기준으로 후속 데이터와 이미지를 찾습니다.

## DB 공통 기준

DB 접속정보는 `DB_INFO_PATH`가 가리키는 credential 파일에서 읽으며 기본 경로는
`/appdata/l0_spider/db_info.pkl`입니다. credential 파일과 내부 값은 Git에 기록하지
않습니다.

DB 이력을 기록할 때 `knox_id`는 요청 본문의 값을 신뢰하지 않습니다. Node 서버가
`x-forwarded-for`, `x-real-ip`, socket 주소 순으로 접속 IP를 구하고 Python helper가
승인된 사용자 정보를 조회하여 결정합니다. proxy가 전달하는 IP header의 신뢰 정책은
운영 환경에서 별도로 보장해야 합니다.

## `pass_history`

자설비와 공통부 이상감지의 SKIP 이력을 저장·조회·해제하는 테이블입니다.

| 컬럼 | 타입 |
| --- | --- |
| `line_id` | `VARCHAR` |
| `ver` | `VARCHAR` |
| `sdwt` | `VARCHAR` |
| `desc` | `VARCHAR` |
| `recipe_id` | `VARCHAR` |
| `update_date` | `TIMESTAMP` |
| `priority` | `VARCHAR` |
| `sensor` | `VARCHAR` |
| `step` | `VARCHAR` |
| `eqp` | `VARCHAR` |
| `knox_id` | `VARCHAR` |
| `exec_date` | `TIMESTAMP` |
| `comment` | `VARCHAR` |

### 자설비 SKIP 저장값

| `pass_history` 컬럼 | SKIP 저장값 |
| --- | --- |
| `line_id` | 필터에서 선택한 Line Name |
| `ver` | ERD 경로의 `{ver}` |
| `sdwt` | ERD 경로의 `{sdwt}` |
| `desc` | ERD 경로의 `{step_desc}` |
| `recipe_id` | ERD 경로의 `{ppid}` |
| `update_date` | ERD 경로의 `{latest_date}` |
| `priority` | ERD 경로의 `{grade}` |
| `sensor` | ERD 경로의 `{sensor}` |
| `step` | ERD 경로의 `{ch_step}` |
| `eqp` | 차트의 eqp_ch (`.png` 확장자 제외) |
| `knox_id` | 현재 접속자의 `knox_id` |
| `exec_date` | SKIP 버튼을 눌러 팝업을 연 시각 |
| `comment` | 팝업에서 입력한 한 줄 comment, 미입력 시 빈 문자열 |

`POST /api/pass-history`는 SKIP을 등록하고 `DELETE /api/pass-history`는 같은 차트
식별값을 해제합니다. `EQP ALL SKIP`은 현재 EQP에 실제로 존재하는 각 `ch_step`을 별도
행으로 저장하며 `step = ALL`인 가상 행은 만들지 않습니다.

### 공통부 SKIP 저장값

| `pass_history` 컬럼 | 공통부 SKIP 저장값 |
| --- | --- |
| `line_id` | 필터에서 선택한 Line Name |
| `ver` | `NA` |
| `sdwt` | 공통부 데이터 경로의 `{sdwt}` |
| `desc` | 공통부 데이터 경로의 `{step_desc}` |
| `recipe_id` | 경로 테이블에서 선택된 `prc_group` |
| `update_date` | 공통부 데이터 경로의 `{latest_date}` |
| `priority` | 공통부 데이터 경로의 `{grade}` |
| `sensor` | 공통부 데이터 경로의 `{sensor}` |
| `step` | 공통부 데이터 경로의 `{ch_step}` |
| `eqp` | 선택 EQP (`.png` 확장자 제외) |
| `knox_id` | 현재 접속자의 `knox_id` |
| `exec_date` | SKIP 버튼을 눌러 팝업을 연 시각 |
| `comment` | 팝업에서 입력한 한 줄 comment, 미입력 시 빈 문자열 |

공통부 경로에는 `{ver}`가 없으므로 `NA`를 저장합니다. `ver = NA`인 행은 공통부
`SKIP LIST`에서 조회하며 자설비의 경로 복원 대상에서는 제외합니다.

### 활성 기간과 `SKIP LIST`

일반 조회에서는 `exec_date`부터 72시간 동안 같은 이상감지 식별값을 화면 목록과 관련
필터 건수에서 제외합니다. 정확히 72시간이 지나면 일반 이상감지에 다시 포함하고
`SKIP LIST`에서도 제외하지만 DB 행을 자동 삭제하지는 않습니다. 만료된 같은 식별값을
다시 SKIP하면 기존 행의 사용자·시각·comment를 갱신하여 새 72시간을 시작합니다.

자설비 `SKIP LIST`의 최종 차트 경로는 다음 규칙으로 복원합니다.

```text
/appdata/abnormal_trend/pic/erd/{update_date}/{sdwt}/{desc}/{ver}/{recipe_id}/{priority}/{sensor}/{step}/{eqp}.png
```

## `hit_history`

네 이상감지 화면의 결과 카드에서 HIT 이력을 저장하는 테이블입니다.

| 컬럼 | 타입 |
| --- | --- |
| `update_date` | `TIMESTAMP` |
| `line_id` | `VARCHAR` |
| `sdwt` | `VARCHAR` |
| `file_path` | `VARCHAR` |
| `knox_id` | `VARCHAR` |
| `exec_date` | `TIMESTAMP` |

`POST /api/hit-history`는 자설비, 동일성, 공통부와 공통부 동일성의 허용된 결과 이미지
경로를 검증하여 다음 값으로 저장합니다.

| `hit_history` 컬럼 | 이력저장 값 |
| --- | --- |
| `update_date` | 결과 경로의 날짜 또는 날짜·시각 segment |
| `line_id` | 화면에서 선택한 Line Name |
| `sdwt` | 결과 경로의 `{sdwt}` |
| `file_path` | 결과 원본 파일 경로의 모든 `/`를 `#`으로 치환한 값 |
| `knox_id` | 현재 접속자의 `knox_id` |
| `exec_date` | 이력저장 버튼 클릭 시각 |

버튼을 누를 때마다 새 행을 INSERT합니다. 서버는 App별 허용 root, 날짜 형식, 경로 깊이와
파일명을 확인한 뒤 DB helper를 호출합니다.

## `clicked_category_history`

네 이상감지 화면에서 최종 필터 선택으로 결과 조회를 시작한 이력을 저장합니다.

| 컬럼 | 타입 |
| --- | --- |
| `line_id` | `VARCHAR` |
| `sdwt` | `VARCHAR` |
| `grade` | `VARCHAR` |
| `sensor` | `VARCHAR` |
| `update_date` | `TIMESTAMP` |
| `knox_id` | `VARCHAR` |

`POST /api/clicked-category-history`는 실제 Drawing 결과 경로를 서버에서 검증·파싱하고
현재 사용자를 결합한 뒤 한 행을 INSERT합니다. 자설비의 `ch_step`, 동일성·공통부
동일성의 `ch_step`, 공통부의 `sensor`를 새로 선택할 때 호출합니다. 선택 해제와
`SKIP LIST` 조회는 저장하지 않습니다.

| App | `line_id` | `sdwt` | `grade` | `sensor` | `update_date` |
| --- | --- | --- | --- | --- | --- |
| 자설비 | 선택 Line Name | ERD Drawing 경로 | 선택 grade를 확장한 리스트 문자열. `A/B`는 `['A', 'B']` | ERD Drawing 경로 | `ch_step` 클릭 시각 |
| 동일성·공통부 동일성 | 선택 Line Name + `(g)` | `img.png` Drawing 경로 | `img.png` Drawing 경로 | `img.png` Drawing 경로 | `ch_step` 클릭 시각 |
| 공통부 | 선택 Line Name + `(c)` | `data.parquet` Drawing 경로 | `data.parquet` Drawing 경로 | `data.parquet` Drawing 경로 | `sensor` 클릭 시각 |

여러 결과 경로에 grade 또는 sensor가 둘 이상이면 중복을 제거한 리스트 문자열로
저장합니다. Sensor `ALL`은 실제 센서 목록으로 확장하지 않고 `ALL`을 저장합니다.
DB 응답의 `affectedRows`가 0이면 성공으로 처리하지 않습니다.

자설비에서 `MY EQP`를 선택해 조회를 시작할 때는 Drawing 경로 없이 다음 가상 카테고리를
한 번 저장합니다.

- `line_id`: 선택 Line Name
- `sdwt`: `MY EQP`
- `grade`: `['A', 'B', 'D', 'N', 'M']`
- `sensor`: `ALL`
- `update_date`: MY EQP 선택 시각
- `knox_id`: 현재 접속자의 `knox_id`

MY EQP에서는 이 진입 이력만 저장하고 이후 `ch_step` 선택에서 파일 경로 기반 이력을
중복 저장하지 않습니다.

## 관련 문서

- [Dashboard 기능 및 API 계약](dashboard.md)
- [Self Equipment 기능 기준](self-equipment.md)
- [이상 데이터 및 결과 조회 기준](abnormal-data.md)
- [환경 정의](../system/environment-definition.md)
- [데이터 흐름](../system/data-flow.md)
- [문제 해결](../operations/troubleshooting.md)

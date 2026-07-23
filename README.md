# L0 Spider

Standalone React/Vite app for L0 Spider, based on the `fdc_trend` UI from `mlbarod/template2`.

## Run

```bash
npm install
npm run dev
```

The app opens directly at `/`.

## Server

```bash
PORT=5173 node server.mjs
```

기본 실행 모드는 소스 변경사항을 실시간으로 반영한다. 서버를 재실행할 필요 없이
브라우저를 새로고침하면 최신 개발 코드가 표시된다.

정적 `dist` 운영 모드로 실행하려면 다음과 같이 설정한다.

```bash
LIVE_RELOAD=0 PORT=5173 node server.mjs
```

정적 모드에서 `BUILD_ON_START=0`을 설정하면 기존 `dist`를 재빌드하지 않고 제공한다.

## Defect SPIDER 접속자 `knox_id` 식별 구조

참고 저장소: [`mlbarod/defect_spider_for_p3d`](https://github.com/mlbarod/defect_spider_for_p3d)<br>
확인 기준 커밋: [`4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a`](https://github.com/mlbarod/defect_spider_for_p3d/commit/4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a) (`2026-07-10`)

Defect SPIDER는 요청 헤더나 쿠키에서 `knox_id`를 직접 읽지 않는다. 서버에서 접속자의 IP를 구한 뒤 승인된 IP 정보와 사용자 정보를 DB에서 조인하여 `knox_id`를 역조회한다.

```text
사용자 STEP 선택
  → GET /api/click-history?lineName=...&selectStep=...
  → Node 서버가 접속 IP 추출 및 정규화
  → Python loader의 REMOTE_ADDR 환경변수로 전달
  → v_ipms_ip_info에서 승인된 IP 조회
  → user_info와 SUB_USER_ID = knox_id로 조인
  → 첫 번째 조회 행의 knox_id 사용
  → 클릭 이력 테이블 저장
```

세부 처리 순서는 다음과 같다.

1. 사용자가 main/FCC/개별 챔버 화면에서 STEP을 선택하면 프런트엔드가 `lineName`, `selectStep`, cache-busting용 `t`를 포함한 `/api/click-history` 요청을 보낸다. 요청 실패는 화면 흐름을 막지 않도록 비동기로 무시한다. 참고: [`src/main.jsx`](https://github.com/mlbarod/defect_spider_for_p3d/blob/4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a/src/main.jsx#L242-L267), [`src/main.jsx`](https://github.com/mlbarod/defect_spider_for_p3d/blob/4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a/src/main.jsx#L3066-L3071)
2. Node 서버의 `getRemoteIp(req)`는 `x-forwarded-for` → `x-real-ip` → `req.socket.remoteAddress` 순서로 접속 IP를 결정한다. `x-forwarded-for`에 여러 값이 있으면 첫 번째 값을 사용하고, IPv4-mapped IPv6의 `::ffff:` 접두사는 제거한다. 참고: [`server.mjs`](https://github.com/mlbarod/defect_spider_for_p3d/blob/4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a/server.mjs#L57-L64)
3. `/api/click-history` handler는 Python의 `click-history` 명령을 실행하면서 정규화한 IP를 `REMOTE_ADDR` 환경변수로 넘긴다. 운영 서버와 Vite 개발 서버가 같은 방식을 사용한다. 참고: [`server.mjs`](https://github.com/mlbarod/defect_spider_for_p3d/blob/4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a/server.mjs#L143-L150), [`server.mjs`](https://github.com/mlbarod/defect_spider_for_p3d/blob/4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a/server.mjs#L213-L225)
4. Python loader는 `REMOTE_ADDR`을 읽고 로컬 `db_info.pkl`의 DB 접속정보로 아래 쿼리를 실행한다. `v_ipms_ip_info`에서 접속 IP와 일치하면서 `STATUS = '승인'`인 행만 선택한 후, `user_info.knox_id = v_ipms_ip_info.SUB_USER_ID` 조건으로 조인한다. 참고: [`scripts/data_loader.py`](https://github.com/mlbarod/defect_spider_for_p3d/blob/4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a/scripts/data_loader.py#L244-L297)

   ```sql
   WITH A AS (
       SELECT IP_ADDR, SUB_USER_ID, USER_NAME
       FROM v_ipms_ip_info
       WHERE IP_ADDR = %s AND STATUS = '승인'
   )
   SELECT ip, knox_id, sdwt, available
   FROM user_info
   JOIN A ON knox_id = SUB_USER_ID
   ```

5. 조회 결과가 없거나 첫 번째 행의 `knox_id`가 비어 있으면 클릭 이력을 저장하지 않고 각각 `승인된 접속자 정보를 찾지 못했습니다`, `접속자 knox_id를 찾지 못했습니다` 오류를 반환한다. 정상 조회 시 `(line_name, select_step, 현재시각, knox_id)`를 `clicked_category_history`와 `clicked_history_defect`에 저장한다. 참고: [`scripts/data_loader.py`](https://github.com/mlbarod/defect_spider_for_p3d/blob/4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a/scripts/data_loader.py#L429-L465), [`scripts/data_loader.py`](https://github.com/mlbarod/defect_spider_for_p3d/blob/4f7ebbcaa83a6f1189fd52798d6c88a6bdcf004a/scripts/data_loader.py#L468-L518)

주의사항:

- 현재 구현에서 `knox_id` 식별은 단순 첫 화면 접속 시점이 아니라 사용자가 STEP을 선택하여 `/api/click-history`가 호출될 때 수행된다.
- `/api/client-ip`는 정규화된 IP만 반환하며 현재 프런트엔드의 `knox_id` 식별 흐름에서는 사용하지 않는다.
- 역방향 프록시 환경에서는 프록시가 `x-forwarded-for` 또는 `x-real-ip`를 신뢰할 수 있는 값으로 덮어쓰도록 구성해야 한다. 애플리케이션에 직접 접근할 수 있는 환경에서 클라이언트가 이 헤더를 임의로 지정하면 다른 IP로 위장할 수 있다.
- 공용 IP, NAT 또는 중복 IP 매핑 환경에서는 IP만으로 사용자를 유일하게 식별할 수 없으므로 운영 DB의 승인 IP 정책과 일대일 매핑 여부를 보장해야 한다.

### L0 Spider 적용

L0 Spider는 위 구조를 `/api/current-user`에 적용한다. 자설비 이상감지 화면 진입 시 이 API를 한 번 호출하며, 성공 응답의 `knoxId`를 우측 상단의 `{knox_id}님 안녕하세요!` 문구에 사용한다. 동일 IP의 성공 응답은 서버에서 5분 동안 캐시하고, 프런트엔드는 화면 세션 동안 재조회하지 않는다.

- Node 처리: `server/currentUser.mjs`
- DB 조회 helper: `scripts/current_user.py`
- 프런트엔드 API: `src/features/fdc-trend/api/currentUserApi.js`
- 화면 표시: `src/features/fdc-trend/pages/FdcTrendPage.jsx`

Python helper가 사용하는 PyMySQL을 설치한다.

```bash
python3 -m pip install -r scripts/requirements.txt
```

DB 접속정보 pickle의 기본 위치는 `/appdata/l0_spider/db_info.pkl`이다. 예외적으로 다른 위치를 사용할 때만 서버 실행 환경에 `DB_INFO_PATH`를 지정한다. `db_info.pkl`은 비밀번호를 포함하므로 Git 추적 대상에서 제외되어 있다.

```bash
node server.mjs
```

## Database References

### 메인 대시보드 데이터

SPIDER 메인 하단의 라인별 이상 현황 대시보드는
`/appdata/abnormal_trend/pic/path` 아래에서 `YYYY-MM-DD hh:mm:ss` 형식의 파일을
조회 기간에 맞춰 읽는다. 최신 항목은 `{latest_date}`로 사용한다.

| 구분 | 경로 | 참조 컬럼 |
| --- | --- | --- |
| 전체 통계 | `/appdata/abnormal_trend/pic/stats/{latest_date}_spider_step_stats.parquets` | `exec_date`, `recipe_id`, `priority`, `ng`, `total` |
| 세부 통계 | `/appdata/abnormal_trend/pic/path/{latest_date}` | `sdwt`, `desc`, `recipe_id`, `priority`, `sensor`, `eqp` |

라인별 이상 1건은 세부 통계의 `sdwt`를 `/appdata/l0_spider/mapping_config.json`의
`line_mapping`과 `sdwt_mapping`으로 라인에 매핑한 뒤, 같은 날짜와 라인 안에서
`desc`, `recipe_id`, `priority`, `sensor`, `eqp` 조합이 같은 행을 중복 제거하여 계산한다.
매핑할 수 없거나 비어 있는 `sdwt` 행은 라인 집계에서 제외한다.

`GET /api/dashboard-data`는 다음 쿼리를 지원한다.

- `startDate`, `endDate`: `YYYY-MM-DD` 형식의 조회 기간. 생략 시 시작일과 종료일 모두 최신 파일 날짜
- `line`: 복수 지정 가능한 라인 필터. 생략 시 조회 기간에 실제 데이터가 있는 전체 라인

하루에 파일이 여러 개 있으면 해당 날짜에서 `hh:mm:ss`가 가장 늦은 파일 1개만 읽고,
전체 최신 날짜도 전역 `{latest_date}` 파일 1개를 사용한다. 서버는 요약 KPI,
라인별 누적/A·B Grade/최신일/전일 비교/비율, 날짜·라인별 추이를 집계해 반환한다.
조회 기간 중 파일이 없는 날짜는 추이에 0건으로 포함한다. 전일 비교는 최신 파일의
`hh:mm:ss`와 정확히 같은 D-1 파일로 계산하며, 해당 파일이 없으면 비교값은 `null`로 반환한다. 기존 최신일
센서/Grade 요약값도 같은 API 응답에 유지한다.

일자별 이상 추이 선그래프는 첫 화면에서 최신일을 종료일로 한 최근 10일을 별도로
지연 조회한다. 차트의 `10일`, `30일`, `90일`, `180일` 버튼으로 기간을 전환할 수 있다.
상단 필터는 실제 데이터에 존재하는 라인의 전체/복수 선택만 제공하며 날짜 입력은 표시하지 않는다.

L0 Spider의 DB 접속정보는 `/appdata/l0_spider/db_info.pkl`에서 읽는다. 아래 이력 테이블의 실제 INSERT/SELECT 기능은 해당 기능 개발 시 명시된 스키마를 기준으로 구현한다.

### `pass_history`

자설비 이상감지의 PASS 이력 데이터를 DB에 저장하거나 기존 데이터를 조회하는 용도로 사용한다.

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

자설비 이상감지의 SKIP 기능은 `/api/pass-history`를 사용한다. GET은 현재 필터의 `line_id`, `sdwt`, `desc`에 해당하는 SKIP 상태를 조회하고, POST는 SKIP을 등록하며, DELETE는 같은 차트 식별값의 SKIP 데이터를 삭제한다. POST/DELETE 시 브라우저는 `lineId`와 `filePath`만 차트 식별정보로 전달하고, 서버가 ERD 경로를 파싱하여 아래 값으로 매핑한다. `knox_id`는 요청 본문을 신뢰하지 않고 접속 IP 기반 현재 사용자 조회 결과를 사용한다.

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

SKIP 상태인 차트는 상단에 `이상감지 SKIP 건` 배지와 하단에 `SKIP해제` 버튼을 표시한다. 해제가 완료되면 해당 차트 식별값의 `pass_history` 데이터를 삭제하고 배지를 제거한다.
자설비 각 Chart의 `SKIP` 버튼 옆에는 `EQP ALL SKIP` 버튼을 표시한다. 어느 Chart에서
누르더라도 현재 EQP의 실제 모든 `ch_step` 경로를 조회하여 각 `ch_step`을 별도의
`pass_history` 행으로 한 번에 저장한다. `step = ALL`인 가상 행은 저장하지 않는다.
공통부 이상감지에는 `EQP ALL SKIP` 버튼을 표시하지 않는다.

공통부 이상감지의 SKIP도 같은 `/api/pass-history`와 팝업 구조를 사용한다. Chart drawing에
사용하는 공통부 `data.parquet` 경로, 선택 EQP와 `prc_group`을 서버로 전달하며,
접속자 `knox_id`는 자설비와 동일하게 서버가 결정한다. 공통부 경로에는 `{ver}`가 없으므로
공통부 SKIP은 하드코딩 값 `NA`를 `ver`에 저장한다.

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

`ver = NA`인 행은 공통부 `SKIP LIST`에서 조회하며 자설비의 `SKIP LIST` 경로 복원
대상에서는 제외한다.

SDWT 필터의 마지막에는 가상 항목인 `SKIP LIST`가 표시된다. 일반 SDWT 조회에서는 SKIP 등록 시각(`exec_date`)부터 72시간 동안 `latest_date`를 제외한 ERD 경로의 모든 식별값(`line_id`, `sdwt`, `desc`, `ver`, `recipe_id`, `priority`, `sensor`, `step`, `eqp`)이 같은 행을 동일 이상건으로 처리한다. 해당 행은 차트 목록뿐 아니라 STEP, `eqp_ch`, `sensor`, `ch_step`의 일반 이상건수 집계에서도 제외한다. 정확히 72시간이 지나면 일반 이상건과 SKIP 상태로부터 해제되고 `SKIP LIST`에서도 제거된다. 이 만료 처리는 조회 결과에서만 제외하는 UI 동작이며 `pass_history` 행은 삭제하지 않는다. 만료된 동일 식별 건을 다시 SKIP하면 기존 DB 행의 `knox_id`, `exec_date`, `comment`를 갱신하여 새로운 72시간 SKIP 기간을 시작한다.

`SKIP LIST`를 선택하면 ERD 원본 목록 대신 선택 Line의 `pass_history`를 조회한다. 이후 Sensor Grade → STEP(`desc`) → `eqp_ch`(`eqp`) → `sensor` → `ch_step`(`step`) 필터와 차트 목록은 모두 해당 테이블의 구분값으로 생성한다. 최종 차트 경로는 다음 규칙으로 복원하며, SKIP 해제 시 목록을 다시 조회하여 해제된 차트를 즉시 제거한다.

```text
/appdata/abnormal_trend/pic/erd/{update_date}/{sdwt}/{desc}/{ver}/{recipe_id}/{priority}/{sensor}/{step}/{eqp}.png
```

### `hit_history`

자설비 이상감지의 HIT 이력 데이터를 DB에 저장하거나 기존 데이터를 조회하는 용도로 사용한다.

| 컬럼 | 타입 |
| --- | --- |
| `update_date` | `TIMESTAMP` |
| `line_id` | `VARCHAR` |
| `sdwt` | `VARCHAR` |
| `file_path` | `VARCHAR` |
| `knox_id` | `VARCHAR` |
| `exec_date` | `TIMESTAMP` |

자설비 이상감지 Chart의 `이력저장` 버튼은 `POST /api/hit-history`를 호출한다.
서버는 Chart drawing에 사용한 ERD 이미지 경로를 파싱하고 아래 규칙으로 저장한다.
`knox_id`는 요청 본문이 아니라 접속 IP 기반 현재 사용자 조회 결과를 사용한다.

| `hit_history` 컬럼 | 이력저장 값 |
| --- | --- |
| `update_date` | Chart 경로의 `{latest_date}` |
| `line_id` | 화면에서 선택한 Line Name |
| `sdwt` | Chart 경로의 `{sdwt}` |
| `file_path` | Chart drawing 원본 파일 경로의 모든 `/`를 `#`으로 치환한 값 |
| `knox_id` | 현재 접속자의 `knox_id` |
| `exec_date` | 이력저장 버튼 클릭 시각 |

예를 들어 `/appdata/abnormal_trend/pic/erd/.../EQP-1.png`는
`#appdata#abnormal_trend#pic#erd#...#EQP-1.png`로 저장한다. 버튼 클릭마다
`hit_history`에 새 행을 INSERT한다.

### `clicked_category_history`

세 이상감지 App에서 마지막 필터를 선택해 Chart Drawing을 시작한 클릭이력을 저장한다.

| 컬럼 | 타입 |
| --- | --- |
| `line_id` | `VARCHAR` |
| `sdwt` | `VARCHAR` |
| `grade` | `VARCHAR` |
| `sensor` | `VARCHAR` |
| `update_date` | `TIMESTAMP` |
| `knox_id` | `VARCHAR` |

`POST /api/clicked-category-history`는 실제 Drawing 결과 경로를 서버에서 파싱하고 접속
IP로 현재 사용자를 확인한 후 한 행을 INSERT한다. 자설비는 `ch_step`, 동일성은
`ch_step`, 공통부는 마지막 필터인 `sensor`를 새로 선택할 때 호출한다. 필터를 다시
클릭해 선택 해제하거나 SKIP LIST를 조회하는 동작은 저장하지 않는다.

| App | `line_id` | `sdwt` | `grade` | `sensor` | `update_date` |
| --- | --- | --- | --- | --- | --- |
| 자설비 | 선택 Line Name | ERD Drawing 경로 | 선택 grade를 확장한 리스트 문자열. `A/B`는 `['A', 'B']` | ERD Drawing 경로 | `ch_step` 클릭 시각 |
| 동일성 | 선택 Line Name + `(g)` | `img.png` Drawing 경로 | `img.png` Drawing 경로 | `{sensor}_{ch_step}` 경로 | `ch_step` 클릭 시각 |
| 공통부 | 선택 Line Name + `(c)` | `data.parquet` Drawing 경로 | `data.parquet` Drawing 경로 | `data.parquet` Drawing 경로 | `sensor` 클릭 시각 |

한 번의 Drawing 결과에 여러 grade 또는 sensor가 포함되면 중복을 제거한 리스트 문자열로
저장한다. 동일성 App의 STEP(`step_desc`) 선택값은 저장하지 않으며, 업로드 요청은
Drawing 결과를 `sdwt`, `grade`, `sensor` 기준 대표 경로로 압축해 기존 컬럼 구조를
유지한다. 단, 동일성 App에서 Sensor의 `ALL`을 선택한 클릭이력은 여러 센서명을 긴
리스트로 확장하지 않고 `sensor` 컬럼에 `ALL`을 저장한다. DB 응답의 `affectedRows`가
0이면 저장 성공으로 처리하지 않고 화면에 오류를 표시한다. `knox_id`는 모든 App에서
접속 IP 기반 현재 사용자 값을 사용한다.

현재 확인된 정보에는 `VARCHAR` 길이, 기본키, 인덱스, NULL 허용 여부와 기본값이 포함되어 있지 않으므로 각 표에서는 별도로 가정하지 않는다.

## Self-equipment UI Versions

- 최초버전: `src/features/fdc-trend/pages/versions/FdcTrendPage.initial.jsx.bak`
- 개선버전(현재 사용): `src/features/fdc-trend/pages/FdcTrendPage.jsx`

My EQP 딥링크는 STEP 이름을 URL에 노출하지 않고 항상 `step=ALL`을 사용한다.
`sdwt=MY_EQP` URL에 `step`이 없거나 다른 값이 전달되어도 화면에서는 `ALL`로
해석하며, `eqpCh`가 있으면 전체 STEP 범위에서 해당 EQP를 선택한다.

원복 절차는 `src/features/fdc-trend/pages/versions/README.md`를 참조한다.

## Data References

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
| 이상감지 이력 이미지 | `#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png` | `/appdata/abnormal_trend/pic/backup/#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png` | 해당 없음 (이미지 파일) |
| `latest_date` 결정 및 대시보드 세부 파일 | `{latest_date}` | `/appdata/abnormal_trend/pic/path/{latest_date}` | `sdwt`, `desc`, `recipe_id`, `priority`, `sensor`, `eqp` |
| 분임조별 ERD 이상감지 경로 데이터 | `df_path.parquet` | `/appdata/abnormal_trend/pic/path/{line}/{sdwt}/df_path.parquet` | `sdwt`, `desc`, `ver`, `recipe_id`, `priority`, `sensor`, `step`, `eqp`, `file_path`, `line_rev` |
| 공통부 이상감지 경로 테이블 | `df_path.parquet` | `/appdata/abnormal_trend/pic/path_common/{line}/{sdwt}/df_path.parquet` | `file_path`, `sdwt`, `prc_group`, `date`, `priority`, `sensor`, `step`, `eqp`, `line_rev` |
| 공통부 이상감지 데이터 | `data.parquet` | `/appdata/abnormal_trend/pic/common/{latest_date}/{sdwt}/{step_desc}/{grade}/{sensor}/{ch_step}/data.parquet` | `eqp_id`, `disp_name`, `lotid`, `wafer_id`, `act_time` (x축), `{sensor}_{ch_step}` (y축), `eqp_cb` (차트별 EQP 필터) |
| 공통부 이상감지 이미지 | `{eqp_cb}.png` | `/appdata/abnormal_trend/pic/common/{latest_date}/{sdwt}/{step_desc}/{grade}/{sensor}/{ch_step}/{eqp_cb}.png` | 해당 없음 (메인 카드 이미지 출력) |
| 기준정보 매핑 | `mapping_config.json` | `/appdata/l0_spider/mapping_config.json` | `root.line_mapping` (`key`: SDWT 식별자, `value`: 라인), `root.sdwt_mapping` (`key`: SDWT 식별자, `value`: 표시명, key가 없으면 원본 SDWT 사용) |

새 데이터 파일이나 참조 컬럼/키가 추가되면 이 표와
`src/config/spiderDataPaths.mjs`를 함께 업데이트한다.

### 공통부 이상감지 App

`/common-anomaly`은 공통부 이상감지 경로 테이블을 기준으로 `Line Name` → `SDWT` →
`prc_group` → `eqp` → `sensor` 순서의 필터를 제공한다. `Line Name`은 테이블의
`line_rev`와 비교하고 나머지 필터는 같은 이름의 컬럼과 비교한다. `eqp` 필터에는
선택한 `prc_group`의 전체 설비를 조회하는 `ALL` 항목이 포함된다.

최종 필터 결과의 각 `file_path`는 아래 순서로 공통부 `data.parquet` 경로로 변환한다.

1. 경로 문자열의 `pic_server2`를 `pic`로 변경한다.
2. 경로의 마지막 `.png` 파일명을 `data.parquet`으로 변경한다.

예를 들어 아래 경로는 같은 디렉터리의 공통부 parquet 파일로 변환된다.

```text
/appdata/abnormal_trend/pic_server2/common/2026-07-17/SDWT-1/ETCH/A/TEMP/10/EQP-1.png
→ /appdata/abnormal_trend/pic/common/2026-07-17/SDWT-1/ETCH/A/TEMP/10/data.parquet
```

메인 카드에는 위 `data.parquet` 파일명을 선택 EQP의 `{eqp_cb}.png`로 바꾼 이미지를
출력한다. 이미지 카드는 데스크톱 기준 2열로 표시하며 이미지 로드에 실패하면 카드에
최종 이미지 절대경로를 표시한다.

`동일성 차트`는 `data.parquet`의 `act_time`과 `{sensor}_{ch_step}`을 사용하여 같은
파일의 전체 `eqp_cb`를 자설비와 같은 UI로 비교하고,
선택 EQP를 강조한다. `SKIP`은 자설비와 같은 팝업·등록·해제 UI를 사용한다.
SDWT 필터 마지막의 `SKIP LIST`를 선택하면 선택 Line에서 `ver = NA`인
`pass_history` 행을 `prc_group`(`recipe_id`) → `eqp` → `sensor` 순서로 조회하고,
저장된 값으로 `data.parquet` 및 `{eqp}.png` 경로를 복원한다. SKIP 해제 후에는 해당
이미지가 목록에서 즉시 제거된다.

일반 SDWT 조회에서는 공통부 SKIP 등록 시각(`exec_date`)부터 72시간 동안
`line_id`, `sdwt`, `desc`, `priority`, `sensor`, `step`(`ch_step`), `eqp`의 7개 값이
모두 같은 행을 동일 이상감지 건으로 판단한다. 이 비교에는 `ver`, `recipe_id`,
`update_date`를 사용하지 않으며, 동일 건은 이미지 목록과 각 필터 건수에서 제외된다.
정확히 72시간이 지나면 일반 이상감지 대상에 다시 포함되고 공통부 `SKIP LIST`에서도
제거된다. 만료된 `pass_history` 행은 DB에서 삭제하지 않으며 UI 조회에서만 제외한다.
`이력저장`은 공통부용 기능이 별도로 정의될 때까지 비활성화한다.

- 필터·경로 목록 API: `GET /api/common-anomaly-data`
- SKIP LIST API: `GET /api/pass-history?view=common-filters`
- 이미지 API: `GET /api/common-anomaly-image`
- 동일성 데이터 API: `GET /api/common-anomaly-scatter-data?mode=identity`
- 서버 데이터 모듈: `server/commonAnomalyData.mjs`
- 화면: `src/features/fdc-trend/pages/CommonAnomalyPage.jsx`

### 동일성 최신날짜

`/appdata/abnormal_trend/pic/erd_commonality` 바로 아래의 디렉터리 중 폴더명이
유효한 `YYYY-MM-DD hh:mm:ss` 형식인 항목만 대상으로 하며, 폴더명 날짜와 시간이 가장 큰 디렉터리를
`동일성 최신날짜`로 사용한다. 파일, 임시 폴더, 잘못된 날짜명과 하위 단계 디렉터리는
검색 대상에서 제외한다.

공용 함수 `getLatestCommonalityPath`는 다음 구조를 반환하며
`GET /api/latest-commonality-path`에서도 같은 구조를 제공한다.

```json
{
  "name": "동일성 최신날짜",
  "path": "/appdata/abnormal_trend/pic/erd_commonality/2026-07-16 12:45:30",
  "date": "2026-07-16 12:45:30"
}
```

날짜 형식의 디렉터리가 없으면 API는 `404`와 명확한 오류 메시지를 반환한다.
운영 경로를 예외적으로 변경해야 할 때만 서버 환경변수 `COMMONALITY_ROOT_PATH`를 사용한다.

### 동일성 이상감지 App

`/matching-anomaly`은 실제 동일성 기준 이상감지 그래프 파일을 사용한다. Line Name과
SDWT는 자설비 이상감지와 동일하게 `mapping_config.json`의 `line_mapping`,
`sdwt_mapping`을 사용한다. 필터 순서는 Line Name → SDWT → STEP(`step_desc`) →
Sensor → `ch_step`이다. STEP 목록은 선택 SDWT 아래의 모든 `grade`와 `step_seq`를
ALL 조건으로 합친 뒤 `step_desc` 고유값으로 생성한다. 선택한 SDWT에 대해 아래 경로의
`grade`부터 두 번째 `ppid`까지 모든 직하위 디렉터리를 순회하고,
`{sensor}_{ch_step}` 폴더의 마지막 밑줄을 기준으로 Sensor와 ch_step 필터 값을 생성한다.

서버 탐색은 각 폴더를 순차 처리하거나 전체 트리를 `rglob` 방식으로 무조건 탐색하지
않는다. 경로 깊이가 고정된 점을 이용해 필요한 단계의 디렉터리만 최대 64개씩 제한
병렬 조회한다. `{sensor}_{ch_step}` 폴더에 도달하면 규칙에 따라 `img.png` 경로를
즉시 생성하며, 필터 단계에서 각 이미지 파일에 별도의 `stat`/`readdir`을 하지 않는다.
실제 파일 확인은 화면의 이미지 요청 시 수행하고, 파일이 없으면 카드에 절대경로를
표시한다. 동일 SDWT의 동시 요청은 하나의 탐색 Promise를 공유하며, 탐색 결과는 5분간
캐시한다. 최신날짜 폴더가 변경되면 경로가 캐시 키에 포함되므로 새 폴더를 자동으로
다시 탐색한다.

```text
{동일성 최신날짜}/{sdwt}/{grade}/{step_seq}/{step_desc}/{ppid}/{ppid}/{sensor}_{ch_step}/img.png
```

두 번째 `{ppid}` 폴더명이 첫 번째 `{ppid}`와 같은 경로의 `img.png`만 표시 대상으로
사용한다. Sensor의 `ALL`을 선택하면 ch_step에는 `ALL`만 표시하며, 이를 선택하면
Line Name, SDWT와 STEP까지 선택한 범위에 속한 모든 Sensor와 ch_step 이미지를 조회한다.
개별 Sensor를 선택한 경우에는 해당 Sensor의 ch_step과 `ALL`을 제공한다. 최종 필터
결과는 `{step_desc}`별로 분류하여 데스크톱 기준 3열 이미지 카드로 표시한다.
이미지는 한 페이지당 최대 18장만 렌더링하고 이미지 영역 상단의 숫자 탭으로 페이지를
전환한다. 이미지 로드에 실패하면 해당 카드에 요청한 절대 파일 경로를 표시한다.

- 필터·이미지 목록 API: `GET /api/commonality-data`
- 이미지 제공 API: `GET /api/commonality-image?path=...`
- 서버 탐색 모듈: `server/commonalityData.mjs`
- 화면: `src/features/fdc-trend/pages/CommonalityAnomalyPage.jsx`

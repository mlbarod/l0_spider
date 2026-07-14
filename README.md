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

## Self-equipment UI Versions

- 최초버전: `src/features/fdc-trend/pages/versions/FdcTrendPage.initial.jsx.bak`
- 개선버전(현재 사용): `src/features/fdc-trend/pages/FdcTrendPage.jsx`

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
| Step 통계 | `{latest_date}_spider_step_stats.parquets` | `/appdata/abnormal_trend/pic/stats/{latest_date}_spider_step_stats.parquets` | 미정 (추후 지정) |
| V 제외 Step 통계 | `{latest_date}_spider_step_stats_except_v.parquets` | `/appdata/abnormal_trend/pic/stats/{latest_date}_spider_step_stats_except_v.parquets` | 미정 (추후 지정) |
| 이상감지 이력 이미지 | `#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png` | `/appdata/abnormal_trend/pic/backup/#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png` | 해당 없음 (이미지 파일) |
| `latest_date` 결정 파일 | `{latest_date}` | `/appdata/abnormal_trend/pic/path/{latest_date}` | 해당 없음 (파일명 참조) |
| 분임조별 ERD 이상감지 경로 데이터 | `df_path.parquet` | `/appdata/abnormal_trend/pic/path/{line}/{sdwt}/df_path.parquet` | `sdwt`, `desc`, `ver`, `recipe_id`, `priority`, `sensor`, `step`, `eqp`, `file_path`, `line_rev` |
| 기준정보 매핑 | `mapping_config.json` | `/appdata/l0_spider/mapping_config.json` | `root.line_mapping` (`key`: SDWT 식별자, `value`: 라인), `root.sdwt_mapping` (`key`: SDWT 식별자, `value`: 표시명, key가 없으면 원본 SDWT 사용) |

새 데이터 파일이나 참조 컬럼/키가 추가되면 이 표와
`src/config/spiderDataPaths.mjs`를 함께 업데이트한다.

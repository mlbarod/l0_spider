# l0_spider

Standalone React/Vite app for `l0_spider`, based on the `fdc_trend` UI from `mlbarod/template2`.

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

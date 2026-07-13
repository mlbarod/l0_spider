# l0_spider

Standalone React/Vite app for `l0_spider`, based on the `fdc_trend` UI from `mlbarod/template2`.

## Run

```bash
npm install
npm run dev
```

The app opens directly at `/`.

## Production Server

```bash
PORT=5173 node server.mjs
```

Set `BUILD_ON_START=0` to serve the existing `dist` directory without rebuilding.

## Data References

`latest_date`는 `/appdata/abnormal_trend/pic/path`에 있는 파일명 중
`yyyy-mm-dd hh:mm:ss` 형식과 일치하는 가장 최신 파일명으로 결정한다.

| 구분 | 참조 파일 | 경로 | 참조 컬럼/키 |
| --- | --- | --- | --- |
| ERD 이상감지 데이터 | `data.parquet` | `/appdata/abnormal_trend/pic/erd/{latest_date}/{sdwt}/{step_desc}/{ver}/{ppid}/{grade}/{sensor}/{ch_step}/data.parquet` | 미정 (추후 지정) |
| Step 통계 | `{latest_date}_spider_step_stats.parquets` | `/appdata/abnormal_trend/pic/stats/{latest_date}_spider_step_stats.parquets` | 미정 (추후 지정) |
| V 제외 Step 통계 | `{latest_date}_spider_step_stats_except_v.parquets` | `/appdata/abnormal_trend/pic/stats/{latest_date}_spider_step_stats_except_v.parquets` | 미정 (추후 지정) |
| 이상감지 이력 이미지 | `#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png` | `/appdata/abnormal_trend/pic/backup/#appdata#abnormal_trend#pic#erd#{latest_date}#{sdwt}#{step_desc}#{ver}#{ppid}#{grade}#{sensor}#{ch_step}#{eqp}.png` | 해당 없음 (이미지 파일) |
| `latest_date` 결정 파일 | `{latest_date}` | `/appdata/abnormal_trend/pic/path/{latest_date}` | 해당 없음 (파일명 참조) |
| 분임조별 ERD 이상감지 경로 데이터 | `df_path.parquet` | `/appdata/abnormal_trend/pic/path/{line}/{sdwt}/df_path.parquet` | 미정 (추후 지정) |
| 기준정보 매핑 | `mapping_config.json` | `/appdata/l0_spider/mapping_config.json` | `root.line_mapping` (`key`: SDWT 식별자, `value`: 라인), `root.sdwt_mapping` (`key`: SDWT 식별자, `value`: 표시명, key가 없으면 원본 SDWT 사용) |

새 데이터 파일이나 참조 컬럼/키가 추가되면 이 표와
`src/config/spiderDataPaths.mjs`를 함께 업데이트한다.

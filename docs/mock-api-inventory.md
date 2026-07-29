# Frontend API inventory

Only URL paths are recorded. Host values are intentionally excluded. `?` marks optional input and `[]` marks repeated query parameters.

## Endpoint matrix

| Screen/use | Source | Method and path | Query / request body | Frontend-used response contract | Empty / error | React Query key | Paging/filter/sort | Mock / contract |
|---|---|---|---|---|---|---|---|---|
| Main dashboard | `api/dashboardApi.js`, `LineAnomalyDashboard.jsx`, `L0SpiderHomePage.jsx` | `GET /api/dashboard-data` | query: `startDate?`, `endDate?`, `line[]?` | `lineDashboard.{filters,options,summary,lineSummary[],dailyTrend[],mailingSummary[],meta}` plus root metrics/detail metadata | valid arrays and zero totals; non-2xx `{ok:false,error,code}` | `spider-line-dashboard`, filters; trend key with preset range | client line filter; server date/line filtering; no paging | yes / yes |
| Current user | `api/currentUserApi.js`; anomaly and registration pages | `GET /api/current-user` | none | `{ok:boolean,knoxId:string|null,source:string}` | optional identifier may be null; JSON error | `current-user` | none | yes / yes |
| Hit audit | `api/hitHistoryApi.js` | `POST /api/hit-history` | body `{lineId,filePath,execDate}` | `{ok:true,affectedRows:number}` | JSON error | mutation, no query key | none | yes / yes |
| Category-click audit | `api/clickedCategoryHistoryApi.js` | `POST /api/clicked-category-history` | body `{app,lineId,filePaths[],grades?,selectedSensor?,virtualCategory?,clickedAt}` | `{ok:true,affectedRows:number}` | affected rows below one is treated as error | mutation, no query key | none | yes / yes |
| Latest commonality date | `api/latestCommonalityPathApi.js` | `GET /api/latest-commonality-path` | none | `{name:string,path:string,date:string}` | empty date allowed; JSON error | caller-managed | none | yes / yes |
| Matching anomaly filters/images | `api/commonalityApi.js`, `CommonalityAnomalyPage.jsx` | `GET /api/commonality-data` | `line`, `pathSdwt`, `sdwt`, `stepDesc?`, `sensor?`, `chStep?` | `{latest,filters,stepDescs[],sensors[],chSteps[],counts,rows[]}` | arrays empty; JSON error | `commonality-data` plus all filters | progressive filter selection; client image paging | yes / yes |
| Matching image | `api/commonalityApi.js` | `GET /api/commonality-image` | `path` | image bytes/content type | 4xx/5xx image request failure | browser resource URL | none | yes / yes |
| Common anomaly filters/images | `api/commonAnomalyApi.js`, `CommonAnomalyPage.jsx` | `GET /api/common-anomaly-data` | `line`, `pathSdwt`, `sdwt`, `prcGroup?`, `eqp?`, `sensor?` | `{filters,counts,prcGroups[],eqps[],sensors[],rows[]}` | arrays empty; JSON error | `common-anomaly-data` plus filters | progressive filters; no server paging | yes / yes |
| Common chart | `api/commonAnomalyApi.js` | `GET /api/common-anomaly-scatter-data` | `path`, `eqp`, `sensor`, `chStep`, `mode?` | scatter `points[]` or identity `groups[].points[]`, plus axis/source/count metadata | empty points/groups; JSON error | common anomaly identity/scatter keys including row path/equipment/sensor/step | chronological point order in normal data | yes / yes |
| Common image | `api/commonAnomalyApi.js` | `GET /api/common-anomaly-image` | `path` | image bytes/content type | image request status | browser resource URL | none | yes / yes |
| Pass history/list | `api/passHistoryApi.js`, `api/commonAnomalyApi.js` | `GET /api/pass-history` | `lineId`, `activeOnly?`, `sdwt?`, `desc?`, or `view`, repeated `priority`, filter values | ordinary `{ok,records[]}`; filter view uses equipment filter payload; common view uses common filter payload | empty arrays; JSON error | `pass-history`, `skip-list-data`, `common-anomaly-skip-list` | active/filter query; no paging | yes / yes |
| Pass create | `api/passHistoryApi.js` | `POST /api/pass-history` | single `{lineId,filePath,eqp,prcGroup,comment,execDate}` or batch `{records[],comment,execDate}` | `{ok:true,affectedRows:number}` | JSON error | mutation; invalidates related keys | batch capped by service, Mock only acknowledges | yes / yes |
| Pass delete | `api/passHistoryApi.js` | `DELETE /api/pass-history` | `{lineId,filePath,eqp,prcGroup}` | `{ok:true,affectedRows:number}` | JSON error | mutation; invalidates related keys | none | yes / yes |
| Mapping | `api/mappingConfigApi.js`; filter pages | `GET /api/mapping-config` | none | `{line_mapping:Record<string,string>,sdwt_mapping:Record<string,string>,source_path:string}` | malformed dictionaries rejected by client | `l0-spider-line-mapping` | client derives line/team options | yes / yes |
| My EQP reference | `api/myEqpReferenceApi.js`, registration page | `GET /api/my-eqp-reference` | none | `{ok:true,rows[]}`; client uses row `main,label,prc_group,eqp,disp_name` | rows must be array | `my-eqp-reference` | client filtering | yes / yes |
| My EQP registration list | `api/myEqpRegistrationApi.js` | `GET /api/my-eqp-registration` | `line`, `activeOnly?` | `{ok,registrations[]}`; registration uses `id,line,sdwt,prcGroup,eqps[],execDate,periode,comment,knoxId,isPublic,expiresAt,active,ownedByCurrentUser` | empty list; JSON error | `my-eqp-registrations`, line, active flag | server filter; no paging | yes / yes |
| My EQP create | `api/myEqpRegistrationApi.js` | `POST /api/my-eqp-registration` | `{line,sdwt,prcGroup,eqps[],periode,comment,isPublic,knoxIds[]}` | `{ok:true,affectedRows:number,knoxId:string}` | JSON error; debug fields not generated by Mock | mutation | none | yes / yes |
| My EQP delete | `api/myEqpRegistrationApi.js` | `DELETE /api/my-eqp-registration` | registration object | `{ok:true,affectedRows:number}` | JSON error | mutation | none | yes / yes |
| Mailing list | `api/mailingRegistrationApi.js` | `GET /api/mailing-registration` | `knoxId` | `{registrations[]}`; rows use `id,knoxId,sdwts[],priorities[]` | empty list; JSON error | `mailing-registrations`, user identifier | client grouping | yes / yes |
| Mailing create | `api/mailingRegistrationApi.js` | `POST /api/mailing-registration` | `{knoxId,knoxIds[],sdwts[]}` | `{ok:true,affectedRows:number}` | JSON error | mutation | none | yes / yes |
| Mailing delete | `api/mailingRegistrationApi.js` | `DELETE /api/mailing-registration` | `{knoxId,line,sdwts[]}` | `{ok:true,affectedRows:number}` | JSON error | mutation | none | yes / yes |
| Self-equipment filters/results | `api/selfEquipmentApi.js`, `FdcTrendPage.jsx` | `GET /api/self-equipment-data` | `line`, `pathSdwt`, `sdwt`, `priority[]`, `desc?`, `eqpCh?`, `sensor?`, `chStep?` | `{filters,counts,availablePriorities[],steps[],eqpChannels[],sensors[],chSteps[],rows[]}` | empty options/rows; JSON error | `self-equipment-data` plus all filters | progressive filters; no paging | yes / yes |
| My EQP results | `api/selfEquipmentApi.js`, `FdcTrendPage.jsx` | `GET /api/my-eqp-equipment-data` | `line`, `priority[]`, `desc?`, `eqpCh?`, `sensor?`, `chStep?` | same filter payload plus registration match counts | empty options/rows; JSON error | `my-eqp-equipment-data` plus filters | progressive filters | yes / yes |
| Equipment chart | `api/selfEquipmentApi.js`, `FdcTrendPage.jsx` | `GET /api/erd-scatter-data` | `path`, `eqp`, `sensor?`, `chStep?`, `mode?`, `days?` | scatter `points[]`/`changeHistory[]`; identity `groups[].points[]`, source/count/window metadata | empty chart arrays; JSON error | `erd-scatter-data`, `erd-identity-data` plus row/filter fields | chronological normal data; window days | yes / yes |
| Equipment image/file | `api/selfEquipmentApi.js` | `GET /api/erd-file` | `path` | image bytes/content type | image request status | browser resource URL | none | yes / yes |

## Shared field structures

Filter rows use:

```text
id:string
sdwt:string
desc:string
ver:string|null
recipe_id:string
priority:string
sensor:string
step:string
eqp:string
file_path:string
line_rev:string
pass_history?:object
```

Chart points use:

```text
actTime:string
actTimeMs:number
value:number|string
eqpId:string
dispName:string
waferId:string
rootLotId:string
lotId?:string
isRecent?:boolean
```

Normal scenario values are numeric and date-valid. Only `edge-values` uses string representations such as `"NaN"` or `"Infinity"` because JSON cannot carry non-finite numbers. `partial` removes only optional fields.

## Error and control behavior

All JSON errors are `{ok:false,error:string,code:string}` with the configured HTTP status. Unknown paths return 404; unsupported methods return 405 and `Allow`; missing required query values return 400. Mock control paths are not part of the service API and exist only in the independent Mock server.

No endpoint uses server pagination today. The matching page performs client-side image paging. Sorting is produced by the server contract where the UI assumes ordered dates; `edge-values` deliberately breaks time ordering.

## Non-HTTP local data

`fdcTrendApi.js` and `fdcTrendMockData.js` provide in-memory data to feature-preview pages and do not call HTTP. Mock mode resolves both imports to `mock/fixtures/local` and sanitizes the preview page's existing defaults. These are deliberately excluded from the endpoint count but included in the security and build verification.

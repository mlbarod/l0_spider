# ADR-002: Parquet·이미지 기반 분석 결과 저장 및 조회

## 상태

`Accepted — As-Is Baseline`

현재 `main`에서 Dashboard, Self Equipment, 동일성 및 공통부 분석 결과를 Parquet·PNG·디렉터리 구조로 조회하는 구현이 확인된다.
이 상태는 과거 대안 평가나 영구적 기술 선택을 증명하지 않으며, 호환성을 보존하기 위한 현재 기준선 승인이다.

## 결정 날짜

2026-07-31

## 적용 범위

- Dashboard detail·stats Parquet와 mapping JSON
- Self/MY EQP의 team `df_path.parquet`, ERD `data.parquet`, history Parquet와 image
- 동일성 `erd_commonality` directory·`img.png`
- 공통부 `path_common` Parquet, common `data.parquet`·PNG
- 파일 path를 전달하는 API와 이를 소비하는 React 화면
- 사용자·등록·이력 DB와 분석 파일 저장소의 책임 구분

## 관련 문서

- `docs/features/abnormal-data.md`
- `docs/system/architecture.md`, `docs/system/data-flow.md`
- `docs/system/environment-definition.md`, `docs/system/security.md`
- `docs/features/dashboard.md`, `docs/features/self-equipment.md`

## 1. 컨텍스트

L0 Spider는 분석 결과를 자체 DB로 적재하지 않고 Node server에서 운영 파일 저장소의 Parquet를 직접 읽고 PNG를 stream한다.
Dashboard는 날짜·시각 filename을 나열해 detail과 stats를 선택한다.
Self와 공통부는 index Parquet의 `file_path`에서 sibling `data.parquet`·image·history path를 파생한다.
동일성은 최신 유효 시각 directory 아래의 계층을 index로 변환한다.

업무 DB는 사용자 식별, Mailing·MY EQP 등록, PASS·hit·click 이력을 저장한다.
분석 point, Dashboard 집계 원천과 분석 이미지는 확인된 DB table이 아니라 파일 원천에 있다.
운영 파일 생성 주체·주기·Schema version·publish 계약은 저장소에서 확인되지 않았다.

## 2. 문제 정의

- 현재 화면·API가 경로 구조와 Parquet column에 직접 의존하므로 As-Is 계약을 명시해야 한다.
- 파일 원천과 DB 역할이 섞여 보이면 변경 책임과 복구 범위를 잘못 판단할 수 있다.
- upstream 생성과 L0 Spider 조회 사이의 Schema·freshness·완료 신호가 문서화돼 있지 않다.
- root·segment·column 변경은 여러 화면, handler, 이력 path와 cache를 동시에 깨뜨릴 수 있다.
- 대안 검토·migration 기록이 없으므로 현재 구현과 향후 선택지를 구분해야 한다.

## 3. 결정 동인

| 동인 | 현재 근거 | 중요성 |
|---|---|---|
| 운영 호환성 | 기존 API와 화면이 absolute path·column에 의존 | 높음 |
| upstream 결과 재사용 | Parquet·PNG가 준비된 분석 결과 원천으로 참조됨 | 높음 |
| 대용량 column 조회 | `hyparquet`가 필요한 column projection을 사용 | 높음 |
| 이미지 제공 | Node가 검증된 path의 PNG를 직접 stream | 높음 |
| DB 책임 분리 | DB는 사용자·등록·이력 중심 | 높음 |
| migration 비용 | path·Schema 변경이 producer와 모든 consumer에 영향 | 높음 |
| 운영 안전 | `/appdata` runtime write를 도입하지 않는 현재 경계 | 높음 |
| freshness·복구 | 생성·보존·backup 계약 미확인 | 확인 필요 |

## 4. 결정

현재 Core Harness의 기준선으로 다음을 유지한다.

1. 분석 결과 원천은 현재 path contract의 Parquet·PNG·directory 구조로 취급한다.
2. L0 Spider는 scoped runtime에서 분석 파일을 읽기·검증·집계·변환·stream하며 파일을 생성하거나 덮어쓰지 않는다.
3. DB는 사용자·등록·이력과 기준 조회를 담당하고 분석 파일 전체를 DB로 복제하지 않는다.
4. index Parquet와 결과 file의 연결, sibling path와 directory segment는 호환 계약으로 관리한다.
5. path·column·latest 선택 변경은 upstream producer와 화면·API consumer의 동시 migration 없이 수행하지 않는다.
6. 실제 운영 파일, DB 또는 mock 자산을 Core test fixture로 사용하지 않는다.
7. 향후 다른 저장 방식을 도입하려면 아래 재검토 조건과 migration 기준을 충족한다.

이 결정은 현재 구조를 최적이라고 증명하지 않는다.
구현 사실과 기존 동작 보존을 기준으로 한 `As-Is Baseline`이다.

## 5. 현재 저장 범위

| 결과 종류 | 저장 형태 | L0 Spider 소비 | 상태 |
|---|---|---|---|
| Dashboard detail | 시각명을 가진 Parquet file | 날짜별 latest·기간 집계 | `Confirmed` |
| Dashboard stats | `*_spider_step_stats.parquets` | monitoring sensor·summary | `Confirmed` |
| Self path index | `df_path.parquet` | filter option과 result path | `Confirmed` |
| ERD point | sibling `data.parquet` | scatter·identity chart | `Confirmed` |
| ERD 변경이력 | sibling `{eqp}.parquet` | 변경점 목록 | `Confirmed` |
| 동일성 결과 | directory metadata + `img.png` | filter index·image card | `Confirmed` |
| 공통부 path index | `path_common/.../df_path.parquet` | PRC Group·EQP·sensor option | `Confirmed` |
| 공통부 point | common `data.parquet` | scatter·identity chart | `Confirmed` |
| 공통부 결과 image | `{eqp_cb}.png` | image card | `Confirmed` |
| mapping | JSON | path key와 display·Line 변환 | `Confirmed` |

확인된 projection은 기능 문서에 기록하지만 전체 파일 Schema·타입·nullable·version은 `Unknown`이다.

## 6. DB와 파일의 역할 구분

| 책임 | 파일 저장소 | DB |
|---|---|---|
| 분석 point·stats | 주 원천 | 확인된 저장 없음 |
| 분석 image | 주 원천 | 확인된 저장 없음 |
| filter index | Parquet·directory | 일부 등록·기준정보 보조 |
| 사용자 식별 | 해당 없음 | 조회 |
| MY EQP·Mailing 등록 | 해당 없음 | 조회·등록·삭제 |
| PASS·hit·click 이력 | path identity를 입력으로 사용 | 조회·등록·삭제 |
| L0 Spider runtime 쓰기 | 분석 파일 write 미확인 | 업무 기능 write 확인 |

DB 이력은 분석 파일을 대체하지 않는다. 반대로 파일 결과만으로 사용자별 등록·SKIP 상태를 재구성할 수 있다고 판단하지 않는다.

## 7. 현재 경로 기반 조회를 유지하는 이유

다음은 과거 의사결정 기록이 아니라 현재 기준선 유지 판단이다.

- Dashboard, index, point와 image producer-consumer 연결이 이미 path와 filename으로 구현돼 있다.
- `file_path`는 filter row, scatter, image, history와 DB 이력 사이의 공통 identity 역할을 한다.
- Parquet column projection으로 필요한 field만 읽는 구현이 존재한다.
- image는 변환 없이 stream할 수 있고 directory 구조는 동일성 metadata index로 사용된다.
- 저장 방식 교체는 단일 모듈 변경이 아니라 upstream producer, API, browser, 이력 parser와 운영 배포를 함께 바꿔야 한다.
- 현재 요구는 기존 시스템 위에 검증 계층을 추가하는 것이며 저장소 교체가 아니다.

처리량, 비용, 장애복구 관점에서 현재 방식이 다른 대안보다 우월하다는 측정 근거는 없다.

## 8. 장점과 현재 효과

- 분석 결과를 별도 DB ingestion 없이 직접 소비한다.
- Parquet의 column projection과 압축 reader를 사용할 수 있다.
- PNG 결과를 원본 형식으로 제공한다.
- 날짜·Line·SDWT 등 domain segment가 경로에서 식별 가능하다.
- index Parquet가 상세 file 위치를 전달해 전체 ERD root 순회를 피한다.
- mtime·size 기반 bounded cache로 반복 file read를 일부 줄인다.
- 분석 파일과 사용자 상태 DB의 장애·변경 책임을 논리적으로 분리할 수 있다.

## 9. 제약과 부정적 결과

- absolute path가 API payload와 query에 전달되어 mount·root 변경 영향이 browser까지 확산된다.
- path segment가 사실상 Schema이므로 directory 이름 변경도 호환성 변경이다.
- 전체 Parquet Schema와 version 협약이 없어 upstream drift가 request-time에 발견될 수 있다.
- index와 sibling data/image의 publish 시점이 다르면 부분 결과가 발생한다.
- file 없음·권한·mount 장애가 해당 기능의 API 오류로 직접 나타난다.
- 여러 cache가 mtime·size 또는 TTL에 의존해 freshness 기준을 운영 filesystem과 공유한다.
- 동일성은 directory traversal 비용과 5분 index TTL을 가진다.
- file path·오류 detail이 response·log에서 운영 구조를 노출할 수 있다.
- local filesystem API와 `asyncBufferFromFile` 사용으로 object storage를 투명하게 대체할 수 없다.
- backup, retention, quota, cleanup과 disaster recovery 책임이 확인되지 않았다.

## 10. 최신성과 cache 결정

- Dashboard latest는 유효한 `YYYY-MM-DD hh:mm:ss` filename의 정렬로 결정한다.
- 기간 조회는 날짜별 마지막 detail file을 선택하고 stats는 최종 detail 시각을 사용한다.
- 동일성은 root 바로 아래 유효한 시각 directory 중 마지막 값을 선택한다.
- Self·공통부는 index row가 가리키는 path를 사용하며 별도 global latest 탐색을 하지 않는다.
- server Parquet cache는 대부분 mtime·size를 비교하고 bounded entry 수를 사용한다.
- 동일성 directory index cache는 5분 TTL을 사용한다.
- HTTP image cache와 React Query stale 정책은 endpoint·화면마다 다르다.

업무 timezone, 허용 데이터 지연, latest file 완료 확인과 stale 허용 시간은 후속 결정이 필요하다.

## 11. 파일 누락과 장애 영향

| 장애 | 현재 영향 | 복구·fallback 상태 |
|---|---|---|
| Dashboard root·detail 없음 | Dashboard `404` 또는 `500` | 이전 정상 snapshot fallback 없음 |
| stats 없음 | Dashboard `500` | stats 없는 부분 응답 없음 |
| team/common index 없음 | 해당 filter API `500` | 다른 SDWT는 별도 요청 가능 |
| ERD/common point 없음 | chart API `500` | image만 표시되는 화면은 별도 가능 |
| ERD history 없음 | main scatter 유지, `historyError` | 부분 성공 구현 |
| 동일성 latest 없음 | data API `404` | 이전 directory fallback 없음 |
| 개별 PNG 없음 | image `404`, 해당 card 오류 | 나머지 card는 유지 가능 |
| mapping 없음 | 관련 화면·Dashboard 실패 | 코드 fallback 범위는 기능별 상이 |
| mount·권한 장애 | 첫 관련 요청에서 실패 | startup readiness 없음 |

## 12. 보안과 운영 경계

- 분석 file root는 server trust boundary 안에 두고 browser는 API를 통해서만 접근한다.
- user-controlled segment와 absolute path는 허용 root·extension·형식을 검증한다.
- 실제 file owner, mode, ACL, read-only mount와 symlink 구성은 운영에서 확인해야 한다.
- source path를 client에 반환하는 현재 계약은 정보 노출과 migration 결합의 `Risk`다.
- upstream producer에게 write가 필요하더라도 L0 Spider runtime 계정의 write 권한 필요성을 의미하지 않는다.
- Core fixture는 최소 synthetic value만 사용하고 실제 운영 file을 복사하지 않는다.
- `mock-agent`의 mock file 구조는 현재 저장 설계의 사실 근거가 아니다.

## 13. 현재 기준선 평가를 위한 대안

과거에 아래 대안을 실제로 검토·기각했다는 근거는 없다.
후속 재검토를 위한 비교이며 현재 결정의 역사로 해석하지 않는다.

| 대안 | 기대 효과 | 비용·제약 | migration 영향 | 현재 판단 |
|---|---|---|---|---|
| 분석 결과 DB 저장 | transaction·query·권한·catalog 통합 | 대용량 point/image 모델, ingestion·index·보존 비용 | producer·API·운영 DB 전환 | 측정·요구 전 미채택 |
| Object storage | durable object, lifecycle, 분산 접근 | local file API 교체, 인증·URL·range/cache 설계 | path ID·reader·image endpoint 변경 | 운영 요구 확인 필요 |
| 분석 전용 API | file 구조 은닉, producer가 Schema 제공 | 새 서비스 가용성·인증·version·latency 의존 | Node handler를 API client로 교체 | owner·SLA 확인 필요 |
| metadata DB + object/file | 검색·version catalog 개선 | 이중 저장소 일관성·publish transaction 필요 | index Parquet 대체·migration 필요 | 부분 결과 문제가 우선일 때 검토 |
| manifest/version file | producer 완료·Schema version 표현 | producer 변경과 검증 logic 필요 | 기존 path에 sidecar 계약 추가 | 비교적 작은 후속 후보 |
| 현재 path 방식 유지 | 기존 호환성, migration 없음 | 강한 경로 결합·운영 filesystem 의존 | 문서·계약·검증 강화 | 현재 기준선 |

## 14. 경로·Schema 변경 영향

| 변경 | 영향 대상 | 필수 동시 검토 |
|---|---|---|
| root·mount | 모든 data/image handler와 source path | 환경 설정, resolver, 배포·rollback |
| 날짜 filename | Dashboard·commonality latest | parser, timezone, 비교·cache |
| index path·column | Self·MY EQP·공통부 filter | upstream producer, projection, payload builder |
| ERD/common directory segment | sibling data/image·history와 DB path parser | resolver, history key, 화면 query |
| `recipe_id`·PPID mapping | Dashboard dedupe, Self grouping·표시 | Schema, UI label, history |
| dynamic axis naming | scatter·identity | producer column, sensor/chStep normalization |
| image extension | image handler allowlist·MIME | producer, URL builder, cache |
| absolute path→opaque ID | 모든 chart/image API | ID registry, migration, old link 호환 |
| file→DB/object/API | 전체 read path | dual-read, backfill, 검증, rollback, 성능 |

호환되지 않는 변경은 producer와 consumer version을 함께 관리하고 dual-read 또는 명시적 cutover·rollback을 설계해야 한다.

## 15. Mismatch·Unknown·Risk

### Mismatch

- Parquet/API의 `recipe_id`와 path·UI의 PPID 명칭이 일관되지 않다.
- path registry의 일부 builder는 runtime보다 prototype에서 사용되고 실제 runtime은 `file_path` sibling 변환을 사용한다.
- Vite 단독 middleware와 통합 server의 abnormal-data 관련 route 범위가 일부 다르다.

### Unknown

- upstream producer, 파일 생성 주기·완료 신호·원자적 publish
- 전체 Schema·type·nullable·version과 호환 정책
- mount·ACL·symlink·retention·backup·restore·quota
- 업무 timezone과 허용 freshness·staleness SLA
- stats `except_v`, backup image와 미사용 path helper의 실제 운영 역할
- 실제 규모, read latency, cache hit rate와 장애 빈도

### Risk

- absolute path 노출과 환경 결합
- symlink·prefix 검증의 운영 의존성
- index/data/image 비원자적 publish에 따른 부분 결과
- Schema drift가 배포가 아닌 request-time에 발견될 가능성
- 같은 query key와 무한 stale cache로 인한 오래된 chart 표시 가능성
- startup readiness와 이전 snapshot fallback 부재

## 16. 재검토 조건

- 운영 filesystem 용량·latency·가용성 또는 backup 요구가 현재 방식으로 충족되지 않을 때
- producer가 object storage, DB 또는 전용 API로 결과 제공 방식을 바꿀 때
- path 또는 column 변경이 빈번해 호환 장애가 반복될 때
- 여러 server instance가 local mount·cache 일관성을 보장하지 못할 때
- 데이터 보존·감사·접근권한 요구가 file ACL만으로 부족할 때
- 원자적 publish, Schema version과 freshness SLA가 필요해질 때
- source path 노출을 제거하거나 opaque resource ID가 필요할 때
- 측정된 데이터 규모가 현재 memory·read·directory traversal 한계를 넘을 때

## 17. 후속 결정 필요 사항

1. 파일 producer와 owner, publish schedule·완료 신호를 확인한다.
2. 기능별 Parquet Schema와 version·nullable 계약을 만든다.
3. timezone, freshness SLA와 이전 snapshot fallback 정책을 결정한다.
4. `/appdata` mount·read-only·ACL·symlink·backup·restore를 운영 문서에 정의한다.
5. absolute path 대신 resource ID가 필요한지 보안·migration 관점에서 평가한다.
6. 실제 규모와 latency를 측정한 뒤 storage 대안을 비교한다.
7. 변경 시 synthetic fixture와 unit·contract test 범위를 정의한다.

## 18. 결정 결과

### 긍정적 결과

- 현재 화면·API 호환성을 유지한다.
- 파일과 DB 책임을 명시해 변경 범위를 추적할 수 있다.
- upstream 계약이 확인되기 전에 저장소 교체를 추정·강행하지 않는다.
- 향후 migration의 동시 변경 지점과 검증 의무가 명확해진다.

### 부정적 결과

- path coupling, 운영 filesystem 의존과 source path 노출 위험은 즉시 제거되지 않는다.
- Schema·freshness·backup 공백은 후속 운영 확인이 필요하다.
- 현재 방식의 성능·비용 우월성을 보장하지 않는다.

## 19. 근거

- `src/config/spiderDataPaths.mjs:1-90` — path·column 기준
- `server/dashboardData.mjs:568-825` — Dashboard file 선택·cache
- `server/selfEquipmentData.mjs:137-162,449-834` — index·ERD point·history·image
- `server/commonalityData.mjs:83-290` — directory index·PNG
- `server/commonAnomalyData.mjs:223-615` — common index·point·image
- `docs/system/architecture.md:20-38,108-114` — file·DB 경계
- `docs/system/data-flow.md:88-105,313-325` — 원천·소유권
- `docs/system/environment-definition.md:145-175` — filesystem 환경 공백
- `docs/system/security.md:151-167` — path 검증·운영 위험
- `docs/features/abnormal-data.md` — 기능별 추적 기준

이 ADR은 `7d65493` 시점의 정적 코드 근거를 사용한다.
실제 `/appdata`, DB, 운영 성능과 upstream 배치 실행은 확인하지 않았다.

# L0 Spider 성능·구조 효율성 종합 검수

## 실행 개요

- 기준: `agent/performance`, commit `536a5a7`
- 측정 시각: 2026-08-01 11:18~11:32 KST
- 환경: WSL2 x86_64, 4 CPU, 메모리 7,922 MiB, Node v22.22.1, npm 9.2.0, Vite 6.4.1, Chromium 149.0.7827.55
- 조건: 합성 Mock `single`·`normal`·`large`, 새 browser context, viewport 1440×900, throttling 없음
- 반복: API·브라우저·계산 각 1회 warm-up 제외 후 5회; `slow`·`race-condition` 3회
- 범위: 코드·문서 읽기, Mock/API/browser/build 측정. 애플리케이션·테스트·설정·의존성은 수정하지 않음
- 데이터 보호: 운영 DB·운영 파일·실제 메일·사내 시스템 미접속. 주소·port·실제 식별자·원본 응답은 기록하지 않음

## 종합 결과

| 우선순위 | ID | 상태 | 핵심 결과 |
|---|---|---|---|
| P1 | PERF-001 | 확인됨 | 공통부 `large` 1,200개 카드를 전부 mount하여 완료 중앙값 14,982.4 ms, DOM 34,040 nodes |
| P1 | PERF-002 | 확인됨/영향 판단 불가 | Dashboard 32-entry LRU는 90·180일 날짜순 반복 scan에서 재사용 hit 0 |
| P2 | PERF-003 | 잠재 위험 | chart 원본 payload와 고유 query cache가 페이지 이동·dialog 조회에 따라 누적 가능 |
| P2 | PERF-004 | 확인됨 | 모든 route가 단일 초기 JS 1,155,474 B(gzip 347,542 B)에 포함 |
| P2 | PERF-005 | 잠재 위험 | 주요 Parquet/chart cache가 1 entry이고 동기 `statSync`를 요청 경로에서 실행 |
| P3 | PERF-006 | 확인됨 | 직접 import가 없는 dependency 14개와 중복 npm script key 2개 존재 |

- P0: 0건, P1: 2건, P2: 3건, P3: 1건
- 가장 큰 실측 병목은 API 자체보다 공통부 전체 카드 mount의 browser main-thread 비용이다.
- 운영 데이터 규모·운영 파일시스템 I/O·운영 동시접속 용량은 측정하지 않았으므로 판단 불가다.

## 규모별 기준선

| 지표 | single | normal | large |
|---|---:|---:|---:|
| 공통부 최종 row | 1 | 8 | 1,200 |
| 공통부 UI 완료 중앙값 | 435.1 ms | 762.5 ms | 14,982.4 ms |
| 공통부 UI task 중앙값 | 382.8 ms | 645.2 ms | 11,809.3 ms |
| 공통부 DOM nodes 중앙값 | 257 | 575 | 34,040 |
| 공통부 JS heap used 중앙값 | 13.4 MB | 14.7 MB | 91.0 MB |
| 공통부 최종 payload | 798 B | 3,917 B | 516,225 B |
| scatter payload | 749 B | 3,294 B | 580,227 B |
| identity payload | 567 B | 5,983 B | 1,159,859 B |

브라우저 heap은 명시적 GC 없이 최종 필터 전후를 측정했으며 누수 판정값이 아니다. `large`는 1,200 row·scatter 2,500 point·identity 5,000 point의 고정 합성 fixture일 뿐 운영 용량 모델이 아니다.

## PERF-001 공통부 결과 전체 mount로 main thread·DOM·heap 급증

- 심각도: **P1**
- 상태/신뢰도: 확인됨 / 높음
- 병목 위치·조건: `CommonAnomalyPage.jsx:366-378, 594-618`; sensor 최종 선택 결과가 많을 때 `chartGroups → group.rows.map`으로 전 row card를 즉시 mount
- 영향: 화면 완료와 입력 응답이 늦어지고 DOM·listener·heap이 row 수에 비례해 증가한다. `loading="lazy"`는 image body만 지연하며 card mount 비용은 줄이지 않는다.
- 코드 근거: `CommonAnomalyImageCard`는 row마다 state, mutation, query client, dialog 자식을 구성한다(`CommonAnomalyPage.jsx:165-269`).
- 측정 근거: `large` 5/5 재현. 완료 평균/중앙/최소/최대 `15,207.3 / 14,982.4 / 14,533.0 / 15,820.1 ms`; task 중앙값 `11,809.3 ms`; script 중앙값 `8,889.0 ms`; DOM 중앙값 `34,040`; listener 중앙값 `5,001`; 최종 filter 후 heap 증가 중앙값 `75.8 MB`.
- 권장 개선: 공통부 API에 cursor/page 계약을 추가하고 UI도 페이지 또는 virtualization으로 실제 보이는 card만 mount한다. 총 row 수·group 정보와 page row를 분리하고 기존 필터·SKIP 동작 호환성을 보존한다.
- 검증 방법: 같은 fixture·viewport·5회 조건에서 총 1,200건 의미는 유지하되 mounted card/DOM 상한을 확인하고 완료·task·INP 대용 event latency·heap을 전후 비교한다. page 이동·SKIP 후 row 정합성도 함께 검증한다.

## PERF-002 Dashboard 90·180일 범위의 LRU scan thrash

- 심각도: **P1**
- 상태/신뢰도: cache 동작 확인됨, 실제 I/O 영향 판단 불가 / 높음
- 병목 위치·조건: `LineAnomalyDashboard.jsx:330, 351-364, 546-565`의 90·180일 조회와 `dashboardData.mjs:22-29, 595-662, 712-741`; 일별 file을 날짜순으로 읽고 aggregate LRU는 32 entry, read concurrency는 1
- 영향: 기간 내 일별 file이 32개를 넘으면 동일 범위 재조회도 Parquet read·decode·aggregate를 다시 수행할 수 있다. 파일 수·크기와 저장장치 지연에 따라 서버 응답과 CPU/I/O가 커질 수 있다.
- 측정·코드 근거: 실제 `boundedCache.mjs`로 동일 scan을 모사했을 때 두 번째 요청 hit/miss는 10일 `10/0`, 30일 `30/0`, 90일 `0/90`, 180일 `0/180`이었다. 운영 Parquet 시간은 미측정이다.
- 권장 개선: 최대 지원 기간과 aggregate byte 크기를 기준으로 cache 정책을 설계한다. 단순 entry 확대만 하지 말고 기간 응답 cache, 날짜별 durable/precomputed aggregate, byte-aware eviction·TTL, 변경 file만 무효화하는 방식을 검토한다. read concurrency는 저장장치 특성 측정 후 제한적으로 조정한다.
- 검증 방법: synthetic Parquet 10·30·90·180일로 cold/warm 각 5회 측정하고 file open/read count, cache hit, p50/p95, event-loop delay, RSS를 기록한다. 동일 범위 두 번째 요청에서 재읽기가 실제로 감소해야 한다.

## PERF-003 chart 원본 payload·query cache 누적 가능성

- 심각도: **P2**
- 상태/신뢰도: 잠재 위험 / 중간
- 병목 위치·조건: `FdcTrendPage.jsx:450-462, 737-750, 1099-1135`; row별 scatter/identity query와 client sampling. scatter와 dialog identity는 `gcTime: Infinity`; server는 원본 point array를 JSON으로 반환한 뒤 client가 sampling한다.
- 영향: 여러 chart page와 dialog를 순차 조회하면 network·JSON parse와 React Query heap이 고유 row path 수에 따라 누적될 수 있다. 현재 pagination은 동시 mount를 줄이지만 무기한 scatter cache는 page unmount 후에도 남는다.
- 측정·코드 근거: `large` scatter `580,227 B`, 평균 `95.9 ms`; identity `1,159,859 B`, 평균 `152.2 ms`. 합성 Mock에서 2,500/5,000 source point를 받은 뒤 identity utility가 최대 2,200 point를 선택했다. 기본 모아보기 10쌍을 모두 조회하는 합성 상한은 raw body 약 17.4 MB/page이나, 운영의 3일 범위 payload와 실제 heap은 판단 불가다.
- 권장 개선: 정확성 계약을 먼저 정한 뒤 server-side time window·point budget·level-of-detail 또는 zoom 재조회 방식을 도입한다. query cache는 화면 context별 유한 `gcTime`, 명시적 제거 또는 byte budget을 검토한다.
- 검증 방법: 자설비 Mock 계약을 수정한 별도 `mock-agent`에서 page 1→N→1을 반복하고 요청 수·전송량·parse time·GC 후 retained heap·cache entry/bytes를 기록한다. 이상치·최근 구간 보존도 Code Audit과 함께 확인한다.

## PERF-004 route 지연 로딩 부재로 단일 초기 bundle 생성

- 심각도: **P2**
- 상태/신뢰도: 확인됨 / 높음
- 병목 위치·조건: `routes.jsx:2-9`가 모든 page를 정적 import하고, `CommonAnomalyPage.jsx:25`가 2,257-line `FdcTrendPage.jsx`의 dialog 구현을 직접 import
- 영향: 메인만 방문해도 자설비 chart, 등록, manual parser/sanitizer 등 route 코드의 download·parse·compile 비용을 부담한다.
- 측정 근거: Mock production build 2,680 modules, JS chunk 1개 `1,155,474 B`(gzip `347,542 B`), CSS `123,111 B`(gzip `20,216 B`); Vite 500 kB 경고 재현. 실제 네트워크 FCP/LCP 개선량은 측정하지 않음.
- 권장 개선: route-level `lazy`/dynamic import를 적용하고 공통 chart dialog를 독립 module로 분리해 route 간 강결합을 끊는다. manual·registration·chart-heavy 기능은 사용자 진입 시 로드한다.
- 검증 방법: 같은 build에서 initial JS/gzip, chunk 수·중복을 비교하고 cold cache + 고정 throttling으로 메인 FCP/LCP/TBT와 각 route 첫 진입 시간을 5회 측정한다.

## PERF-005 1-entry file cache와 동기 metadata 접근

- 심각도: **P2**
- 상태/신뢰도: 잠재 위험 / 중간
- 병목 위치·조건: `selfEquipmentData.mjs:36-44, 137-160, 471-529`, `commonAnomalyData.mjs:25-30, 223-244, 417-449`; path/scatter/history cache가 각각 1 entry이고 request path에서 `statSync` 실행
- 영향: 서로 다른 file을 번갈아 조회하거나 여러 chart를 탐색하면 cache eviction과 Parquet 재읽기가 반복될 수 있다. 느린 filesystem metadata 호출은 단일 Node event loop를 block할 수 있다.
- 코드 근거: 동일 key 동시 요청은 pending map으로 합쳐지지만, 다른 key에는 적용되지 않는다. cache 크기 1은 메모리를 제한하는 장점도 있으므로 실제 read hit·RSS 없이 결함으로 단정하지 않는다.
- 권장 개선: async `stat`, file/axis별 read 계측, byte-aware bounded cache와 request concurrency/backpressure를 검토한다. 운영 메모리 한도를 모른 채 entry 수만 확대하지 않는다.
- 검증 방법: 합성 Parquet A/B 교차 조회와 20개 병렬 chart를 cold/warm 5회 실행해 open/read/stat count, p50/p95, event-loop delay, peak RSS와 hit rate를 비교한다.

## PERF-006 미사용 직접 dependency와 중복 npm script key

- 심각도: **P3**
- 상태/신뢰도: 확인됨 / 높음
- 병목 위치·조건: `package.json:13-23` 및 dependencies
- 영향: runtime bundle 포함은 확인되지 않았지만 install/cache·보안 scan·업데이트 범위를 키운다. 중복 script key는 뒤 정의가 앞 정의를 덮어 검증 명령의 의도와 유지보수를 불명확하게 한다.
- 측정·코드 근거: source/server/mock 전체 import 검색에서 직접 참조가 없는 dependency 14개 확인. 현재 해당 package directory 합계는 약 290 MB, 전체 `node_modules`는 621 MB이나 제거 후 절감량은 transitive 공유 때문에 판단 불가. Mock·build에서 `test:unit`, `test:contract` duplicate-key 경고 재현.
- 권장 개선: `main`에서 각 dependency의 runtime·build·운영 script 사용을 다시 확인한 뒤 미사용 항목만 제거한다. script 이름은 Core와 Mock 검증 범위를 분리해 단일 의미로 정리한다.
- 검증 방법: clean install 시간·package cache·directory size·audit 수를 전후 비교하고 lint/build/unit/contract 및 route smoke를 모두 통과시킨다.

## 확인된 보호 장치와 비병목

- 자설비는 `paginateChartGroups`로 페이지당 실제 chart 최대 20개만 mount하고, 동일성 이미지는 페이지당 18개만 mount한다. 과거의 전체 mount 위험은 이 두 화면에서는 현재 코드 기준 완화됨.
- 공통부 browser flow는 filter 단계별 `/api/common-anomaly-data` 4회와 클릭이력 1회를 관찰했다. 같은 key의 중복 전송은 확인되지 않았고 종속 filter 설계에 따른 직렬 호출이었다.
- 메인의 `LatestDataCard`와 Dashboard 기본 조회는 같은 React Query key를 사용하므로 코드상 cache/dedup 대상이다.
- 1,200-row grouping+sort 평균 `0.796 ms`, 5,000-point identity 선택 평균 `0.635 ms`로 현재 합성 규모의 주 병목이 아니었다. JSON encode/decode proxy는 평균 `32.179 ms`였다.

## 실행 실패·판단 불가

- 최초 API 측정은 sandbox local socket 제한으로 `connect EPERM` 실패 후 승인된 로컬 합성 연결로 재실행해 성공했다. 제품 결함이 아니다.
- `tests/performance/`에는 실행 가능한 test가 없고 README만 있다(`Mismatch`). 기존 artifact 측정 script와 browser benchmark를 실행했다.
- 자설비 최종 Mock 요청은 모든 규모에서 0 row였다. Mock의 반복 `line` query 해석과 scalar 비교가 맞지 않아 자설비 browser fan-out·heap은 판단 불가이며 Mock 계약 확인이 필요하다.
- React Profiler의 component별 render 횟수, 운영 filesystem/Parquet I/O, 운영 동시접속, 실제 네트워크 FCP/LCP/INP, 장시간 GC 후 retained heap은 `Not Run` 또는 판단 불가다.
- `slow`는 주입 지연을 재현했고, race pair 완료 차 평균은 2,704.75 ms였다. 둘 다 애플리케이션 자체 처리 성능으로 해석하지 않는다.

## 증거와 변경 보호

- 원시 지표: `artifacts/performance/metrics/{api-benchmark,browser-benchmark,compute-benchmark,latency-scenarios,bundle-summary,cache-scan}.json`
- 재현 script: `artifacts/performance/metrics/measure-{api,browser,compute,latency-scenarios,cache-scan}.mjs`, `collect-bundle.mjs`
- build: `artifacts/performance/build/`
- 검증: Mock build 성공; bounded cache·chart pagination·identity utility 대상 test 3/3 통과
- 변경 범위: 이번 실행 산출물은 `reports/performance/`, `artifacts/performance/`에만 존재
- 운영 자원 변경: 없음
- 애플리케이션·테스트·설정·dependency 수정: 없음

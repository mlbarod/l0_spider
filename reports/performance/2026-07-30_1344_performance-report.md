# Performance & Architecture Optimization 측정 보고서

## 1. 측정 일시

- 측정 일시: 2026-07-30 13:14~13:44 KST
- 보고서 작성 기준 시각: 2026-07-30 13:44 KST
- 측정자: Agent 3 — Performance & Architecture Optimization
- 핵심 질문: 어디가 느리고, 데이터 규모가 커져도 견딜 수 있는가?

## 2. 브랜치와 커밋

- 작업 경로: 데이터 보호 지침에 따라 절대 경로는 보고서에 기록하지 않음
- 브랜치: `agent/performance`
- 기준 브랜치: `mock-agent`
- 기준 commit: `c8e9ee9 Add read-only multi-agent review environment`
- 시작 상태: 애플리케이션 코드 미커밋 변경 없음
- 브랜치 전환·생성, commit, push, merge, rebase, reset, clean: 수행하지 않음

## 3. 측정 환경

| 항목 | 값 |
|---|---|
| 실행 환경 | WSL2, 로컬 합성 Mock 전용 |
| 실행 모드 | Vite `mock` mode |
| Mock 연결 | 로컬 loopback 전용, 주소와 포트는 데이터 보호 지침에 따라 생략 |
| 캐시 조건 | Mock API `Cache-Control: no-store`; API flow별 첫 1회 워밍업 제외 |
| 브라우저 cache | 브라우저 기동 실패로 미측정 |
| throttling | 적용하지 않음 |
| background tab | 해당 없음 |
| 측정 도구 | Node `performance.now()`, HTTP `fetch`, Vite build, 기존 합성 generator/차트 유틸 |
| API 반복 횟수 | `single`·`normal`·`large` 각 5회 + 워밍업 1회 |
| 보조 시나리오 반복 횟수 | `slow`·`race-condition` 각 3회 + 가능한 항목 워밍업 1회 |
| 제외값 기준 | 워밍업만 제외, 측정값 outlier는 제외하지 않음 |

측정 시작 시 지정 Mock frontend/API 포트에 listener가 없음을 연결 검사로 확인했다. 소켓 목록 명령은 샌드박스 권한 제한으로 실패했으나, 실제 연결 검사를 통해 두 포트 모두 미사용 상태임을 재확인했다. 시스템 load average는 측정 후 `0.18 / 0.54 / 0.63`이었고 측정을 크게 왜곡할 관련 고부하 프로세스는 확인되지 않았다.

## 4. 하드웨어·OS·Node·브라우저 정보

| 항목 | 값 |
|---|---|
| OS | Ubuntu 26.04, Linux 6.18.33.2 WSL2, x86_64 |
| CPU | Intel Core i5-7500 3.40 GHz, 4 cores / 4 threads |
| 메모리 | 총 7,922 MiB, 측정 후 available 6,170 MiB |
| Node | v22.22.1 |
| npm | 9.2.0 |
| Vite | 6.4.1 |
| React | 19.2.0 |
| Recharts | 3.3.0 |
| Playwright | 1.61.1 |
| 브라우저 | Chromium binary는 존재하나 `libnspr4.so` 부재로 기동 실패 |
| viewport | 브라우저 기동 실패로 미적용·미측정 |

## 5. 실행 명령

주소·포트·절대 경로는 기록하지 않고 의미만 보존했다.

```text
pwd
git branch --show-current
git status --short
git log -1 --oneline
npm run mock
node artifacts/performance/metrics/measure-api.mjs
node artifacts/performance/metrics/measure-compute.mjs
node artifacts/performance/metrics/measure-latency-scenarios.mjs
npm run build -- --mode mock --outDir artifacts/performance/build --emptyOutDir
node artifacts/performance/metrics/collect-bundle.mjs
```

초기 `npm run mock`은 샌드박스의 local listen 제한으로 실패했고, 사용자 승인 후 로컬 합성 Mock 전용 실행으로 재시도해 성공했다. 기본 production mode build는 Mock sanitization 보장을 위해 측정 결과로 사용하지 않고, 새로 만든 `artifacts/performance/build/`만 `mock` mode build로 교체했다.

## 6. 측정 시나리오와 데이터 규모

| 시나리오 | 합성 데이터 행 수 | scatter 포인트 | identity 전체 포인트 | 대시보드 trend 포인트 | 비고 |
|---|---:|---:|---:|---:|---|
| `single` | 1 | 1 | 1 | 1 | small 대용 |
| `normal` | 8 | 12 | 24 | 21 | identity는 2 group |
| `large` | 1,200 | 2,500 | 5,000 | 540 | identity는 2 group |
| `slow` | normal fixture | normal fixture | normal fixture | normal fixture | route별 고정 지연 |
| `race-condition` | normal fixture | 해당 없음 | 해당 없음 | normal fixture | 두 합성 line의 고정 지연 차 |

`large`는 고정 seed 합성 fixture이며 운영 환경 용량 모델이 아니다.

## 7. 워밍업 여부

- `single`·`normal`·`large`: endpoint/flow마다 첫 1회를 워밍업으로 분리하고 이후 5회를 통계에 사용했다.
- `slow`: 각 route 첫 1회를 워밍업으로 분리하고 이후 3회를 사용했다.
- `race-condition`: 동시 요청 pair 3회를 모두 사용했다.
- Mock API는 `no-store`이고 별도 서버 cache가 구현되어 있지 않아 cold/warm cache 효과는 분리할 수 없었다.
- 브라우저 cold/warm cache는 측정하지 못했다.

## 8. 전체 성능 요약

- Critical: 0
- High: 1건 — `PAO-002` 잠재 위험
- Medium: 3건 — `PAO-001`, `PAO-003`, `PAO-004`
- Low: 0
- 확인됨: large payload 증가와 API 처리시간 증가, 단일 초기 JS chunk
- 잠재 위험: 행별 chart 요청 fan-out과 무기한 cache, 대량 image card 전체 mount
- 재현 불가: 없음
- 추가 확인 필요: 자설비 large 행 렌더, 브라우저 렌더·DOM·heap·trace, 실제 네트워크 조건

가장 큰 확장성 위험은 단일 요청의 수십 ms가 아니라 “1,200개 행 × 행별 chart 요청 × 무기한 cache” 조합이다. large scatter 1회 응답은 평균 580,227 byte였으며, 사용자가 1,200개 행을 모두 펼치고 스크롤해 각 query가 한 번씩 실행된다는 상한 조건에서는 응답 본문만 약 696,272,400 byte(약 664 MiB)에 달한다. 이는 실제 재현값이 아니라 측정된 1회 payload와 코드의 행별 query 구조를 곱한 잠재 상한이며, parsed object와 SVG 비용은 포함하지 않는다.

## 9. 주요 지표 표

시간 단위는 ms, payload는 body byte이다. 시간은 평균 / 중앙값 / 최솟값 / 최댓값 순서다.

| 지표 | single | normal | large |
|---|---:|---:|---:|
| Dashboard 시간 | 12.747 / 15.234 / 3.798 / 16.141 | 6.104 / 2.363 / 2.201 / 12.611 | 10.968 / 10.992 / 5.130 / 16.266 |
| Dashboard payload | 1,498 | 3,084 | 33,254 |
| Common anomaly 최종 시간 | 4.995 / 3.842 / 2.482 / 8.950 | 3.426 / 1.989 / 1.921 / 9.194 | 60.720 / 41.042 / 36.687 / 141.996 |
| Common anomaly 최종 payload | 798 | 3,917 | 516,225 |
| Scatter 시간 | 5.945 / 2.888 / 1.853 / 11.877 | 5.772 / 1.902 / 1.785 / 11.851 | 42.528 / 42.016 / 28.836 / 57.722 |
| Scatter payload | 749 | 3,294 | 580,227 |
| Identity 시간 | 5.646 / 2.061 / 1.885 / 13.491 | 5.664 / 2.084 / 1.843 / 11.622 | 62.426 / 58.254 / 55.941 / 78.064 |
| Identity payload | 567 | 5,983 | 1,159,859 |
| Pass history payload | 345 | 2,615 | 97,415 |
| Registration payload | 338 | 648 | 61,929 |
| 주요 브라우저 렌더 수 | 미측정 | 미측정 | 미측정 |
| 시작/종료 브라우저 메모리 | 미측정 | 미측정 | 미측정 |

large common anomaly 평균이 중앙값보다 큰 이유는 5회 중 1회가 141.996 ms로 상승했기 때문이다. outlier를 임의 제외하지 않았고, 환경 scheduling 또는 GC 가능성을 배제할 수 없어 평균과 중앙값을 함께 제시한다.

## 10. single·normal·large 비교

| 지표 | single→large 시간 배율 | normal→large 시간 배율 | single→large payload 배율 | normal→large payload 배율 |
|---|---:|---:|---:|---:|
| Dashboard | 0.86× | 1.80× | 22.20× | 10.78× |
| Common anomaly 최종 | 12.16× | 17.72× | 646.90× | 131.79× |
| Scatter | 7.15× | 7.37× | 774.67× | 176.15× |
| Identity | 11.06× | 11.02× | 2,045.61× | 193.86× |
| Pass history | 5.38× | 3.51× | 282.36× | 37.25× |
| Registration | 1.72× | 1.03× | 183.22× | 95.57× |

Dashboard 시간은 데이터 규모와 단조 증가하지 않아 현재 로컬 HTTP 측정만으로 병목을 확정하지 않는다. 반면 common anomaly, scatter, identity는 payload와 시간 증가가 함께 나타났다.

## 11. API 분석

### 요청 수와 progressive filter

- 자설비 filter flow: 최종 선택까지 합성 직접 측정 기준 5개 직렬 요청
- 공통부 filter flow: 최종 선택까지 합성 직접 측정 기준 4개 직렬 요청
- common anomaly progressive flow payload: `single` 1,692 byte, `normal` 4,940 byte, `large` 517,284 byte
- common anomaly progressive flow 평균: `single` 24.579 ms, `normal` 20.187 ms, `large` 68.129 ms
- React Query의 같은 queryKey에 대한 `fetchQuery`와 `useQuery` 중복 전송 여부는 브라우저 network trace가 없어 확정하지 않았다.

### payload와 직렬화

기존 generator와 chart utility를 Node에서 반복 실행한 보조 측정 결과:

| 연산 | single 평균 | normal 평균 | large 평균 | large 출력 규모 |
|---|---:|---:|---:|---:|
| 행 group+sort | 0.0093 ms | 0.0420 ms | 0.6116 ms | 1,200 rows |
| JSON encode+decode proxy | 0.0299 ms | 0.2752 ms | 42.5540 ms | 1,200 rows + 5,000 points |
| identity point 선택 | 0.0084 ms | 0.0135 ms | 0.6669 ms | 5,000 source → 2,200 render |

large에서 단순 group/sort 자체는 1 ms 미만이었고 JSON materialization proxy가 약 42.6 ms로 더 컸다. 이는 브라우저 main-thread 측정이 아니라 Node 보조 측정이므로 실제 UI 비용으로 일반화하지 않는다.

### `slow`

| API | 횟수 | 평균 | 중앙값 | 최솟값 | 최댓값 |
|---|---:|---:|---:|---:|---:|
| Dashboard | 3 | 1,004.49 | 1,004.50 | 1,004.25 | 1,004.71 |
| Self equipment | 3 | 3,008.80 | 3,006.82 | 3,004.81 | 3,014.77 |
| Scatter | 3 | 10,008.87 | 10,008.08 | 10,007.52 | 10,011.00 |

이는 Mock에 설정된 지연을 재현한 값이며 애플리케이션 자체 overhead로 해석하지 않는다.

### `race-condition`

동시 요청 3쌍에서 느린 요청 평균 3,004.83 ms, 빠른 요청 평균 303.07 ms, 완료 차 평균 2,701.77 ms였다. 응답 순서 정확성은 Code Audit Agent 범위이며, 본 보고서는 동시 요청 간 대기시간 차만 기록한다.

### 자설비 측정 차단 현상

`self-equipment-data`의 최종 filter 요청은 `single`·`normal`·`large` 모두 0행을 반환했다. 따라서 자설비 large table/chart의 실제 fan-out을 Mock 브라우저에서 재현하지 못했다. 상대 query path에서 `line`을 반복 파라미터로 수집하는 형태와 generator의 scalar 비교가 함께 관찰됐으나 정확성 결함 판정은 Code Audit Agent에 이관한다. 이 항목의 성능 영향은 “large 경로 측정 불가”로만 판정한다.

## 12. 렌더링 분석

- React DevTools profiler: 미측정
- 주요 component render 횟수: 미측정
- 브라우저 Performance trace: 미수집
- 확인된 코드 구조:
  - `FdcTrendPage.jsx`는 2,206 lines의 대형 page module이다.
  - 자설비 chart rows를 group한 뒤 `group.rows.map(...)`으로 모든 행의 `ErdScatterCard`를 생성하고, 일부는 CSS `hidden`으로 숨긴다: `src/features/fdc-trend/pages/FdcTrendPage.jsx:2155`
  - 각 card는 `IntersectionObserver`로 request 시점을 늦추지만 component와 observer 생성 자체는 모든 row map에 연결된다: `FdcTrendPage.jsx:1088`
  - 공통부는 최종 `chartRows` 전체를 group하고 모든 row에 image card를 생성한다: `src/features/fdc-trend/pages/CommonAnomalyPage.jsx:368`, `:606`
- 판정: 실제 commit/render duration이 없어 구조적 잠재 위험으로만 기록한다.

## 13. 차트 분석

- scatter large: 2,500 points, 평균 payload 580,227 byte, 평균 42.528 ms
- identity large: 2 groups × 2,500 = 5,000 source points, 평균 payload 1,159,859 byte, 평균 62.426 ms
- 기존 identity utility는 large 5,000 source points를 2,200 rendered points로 줄였다.
- source points 전체는 먼저 전송·JSON parse·메모리 materialize된 뒤 render sampling이 적용되므로 network와 parse 비용은 줄지 않는다.
- 현재 `samplePoints`는 균등 간격으로 첫/마지막을 보존한다: `src/features/fdc-trend/utils/identityChart.mjs:6`
- sampling이 이상치·급격한 전환·판정 근거를 보존하는지는 Performance 범위에서 확인하지 않았다. 데이터 정확성 검토는 Code Audit Agent가 필요하다.
- sampling 또는 집계를 개선안으로 적용할 경우 원본 포인트 수, 표시 포인트 수, 방법, zoom 시 원본 재조회 여부를 UI에 명시해야 하며 임의 포인트 삭제를 허용해서는 안 된다.

## 14. 목록·테이블 분석

- Dashboard line table은 client sort/filter 후 page 단위 slice를 수행한다. Mock의 line 수가 최대 3이어서 대량 table 병목을 재현하지 못했다.
- 동일성 image 목록은 전체 1,200행을 응답으로 받은 뒤 client에서 18개씩 표시한다: `CommonalityAnomalyPage.jsx:264`, `:268`.
  - 장점: DOM card는 한 페이지 18개로 제한된다.
  - 남은 비용: 최초 network와 JSON parse는 전체 1,200행 기준이다.
- 공통부 image 목록은 server pagination과 client pagination이 없고 large 1,200 rows 전체를 `group.rows.map`으로 card 생성한다: `CommonAnomalyPage.jsx:606`.
- image는 `loading="lazy"`이므로 image body 전송 시점은 늦춰지지만, 1,200개 article/card와 자식 component mount 비용은 남는다.
- 스크롤 반응, DOM node 수, filter 시간: 브라우저 기동 실패로 미측정.

## 15. 번들 분석

명시적 Vite `mock` mode build 결과:

| 항목 | 현재 값 | 기준 |
|---|---:|---|
| transformed modules | 2,679 | 비교 기준 없음 |
| JS chunk 수 | 1 | 모든 route가 초기 chunk에 포함 |
| 초기 JS | 1,152,373 byte | Vite 500 kB warning 초과 |
| 초기 JS gzip | 346,440 byte | 제품 목표 미정 |
| CSS chunk 수 | 1 |  |
| 초기 CSS | 123,113 byte | 제품 목표 미정 |
| 초기 CSS gzip | 20,216 byte |  |
| 초기 JS+CSS | 1,275,484 byte | 제품 목표 미정 |
| 초기 JS+CSS gzip | 366,656 byte | 제품 목표 미정 |

`src/features/fdc-trend/routes.jsx:2-9`가 모든 page를 정적 import하며 build는 단일 JS chunk를 생성했다. `CommonAnomalyPage.jsx`가 chart dialog를 `FdcTrendPage.jsx`에서 import하는 결합도 초기 chunk 분리에 불리한 구조다. 새 분석 package는 설치하지 않았고, library별 chunk 기여도는 측정하지 못했다.

## 16. 메모리 분석

- 브라우저 heap 시작/종료: 미측정
- navigation 반복 전후 heap: 미측정
- GC 후 retained size: 미측정
- 확인된 구조:
  - 행별 scatter query는 row path가 포함된 고유 queryKey를 사용한다.
  - `staleTime: Infinity`, `gcTime: Infinity`로 설정되어 있다: `FdcTrendPage.jsx:1098-1108`.
  - identity dialog query도 `gcTime: Infinity`다.
- 추정:
  - 사용자가 많은 row의 chart를 순차 조회하면 parsed point 배열이 query cache에 누적될 수 있다.
  - 1회 large scatter body 580,227 byte는 heap object 크기의 하한도 아니며, parsed object·React Query metadata·Recharts object는 별도다.
  - 실제 누수 여부와 장기 retained heap은 browser heap snapshot 없이는 확정할 수 없다.

## 17. 확장성 위험

| 우선순위 | ID | 상태 | 사용자 체감 | 빈도 | 규모 악화 | CPU | 메모리 | 네트워크 | 서버 부하 | 수정 난이도 | 정확성 위험 | 예상효과 |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | PAO-002 | 잠재 위험 | 4 | 3 | 5 | 4 | 5 | 5 | 4 | 4 | 3 | 5 |
| 2 | PAO-001 | 확인됨 | 3 | 4 | 5 | 3 | 4 | 5 | 4 | 4 | 4 | 4 |
| 3 | PAO-003 | 잠재 위험 | 3 | 3 | 5 | 4 | 4 | 3 | 3 | 3 | 2 | 4 |
| 4 | PAO-004 | 확인됨 | 3 | 5 | 2 | 2 | 3 | 4 | 2 | 3 | 1 | 3 |

점수는 1(낮음)~5(높음)이다. 수정 난이도는 높을수록 어렵다. 사용자 체감은 브라우저 실측 부재 때문에 보수적으로 산정했다.

## PAO-001 large에서 전체 원본 행·포인트 응답의 payload와 처리시간 급증

- 상태: 확인됨
- 심각도: Medium
- 신뢰도: 높음
- 분류: API / network / serialization / 확장성
- 대상 화면 또는 기능: 공통부 이상감지, scatter, identity chart
- 관련 파일: `mock/generators/synthetic-data.mjs`, `mock/server/routes/api.mjs`, chart API modules
- 관련 API: `/api/common-anomaly-data`, `/api/erd-scatter-data`
- 연관 에이전트: Code Audit Agent
- 연관 사유: 집계·sampling 도입 시 이상치와 판단 근거 보존 조건 검토 필요
- 최초 발견 시나리오: `large`
- 재현 횟수: 5 / 5

### 문제 요약

large에서 common anomaly 1,200 rows, scatter 2,500 points, identity 5,000 points가 한 응답에 포함된다. normal 대비 payload는 각각 131.79×, 176.15×, 193.86× 증가했고 평균 처리시간은 17.72×, 7.37×, 11.02× 증가했다.

### 사용자 또는 시스템 영향

실제 네트워크에서는 전송시간, JSON parse, heap, chart 준비 비용이 함께 증가할 수 있다. 로컬 API 평균은 최대 약 62 ms였으므로 현재 측정만으로 “사용 불가”를 판정하지 않는다.

### 재현 절차

1. scenario를 reset하고 `single`, `normal`, `large`를 순서대로 설정한다.
2. 각 endpoint를 1회 워밍업한다.
3. 응답 body를 끝까지 읽어 5회 시간·byte·행·포인트 수를 기록한다.

### 기대 결과

데이터 규모 증가 시 사용자가 필요한 범위만 전송되고 처리 비용이 예측 가능해야 한다.

### 실제 결과

large에서 전체 행·포인트가 한 번에 전송되며 payload와 시간이 함께 증가했다.

### 수집된 근거

- network: `artifacts/performance/metrics/api-benchmark.json`
- 측정값: 본 보고서 9~11절
- 관련 코드 위치: `mock/generators/synthetic-data.mjs:37`, `:110`, `:398`
- profile: 브라우저 profile 미수집

### 측정 통계

| endpoint | 횟수 | 평균 | 중앙값 | 최솟값 | 최댓값 | 응답 크기 | 데이터 행 수 | 차트 포인트 수 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| common anomaly large | 5 | 60.720 ms | 41.042 ms | 36.687 ms | 141.996 ms | 516,225 B | 1,200 | 해당 없음 |
| scatter large | 5 | 42.528 ms | 42.016 ms | 28.836 ms | 57.722 ms | 580,227 B | 해당 없음 | 2,500 |
| identity large | 5 | 62.426 ms | 58.254 ms | 55.941 ms | 78.064 ms | 1,159,859 B | 해당 없음 | 5,000 |

### 원인 분석

- 확인된 사실: inventory에 server pagination이 없고 large generator가 전체 배열을 응답한다.
- 추정: 운영 데이터 규모와 필드 폭이 더 크면 전송·parse·heap 비용이 더 악화될 수 있다. 운영 규모는 알 수 없어 수치 일반화하지 않는다.

### 권장 수정 방향

- 프런트엔드 제안:
  - viewport/chart zoom에 필요한 범위를 명시적으로 요청한다.
  - 응답의 원본 count, 표시 count, 집계·sampling 방식을 사용자에게 표시한다.
  - 기존 client sampling 전까지 전체 raw payload를 받는 구조를 재검토한다.
- 백엔드 API 제안:
  - 목록 server pagination과 안정적인 sort key를 제공한다.
  - chart는 시간 window, equipment, sensor, step, 해상도/집계 수준을 명시적으로 받는다.
  - raw와 aggregate 응답을 구분하고 extrema·anomaly marker·첫/마지막 점 보존 계약을 정의한다.

실제 코드는 수정하지 않았다.

### 예상 개선효과와 산정 근거

정량 목표는 제품 네트워크·정확성 요구사항이 없어 임의로 만들지 않는다. 수정 후 동일 fixture에서 transferred byte, JSON parse time, displayed source/render count를 전후 비교해야 한다.

### 수정 후 검증 기준

- 동일 데이터 의미와 합계가 유지된다.
- 페이지/기간 변경 간 누락·중복이 없다.
- 원본 count와 표시 count가 일치하거나 차이가 명시된다.
- `single`·`normal`·`large` 5회 비교에서 payload와 parse 증가율이 제한된다.

## PAO-002 행별 chart 요청 fan-out과 무기한 query cache의 결합

- 상태: 잠재 위험
- 심각도: High
- 신뢰도: 중간
- 분류: architecture / network / memory / React Query
- 대상 화면 또는 기능: 자설비 scatter·identity chart
- 관련 파일: `src/features/fdc-trend/pages/FdcTrendPage.jsx`
- 관련 API: `/api/erd-scatter-data`
- 연관 에이전트: Code Audit Agent
- 연관 사유: query lifecycle, cache eviction, request identity와 취소 정책 검토 필요
- 최초 발견 시나리오: `large` 코드·payload 결합 분석
- 재현 횟수: 브라우저 end-to-end 미재현

### 문제 요약

모든 row에 chart component가 생성되고 각 row path별 queryKey로 chart를 요청한다. scatter query는 `gcTime: Infinity`이며 large 1회 응답은 580,227 byte다.

### 사용자 또는 시스템 영향

많은 row를 펼치고 스크롤하면 요청 수, 전송량, parsed point 배열, query cache가 함께 증가할 수 있다. 1,200회가 모두 실행되는 상한 조건은 body 기준 약 664 MiB이며 실제 heap은 더 클 수 있다.

### 재현 절차

1. large 자설비 최종 filter로 1,200 rows를 표시한다.
2. 각 group을 펼치고 전체 목록을 스크롤한다.
3. unique chart 요청 수, transferred bytes, query cache, heap을 기록한다.

현재 Mock self-equipment가 0행을 반환하고 Chromium이 기동하지 않아 1~3을 완주하지 못했다.

### 기대 결과

동시·누적 chart 요청과 cache가 화면에 필요한 범위 및 명시적 budget 안에 있어야 한다.

### 실제 결과

코드상 row별 query와 무기한 cache가 확인됐으나 실제 browser 누적량은 미측정이다.

### 수집된 근거

- network 단위값: `artifacts/performance/metrics/api-benchmark.json`
- 관련 코드 위치: `FdcTrendPage.jsx:1098-1108`, `:2155-2172`
- profile: 미수집

### 측정 통계

- 1회 large scatter: 5회, 평균 42.528 ms, 중앙값 42.016 ms, 580,227 byte, 2,500 points
- row 수: fixture 기준 1,200
- 1,200회 단순 곱 상한: 696,272,400 byte, 약 664 MiB
- 실제 요청 수·heap: 미측정

### 원인 분석

- 확인된 사실: row path가 queryKey에 포함되고 `gcTime: Infinity`다. row 전체를 map해 component를 만든다.
- 추정: 전체 스크롤/확장 시 request와 cache가 장시간 누적될 수 있다.

### 권장 수정 방향

- 프런트엔드 제안:
  - 보이는 chart만 mount하고 unmount 후 합리적인 cache eviction 정책을 적용한다.
  - 동시 요청 수와 prefetch 거리를 제한한다.
  - query cache byte/point budget을 정하고 오래된 chart를 제거하되 stale data를 최신처럼 표시하지 않는다.
- 백엔드 API 제안:
  - 행별 동일 규모 raw points 반복 전송 대신 범위·집계 endpoint 또는 batch contract를 검토한다.
  - batch를 도입해도 각 row의 identity와 실패 상태를 개별 표시하고 부분 실패를 빈 성공으로 치환하지 않는다.

### 예상 개선효과와 산정 근거

실제 개선율은 row별 request가 재현되지 않아 제시하지 않는다. 최댓값은 현재 구조의 잠재 fan-out 상한을 줄이는 방향이어야 한다.

### 수정 후 검증 기준

- large에서 첫 viewport, 전체 스크롤, group 펼침을 각각 5회 측정한다.
- 동시 요청 수, 누적 요청 수, transferred bytes, cache entry, GC 후 heap을 기록한다.
- 화면 밖 chart 제거 후 cache와 heap이 안정화된다.
- 실패·취소·재조회가 빈 chart나 오래된 정상 chart로 숨겨지지 않는다.

## PAO-003 공통부 large 1,200 image card 전체 mount

- 상태: 잠재 위험
- 심각도: Medium
- 신뢰도: 중간
- 분류: React rendering / DOM / list scalability
- 대상 화면 또는 기능: 공통부 이상감지
- 관련 파일: `src/features/fdc-trend/pages/CommonAnomalyPage.jsx`
- 관련 API: `/api/common-anomaly-data`, `/api/common-anomaly-image`
- 연관 에이전트: Browser QA Agent
- 연관 사유: 실제 scroll 반응과 사용자 조작성 확인 필요
- 최초 발견 시나리오: `large`
- 재현 횟수: API 5 / 5, browser render 미재현

### 문제 요약

large final response 1,200 rows를 client에서 group한 뒤 pagination/virtualization 없이 모든 `CommonAnomalyImageCard`를 map한다. image body는 lazy loading이지만 card와 dialog/hooks는 mount 대상이다.

### 사용자 또는 시스템 영향

DOM node·React component·hook 수가 row 수에 비례할 수 있고, 초기 render와 scroll main-thread 비용이 악화될 수 있다.

### 수집된 근거

- 1,200 rows, 516,225 byte, 평균 60.720 ms
- 관련 코드 위치: `CommonAnomalyPage.jsx:368-378`, `:596-615`
- browser DOM/profile: 미수집

### 권장 수정 방향

- 프런트엔드 제안:
  - 명시적 server pagination 또는 의미 보존형 windowing을 적용한다.
  - 현재 total count와 표시 범위를 항상 보인다.
  - image lazy loading과 component mount 범위를 함께 제한한다.
- 백엔드 API 제안:
  - cursor/page 계약에 안정 sort key와 total을 포함한다.
  - page 이동 간 누락·중복 및 filter scope를 검증한다.

### 수정 후 검증 기준

- large 첫 page DOM node·commit duration·scroll long task·heap을 5회 측정한다.
- page 이동 전후 total과 행 identity가 유지된다.
- 전체 응답을 임의 축소하거나 누락하지 않는다.

## PAO-004 모든 route가 단일 초기 JS chunk에 포함

- 상태: 확인됨
- 심각도: Medium
- 신뢰도: 높음
- 분류: bundle / initial load / architecture
- 대상 화면 또는 기능: 전체 앱 최초 진입
- 관련 파일: `src/features/fdc-trend/routes.jsx`, `src/features/fdc-trend/pages/CommonAnomalyPage.jsx`
- 관련 API: 해당 없음
- 연관 에이전트: 없음
- 최초 발견 시나리오: Vite `mock` mode build
- 재현 횟수: build 1 / 1

### 문제 요약

2,679 modules가 JS chunk 1개로 생성됐고 초기 JS는 1,152,365 byte, gzip 346,437 byte다. Vite의 500 kB 경고를 재현했다.

### 사용자 또는 시스템 영향

사용자가 방문하지 않는 manual, registration, anomaly page 코드도 최초 chunk parse/compile 범위에 포함될 가능성이 높다. 실제 LCP/interaction 영향은 브라우저 미기동으로 측정하지 못했다.

### 수집된 근거

- build summary: `artifacts/performance/metrics/bundle-summary.json`
- build output: `artifacts/performance/build/`
- 관련 코드 위치: `src/features/fdc-trend/routes.jsx:2-9`

### 권장 수정 방향

- 프런트엔드 제안:
  - route 단위 lazy loading 경계를 먼저 검토한다.
  - `FdcTrendPage`에서 재사용 dialog를 독립 module로 분리해 common page가 대형 page module을 끌어오지 않게 한다.
  - 데이터 정확성이나 error state를 lazy boundary에서 숨기지 않고 명시적 loading/error UI를 유지한다.
- 백엔드 API 제안: 해당 없음

### 예상 개선효과와 산정 근거

library별 기여도와 browser load가 미측정이므로 숫자 목표를 만들지 않는다. 현재 초기 JS/gzip을 전후 baseline으로 사용한다.

### 수정 후 검증 기준

- build에서 route별 chunk가 생성된다.
- 초기 route가 필요로 하지 않는 page chunk를 최초 진입에서 요청하지 않는다.
- 동일 viewport와 cache 조건에서 navigation·error boundary를 포함해 5회 측정한다.

## 18. 백엔드 개선 제안

1. 목록 endpoint에 server pagination/cursor, stable sort key, total count를 함께 제공한다.
2. chart endpoint에 time window, resolution/aggregation level, equipment/sensor/step filter를 명시한다.
3. 집계 응답은 원본 count, 표시 count, extrema/anomaly marker 보존 규칙을 계약에 포함한다.
4. 행별 chart fan-out을 줄일 batch가 필요하면 부분 실패와 row identity를 보존한다.
5. API 실패나 schema mismatch를 빈 배열 성공으로 치환하지 않는다.
6. cache validator를 도입할 경우 stale 응답을 최신처럼 표시하지 않고 기준 시각을 노출한다.

## 19. 프런트엔드 개선 제안

1. viewport 범위 밖 chart component의 mount와 query를 제한하고 cache budget/eviction을 정의한다.
2. 공통부 image 목록은 표시 범위가 제한되는 server pagination 또는 windowing을 사용한다.
3. route 단위 lazy loading과 재사용 dialog module 분리를 검토한다.
4. sampling/aggregation 사용 시 원본 count·표시 count·방법을 사용자에게 알리고 zoom에서 필요한 상세를 재조회한다.
5. 오류·취소·부분 실패를 오래된 chart나 빈 정상 결과로 숨기지 않는다.
6. 적용 후 반드시 동일 `single`·`normal`·`large`, 동일 횟수로 전후를 비교한다.

## 20. 측정하지 못한 항목

- 최초 진입시간, DOMContentLoaded, load, 주요 콘텐츠 표시시간
- 사용자 조작 가능 시점
- 실제 chart 최초/필터 변경 렌더 시간
- React component render 횟수와 commit duration
- DOM node 수, scroll FPS/long task
- tooltip 반응
- browser network request count와 cache hit
- browser memory, GC 후 retained heap, listener 증가
- Lighthouse
- browser trace, performance trace, React profile
- 실제 네트워크 latency/throttling
- 자설비 large row/chart end-to-end
- library별 bundle 기여도

## 21. Mock 환경의 한계

- 합성 `large`는 1,200 rows, 2,500 points의 고정 fixture이며 운영 규모를 나타내지 않는다.
- Mock API와 frontend가 같은 로컬 환경에 있어 실제 RTT, bandwidth, TLS, server concurrency가 반영되지 않는다.
- `slow`와 `race-condition`은 고정 지연이므로 실제 backend 분포가 아니다.
- 브라우저 공유 라이브러리 부재로 UI 계측을 수행하지 못했다.
- self-equipment large 응답이 0행이어서 주 대상 chart fan-out을 실제로 실행하지 못했다.
- API 서버 cache가 없어 cold/warm server cache를 비교할 수 없다.

## 22. main 개발용 Codex 우선 개선 목록

1. `PAO-002`를 현재 `main`의 실제 self-equipment 응답으로 재현하고, viewport 전체 스크롤 시 request/heap 상한을 먼저 확정한다.
2. `PAO-001`의 목록 pagination과 chart range/aggregation 계약을 데이터 정확성 보호 조건과 함께 설계한다.
3. `PAO-003` 공통부 1,200 cards의 DOM/commit/scroll 비용을 브라우저에서 측정한 뒤 server pagination 또는 windowing을 선택한다.
4. `PAO-004` route lazy boundary와 공통 dialog module 분리를 적용하기 전 bundle 기여도를 확인한다.
5. 수정 후 같은 fixture·횟수·환경으로 API byte/time, browser render, heap, bundle을 재측정한다.

## 실행 실패 및 제한사항

- 실패한 명령:
  - 샌드박스 내부 최초 `npm run mock`: local listen `EPERM`; 승인된 로컬 실행으로 재시도 성공
  - socket listener 목록 조회: netlink 권한 제한; loopback 연결 검사로 대체
  - Chromium launch: `libnspr4.so` 부재; 의존성 설치 금지에 따라 중단
- 측정하지 못한 지표: 20절 참조
- 도구·환경 제한: browser OS library 미설치, local network sandbox 승인 필요

## 증거 목록

- `artifacts/performance/metrics/api-benchmark.json`
- `artifacts/performance/metrics/compute-benchmark.json`
- `artifacts/performance/metrics/latency-scenarios.json`
- `artifacts/performance/metrics/bundle-summary.json`
- `artifacts/performance/build/`
- 측정 스크립트:
  - `artifacts/performance/metrics/measure-api.mjs`
  - `artifacts/performance/metrics/measure-compute.mjs`
  - `artifacts/performance/metrics/measure-latency-scenarios.mjs`
  - `artifacts/performance/metrics/collect-bundle.mjs`

응답 본문 전체, 실제 회사 정보, 실제 식별자, 내부 주소·host·IP·port·credential·token·secret은 저장하지 않았다.

## 변경 보호 확인

- 종료한 실행 프로세스: Mock runner, Mock API, Vite frontend 종료; 실패한 Chromium process는 launch 실패 시 정리됨
- 포트 반환: Mock frontend/API 지정 포트 모두 listener 없음 확인
- 보고서·artifact 외 변경 발생 여부: 없음
- 애플리케이션 소스 수정 없음 확인: 확인
- 테스트·설정·의존성 수정 없음 확인: 확인
- 테스트 실행: 없음
- 브라우저 trace/profile: 없음

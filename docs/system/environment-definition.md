# L0 Spider 환경 정의

## 1. 문서 목적과 범위

- 이 문서는 L0 Spider Core Harness가 기준으로 삼을 실행 환경, 설정 주입 지점, 외부 의존성과 운영 경계를 정의한다.
- 기준(Baseline)은 현재 `main` 브랜치의 코드와 설정이며, 현재 상태(As-Is)와 향후 확인 항목을 구분한다.
- 조사 기준 브랜치와 시작 commit은 각각 `main`, `2d553536`이며 본 기능은 현재 working tree 변경을 포함한다.
- 주요 근거 문서는 `reports/audit/system-inventory.md`, `docs/system/overview.md`, `docs/system/architecture.md`이다.
- 실제 `.env`, 운영 DB, `/appdata` 파일, 서비스 관리자와 외부 브랜치는 확인하지 않았다.
- 실제 비밀번호, 토큰, 이메일 주소, 내부 IP와 내부 host 값은 이 문서에 기록하지 않는다.
- 배포 절차와 장애 대응 절차는 각각 향후 `docs/system/deployment.md`, `docs/operations/`에서 관리한다.

## 2. 환경 정의 원칙

- 환경 사실은 `Confirmed`, `Documented`, `Inferred`, `Unknown`, `Mismatch`로 구분한다.
- 비밀정보 또는 운영상 위해 가능성은 사실 상태와 별개로 `Risk`를 표시한다.
- 코드 기본값이 있어도 운영에 적합한 값이라고 간주하지 않는다.
- 설정 파일 이름만으로 자동 로딩이나 우선순위를 추정하지 않는다.
- 실행 명령은 `package.json` 또는 현재 코드에서 확인된 것만 기록한다.
- 운영 환경과 개발 환경의 이름은 저장소 근거가 없으므로 임의로 `production`, `staging`으로 확정하지 않는다.
- Core Harness는 운영 자원 없이 검증할 수 있어야 하며, 실제 운영 설정값을 fixture로 복사하지 않는다.

## 3. 확인된 실행 모드

| 실행 모드 | 진입 명령 | 서버 구성 | 기본 listen | API 범위 | 상태 |
|---|---|---|---|---|---|
| Vite 단독 개발 | `npm run dev` | Vite dev server | 모든 interface, port `3000` | `vite.config.mjs`에 구현된 일부 API | `Confirmed` |
| 통합 live reload | `npm start`, `npm run preview` | Node HTTP server와 Vite middleware | `HOST` 또는 `0.0.0.0`, `PORT` 또는 `5173` | `server.mjs`의 전체 API | `Confirmed` |
| 통합 정적 제공 | `LIVE_RELOAD=0 npm start` | Node HTTP server가 `dist/` 제공 | 통합 live reload와 동일 | `server.mjs`의 전체 API | `Confirmed` |
| 메뉴얼 화면 생성 | `npm run manual:screenshots` | 선택적 Vite와 Playwright 도구 | 코드 기본 loopback, port `4173` | 합성 화면 데이터 | `Confirmed` |

- `npm run preview`는 Vite preview가 아니라 `node server.mjs`를 실행한다.
- 통합 정적 제공은 `BUILD_ON_START`가 `"0"`이 아니면 시작 전에 `npm run build`를 호출한다.
- 어떤 실행 모드가 실제 운영에 쓰이는지는 저장소만으로 확인할 수 없어 `Unknown`이다.

## 4. 런타임과 도구 체인

| 항목 | 확인 결과 | 상태 | 근거 |
|---|---|---|---|
| JavaScript runtime | Node.js로 `server.mjs`와 도구를 실행하지만 버전 제약은 없음 | `Confirmed` / 버전 `Unknown` | `package.json`, `server.mjs` |
| package manager | npm script와 `package-lock.json` lockfileVersion 3 사용 | `Confirmed` | `package.json`, `package-lock.json` |
| 프론트엔드 build | Vite build와 React 애플리케이션 | `Confirmed` | `package.json`, `vite.config.mjs`, `src/` |
| Python runtime | Node가 `python3 -B`로 DB helper를 실행하지만 버전 제약은 없음 | `Confirmed` / 버전 `Unknown` | `server/*.mjs`, `scripts/*.py` |
| Python 의존성 | `PyMySQL>=1.1,<2` | `Confirmed` | `scripts/requirements.txt` |
| 브라우저 | 사용자 UI 소비에 필요하며 서버 런타임 버전 정책은 없음 | `Confirmed` / 지원 범위 `Unknown` | `src/`, `package.json` |
| Playwright | 사용자 메뉴얼 이미지 생성 도구에 사용 | `Confirmed` | `scripts/generate-user-manual-screenshots.mjs` |
| OS 및 배포 image | 버전 선언 없음 | `Unknown` | 저장소 정적 조사 |

- `.nvmrc`, `.node-version`, `.python-version`, `runtime.txt`, `Dockerfile`은 현재 checkout에서 확인되지 않았다.
- 조사 시스템에 설치된 Node.js 또는 Python 버전은 프로젝트 요구 버전으로 사용하지 않았다.

## 5. 프로세스와 실행 진입점

| 프로세스 | 진입점 | 역할 | 종료·복구 동작 | 상태 |
|---|---|---|---|---|
| 통합 웹 프로세스 | `server.mjs` | API, Vite middleware 또는 정적 파일, SPA fallback 제공 | listen 오류 시 종료; graceful shutdown 미확인 | `Confirmed` |
| Vite 개발 프로세스 | `vite.config.mjs` | 프론트엔드 개발 서버와 제한된 API 제공 | 별도 종료 처리 미확인 | `Confirmed` |
| Python DB helper | `scripts/*.py` | stdin JSON을 받아 DB 조회·변경 후 stdout JSON 반환 | 호출별 child process, timeout 적용 | `Confirmed` |
| 메뉴얼 생성 프로세스 | `scripts/generate-user-manual-screenshots.mjs` | 합성 데이터 기반 화면 이미지 생성 | 애플리케이션 운영 프로세스 아님 | `Confirmed` |
| 메일 발송 프로세스 | 해당 진입점 미확인 | 실제 메일 생성·발송 | 전체 동작 미확인 | `Unknown` |

- Node 서버는 Python helper에 요청별 프로세스를 생성하며 현재 사용자 조회는 10초, 등록 계열은 주로 15초 timeout을 둔다.
- health check, readiness probe, process restart 정책과 무중단 종료 처리는 확인되지 않았다.

## 6. Build-time과 Runtime 구분

| 설정 또는 자산 | Build-time | Runtime | 설명 |
|---|---|---|---|
| `VITE_SITE_URL` | 예 | Vite 시작 시 | `vite.config.mjs`가 host 허용과 HMR 조건을 계산한다. |
| `PORT`, `HOST` | 아니오 | 예 | `server.mjs` listen 주소를 결정한다. |
| `LIVE_RELOAD`, `BUILD_ON_START` | 아니오 | 예 | 통합 서버의 Vite 사용과 시작 build 여부를 결정한다. |
| 데이터 root 설정 | 아니오 | 예 | API 요청 처리 중 파일 탐색 위치를 결정한다. |
| `SENSOR_EXCLUSION_CONFIG_PATH` | 아니오 | 예 | 기본 `config/sensor-exclusions.json` 대신 사용할 App별 sensor 제외 JSON 위치를 지정한다. |
| `DB_INFO_PATH`, `REMOTE_ADDR` | 아니오 | 예 | Python DB helper가 credential 파일과 사용자 주소를 해석한다. |
| `NOTICE_ADMIN_KNOX_IDS` | 아니오 | 예 | 쉼표로 구분한 `knoxId` 목록과 비교해 공지 등록·완료 권한을 판정한다. |
| `dist/` | build 결과 | 정적 모드 입력 | build 결과가 없으면 정적 모드 시작이 실패할 수 있다. |
| `public/` 자산 | build 입력 | 정적 URL | Vite가 template, 이미지 등 공개 자산을 다룬다. |

- 클라이언트 코드에서 `import.meta.env` 소비는 확인되지 않았다.
- `VITE_` 접두 설정은 client bundle 노출 가능성을 전제로 비밀값을 넣지 않아야 한다.

## 7. 설정 로딩과 우선순위

1. Node 프로세스에 주입된 환경변수가 해당 코드 기본값보다 우선한다.
2. Node가 Python child process를 만들 때 기존 환경을 전달하고 `REMOTE_ADDR`를 요청 정보로 덮어쓴다.
3. 환경변수가 없으면 각 모듈의 코드 기본값 또는 `SPIDER_DATA_PATH_TEMPLATES`가 사용된다.
4. 저장소 root의 `notices.env`가 있으면 서버 시작 시 로드하며, 이미 프로세스에 주입된 환경변수는 `notices.env`보다 우선한다.
5. `DB_INFO_PATH`, `MAPPING_CONFIG_PATH`가 가리키는 파일 내용은 파일을 읽는 시점에 적용된다. `SENSOR_EXCLUSION_CONFIG_PATH`의 경로 값은 프로세스 시작 시, 동일 경로의 파일 내용은 API 요청 시 적용된다.
6. 실제 서비스 관리자, shell 또는 배포 플랫폼이 환경변수를 주입하는 방식은 `Unknown`이다.

- 서버는 `server/loadEnv.mjs`에서 저장소 root의 `notices.env`를 로드한다. `notices.env`는 `.gitignore`에 포함되며 Git에 기록하지 않는다.
- Vite 자체 환경 파일 로딩을 운영 설정 주입 방식으로 사용한다는 저장소 근거도 확인되지 않았다.
- 설정 변경 후 hot reload, 프로세스 재시작 또는 재build 중 무엇이 필요한지는 항목별 표의 적용 시점을 따른다.

## 8. 환경변수 레지스트리

| 영역 | 이름 | 용도 | 기본값 또는 fallback | 필수성 | 적용 시점 | 소비 위치 | 비밀 여부 | 누락 시 동작 | 상태 |
|---|---|---|---|---|---|---|---|---|---|
| 서버 | `PORT` | 통합 서버 port | `5173` | 선택 | 프로세스 시작 | `server.mjs:37` | 아니오 | 기본값 사용 | `Confirmed` |
| 서버 | `HOST` | 통합 서버 bind host | `0.0.0.0` | 선택 | 프로세스 시작 | `server.mjs:38` | 아니오 | 기본값 사용 | `Confirmed` |
| 서버 | `LIVE_RELOAD` | Vite middleware 사용 | `"0"` 외 활성 | 선택 | 프로세스 시작 | `server.mjs:40` | 아니오 | 활성 | `Confirmed` |
| 서버 | `BUILD_ON_START` | 정적 모드 시작 build | `"0"` 외 활성 | 조건부 | 프로세스 시작 | `server.mjs:39,65-75` | 아니오 | 활성 | `Confirmed` |
| Vite | `VITE_SITE_URL` | 허용 host와 HMR 조건 | 빈 값 | 선택 | Vite 시작/build | `vite.config.mjs:29-30,129-140` | 아니오 | 조건부 설정 미적용 | `Confirmed` |
| 데이터 | `MAPPING_CONFIG_PATH` | mapping 설정 파일 override | `SPIDER_DATA_PATH_TEMPLATES.mappingConfig` | 선택 | API 요청 | `server/mappingConfig.mjs:5-7` | 경로 주의 | 코드 경로 사용 | `Confirmed` |
| 데이터 | `COMMONALITY_ROOT_PATH` | commonality root override | 코드 경로 template | 선택 | API 요청 | `server/latestCommonalityPath.mjs:9-11` | 경로 주의 | 코드 root 사용 | `Confirmed` |
| 데이터 | `COMMON_COMMONALITY_ROOT_PATH` | 공통부 동일성 root override | 기존 commonality/dashboard root의 형제 `path_common_commonality`, 이후 코드 template | 선택 | 프로세스 시작 | `server/latestCommonCommonalityPath.mjs` | 경로 주의 | 기존 데이터 mount의 형제 경로 사용 | `Confirmed` |
| 데이터 | `SPIDER_DASHBOARD_PATH_ROOT` | dashboard 통계 root override | dashboard template의 상위 경로 | 선택 | API 요청 | `server/dashboardData.mjs:20-22` | 경로 주의 | 코드 root 사용 | `Confirmed` |
| 데이터 | `SENSOR_EXCLUSION_CONFIG_PATH` | 기본 sensor 제외 JSON 경로 override | `config/sensor-exclusions.json` | 선택 | 경로는 프로세스 시작; 내용은 API 요청 | `server/sensorExclusionConfig.mjs` | 경로 주의 | 기본 파일 사용 | `Confirmed` |
| DB | `DB_INFO_PATH` | DB credential pickle 위치 | `/appdata/l0_spider/db_info.pkl` | DB 기능에 조건부 | helper 실행 | `scripts/*.py` | 값 자체는 아니나 민감 경로 | 코드 경로 사용 | `Confirmed` |
| DB | `REMOTE_ADDR` | 현재 사용자 식별용 주소 | 없음 | 현재 사용자 조회에 조건부 | 요청별 helper 실행 | `server/currentUser.mjs:42`, `scripts/current_user.py:15` | 개인정보 주의 | helper 오류 | `Confirmed` |
| 메뉴얼 | `MANUAL_BASE_URL` | 기존 UI 서버 사용 여부 | 코드 기본 loopback URL, port `4173` | 선택 | 도구 시작 | `scripts/generate-user-manual-screenshots.mjs:11-12` | 아니오 | 자체 Vite 시작 | `Confirmed` |
| 메뉴얼 | `PLAYWRIGHT_LD_LIBRARY_PATH` | Playwright 동적 library 경로 보완 | 없음 | 환경별 선택 | 도구 시작 | `scripts/generate-user-manual-screenshots.mjs:19-20` | 경로 주의 | 변경 없음 | `Confirmed` |
| 메뉴얼 | `LD_LIBRARY_PATH` | 기존 동적 library 검색 경로 | 실행 환경 상속 | 환경별 선택 | 도구 시작 | `scripts/generate-user-manual-screenshots.mjs:20` | 경로 주의 | 시스템 기본 사용 | `Confirmed` |

- `REMOTE_ADDR`는 운영자가 직접 설정하는 일반 환경변수가 아니라 Node가 요청별로 Python helper에 전달하는 내부 계약이다.
- HMAC 비밀키와 SMTP 관련 환경변수 이름은 코드에서 확인되지 않았으므로 레지스트리에 가상의 이름을 추가하지 않았다.

## 9. 코드와 환경 예제의 일관성

| 확인 항목 | 코드 상태 | 예제·문서 상태 | 판정 |
|---|---|---|---|
| 서버 listen 설정 | `PORT`, `HOST` 사용 | README에 `PORT` 예시 일부 존재 | `Confirmed` |
| 정적 모드 설정 | `LIVE_RELOAD`, `BUILD_ON_START` 사용 | README에 두 설정 설명 존재 | `Confirmed` |
| 데이터 경로 override | 네 환경변수 사용 | 구조 문서에 이름 기록 | `Confirmed` |
| DB credential 경로 | `DB_INFO_PATH` 사용 | README에 이름 기록 | `Confirmed` |
| 전체 환경변수 예제 | 여러 변수를 코드가 소비 | tracked `.env.example` 없음 | `Mismatch` |
| HMAC 설정 예제 | 구현과 변수 이름 미확인 | 후보 요구만 문서화 | `Unknown` |
| 메일 설정 예제 | 발송 구현과 변수 이름 미확인 | template 자산만 확인 | `Unknown` |

- `.env`가 무시 대상이라는 사실만으로 애플리케이션이 `.env`를 직접 로딩한다고 판단하지 않는다.
- 향후 예제 파일을 만들 때도 실제 값, 내부 host, credential 경로의 민감한 세부값을 복사하지 않는다.

## 10. 네트워크, host와 port

| 연결 | 출발 → 도착 | 설정 | 보안·운영 상태 |
|---|---|---|---|
| 브라우저 UI/API | 브라우저 → 동일 origin `/api/*` | 별도 API base 환경변수 없음 | CORS 설정 미확인, same-origin 전제 `Inferred` |
| 통합 HTTP | 외부 client → Node | `HOST`, `PORT` | TLS와 reverse proxy는 `Unknown` |
| Vite 개발 HTTP | 개발 client → Vite | host 전체, port `3000` | 허용 host 일부가 코드에 고정됨 |
| DB | Python helper → DB host/port | credential 파일 내부 key | 실제 endpoint와 TLS는 `Unknown` |
| browser 외부 자산 | 브라우저 → 외부 font 제공자 | CSS 참조 | 운영망 허용 정책 `Unknown`, `Risk` |

- Vite 설정과 Home 화면에는 내부 서비스 host 또는 URL이 코드에 고정된 위치가 있다.
- 실제 값은 `<redacted>`로 취급하며, 설정 분리와 접근 통제 여부는 후속 보안 문서에서 확인한다.
- CORS header, 인증 proxy, TLS 인증서, firewall, load balancer와 health endpoint는 확인되지 않았다.
- port 충돌 사전 검사는 없고 통합 서버는 `EADDRINUSE`를 별도로 보고한 뒤 종료한다.

## 11. 파일시스템과 운영 데이터

| 영역 | 경로 결정 방식 | 접근 형태 | 누락·오류 동작 | 상태 |
|---|---|---|---|---|
| dashboard 통계 | `SPIDER_DASHBOARD_PATH_ROOT` 또는 코드 template | directory·Parquet 읽기 | API 오류 또는 빈 구조는 함수별 상이 | `Confirmed` |
| mapping 설정 | `MAPPING_CONFIG_PATH` 또는 코드 template | UTF-8 JSON 읽기 | 읽기·파싱 실패 시 API `500` | `Confirmed` |
| sensor 제외 설정 | 기본 `config/sensor-exclusions.json`; `SENSOR_EXCLUSION_CONFIG_PATH`는 선택적 override | UTF-8 JSON 읽기·mtime/size cache | 최초 읽기 실패 시 오류 log와 빈 규칙; 정상 로드 후 잘못된 변경은 마지막 정상값 유지 | `Confirmed` |
| commonality image | `COMMONALITY_ROOT_PATH` 또는 코드 template | directory·PNG 읽기 | 최신 날짜 없음 `404`, 기타 오류 `500` | `Confirmed` |
| common-commonality data·image | `COMMON_COMMONALITY_ROOT_PATH`, 기존 데이터 root의 형제 경로 또는 코드 template | directory·PNG 읽기 | data API의 최신 날짜·SDWT 없음 `404`; image API의 경로 탐색 오류 `500` | `Confirmed` |
| self equipment | 코드에 정의된 ERD·backup·common root | Parquet·PNG 읽기 | endpoint별 오류 또는 빈 응답 | `Confirmed` |
| DB credential | `DB_INFO_PATH` 또는 코드 기본 경로 | pickle 읽기 | helper 오류 | `Confirmed` |

- 경로 패턴은 `src/config/spiderDataPaths.mjs`가 중심 근거지만 모든 root가 환경변수로 분리된 것은 아니다.
- 실제 `/appdata`의 존재, 권한, owner, mount, 용량, 보존과 백업 정책은 조사하지 않아 `Unknown`이다.
- Node 코드에서 운영 데이터 파일을 쓰거나 삭제하는 동작은 확인되지 않았다.
- 일부 API 오류 응답이 내부 source path를 포함할 수 있어 정보 노출 `Risk`가 있다.

## 12. DB 환경

- Python helper는 `DB_INFO_PATH`가 가리키는 pickle에서 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` key를 읽는다.
- 실제 값과 실제 파일은 확인하지 않았으며 문서에도 기록하지 않는다.
- 연결은 `PyMySQL`과 `charset="utf8"`을 사용하고 helper 호출마다 열고 닫는다.
- connection pool, 명시적 connect/read/write timeout, TLS option은 확인되지 않았다.
- 조회뿐 아니라 등록·이력 저장과 `commit()`이 존재하며, `my_eqp_registration.py`에는 runtime `ALTER TABLE` 가능성이 있다.
- 최소 권한, schema migration 책임, 운영 DB별 계정 분리와 DDL 허용 정책은 `Unknown`이며 권한 과다 `Risk`가 있다.
- 현재 사용자 식별은 proxy 관련 header와 socket 주소로부터 만든 `REMOTE_ADDR`에 의존한다.
- 신뢰할 proxy 범위와 header 위조 방지 설정은 저장소에서 확인되지 않아 `Risk`이다.

## 13. 네 가지 필수 영역의 환경 의존성

### 13.1 데이터 경로와 화면 연결

- 화면의 상대 `/api/*` 요청은 Node 또는 Vite handler를 거쳐 코드 경로 template과 네 data-root override를 사용한다.
- mapping, dashboard, commonality는 일부 override가 가능하지만 self equipment의 주요 root는 코드에 고정되어 있다.
- 읽기 권한, mount 준비, 데이터 생성 주체와 운영별 경로 차이는 `Unknown`이다.

### 13.2 대시보드 API

- `/api/dashboard-data`는 `SPIDER_DASHBOARD_PATH_ROOT` 또는 코드 기본 root를 사용하며 설정은 request-time에 영향을 준다.
- root가 없거나 읽을 수 없으면 handler 오류로 이어지며 startup readiness 검증은 확인되지 않았다.
- Vite 단독 모드에도 같은 경로의 handler가 있지만 통합 서버와 모든 API 범위가 동일하지 않다.

### 13.3 STEP 딥링크와 HMAC

- `/self-equipment`의 `step=ALL`과 `eqpCh` 소비는 확인됐지만 환경변수 의존성은 확인되지 않았다.
- 개별 STEP HMAC 생성·검증, 비밀키 이름, 알고리즘 설정, 키 누락과 rotation 동작은 모두 `Unknown`이다.
- 실제 HMAC key를 client-visible `VITE_*`, 문서, fixture 또는 보고서에 두어서는 안 된다.

### 13.4 메일 생성 및 발송

- `public/mailing-report.html`과 template 변수는 확인됐지만 실제 renderer, scheduler, sender 프로세스는 확인되지 않았다.
- SMTP/API endpoint, 인증, sender, 수신자, enable flag, timeout과 retry 환경변수도 `Unknown`이다.
- `spider_base_url`은 template 변수이며 확인된 process environment variable이 아니다.
- Core Harness의 local·test 검증은 실제 발송을 기본 차단해야 하지만 현재 차단 설정 구현은 확인되지 않았다.

## 14. 로그, 임시 파일과 쓰기 경로

| 대상 | 확인된 위치·방식 | 보존·정리 | 상태 |
|---|---|---|---|
| 애플리케이션 log | `console`과 process stdout/stderr | rotation·retention 미확인 | `Confirmed` / 정책 `Unknown` |
| 정적 build | `dist/` | Git ignored, 정리 정책 미확인 | `Confirmed` |
| 메뉴얼 이미지 | `docs/user-manual/images/` | 도구가 tracked 문서 자산 생성 | `Confirmed` |
| runtime cache | Node·React Query의 memory | 프로세스 종료 시 소멸 | `Confirmed` |
| upload·temp | 파일 기반 upload나 temp 출력 미확인 | 해당 없음 또는 `Unknown` | `Unknown` |
| 운영 write | DB 등록·이력·DDL | DB 정책 미확인 | `Confirmed` / `Risk` |

- app log file, journal 연계, 중앙 log collector, 민감정보 masking과 disk quota는 확인되지 않았다.
- API 오류와 child process stderr에 내부 경로나 DB 오류가 포함될 가능성이 있어 운영 log 접근 통제가 필요하다.

## 15. 시간, 날짜, locale과 encoding

- dashboard와 latest commonality의 날짜 filename 처리는 `Date.UTC`와 ISO 날짜를 사용한다.
- 사용자 클릭 시각은 여러 화면에서 `new Date().toISOString()`으로 생성되어 UTC 형식이다.
- My EQP 활성 조건은 DB `NOW()`를 사용하므로 DB timezone 설정의 영향을 받지만 실제 timezone은 `Unknown`이다.
- zone 없는 날짜·시각 문자열을 `Date.parse` 또는 `Date`로 처리하는 위치는 runtime timezone 영향을 받을 수 있어 `Risk`이다.
- 저장소에서 `TZ` 설정이나 서버·DB timezone 일치 규칙은 확인되지 않았다.
- 표시에는 `ko-KR`, `ko`, `en-US`가 명시된 위치와 기본 locale을 쓰는 위치가 함께 존재한다.
- HTTP, template과 JSON은 UTF-8 사용 근거가 있으며 Python JSON은 `ensure_ascii=False`를 사용한다.
- DB 연결 charset은 `utf8`이고 collation과 `utf8mb4` 적용 여부는 `Unknown`이다.
- 메일 집계 기준 timezone과 발송 schedule timezone은 `Unknown`이다.

## 16. Build와 정적 자산

- `npm run build`는 `vite build`를 실행하며 별도 `outDir` 설정이 없어 `dist/`를 전제로 한다.
- 통합 정적 모드는 `dist/index.html` 존재를 검사하고 정적 파일 및 SPA fallback을 제공한다.
- `BUILD_ON_START=0`인데 `dist/index.html`이 없으면 시작할 수 없다.
- `public/`에는 메일 template과 공개 자산이 있으며 build 시 공개 URL로 배치되는 전제를 가진다.
- Vite `base`, source map, asset host와 cache header의 명시적 설정은 확인되지 않았다.
- build 재현성을 위한 Node 버전, CI build image와 artifact provenance는 `Unknown`이다.

## 17. 프로세스 관리자와 배포

- tracked systemd unit, Dockerfile, compose, reverse proxy 설정, Procfile, CI workflow는 확인되지 않았다.
- 실제 서비스 실행 user, working directory, environment injection, restart policy와 resource limit은 `Unknown`이다.
- TLS 종료, domain, proxy header 정규화, log 수집과 health monitoring도 `Unknown`이다.
- `server.mjs`는 listen 오류를 처리하지만 `SIGTERM`/`SIGINT` graceful shutdown handler는 확인되지 않았다.

## 18. 시작 전제조건

| 전제조건 | 적용 모드 | 실패 시점 | 상태 |
|---|---|---|---|
| 설치된 npm 의존성 | 모든 JS 모드 | 프로세스 또는 build 시작 | `Confirmed` |
| 호환 Node.js | 모든 JS 모드 | 실행 시작 | 필요성 `Confirmed`, 버전 `Unknown` |
| Python 3와 PyMySQL | DB 기능 | DB helper 요청 | `Confirmed` |
| 사용 가능한 listen port | 서버 모드 | listen 시작 | `Confirmed` |
| 읽기 가능한 데이터 root와 mapping | 관련 API | 요청 처리 | `Confirmed` |
| 읽기 가능한 DB credential과 DB 연결 | DB 기능 | 요청 처리 | `Confirmed` |
| 유효한 `dist/index.html` | 정적 모드, startup build 비활성 | 서버 시작 | `Confirmed` |
| build 도구와 쓰기 가능한 `dist/` | 정적 모드, startup build 활성 | 서버 시작 | `Confirmed` |
| HMAC key | 개별 STEP token 기능 후보 | 확인 불가 | `Unknown` |
| 메일 credential·endpoint | 실제 발송 후보 | 확인 불가 | `Unknown` |

- 데이터와 DB 준비 상태를 시작 시 일괄 검사하는 readiness 절차는 확인되지 않았다.

## 19. 환경 비교 행렬

| 항목 | Vite 단독 | 통합 live reload | 통합 정적 제공 |
|---|---|---|---|
| 기본 port | `3000` | `5173` | `5173` |
| 설정 위치 | `vite.config.mjs` | `server.mjs` | `server.mjs` |
| 프론트엔드 제공 | Vite dev | Vite middleware | `dist/` |
| full API | 아니오 | 예 | 예 |
| 시작 build | 아니오 | 아니오 | 기본 예, `BUILD_ON_START=0`이면 생략 |
| HMR | 예 | 예 | 아니오 |
| 운영 적합성 | 확인하지 않음 | 확인하지 않음 | 확인하지 않음 |

- 이 행렬은 현재 `main`에서 정적으로 확인한 모드만 비교하며 환경 이름을 임의로 부여하지 않는다.
- `mock-agent` 실행 환경은 조사 범위 밖이므로 비교 행렬에 포함하지 않는다.

## 20. 비밀정보와 신뢰 경계

- DB credential 파일과 그 내부 값은 server-side 전용이며 Git과 client bundle에 포함하지 않는다.
- 실제 `.env`, HMAC key, token, email 주소, 인증서와 내부 endpoint를 문서·fixture·보고서에 복사하지 않는다.
- `VITE_*`는 client 노출 가능 영역이므로 비밀정보 저장소로 사용하지 않는다.
- browser → proxy → Node의 주소 전달 경계에서 신뢰할 proxy와 forwarded header 정책이 필요하다.
- Node → Python child process 경계에서는 필요한 환경만 전달하고 stderr·오류 응답의 민감정보를 제한해야 한다.
- Node/Python → `/appdata`와 DB 경계에는 최소 파일권한과 최소 DB 권한이 필요하다.
- secret manager, key rotation, credential 교체 절차와 접근 감사는 현재 `Unknown`이다.

## 21. Core Harness와 mock 브랜치 경계

- 실제 시스템과 Core Harness의 기준은 `main`이다.
- mock 서버, mock API, mock DB·data, UI 구동 fixture, mock script와 mock 의존 integration·E2E는 `mock-agent` 전용이다.
- `main`의 코드, 문서, build와 검증은 `mock-agent`에 의존하지 않는다.
- 공유 기준은 API 계약, 시스템 문서와 기능 정의이며 동기화 방향은 기본적으로 `main → mock-agent`이다.
- mock 구현 자체는 `main` 병합 대상이 아니다.
- 이번 조사에서 `mock-agent`를 checkout하거나 파일을 확인하지 않았으므로 구현과 환경은 `Out of Scope`이다.
- 현재 `main`에 mock 환경이 없는 것은 `Mismatch`나 미완성으로 판정하지 않는다.

## 22. 확인된 Mismatch

| ID | 불일치 | 영향 | 근거 |
|---|---|---|---|
| ENV-M01 | 코드가 여러 환경변수를 소비하지만 tracked `.env.example`이 없다. | 설정 이름, 안전한 예시와 필수성 전달이 분산된다. | `.gitignore`, `server.mjs`, `server/*.mjs`, `scripts/*.py` |
| ENV-M02 | Vite 단독 서버와 통합 Node 서버의 API route 범위가 다르다. | `npm run dev`에서 일부 화면 기능이 통합 모드와 다르게 동작할 수 있다. | `vite.config.mjs`, `server.mjs` |
| ENV-M03 | 프로젝트 후보인 개별 STEP HMAC의 key·생성·검증 환경 계약이 현재 코드에서 확인되지 않는다. | 딥링크 보안과 환경 이관 조건을 정의할 수 없다. | `AGENTS.md`, STEP 관련 코드 검색 결과 |

- hard-coded data root와 내부 service URL은 설정 유연성과 노출 문제의 `Risk`로 분류하며, 확인된 계약과 충돌한다는 근거가 없어 `Mismatch`로 단정하지 않는다.
- 메일 발송 설정 부재는 실제 sender 구현 자체가 확인되지 않아 `Unknown`으로 유지한다.

## 23. Unknown과 Risk

### 주요 Unknown

- 실제 운영 실행 모드, service manager, 실행 user, working directory와 환경 주입 방식
- 요구 Node.js·Python·브라우저·OS 버전과 patch 정책
- 실제 host, port, TLS, reverse proxy, network ACL과 health check
- `/appdata` mount, owner, 권한, 용량, 보존, backup과 생성 주체
- DB 환경 분리, TLS, timeout, 최소 권한, migration과 timezone
- HMAC key 이름, 저장 위치, 알고리즘, 누락·rotation·만료 동작
- 메일 sender, scheduler, credential, endpoint, enable flag, timeout, retry와 timezone
- log 수집, rotation, retention, masking과 alert 기준

### 주요 Risk

- 내부 host와 service URL 및 일부 data root가 코드에 고정되어 환경 이관과 정보 노출에 영향을 줄 수 있다.
- 오류 응답과 child process 오류가 내부 경로 또는 DB 세부정보를 노출할 수 있다.
- proxy header 신뢰 정책이 확인되지 않아 사용자 주소 기반 식별의 위조 가능성을 평가할 수 없다.
- DB helper 계정이 runtime DDL을 수행할 수 있어 최소 권한 위반 가능성이 있다.
- startup readiness가 없어 데이터 root와 DB 장애가 첫 요청 시 드러날 수 있다.
- timezone과 locale이 명시되지 않은 parsing·표시 위치는 환경별 결과 차이를 만들 수 있다.
- 실제 메일 발송 차단 장치가 확인되지 않아 sender가 추가될 때 안전한 기본값이 필요하다.

## 24. 후속 문서와 책임 분리

| 주제 | 기준 문서 또는 산출물 | 이 문서와의 관계 |
|---|---|---|
| 시스템 구성과 경계 | `docs/system/architecture.md` | process·component 관계의 기준 |
| 화면부터 데이터까지 | 향후 `docs/system/data-flow.md` | 환경별 경로 해석을 상세 연결 |
| 배포 절차 | 향후 `docs/system/deployment.md` | service manager, build, rollout, rollback 정의 |
| 보안 | 향후 `docs/system/security.md` | secret, proxy trust, 권한과 masking 정의 |
| 기능별 환경 의존성 | 향후 `docs/features/*.md` | dashboard, STEP/HMAC, mailing 계약 상세화 |
| 운영 절차 | 향후 `docs/operations/` | startup, 점검, 장애·backup·restore 절차 |
| 환경 예제 | 향후 별도 승인 범위 | 비밀값 없는 이름과 안전한 placeholder 제공 |

- 후속 문서는 이 문서의 `Unknown`을 근거 없이 확정하지 않고 재현 가능한 검증 또는 운영자 확인으로 갱신한다.
- 환경 설정 변경 시 코드, 계약, 문서와 운영 영향의 동시 검토가 필요하다.

## 25. 근거

| 중요도 | 경로 | 사용 근거 |
|---|---|---|
| 1 | `server.mjs` | 통합 서버, listen 기본값, live/static 모드, route와 child process |
| 2 | `vite.config.mjs` | Vite 단독 mode, port, host, HMR와 제한된 API |
| 3 | `server/dashboardData.mjs` | dashboard root override와 날짜·파일 처리 |
| 4 | `server/latestCommonalityPath.mjs` | commonality root와 최신 날짜 선택 |
| 5 | `server/mappingConfig.mjs` | mapping 경로 override와 오류 처리 |
| 6 | `src/config/spiderDataPaths.mjs` | 운영 데이터 경로 pattern의 코드 기준 |
| 7 | `server/currentUser.mjs`, `scripts/*.py` | Python 실행, `REMOTE_ADDR`, DB credential·연결 |
| 8 | `package.json`, `package-lock.json` | 실행 script, build 도구와 package manager |
| 9 | `scripts/requirements.txt` | Python 의존성 |
| 10 | `scripts/generate-user-manual-screenshots.mjs` | 선택적 Playwright 도구 환경 |
| 11 | `.gitignore` | 환경·credential·build·log 제외 정책 |
| 12 | `public/mailing-report.html` | 메일 template 자산과 변수 |
| 13 | `README.md`, `web_structure.md` | 기존 실행·환경 설명 비교 |
| 14 | `reports/audit/system-inventory.md` | 현재 checkout의 근거 인덱스 |
| 15 | `docs/system/overview.md`, `docs/system/architecture.md` | 시스템 범위와 구조 기준 |

- 근거는 현재 checkout의 정적 조사 결과이며 실제 운영 상태를 재현한 결과가 아니다.
- 애플리케이션, build, test, DB, 메일, `/appdata`, systemd와 Docker는 실행하거나 접근하지 않았다.

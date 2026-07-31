# L0 Spider 시스템 인벤토리

## 1. 조사 개요

- 조사 목적: 현재 `main` checkout의 코드, 문서, 설정, 화면, API, 데이터 경로 참조, HMAC, 메일과 Core 검증 자산을 후속 시스템 문서 작성용 근거 인덱스로 정리한다.
- 조사 범위: 현재 checkout된 저장소 내부의 추적 파일과 작업 시작 전 존재하던 루트 `AGENTS.md`를 정적으로 확인했다.
- 제외 범위: 생성물·캐시·외부 패키지, 실제 `/appdata`, 운영 DB, 외부 API, 실행 중 서비스 및 저장소 밖 자료는 조사하지 않았다.
- 저장소 루트: `/home/arod/project_codex/l0_spider/l0_spider`
- 브랜치: `main`
- commit: `6cf9568`
- 조사 시점: 2026-07-31 11:35 KST
- 작업 시작 상태: `?? AGENTS.md`
- 기존 사용자 변경사항: 루트 `AGENTS.md`가 작업 시작 전부터 untracked 상태였으며 읽기만 하고 수정하지 않았다.
- 브랜치 경계: 저장소 소유자 확인에 따라 실제 시스템과 Core Harness는 `main`, mock 실행·브라우저 검증은 `mock-agent` 범위다. 기본 동기화 방향은 `main → mock-agent`이며 mock 구현은 `main` 병합 대상이 아니다.
- 외부 브랜치 조사: `mock-agent`를 checkout하거나 파일·기능·테스트 결과를 조사하지 않았다. 이 보고서의 `Confirmed`는 현재 `main` checkout 근거에만 적용된다.
- 실행하지 않은 작업: 애플리케이션·서버·테스트·빌드·컨테이너 실행, 패키지 설치, DB 접속, 메일 발송, 외부 통신, `/appdata` 순회 및 systemd 제어를 모두 수행하지 않았다.

## 2. 판정 기준

- `Confirmed`: 현재 코드, 설정 또는 재현 가능한 저장소 근거로 확인했다.
- `Documented`: 기존 문서에만 기록되어 있고 현재 조사에서 실행 또는 구현으로 확인하지 못했다.
- `Inferred`: 코드 구조나 식별자를 근거로 추정했으나 전체 흐름을 확인하지 못했다.
- `Unknown`: 현재 저장소 자료로 확인할 수 없다.
- `Mismatch`: 코드, 설정 또는 문서 사이에 확인 가능한 차이가 있다.
- `Risk`: 즉시 결함으로 단정하지 않지만 운영 안전, 비밀정보 또는 계약 관점의 후속 조사가 필요하다.
- `External Branch`: 저장소 소유자가 별도 브랜치 범위로 확정한 항목이다.
- `Out of Scope`: 이번 `main` 정적 조사에서 확인하거나 완료 기준으로 평가하지 않는 항목이다.

이번 결과는 정적 조사 결과다. 실제 운영 데이터 존재 여부와 런타임 성공 여부는 확인하지 않았다.

## 3. 기존 자료 인벤토리

| 분류 | 경로 | 형식 | 상태 | 주요 내용 | 관련 영역 |
|---|---|---|---|---|---|
| 프로젝트 공통 지침 | `AGENTS.md` | Markdown | Confirmed | 사실 판정, 하네스 목표, 네 필수 영역, 운영 안전 및 변경 절차 | 전체 시스템 |
| 프로젝트 소개·실행 안내 | `README.md` | Markdown | Confirmed | React/Vite 실행, 통합 서버, DB와 데이터 경로 및 기능 규칙 | 전체 시스템, 운영 |
| 시스템 구조 문서 | `web_structure.md` | Markdown/Mermaid | Confirmed | SPA→Node→파일/DB 흐름, 화면·API·경로·DB 표, 현재 주의점 | 전체 시스템 |
| 사용자 메뉴얼 | `docs/user-manual/USER_MANUAL.md` | Markdown | Confirmed | 화면 사용법, 필터, 등록, 메일, 오류 안내 | 전체 시스템, 메일 |
| 사용자 화면 자료 | `docs/user-manual/images/*.png` | PNG 11개 | Confirmed | 메인, 자설비, 동일성, 공통부, 메뉴얼 화면 이미지 | 사용자 화면 |
| 메일 템플릿 | `public/mailing-report.html` | Jinja 호환 HTML | Confirmed | KPI, 전체설비/My EQP 표, 수신인 필터 및 딥링크 변수 | 대시보드, STEP/HMAC, 메일 |
| 과거 화면 버전 안내 | `src/features/fdc-trend/pages/versions/README.md` | Markdown | Confirmed | `.bak` 화면 소스의 보관 목적 | 개발 자료 |
| Node manifest | `package.json`, `package-lock.json` | JSON | Confirmed | npm script와 JavaScript 의존성 | 전체 시스템, 테스트/mock |
| Python 의존성 | `scripts/requirements.txt` | Text | Confirmed | `PyMySQL>=1.1,<2` 선언 | DB, 운영 |
| UI·빌드 설정 | `vite.config.mjs`, `components.json`, `jsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs` | JS/JSON | Confirmed | Vite, alias, shadcn 스타일, Tailwind/PostCSS, lint | 프론트엔드, 배포 |
| Core 환경변수 예제 | `.env.example` | 해당 없음 | Unknown | 현재 `main`에서 발견하지 못함 | 환경 |
| mock 환경변수 예제 | `.env.mock.example` | 외부 브랜치 | External Branch / Out of Scope | `mock-agent` 전용 범위이며 이번 조사에서 확인하지 않음 | 테스트/mock |
| Docker·systemd·CI | `Dockerfile*`, Compose, `*.service`, `.github/workflows/*` | 해당 없음 | Unknown | 저장소에서 발견하지 못함 | 배포, 운영 |
| 실행·화면 캡처 스크립트 | `server.mjs`, `scripts/generate-user-manual-screenshots.mjs` | JavaScript | Confirmed | 통합 서버 및 Playwright 기반 메뉴얼 캡처 진입점 | 운영, 테스트/mock |
| 기존 Core 자동 테스트 | `server/*.test.mjs`, `src/**/*.test.mjs`, `scripts/*_test.py` | JavaScript/Python | Confirmed | 현재 `main`의 Node 22개, Python 2개 테스트 파일 | 테스트 |
| Mock Validation Extension | `mock-agent` 브랜치 | 외부 브랜치 | External Branch / Out of Scope | mock 서버·데이터·스크립트·E2E는 전용 브랜치 범위이며 미조사 | 테스트/mock |
| 과거 감사 보고서 | `reports/audit/*` | 해당 없음 | Unknown | 이번 파일 생성 전 기존 감사 보고서를 발견하지 못함 | 전체 시스템 |
| 구조용 바이너리 문서 | 저장소 내 PDF/DOCX/PPT | 해당 없음 | Unknown | 발견하지 못함 | 전체 시스템 |

## 4. 저장소 및 애플리케이션 구조

### 4.1 주요 구조

| 영역 | 주요 경로 | 진입점 또는 대표 식별자 | 확인된 역할 | 상태 | 근거 |
|---|---|---|---|---|---|
| 브라우저 진입점 | `src/main.jsx` | `createRoot` | 전역 Provider와 router를 마운트하는 SPA 시작점 | Confirmed | `src/main.jsx`; `src/routes/router.jsx:13-18` |
| 프론트엔드 라우트 | `src/routes/`, `src/features/fdc-trend/routes.jsx` | `router`, `fdcTrendRoutes` | `/`와 `/fdc_trend` 아래 화면 라우팅 | Confirmed | `src/features/fdc-trend/routes.jsx:11-67` |
| 기능 화면 | `src/features/fdc-trend/pages/` | 각 `*Page` | 대시보드, 자설비, 등록, 동일성, 공통부, 메뉴얼 UI | Confirmed | `src/features/fdc-trend/routes.jsx:1-55` |
| 기능 컴포넌트 | `src/features/fdc-trend/components/` | `FdcTrendShell`, `LineAnomalyDashboard` | 공통 Shell과 대시보드 표시 | Confirmed | `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:50-52,326-340` |
| 브라우저 API 계층 | `src/features/fdc-trend/api/` | `fetch*`, `create*`, `delete*` | `/api/*` 요청, 일부 응답 형식 검사와 오류 정규화 | Confirmed | `src/features/fdc-trend/api/dashboardApi.js:3-31`; 각 API 모듈 |
| 공통 UI·상태 | `src/components/`, `src/lib/`, `src/styles/` | `AppProviders`, `createQueryClient` | UI primitive, TanStack Query, theme, style | Confirmed | `src/components/common/AppProviders.jsx`; `src/lib/queryClient.js` |
| 데이터 경로 기준 | `src/config/spiderDataPaths.mjs` | `SPIDER_DATA_PATH_TEMPLATES` | 운영 파일 경로 패턴과 대시보드 컬럼 정의 | Confirmed | `src/config/spiderDataPaths.mjs:1-29` |
| 통합 서버 | `server.mjs` | Node `createServer` | 전체 API 라우팅, Vite middleware 또는 `dist` 제공 | Confirmed | `server.mjs:1-40,131-304` |
| 서버 기능 모듈 | `server/*.mjs` | `handle*Request` | 요청 검증, Parquet 집계, 이미지 제공, DB helper 호출 | Confirmed | `server.mjs:9-33`; `server.mjs:134-260` |
| 파일 데이터 접근 | `server/dashboardData.mjs`, `server/selfEquipmentData.mjs`, `server/commonalityData.mjs`, `server/commonAnomalyData.mjs` | `getDashboardSummary`, `read*Rows` | hyparquet 및 파일시스템 API로 저장소 밖 운영 경로를 읽는 코드 | Confirmed | 각 모듈 import 및 handler |
| DB 접근 계층 | `scripts/*.py` | `load_db_info`, 각 SQL 함수 | `DB_INFO_PATH`의 pickle을 읽고 PyMySQL로 업무 DB 접근 | Confirmed | `scripts/current_user.py:21-58`; `scripts/mailing_registration.py:17-39` |
| 메일 등록 계층 | `server/mailingRegistration.mjs`, `scripts/mailing_registration.py` | `handleMailingRegistrationRequest` | 메일 수신 조건을 `email` 테이블에 조회·저장·삭제 | Confirmed | `server/mailingRegistration.mjs:112-217`; `scripts/mailing_registration.py:153-228` |
| 메일 본문 자산 | `public/mailing-report.html` | Jinja 변수와 `rows` loop | 외부 렌더러가 소비하도록 작성된 HTML 템플릿 | Confirmed | `public/mailing-report.html:20-80,180-245` |
| 정적 리소스 | `public/`, `docs/user-manual/images/` | `logo.png`, 메뉴얼 PNG | 로고, 메일 템플릿, 메뉴얼 화면 자료 | Confirmed | 저장소 파일 목록 |
| 현재 main의 synthetic 자산 | `scripts/generate-user-manual-screenshots.mjs`, `src/features/fdc-trend/utils/fdcTrendMockData.js` | `installApiFixtures`, prototype data | 메뉴얼 캡처용 route fixture와 prototype fallback이며 `mock-agent` 환경과 동일하다고 보지 않음 | Confirmed | `scripts/generate-user-manual-screenshots.mjs:266-285`; `web_structure.md:663` |
| 배포 정의 | 저장소 내 Docker/systemd/reverse proxy 설정 | 해당 없음 | 구체적인 운영 배포 단위는 확인하지 못함 | Unknown | 제한 검색 결과 없음 |

### 4.2 확인된 기술

- React 19와 React DOM은 manifest에 선언되고 화면 코드에서 사용된다. 근거: `package.json:44-49`, `src/main.jsx`.
- Vite 6과 React plugin은 manifest와 설정에서 사용된다. 근거: `package.json:61,70`, `vite.config.mjs:1-2,118-145`.
- TanStack React Query는 manifest와 주요 페이지에서 사용된다. 근거: `package.json:29`, `src/features/fdc-trend/components/LineAnomalyDashboard.jsx:331-340`.
- Radix UI, Tailwind CSS 4, Recharts, Lucide React는 의존성으로 선언되어 있고 관련 컴포넌트 import가 존재한다. 근거: `package.json:15-27,38,51,68`, `components.json:1-43`.
- hyparquet와 `hyparquet-compressors`는 서버의 Parquet 읽기에 사용된다. 근거: `package.json:36-37`, `server/selfEquipmentData.mjs:4-5`.
- Playwright는 devDependency이고 메뉴얼 캡처 스크립트에서 `chromium`을 import한다. 근거: `package.json:67`, `scripts/generate-user-manual-screenshots.mjs:7`.
- Python은 DB helper 실행에 필요하지만 Python 버전 선언은 발견하지 못했다. 근거: `server/currentUser.mjs:41-43`, `scripts/requirements.txt:1`.

## 5. 사용자 화면과 라우트

같은 child route가 기본 prefix와 `/fdc_trend` prefix에 등록된다. 아래에는 기본 route를 우선 표시한다.

| 화면 | 브라우저 라우트 | 컴포넌트 | API 또는 조회 함수 | 사용자 자료 | 상태 | 근거 |
|---|---|---|---|---|---|---|
| SPIDER 메인·대시보드 | `/`, `/fdc_trend` | `L0SpiderHomePage`, `LineAnomalyDashboard` | `fetchDashboardSummary` → `/api/dashboard-data` | 매뉴얼 2장, 이미지 `01`, `02` | Confirmed | `routes.jsx:11-15,58-67`; `L0SpiderHomePage.jsx:181-188`; `LineAnomalyDashboard.jsx:326-340` |
| 자설비·MY EQP·SKIP LIST | `/self-equipment`, `/fdc_trend/self-equipment` | `FdcTrendPage` | mapping/current user/self equipment/My EQP/pass/hit/click/scatter/file APIs | 매뉴얼 4장, 이미지 `03`~`07` | Confirmed | `routes.jsx:16-19`; `FdcTrendPage.jsx:1440-1598` |
| Mailing·My EQP 등록 | `/registration`; alias `/my-eqp`, `/recipients` | `RegistrationHubPage` 내부 두 등록 page | mapping/current user/reference/registration APIs | 매뉴얼 5장 | Confirmed | `routes.jsx:20-27,40-43`; `RegistrationHubPage.jsx:55-59` |
| 동일성 이상감지 | `/matching-anomaly` | `CommonalityAnomalyPage` | mapping, `/api/commonality-data`, image, click history | 매뉴얼 6.1, 이미지 `08` | Confirmed | `routes.jsx:28-31`; `CommonalityAnomalyPage.jsx:214-245` |
| 공통부 이상감지 | `/common-anomaly` | `CommonAnomalyPage` | mapping/current user/common anomaly/pass history/scatter/image/click history | 매뉴얼 6.2, 이미지 `09`, `10` | Confirmed | `routes.jsx:32-35`; `CommonAnomalyPage.jsx:288-352` |
| 사용자 메뉴얼 | `/manual` | `UserManualPage` | `USER_MANUAL.md?raw`, image glob; 서버 API 없음 | 자기 자신, 이미지 `15` | Confirmed | `routes.jsx:36-39`; `UserManualPage.jsx:10-25,38-56` |
| 내부 prototype 화면 | `/defect-spider`, `/l1-spider`, `/l3-spider` | `SpiderFeaturePage` | 주로 local prototype/mock 상태 | 메뉴 카드는 별도 서비스로 이동하며 직접 route의 운영 의도는 미확인 | Unknown | `routes.jsx:44-55`; `USER_MANUAL.md:35`; `web_structure.md:663` |

별도 로그인 route는 없다. 현재 사용자 식별은 일부 기능에서 접속 IP를 `/api/current-user`로 조회한다. 프록시 헤더 신뢰와 실제 인증·인가 정책은 후속 확인이 필요하다. 근거: `server/currentUser.mjs:17-29,102-120`.

## 6. 주요 API 및 서버 진입점

| 메서드 | 경로 | 핸들러 | 주요 데이터 소스 | 프론트엔드 소비 위치 | 상태 | 근거 |
|---|---|---|---|---|---|---|
| GET, HEAD | `/api/dashboard-data` | `handleDashboardDataRequest` | dashboard detail/stats Parquet, mapping JSON | `dashboardApi.js`, 메인·대시보드 | Confirmed | `server.mjs:134-139`; `dashboardData.mjs:712-825` |
| GET | `/api/current-user` | `handleCurrentUserRequest` | `v_ipms_ip_info`, `user_info` | 자설비·등록·공통부 | Confirmed | `server.mjs:141-146`; `currentUser.mjs:102-120` |
| POST | `/api/hit-history` | `handleHitHistoryRequest` | `hit_history` | 자설비 이력저장 | Confirmed | `server.mjs:148-153`; `hitHistoryApi.js:4` |
| POST | `/api/clicked-category-history` | `handleClickedCategoryHistoryRequest` | `clicked_category_history` | 자설비·동일성·공통부 최종 필터 | Confirmed | `server.mjs:155-160`; `clickedCategoryHistoryApi.js:12` |
| GET, HEAD | `/api/latest-commonality-path` | `handleLatestCommonalityPathRequest` | 동일성 최신 일시 디렉터리명 | `latestCommonalityPathApi.js` | Confirmed | `server.mjs:162-167`; `latestCommonalityPath.mjs:36-89` |
| GET | `/api/commonality-data` | `handleCommonalityDataRequest` | `erd_commonality` 디렉터리 구조 | `CommonalityAnomalyPage` | Confirmed | `server.mjs:169-174`; `commonalityData.mjs:225-253` |
| GET, HEAD | `/api/commonality-image` | `handleCommonalityImageRequest` | 허용된 `img.png` | `commonalityApi.js` | Confirmed | `server.mjs:195-200`; `commonalityData.mjs:256-290` |
| GET | `/api/common-anomaly-data` | `handleCommonAnomalyDataRequest` | `path_common/.../df_path.parquet`, pass history | `CommonAnomalyPage` | Confirmed | `server.mjs:176-181`; `commonAnomalyData.mjs:355-386` |
| GET | `/api/common-anomaly-scatter-data` | `handleCommonAnomalyScatterRequest` | common `data.parquet` | `CommonAnomalyPage` | Confirmed | `server.mjs:183-188`; `commonAnomalyData.mjs:569-615` |
| GET, HEAD | `/api/common-anomaly-image` | `handleCommonAnomalyImageRequest` | common PNG | `commonAnomalyApi.js` | Confirmed | `server.mjs:190-193`; `commonAnomalyData.mjs:389-415` |
| GET, POST, DELETE | `/api/pass-history` | `handlePassHistoryRequest` | `pass_history` | 자설비·공통부 | Confirmed | `server.mjs:202-207`; `passHistoryApi.js:13-59` |
| GET, HEAD | `/api/mapping-config` | `handleMappingConfigRequest` | `mapping_config.json` | 모든 주요 필터 화면 | Confirmed | `server.mjs:209-214`; `mappingConfig.mjs:26-69` |
| GET, HEAD | `/api/my-eqp-reference` | `handleMyEqpReferenceRequest` | `erdtsum_info` | `MyEqpRegistrationPage` | Confirmed | `server.mjs:216-221`; `myEqpReferenceApi.js:4` |
| GET, POST, DELETE | `/api/my-eqp-registration` | `handleMyEqpRegistrationRequest` | `myeqp_regist` | 등록 화면·MY EQP 조회 | Confirmed | `server.mjs:223-228`; `myEqpRegistration.mjs:242-301` |
| GET, POST, DELETE | `/api/mailing-registration` | `handleMailingRegistrationRequest` | `email` | `MailingRegistrationPage` | Confirmed | `server.mjs:230-235`; `mailingRegistration.mjs:160-217` |
| GET | `/api/self-equipment-data` | `handleSelfEquipmentDataRequest` | team `df_path.parquet`, pass history | `FdcTrendPage` | Confirmed | `server.mjs:237-242`; `selfEquipmentData.mjs:321-353` |
| GET | `/api/my-eqp-equipment-data` | `handleMyEqpEquipmentDataRequest` | active `myeqp_regist`, team path Parquet | `FdcTrendPage` | Confirmed | `server.mjs:244-249`; `selfEquipmentData.mjs:356-385` |
| GET | `/api/erd-scatter-data` | `handleErdScatterDataRequest` | ERD `data.parquet` 및 history Parquet | `FdcTrendPage` | Confirmed | `server.mjs:251-256`; `selfEquipmentData.mjs:715-800` |
| GET, HEAD | `/api/erd-file` | `handleErdFileRequest` | 허용된 ERD 이미지 | `selfEquipmentApi.js` | Confirmed | `server.mjs:258-260`; `selfEquipmentData.mjs:803-834` |
| 해당 없음 | health/status API | 발견하지 못함 | 해당 없음 | 해당 없음 | Unknown | `server.mjs:134-260` route 목록 |

`server.mjs`는 전체 route를 제공하지만 Vite 단독 개발 middleware의 route 집합은 더 작다. 이 차이는 10장의 `Mismatch`로 기록한다.

## 7. 핵심 영역 초기 조사

### 7.1 데이터 경로와 화면 연결

| 화면 | 라우트 | 프론트엔드 코드 | API | 백엔드 코드 | 데이터 경로 또는 DB | 데이터 없음 처리 | 상태 | 근거 |
|---|---|---|---|---|---|---|---|---|
| 메인 대시보드 | `/` | `dashboardApi.js`, `LineAnomalyDashboard.jsx` | `/api/dashboard-data` | `dashboardData.mjs` | `path/{latest_date}`, `stats/{latest_date}_spider_step_stats.parquets`, mapping JSON | 기간 내 없는 날짜는 추이 0건; 비교 파일 없으면 `null`; 전체 root/형식 오류는 오류 응답 | Confirmed | `dashboardData.mjs:664-780,794-825`; `dashboardData.test.mjs:186-200,245-278` |
| 자설비 | `/self-equipment` | `FdcTrendPage.jsx`, `selfEquipmentApi.js` | self equipment, scatter, file, pass/hit/click APIs | `selfEquipmentData.mjs` 및 history handlers | `path/{line}/{sdwt}/df_path.parquet` → ERD `data.parquet`/PNG; DB history | 필수 필터 누락 400, 읽기 실패 500, 이미지 없음 404 | Confirmed | `selfEquipmentData.mjs:308-353,803-834`; `spiderDataPaths.mjs:4,13` |
| MY EQP | `/self-equipment?sdwt=MY_EQP...` | `FdcTrendPage.jsx` | My EQP registration/equipment APIs | `myEqpRegistration.mjs`, `selfEquipmentData.mjs` | active `myeqp_regist` + team path Parquet + ERD | 등록·사용자·Line 조건 오류를 상태 코드로 반환 | Confirmed | `FdcTrendPage.jsx:1491-1557`; `selfEquipmentData.mjs:356-385` |
| 동일성 | `/matching-anomaly` | `CommonalityAnomalyPage.jsx`, `commonalityApi.js` | commonality data/image | `latestCommonalityPath.mjs`, `commonalityData.mjs` | `erd_commonality/{latest_date}/.../{sensor}_{ch_step}/img.png` | 최신 날짜/SDWT 디렉터리 없음 404, 이미지 없음 404 | Confirmed | `commonalityData.mjs:83-130,225-290`; `spiderDataPaths.mjs:9-10` |
| 공통부 | `/common-anomaly` | `CommonAnomalyPage.jsx`, `commonAnomalyApi.js` | common anomaly data/scatter/image, pass history | `commonAnomalyData.mjs` | `path_common/{line}/{sdwt}/df_path.parquet` → common `data.parquet`/PNG + DB | 필수 필터 누락 400, 경로 읽기 실패 500, 이미지 없음 404 | Confirmed | `commonAnomalyData.mjs:325-415,569-615`; `spiderDataPaths.mjs:14-16` |
| Mailing 등록 | `/registration` | `MailingRegistrationPage.jsx` | mapping/current user/mailing registration | `mailingRegistration.mjs` + Python helper | `email` DB table | 등록 validation·DB 오류 처리는 확인됨; 실제 메일 데이터 없음 처리는 별도 `Unknown` | Confirmed | `MailingRegistrationPage.jsx:214-340`; `mailingRegistration.mjs:160-217` |
| My EQP 등록 | `/registration` | `MyEqpRegistrationPage.jsx` | mapping/current user/reference/My EQP registration | `myEqpRegistration.mjs` + Python helper | `erdtsum_info`, `myeqp_regist` | validation·DB 오류 JSON | Confirmed | `MyEqpRegistrationPage.jsx:311-380`; `myEqpRegistration.mjs:242-301` |
| 사용자 메뉴얼 | `/manual` | `UserManualPage.jsx` | 서버 API 없음 | Vite raw import | 저장소의 Markdown과 PNG | 누락 이미지 URL은 원 Markdown 참조를 유지 | Confirmed | `UserManualPage.jsx:10-25,38-52` |

확인된 코드 경로 패턴은 `src/config/spiderDataPaths.mjs:3-17`에 집중되어 있다. `{latest_date}`, `{line}`, `{sdwt}`, `{step_desc}`, `{ver}`, `{ppid}`, `{grade}`, `{sensor}`, `{ch_step}`, `{eqp}` 등이 경로 파라미터다. 데이터 생성 주체와 파일 생성 주기는 저장소에서 확인되지 않아 `Unknown`이다.

### 7.2 대시보드 API

- 메서드와 경로: `GET`/`HEAD /api/dashboard-data`가 통합 서버와 Vite middleware에 등록되어 있다. 근거: `server.mjs:134-139`, `vite.config.mjs:42-45`.
- 프론트엔드 호출: `fetchDashboardSummary`가 `startDate`, `endDate`, 반복 `line`을 query string으로 전송하고 대표 응답 배열을 검사한다. 근거: `src/features/fdc-trend/api/dashboardApi.js:3-31`.
- 서버 처리·응답 생성: `handleDashboardDataRequest` → `getDashboardSummary` → `buildLineDashboardPayloadFromAggregates` 순서다. 근거: `server/dashboardData.mjs:388-532,712-825`.
- 대표 필드: `lineDashboard.summary.monitoringSensorTotal`, `changeFromPreviousDay`, `previousDateTime`와 `lineDashboard.mailingSummary`가 확인된다. `mailingSummary`는 `summary` 내부가 아니다. 근거: `server/dashboardData.mjs:507-526`.
- 데이터 원천: 날짜별 detail Parquet, 최신 시각의 stats Parquet, Line/SDWT mapping JSON이다. 고유 이상건은 `desc`, `recipe_id`, `priority`, `sensor`, `eqp` 조합으로 계산한다. 근거: `server/dashboardData.mjs:264-305,317-380,712-782`.
- Mailing 집계: 날짜 범위의 행을 `lineId`, `sdwt`, `priority`별로 묶되 같은 5개 컬럼 조합을 중복 제거한다. 근거: `server/dashboardData.mjs:317-380,480-526`.
- 빈 데이터: 집계 builder는 날짜 공백을 0건으로 만들고 비교 파일이 없으면 비교값을 `null`로 둔다. 실제 운영 root 자체가 없거나 unreadable인 경우에는 API 오류가 된다. 근거: `server/dashboardData.test.mjs:186-200,245-278`; `server/dashboardData.mjs:813-825`.
- 오류 처리: method 오류 405, 잘못된 필터 400, 최신 날짜 미발견 분기 404, 기타 500 응답 코드가 구현되어 있다. 근거: `server/dashboardData.mjs:794-825`.
- 현재 `main`의 synthetic 자산: 메뉴얼 캡처 스크립트가 `/api/**`를 가로채며 미처리 API는 `{ok: true}`를 반환한다. 이는 메뉴얼 자산이지 `mock-agent`의 mock 환경 조사 결과가 아니다. 근거: `scripts/generate-user-manual-screenshots.mjs:266-285`.
- 테스트: 대시보드 집계, 필터, 빈 날짜, 비교 시각과 invalid date 단위 테스트가 있다. JSON Schema 또는 별도 contract test는 없다. 근거: `server/dashboardData.test.mjs:17-338`; `package.json:5-12`.
- 상세 계약 전 `Unknown`: 모든 필드 타입·nullable, 오류 body의 안정성, source path 공개 정책, 실제 대용량 응답 한계, 버전 호환 정책.
- `Mismatch`: 목표 후보 `lineDashboard.summary.mailingSummary`와 실제 `lineDashboard.mailingSummary`의 위치가 다르다.

### 7.3 STEP 딥링크와 HMAC

| 항목 | 확인 결과 | 상태 | 근거 |
|---|---|---|---|
| 딥링크 생성 | 일반 상세 URL은 `line`, 반복 `sdwt`, 반복 `grade`; My EQP URL은 `sdwt=MY_EQP`, `step=ALL`, 선택적 `eqpCh`를 `URLSearchParams`로 생성한다. | Confirmed | `dashboardLinks.mjs:6-28`; `dashboardLinks.test.mjs:9-36` |
| 메일 링크 | 전체설비 링크에는 Line/SDWT/Grade, My EQP 링크에는 추가로 `step=ALL`, `eqpCh`가 있다. | Confirmed | `public/mailing-report.html:180-190,229-241` |
| 쿼리 파라미터 소비 | `readSelfEquipmentUrlFilters`가 `line`, 반복 `sdwt`, 반복 `grade`, `step`, `eqpCh`/`eqp_ch`를 읽는다. | Confirmed | `selfEquipmentUrlFilters.mjs:23-32` |
| `line`, `sdwt`, `grade` | Line·SDWT는 초기 팀 선택, Grade는 A/B 정규화를 거쳐 선택값에 반영된다. | Confirmed | `selfEquipmentUrlFilters.mjs:35-59`; `selfEquipmentUrlFilters.test.mjs:12-70` |
| HMAC 생성 | `createHmac`, `digest` 또는 동등한 생성 구현과 HMAC 의존성을 저장소 소스에서 발견하지 못했다. | Unknown | 제한 문자열 검색 결과; `package.json:13-70` |
| HMAC 검증 또는 매핑 | 일반 `step` 값은 `stepToken`으로 읽지만 현재 화면은 값이 정확히 `ALL`일 때만 STEP 전체 선택으로 사용한다. 토큰 검증·매핑은 발견하지 못했다. | Mismatch | `selfEquipmentUrlFilters.mjs:30`; `FdcTrendPage.jsx:1458-1459` |
| 비밀키 환경변수 | HMAC/STEP secret 이름을 발견하지 못했다. 실제 값은 조사하지 않았다. | Unknown | 저장소 환경변수 참조 검색 |
| 입력 정규화·URL 인코딩 | URL 값은 NFKC+trim 처리하고 생성 측은 `URLSearchParams`를 사용한다. HMAC 서명 원문의 정규화 규칙은 `Unknown`이다. | Confirmed | `selfEquipmentUrlFilters.mjs:1-10`; `dashboardLinks.mjs:7-28` |
| `step=ALL` | My EQP URL 생성에 고정 사용되고, `sdwt=MY_EQP`이면 누락되거나 다른 `step`도 `ALL`로 덮어쓴다. | Confirmed | `selfEquipmentUrlFilters.mjs:13-31`; `selfEquipmentUrlFilters.test.mjs:55-65` |
| `eqpCh` | camelCase와 `eqp_ch` 호환 이름을 읽고 자설비 초기 EQP 채널로 전달한다. | Confirmed | `selfEquipmentUrlFilters.mjs:31`; `FdcTrendPage.jsx:1461,1532-1557` |
| 변조 및 오류 처리 | HMAC 검증이 없으므로 변조 토큰 판정이나 명시적 오류 응답도 확인되지 않는다. 일반 비-`ALL` 값은 STEP 초기 선택에 반영되지 않는다. | Unknown | `FdcTrendPage.jsx:1458-1459` |
| 만료 정책 | 토큰 발급·검증 구현이 없어 만료 정책을 확인할 수 없다. | Unknown | 저장소 문자열 검색 |
| 테스트 | URL parse, My EQP 강제 `ALL`, URL encoding과 `eqpCh` 테스트는 확인됐다. 정상/변조/만료 HMAC 테스트는 없다. | Confirmed | `selfEquipmentUrlFilters.test.mjs`; `dashboardLinks.test.mjs` |

현재 구현에서 `step`은 복호화 대상이라고 확인되지 않았으며 HMAC 서명이라고도 확정할 수 없다. 프로젝트 브리핑의 개별 STEP HMAC 후보와 현재 코드 사이에는 구현 근거가 없어 `Mismatch`로 유지한다.

### 7.4 메일 생성 및 발송

| 단계 | 구현 위치 | 확인된 동작 | 상태 | 근거 |
|---|---|---|---|---|
| 트리거 | 저장소에서 발송 scheduler/command/API를 발견하지 못함 | 등록 저장과 실제 메일 발송은 분리되어 있음 | Unknown | `web_structure.md:602-610,664`; 제한 문자열 검색 |
| 발송 주기 | 해당 구현·설정 없음 | 주기와 시간대 확인 불가 | Unknown | 저장소 검색 |
| 데이터 조회 | `dashboardData.mjs`, `mailing_registration.py`, `my_eqp_registration.py` | Dashboard summary와 `email`/active `myeqp_regist`가 외부 sender 입력이라고 템플릿에 기록됨 | Documented | `dashboardData.mjs:480-526`; `public/mailing-report.html:39-50,69-78` |
| 집계·중복 제거 | `aggregateDashboardLineRows` | 5개 식별 컬럼 고유조합을 Line/SDWT/Grade로 집계해 `mailingSummary` 생성 | Confirmed | `dashboardData.mjs:317-380,480-526` |
| 템플릿 렌더링 | `public/mailing-report.html` | Jinja 호환 변수·loop·빈 표 fallback은 확인됨; 실행 renderer는 `Unknown` | Confirmed | `public/mailing-report.html:20-80,180-196,229-247` |
| 템플릿 변수 | 같은 파일 | 요청 후보 4개를 포함해 KPI, 날짜, rows, recipient 변수 확인 | Confirmed | `public/mailing-report.html:21-37,94,136-137` |
| 색상 규칙 | 같은 파일 주석 | 증감 숫자 부호에 따른 세 색상 규칙이 문서화됨; 계산 함수는 없음 | Documented | `public/mailing-report.html:27-30,57-60` |
| 이미지·링크 | 같은 파일 | inline 외부 이미지 삽입은 없고, 메인·전체설비·My EQP 링크를 생성 | Confirmed | `public/mailing-report.html:151,180-190,229-241` |
| 수신자 결정 | template contract, DB 등록 코드 | `email.email`과 active `myeqp_regist.knox_id`의 합집합 및 수신인별 필터를 템플릿 주석이 요구; 실제 sender 구현은 없음 | Documented | `public/mailing-report.html:31-46,69-76`; `mailing_registration.py:153-228` |
| 발송 | 저장소에서 SMTP/API sender 없음 | 실제 전송 구현 확인 불가 | Unknown | `web_structure.md:604-610,664`; package 의존성 검색 |
| 실패·재시도·로그 | 등록 API에만 timeout·오류 log가 있음 | 메일 발송 성공/실패, retry, 발송 log는 확인 불가 | Unknown | `mailingRegistration.mjs:112-155`; sender 부재 |
| 데이터 없음 | template의 `{% else %}` | 전체설비와 My EQP 표 각각 빈 행을 표시 | Confirmed | `public/mailing-report.html:192-196,243-247` |
| mock 차단 | `mock-agent` 브랜치 | mock 환경의 실제 발송 차단은 별도 브랜치 검증 범위 | External Branch / Out of Scope | 저장소 소유자 확정 범위; 구현 미조사 |
| 테스트 | dashboard/registration 단위 테스트 | 집계와 등록 validation 테스트는 확인됨; template render/실제 발송 없는 통합 테스트는 없음 | Confirmed | `dashboardData.test.mjs`; `mailingRegistration.test.mjs`; `mailing_registration_test.py` |

확인된 후보 변수 `dashboard_monitoring_sensor_total`, `dashboard_change_from_previous_day`, `dashboard_previous_date_time`, `dashboard_change_color`는 모두 템플릿에 있다. 템플릿이 요구하는 sender의 데이터 조합, auto-escape, 수신자 분리는 실행 코드로는 확인되지 않았다.

## 8. 환경, 실행 및 배포 설정

| 구분 | 항목 | 확인된 설정 또는 이름 | 상태 | 근거 |
|---|---|---|---|---|
| Node.js | 버전 | `engines`, `.nvmrc`, `.node-version` 발견하지 못함 | Unknown | `package.json:1-72`; 파일 목록 |
| Python | 버전 | `python3 -B`로 helper를 실행하나 버전 범위 선언 없음 | Unknown | `currentUser.mjs:41-43`; `requirements.txt` |
| package manager | npm | `package-lock.json`과 npm scripts 존재 | Confirmed | `package.json:5-12`; `package-lock.json` |
| 개발 실행 | `npm run dev` | `vite`; 기본 Vite port `3000`, `host: true` | Confirmed | `package.json:6`; `vite.config.mjs:126-142` |
| 통합 실행 | `npm start`, `npm run preview` | 둘 다 `node server.mjs` | Confirmed | `package.json:9-10` |
| 빌드·lint | `npm run build`, `npm run lint` | `vite build`, `eslint .` | Confirmed | `package.json:7,11` |
| 서버 host/port | `HOST`, `PORT` | 기본 `0.0.0.0`, `5173` | Confirmed | `server.mjs:37-40` |
| 서버 mode | `LIVE_RELOAD`, `BUILD_ON_START` | Vite middleware 또는 `dist`; 정적 모드 build 제어 | Confirmed | `server.mjs:39-40,263-289` |
| 사이트 host | `VITE_SITE_URL` | allowedHosts/HMR 선택에 참조 | Confirmed | `vite.config.mjs:27-34,126-145` |
| 데이터 설정 | `MAPPING_CONFIG_PATH` | mapping JSON override | Confirmed | `mappingConfig.mjs:5-6` |
| 데이터 설정 | `COMMONALITY_ROOT_PATH` | 동일성 root override | Confirmed | `latestCommonalityPath.mjs:9-10` |
| 데이터 설정 | `SPIDER_DASHBOARD_PATH_ROOT` | dashboard detail root override | Confirmed | `dashboardData.mjs:20-24` |
| DB 설정 | `DB_INFO_PATH`, `REMOTE_ADDR` | pickle 경로 override 및 현재 사용자 helper 입력 | Confirmed | `current_user.py:7,14-18`; 다른 DB helper |
| HMAC 설정 | secret/key 환경변수 | 발견하지 못함 | Unknown | 환경변수 참조 검색 |
| 메일 설정 | SMTP/API/sender 환경변수 | 발견하지 못함 | Unknown | 환경변수·의존성 검색 |
| 메뉴얼 캡처 | `MANUAL_BASE_URL`, `PLAYWRIGHT_LD_LIBRARY_PATH`, `LD_LIBRARY_PATH` | 대상 URL 및 브라우저 라이브러리 경로 | Confirmed | `generate-user-manual-screenshots.mjs:11-22` |
| Core 환경 예제 | `.env.example` | 현재 `main`에 없음 | Unknown | 파일 목록 |
| mock 환경 예제 | `.env.mock.example` | `mock-agent` 전용 범위 | External Branch / Out of Scope | 구현 미조사 |
| Docker | Dockerfile/Compose | 없음 | Unknown | 제한 검색 |
| systemd | `*.service` | 없음 | Unknown | 제한 검색 |
| reverse proxy | 배포 설정 | 앱의 forwarded header 소비만 있고 proxy 설정 파일은 없음 | Unknown | `currentUser.mjs:22-28` |
| CI | workflow 설정 | 없음 | Unknown | 제한 검색 |
| 로그 | application logger/경로 | `console`/Python stderr 사용은 확인됨; log 파일·rotation 위치는 `Unknown` | Confirmed | `server.mjs:291-303`; helper stderr 처리 |

환경변수 실제 값과 운영 host, port, service unit, proxy, 방화벽, 로그 수집기는 확인하지 않았다.

## 9. Core 테스트와 외부 mock 범위

이 절의 `Confirmed`는 현재 `main` 파일만 의미한다. `mock-agent`는 Mock Validation Extension의 외부 브랜치이며 checkout·파일 조사·테스트 실행을 하지 않았다.

| 종류 | 경로 | 대상 기능 | 실행 명령 또는 script | 운영 의존성 | 상태 | 근거 |
|---|---|---|---|---|---|---|
| Node 단위 테스트 | `server/*.test.mjs` 14개 | dashboard, self/common data, history, 등록, cache | package script 없음 | 테스트 소스는 synthetic/temp 중심이나 미실행 | Confirmed | 파일 목록; 각 파일의 `node:test` import |
| 프론트 utility/API 테스트 | `src/**/*.test.mjs` 8개 | URL, filter, pagination, API query, 오류 | package script 없음 | synthetic URL/payload 중심이나 미실행 | Confirmed | 파일 목록 |
| Python 단위 테스트 | `scripts/mailing_registration_test.py`, `scripts/my_eqp_registration_test.py` | list 직렬화·등록 payload | package script 없음 | 대체 connection/함수 중심이나 미실행 | Confirmed | 두 파일 존재 |
| 대시보드 테스트 | `server/dashboardData.test.mjs` | 고유 집계, 날짜, filter, 빈 데이터 | package script 없음 | 운영 Parquet 미사용 단위 입력 | Confirmed | `dashboardData.test.mjs:17-338` |
| STEP URL 테스트 | `dashboardLinks.test.mjs`, `selfEquipmentUrlFilters.test.mjs` | `step=ALL`, `eqpCh`, 반복 query | package script 없음 | 없음 | Confirmed | 두 테스트 파일 |
| 메일 관련 테스트 | dashboard·mailing registration 테스트 | summary와 DB 등록 전 validation | package script 없음 | actual sender 없음 | Confirmed | 관련 테스트 파일; sender/render test 부재 |
| 메뉴얼 Browser fixture | `generate-user-manual-screenshots.mjs` | 주요 화면과 synthetic API/image | `npm run manual:screenshots` | localhost Vite/Playwright; route intercept | Confirmed | `package.json:8`; script `266-386` |
| prototype mock | `fdcTrendMockData.js`, `SpiderFeaturePage.jsx` | 일부 미완료/별도 SPIDER 화면 | 실행 script 없음 | 없음 | Confirmed | `web_structure.md:663`; import 위치 |
| 최소 synthetic 계약 샘플 | Core Harness 목표 | API·데이터 계약 | 없음 | 운영 자원 비의존 | Unknown | 현재 `main`에 계약 샘플 경로 없음 |
| contract test/schema | `tests/contract/`, `harness/contracts/` | 해당 없음 | 없음 | 해당 없음 | Unknown | 경로 없음 |
| test script | `package.json` | lint/build는 있으나 test script 없음 | 없음 | 해당 없음 | Unknown | `package.json:5-12` |
| Mock Validation Extension | `mock-agent` 브랜치 | mock 서버·API·DB·데이터·실행 script | 브랜치 전용 | 운영과 분리하는 별도 범위 | External Branch / Out of Scope | 저장소 소유자 확정 범위; 구현 미조사 |
| mock 의존 검증 | `mock-agent` 브랜치 | smoke, integration, E2E, Playwright QA, 성능 검증 | 브랜치 전용 | mock 의존 | External Branch / Out of Scope | 구현·결과 미조사 |

현재 `main`에 mock 서버·데이터·mock 의존 E2E가 없는 것은 의도된 브랜치 경계이며 결함이나 Core Harness 미완성으로 판정하지 않는다. 이번 조사에서는 어떤 테스트도 실행하지 않았다.

## 10. 확인된 Mismatch

| ID | 내용 | 영향 | 근거 |
|---|---|---|---|
| M-01 | `server.mjs`에는 있으나 Vite middleware에는 `/api/clicked-category-history`, `/api/my-eqp-reference`, `/api/my-eqp-registration`, `/api/mailing-registration`, `/api/my-eqp-equipment-data`가 없다. | `npm run dev`와 통합 서버의 기능 범위가 다르다. | `server.mjs:155-160,216-249`; `vite.config.mjs:36-115`; `web_structure.md:152-164` |
| M-02 | 대시보드 후보 경로 `lineDashboard.summary.mailingSummary`와 실제 응답 `lineDashboard.mailingSummary`가 다르다. | 향후 JSON Schema와 메일 sender가 잘못된 위치를 계약할 수 있다. | `dashboardData.mjs:507-526`; `dashboardApi.js:19-26` |
| M-03 | 브리핑의 개별 STEP HMAC 토큰 후보와 달리 현재 저장소에는 생성·검증·매핑 구현과 key 설정이 없고, 비-`ALL` `stepToken`은 화면 STEP 선택에 사용되지 않는다. | 개별 STEP 딥링크의 진위·호환·오류 정책을 정의할 수 없다. | `selfEquipmentUrlFilters.mjs:23-32`; `FdcTrendPage.jsx:1458-1459`; HMAC 제한 검색 |

## 11. Unknown 및 후속 확인 필요 사항

- 운영 데이터 파일 생성 주체, 생성 주기, 보존·백업·복구 및 지연 기준.
- 실제 운영 DB 제품·버전, schema migration 절차, 계정 권한, transaction·index 정책.
- Node.js와 Python의 지원 버전, OS, 프로세스 관리자, systemd unit, Docker 사용 여부.
- reverse proxy, TLS, 방화벽, 실제 public base URL, health check와 monitoring 구성.
- 실제 `.env` 배포 방식과 secret manager 사용 여부. 실제 값은 조사 대상에서 제외했다.
- 대시보드 전체 API schema, nullable·error contract, 하위 호환 및 payload 크기 한계.
- 개별 STEP의 토큰 생성 주체, HMAC 서명 원문·알고리즘·key 이름·검증·만료·변조 처리.
- 메일 trigger, schedule, renderer, 수신자 최종 계산, SMTP/API sender, retry와 발송 log.
- 외부 sender가 `public/mailing-report.html`과 현재 dashboard 응답을 실제로 호환되게 소비하는지 여부.
- 메뉴얼 PNG가 현재 commit의 UI와 완전히 일치하는지에 대한 브라우저 재검증.
- `SpiderFeaturePage` prototype route의 운영 노출 의도와 외부 카드 URL의 관리 주체.
- Core 대상 JSON Schema, 최소 synthetic 계약 샘플과 contract test의 목표 파일은 아직 존재하지 않는다.
- `mock-agent`의 실제 파일·기능·테스트 결과는 `External Branch / Out of Scope`이며 `Unknown` 또는 main의 결함으로 계산하지 않는다.
- 운영 환경에서 `/appdata` 경로와 DB가 실제로 존재·접근 가능한지 여부.
- 장애 대응, backup/restore, release checklist, 관찰 가능성 및 책임자 정보.

## 12. 위험 요소

### 운영 자원 접근 위험

- Node API는 `/appdata`의 Parquet·JSON·이미지를 직접 읽고 Python helper는 DB 읽기·쓰기를 수행한다. Core 단위·계약 검증은 이 handler들을 운영 설정으로 실행하지 않아야 한다. 근거: `server/*.mjs`, `scripts/*.py`.
- `scripts/my_eqp_registration.py:50-67`의 `ensure_public_column()`은 조회·등록·삭제 흐름에서 runtime `ALTER TABLE`을 수행할 수 있다. 배포 migration 정책과 최소 권한 확인이 필요하다.
- `server/currentUser.mjs:22-28`은 `x-forwarded-for`, `x-real-ip`를 우선 신뢰한다. 신뢰 proxy 경계가 별도 설정에 없어 spoofing과 오식별 가능성을 운영 구성에서 확인해야 한다.

### 비밀정보 위험

- 상태: `Risk`
- 위치: `vite.config.mjs:27-28`, `src/features/fdc-trend/pages/L0SpiderHomePage.jsx:44,79,89,99`
- 설명: 내부 host 또는 서비스 URL 하드코딩 가능성
- 실제 값: `<redacted>`

`DB_INFO_PATH` 기본 파일에는 DB credential key를 읽는 코드가 있지만 실제 credential 값은 저장소에서 읽거나 보고서에 기록하지 않았다. `.gitignore:13-24`는 `.env*`, `db_info.pkl`, key/certificate 후보를 제외한다.

### 실제 메일 발송 위험

- 실제 sender가 저장소에 없어 현재 코드 자체의 발송 경로는 확인되지 않는다.
- sender가 저장소 밖에 있다면 운영 발송 경계와 kill switch는 후속 외부 컴포넌트 인벤토리에서 확인해야 한다. `mock-agent`의 발송 차단 구현은 이번 조사 범위가 아니다.

### 계약 부재 위험

- 대시보드 API와 메일 summary에 JSON Schema가 없고 오류 응답이 내부 `error.message`와 source path를 포함할 수 있다. 근거: `dashboardData.mjs:812-825`, `mappingConfig.mjs:64-68`.
- Mailing/My EQP 등록 오류 응답이 table, debug row, DB error detail 또는 입력 row를 브라우저에 전달한다. 운영 schema·입력·DB 상세 노출 범위를 재검토해야 한다. 근거: `mailingRegistration.mjs:208-216`; `mailingRegistrationApi.js:21-27`; `myEqpRegistration.mjs:294-300`.

### 테스트 공백

- 테스트 파일은 있으나 manifest의 통합 test 명령과 Core contract schema/test가 없다.
- 메뉴얼 캡처 fixture는 미처리 API에 `{ok: true}`를 반환하므로 API 계약 검증을 대신하지 못한다. 근거: `generate-user-manual-screenshots.mjs:266-285`.
- mock 서버, mock 실행 script와 mock 의존 E2E는 `mock-agent` 전용이므로 main의 테스트 공백으로 판정하지 않는다.

## 13. 다음 문서 작성에 사용할 근거

`docs/system/overview.md` 작성 시 다음 순서로 우선 참조한다.

1. `AGENTS.md` — 범위, 사실 상태, 안전 및 하네스 공통 규칙.
2. `server.mjs` — 통합 실행 방식과 전체 API route.
3. `src/features/fdc-trend/routes.jsx` — 사용자 화면 URL과 page 연결.
4. `src/config/spiderDataPaths.mjs` — 운영 파일 경로 패턴의 코드 기준.
5. `server/dashboardData.mjs`, `server/selfEquipmentData.mjs`, `server/commonalityData.mjs`, `server/commonAnomalyData.mjs` — 핵심 파일 데이터 흐름.
6. `scripts/*.py`와 대응 `server/*History.mjs`, `server/*Registration.mjs` — DB 경계와 table 사용.
7. `src/features/fdc-trend/api/`, 주요 page와 `LineAnomalyDashboard.jsx` — 브라우저 소비 관계.
8. `public/mailing-report.html` — 메일 데이터와 링크의 template contract.
9. `package.json`, `vite.config.mjs`, `README.md` — 기술, 실행 및 개발 runtime.
10. `web_structure.md` — 현재 코드 기반 구조 설명과 조사 교차검증.
11. `docs/user-manual/USER_MANUAL.md` 및 images — 사용자 관점과 UI 용어.
12. 기존 test 파일과 `generate-user-manual-screenshots.mjs` — 현재 검증 자산과 공백.

API 계약, 시스템 문서와 기능 정의는 `main`에서 관리하고 `mock-agent`가 이를 따르는 공유 기준이다. mock 구현 자체는 다음 Core 문서 작성의 입력 자료로 확인하지 않았다.

후속 문서에서는 이 보고서의 `Mismatch`, `Unknown`, `Risk`를 제거하지 말고 코드 또는 재현 가능한 실행 근거가 생길 때 상태를 갱신해야 한다.

## 14. 조사 결과 요약

### 확인된 주요 사실

- L0 Spider는 React SPA, Node HTTP/API 계층, 파일 기반 Parquet/PNG/JSON 데이터, Python DB helper로 구성된다.
- 브라우저 route와 주요 page, 전체 통합 서버 API, 핵심 데이터 경로 패턴, DB table 접근 코드가 저장소 안에서 연결된다.
- 대시보드 summary와 mailing summary 집계, `step=ALL` My EQP 딥링크, 메일 HTML template, 등록 API가 구현되어 있다.
- 자동 테스트 파일 24개와 메뉴얼 캡처용 synthetic route fixture가 있으며, Core용 통합 test script와 contract schema/test는 아직 없다.

### 가장 중요한 Mismatch

- Vite 단독 개발 서버와 통합 `server.mjs`의 API route 범위가 다르다.
- 개별 STEP HMAC 후보는 현재 구현 근거가 없고 대시보드 `mailingSummary` 후보 위치도 실제 응답과 다르다.

### 가장 중요한 Unknown

- 개별 STEP HMAC 계약과 실제 메일 sender/scheduler 전체 흐름.
- 운영 배포, secret 관리, DB migration, backup/restore 및 Core용 반복 검증 진입점.

### 다음 단계 진행을 막는 요소 여부

저장소 코드 기준의 `docs/system/overview.md` 초안 작성은 가능하다. 다만 HMAC, 실제 메일 발송, 운영 배포를 `Confirmed`로 서술해서는 안 되며, 해당 영역은 `Unknown` 또는 저장소 밖 의존성으로 유지해야 한다.

# L0 Spider

L0 공정의 이상감지 결과를 Line·SDWT·STEP·설비·Sensor 조건별로 조회하는 운영
웹서비스입니다. 메인 대시보드에서 전체 현황을 확인하고 자설비·동일성·공통부
화면에서 Parquet 기반 차트와 분석 이미지를 상세 조회할 수 있습니다.

## 주요 기능

- Line별 이상 현황, KPI와 기간 추이 대시보드
- 자설비 및 MY EQP 이상감지 결과 조회와 Scatter·동일성 차트
- 동일성·공통부·공통부 동일성 이상감지 결과 조회
- SKIP, HIT와 조회 카테고리 클릭 이력 관리
- Mailing Report 수신 조건과 MY EQP 등록·조회·삭제
- 진행 중 공지 조회와 관리자용 공지 등록·완료 처리
- 서비스 내 사용자 메뉴얼

Mailing 요약 데이터와 HTML 템플릿은 이 저장소에서 관리하지만 실제 메일 renderer,
scheduler와 sender의 구현 위치는 확인되지 않았습니다.

## 기술 구성

- React 19, React Router, TanStack Query
- Vite 6 기반 SPA
- Node.js 통합 HTTP 서버와 API
- Parquet·JSON·이미지 기반 파일 데이터
- Python 3 및 PyMySQL 기반 DB helper
- Node Test Runner 기반 unit·integration·contract 검증

## 개발 저장소

- 저장소: `mlbarod/l0_spider`
- 기본 브랜치: `main`

```bash
git clone git@github.com:mlbarod/l0_spider.git
cd l0_spider
```

## 시작하기

프로젝트에 고정된 Node.js와 Python 버전은 없습니다. Node.js와 npm이 설치된 환경에서
JavaScript 의존성을 설치합니다.

```bash
npm install
```

프론트엔드 중심으로 개발할 때는 Vite 개발 서버를 사용합니다.

```bash
npm run dev
```

기본 주소는 `http://localhost:3000`입니다. 이 모드는 일부 API만 제공하므로 전체 기능을
확인할 때는 통합 서버를 사용합니다.

```bash
npm start
```

통합 서버의 기본 주소는 `http://localhost:5173`이며 전체 API와 Vite middleware를
제공합니다. DB 기능을 사용하는 경우 Python 의존성도 설치해야 합니다.

```bash
python3 -m pip install -r scripts/requirements.txt
```

## 실행 모드

| 목적 | 명령 | 설명 |
| --- | --- | --- |
| 프론트엔드 개발 | `npm run dev` | Vite 개발 서버와 제한된 API를 실행합니다. |
| 통합 개발 | `npm start` | Node 서버, 전체 API와 Vite middleware를 실행합니다. |
| 정적 제공 | `LIVE_RELOAD=0 npm start` | 시작 시 빌드한 `dist/`를 제공합니다. |
| 기존 빌드 제공 | `LIVE_RELOAD=0 BUILD_ON_START=0 npm start` | 기존 `dist/`를 다시 빌드하지 않고 제공합니다. |

통합 서버의 주소는 `HOST`와 `PORT`로 변경할 수 있습니다. `npm run preview`도 Vite
preview가 아니라 `node server.mjs`를 실행합니다.

## 데이터 및 환경 설정

서비스의 주요 화면은 `/appdata` 아래의 mapping, Parquet와 이미지 파일을 읽습니다.
운영 데이터가 없는 개발 환경에서는 화면이 비어 있거나 데이터 API가 오류를 반환할 수
있습니다.

DB 기능은 `DB_INFO_PATH`가 가리키는 credential 파일을 사용하며 기본 경로는
`/appdata/l0_spider/db_info.pkl`입니다. 현재 사용자는 proxy 또는 socket에서 얻은 접속
IP를 승인된 사용자 정보와 연결하여 확인합니다.

주요 runtime 설정은 다음과 같습니다.

| 환경변수 | 용도 |
| --- | --- |
| `HOST`, `PORT` | 통합 서버의 listen 주소와 port |
| `LIVE_RELOAD`, `BUILD_ON_START` | Vite middleware와 시작 시 build 여부 |
| `DB_INFO_PATH` | DB credential 파일 경로 |
| `MAPPING_CONFIG_PATH` | Line·SDWT mapping 파일 경로 |
| `SPIDER_DASHBOARD_PATH_ROOT` | Dashboard 데이터 root 경로 |
| `COMMONALITY_ROOT_PATH` | 동일성 데이터 root 경로 |
| `COMMON_COMMONALITY_ROOT_PATH` | 공통부 동일성 데이터 root 경로 |
| `SENSOR_EXCLUSION_CONFIG_PATH` | App별 Sensor 제외 설정 경로 |
| `NOTICE_ADMIN_KNOX_IDS` | 공지 관리가 가능한 `knoxId` 목록 |

공지 관리자 설정은 Git에 기록하지 않는 저장소 root의 `notices.env`에서도 읽을 수
있습니다. 실제 비밀번호, 토큰, credential 파일, 사용자 정보 또는 `.env` 값은 저장소와
문서에 기록하지 않습니다. 전체 설정과 적용 시점은
[환경 정의](docs/system/environment-definition.md)를 참고하세요.

## 검증 명령

```bash
npm run lint
npm run test:unit
npm run test:integration
npm run test:contract
npm run build
```

변경 범위와 가까운 검증부터 선택해 실행합니다. Sensor 제외 설정만 검증할 때는
`npm run sensor-exclusions:validate -- <설정파일>`을 사용합니다.

## 프로젝트 구조

```text
src/                 React 화면, 브라우저 API와 데이터 경로 설정
server/              Node API와 데이터 처리 모듈
scripts/             DB helper와 관리·검증 스크립트
config/              Runtime 설정 파일
docs/                기능·시스템·운영·사용자 문서
harness/contracts/   API 및 데이터 계약
tests/               Unit·integration·contract 테스트
```

## 문서 안내

- [시스템 개요](docs/system/overview.md)
- [환경 및 실행 조건](docs/system/environment-definition.md)
- [Dashboard 기능](docs/features/dashboard.md)
- [Self Equipment 기능](docs/features/self-equipment.md)
- [이상 데이터와 결과 조회](docs/features/abnormal-data.md)
- [Data Reference](docs/features/data-reference.md)
- [공지사항](docs/features/notices.md)
- [Mailing 기능](docs/features/mailing.md)
- [사용자 메뉴얼](docs/user-manual/USER_MANUAL.md)
- [운영 Runbook](docs/operations/runbook.md)
- [문제 해결](docs/operations/troubleshooting.md)
- [배포 기준](docs/system/deployment.md)

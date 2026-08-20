# L0 Spider 배포 기준

| 항목 | 내용 |
|---|---|
| 문서 목적 | `main`의 L0 Spider를 빌드·반영·검증·rollback할 때 지켜야 할 기준을 정의한다. |
| 기준 브랜치 | `main` |
| 기준 commit | `469ab96` |
| 조사 방식 | 저장소 정적 조사만 수행했다. 실제 서버, systemd, Docker, DB와 `/appdata`는 확인하지 않았다. |
| Mock 범위 | `mock-agent`의 mock server·데이터·Playwright 절차는 운영 배포 범위가 아니다. |

## 1. 범위와 상태 기준

이 문서는 배포 구조와 단계의 기준 문서다.
일상 운영 명령은 [runbook](../operations/runbook.md), systemd 상세는 [systemd](../operations/systemd.md), 증상별 대응은 [troubleshooting](../operations/troubleshooting.md)을 따른다.
환경변수 이름과 외부 의존성은 [environment-definition](environment-definition.md), 비밀정보·권한 원칙은 [security](security.md)를 우선한다.

- `Confirmed`: 현재 코드·manifest·tracked 설정으로 확인
- `Documented`: 기존 문서에만 기록
- `Unknown`: 저장소와 허용된 조사로 확인 불가
- `Mismatch`: 코드·설정·문서 사이의 명확한 차이
- `Risk`: 배포 전 운영 확인 또는 통제가 필요한 위험

확인된 애플리케이션 동작과 운영 서버의 실제 배포 구성을 구분한다.
아래 명령 블록은 모두 **이번 작업에서 실행하지 않은 운영자용 명령**이다.

## 2. 확인된 실행·빌드 구조

| 항목 | 확인 결과 | 상태 | 근거 |
|---|---|---|---|
| package manager | npm, `package-lock.json` lockfileVersion 3 | `Confirmed` | `package.json`, `package-lock.json` |
| 서버 진입점 | `server.mjs` | `Confirmed` | `package.json`의 `start`, `preview` |
| frontend build | `npm run build` → `vite build` | `Confirmed` | `package.json` |
| build 결과 | 기본 `dist/`, 시작 시 `dist/index.html` 확인 | `Confirmed` | `server.mjs:36,80-87` |
| 통합 live reload | `npm start` 또는 `npm run preview` | `Confirmed` | `package.json`, `server.mjs` |
| 통합 정적 제공 | `LIVE_RELOAD=0 npm start` | `Confirmed` | `server.mjs:39-40,263-289` |
| 시작 시 build | 정적 mode에서 `BUILD_ON_START`가 `0`이 아니면 실행 | `Confirmed` | `server.mjs:65-77,286-289` |
| Vite 단독 개발 | `npm run dev`, port `3000` | `Confirmed` | `package.json`, `vite.config.mjs:126-142` |
| Python helper | Node가 요청별로 `python3 -B scripts/*.py` 실행 | `Confirmed` | `server/*.mjs` |
| Python 의존성 | `scripts/requirements.txt` | `Confirmed` | README, requirements file |
| 실제 운영 mode | tracked 배포 설정 없음 | `Unknown` | repository search |

`npm run preview`는 Vite preview가 아니라 `node server.mjs`다.
Vite 단독 개발 mode는 통합 server보다 API route가 적으므로 운영 배포 기준으로 확정하지 않는다.

## 3. 빌드 입력과 결과물

| 구분 | 경로·항목 | 역할 | 배포 취급 |
|---|---|---|---|
| manifest | `package.json`, `package-lock.json` | dependency와 script 기준 | source와 함께 version 고정 |
| frontend source | `src/`, `index.html` | React SPA 입력 | build 입력 |
| public assets | `public/` | Vite public asset | build 입력; 공개 범위 검토 |
| server source | `server.mjs`, `server/` | HTTP·API·파일 조회 | runtime 배포 단위 |
| DB helper | `scripts/*.py`, `scripts/requirements.txt` | DB 조회·등록·이력 | runtime 배포 단위 |
| config source | `src/config/`와 환경변수 | path·mapping 기본 계약 | 코드와 환경을 분리 |
| sensor 제외 설정 | `config/sensor-exclusions.json` | 네 이상감지 App과 Mailing의 기본 runtime 설정 | runtime 배포 필수; application user 읽기 가능 여부 확인 |
| static artifact | `dist/` | 정적 mode의 SPA | build 결과; Git 기준 여부 미확인 |
| 문서·계약 | `docs/`, `harness/contracts/` | 운영·API 기준 | 코드 변경과 함께 검토 |

`public/mailing-report.html`은 build에 포함될 수 있지만 저장소 안의 실제 mail sender가 아니다.
분석 Parquet·이미지, DB credential과 실제 `.env`는 build artifact에 포함하지 않는다.

## 4. 환경설정 주입 경계

| 설정 | 적용 | 확인된 fallback | 배포 주의 |
|---|---|---|---|
| `HOST` | server 시작 | `0.0.0.0` | 실제 bind·proxy 경계 `Unknown` |
| `PORT` | server 시작 | `5173` | 운영 값은 `Unknown`; `32640` 근거 없음 |
| `LIVE_RELOAD` | server 시작 | `0` 외 live reload | 운영 mode를 명시적으로 결정 |
| `BUILD_ON_START` | 정적 server 시작 | `0` 외 build | 운영 시작과 build를 결합하는 `Risk` |
| `VITE_SITE_URL` | Vite 시작·build | 빈 값 | client-visible 설정에 secret 금지 |
| `MAPPING_CONFIG_PATH` | API 요청 | 코드 기본 path | 실제 file 접근 사전 확인 |
| `COMMONALITY_ROOT_PATH` | API 요청 | 코드 기본 root | 운영 root 변경 영향 검토 |
| `COMMON_COMMONALITY_ROOT_PATH` | 프로세스 시작 | 기존 commonality/dashboard root의 형제 `path_common_commonality` 또는 코드 기본 root | 별도 mount면 명시적으로 설정하고 프로세스를 재시작 |
| `SPIDER_DASHBOARD_PATH_ROOT` | API 요청 | 코드 기본 root | Dashboard detail·stats 범위 확인 |
| `SENSOR_EXCLUSION_CONFIG_PATH` | 경로는 프로세스 시작; 동일 경로의 내용은 API 요청 | `config/sensor-exclusions.json` | 기본 파일 또는 override JSON은 application read-only, 개발자·배포 계정만 수정; 반영 전 validation |
| `DB_INFO_PATH` | Python helper | 코드 기본 path | 값이 아니라 credential file 위치; 노출 금지 |

tracked `.env.example`, `EnvironmentFile`, secret manager와 실제 주입 우선순위는 `Unknown`이다.
실제 값은 배포 기록, 명령행, journal과 문서에 복사하지 않는다.

## 5. 배포 단위와 외부 의존성

확인된 최소 애플리케이션 단위는 Node source, frontend artifact 또는 build 입력, Python helper와 각 dependency manifest다.
다음 운영 의존성은 애플리케이션 artifact와 별도로 준비돼야 하지만 실제 배치 책임자는 `Unknown`이다.

- 운영 mapping JSON, Parquet와 이미지의 읽기 가능한 mount
- DB credential file과 Python DB network 접근
- 지원 Node.js·Python runtime 및 npm·Python dependency
- 실제 service manager, reverse proxy, TLS, 방화벽과 log 수집
- 외부 mail renderer·scheduler·sender가 있다면 그 별도 배포 단위

Dockerfile, Compose, tracked systemd unit, CI workflow와 artifact registry는 현재 checkout에 없다.

## 6. 배포 전 확인

배포 담당자는 실제 대상 서버·service·경로를 먼저 확인하고 아래 명령의 placeholder를 확정한다.

```bash
# 실행하지 않은 운영자용 명령
git branch --show-current
git rev-parse --short HEAD
git status --short
test -r config/sensor-exclusions.json
npm run sensor-exclusions:validate -- config/sensor-exclusions.json
npm run lint
npm run test:unit
npm run test:contract
npm run build
```

`test:integration`은 현재 Core test가 운영 자원을 사용하지 않는지 확인한 뒤에만 실행한다.
실제 운영 DB, `/appdata`, mail과 외부 API를 사용하는 검증은 release gate로 자동 실행하지 않는다.

사전 확인 항목:

1. release commit과 변경 파일·계약·문서를 식별하고 `config/sensor-exclusions.json`과 전용 운영 가이드가 release source에 포함됐는지 확인한다.
2. Node·Python 실제 버전과 지원 기준을 운영자에게 확인한다. 저장소에는 version 선언이 없다.
3. 정적 mode이면 `dist/index.html`과 asset 생성 성공을 확인한다.
4. runtime 환경변수 이름만 대조하고 실제 값은 출력하지 않는다.
5. 대상 application user의 source·dist·Python script·credential·운영 file과 `config/sensor-exclusions.json` 읽기 권한을 확인한다. 실행 계정과 배포 계정을 분리하는 환경에서는 실행 계정의 설정 파일 쓰기 불가도 확인한다.
6. 사용할 port와 service manager를 확인하고 기존 process 중복을 방지한다.
7. DB schema·권한, `/appdata` mount와 데이터 freshness를 담당 owner에게 확인한다.
8. 실제 mail sender는 이 저장소와 분리해 발송 영향과 중복 방지 여부를 확인한다.

## 7. 권장 반영 순서

다음은 현재 코드 구조에서 안전 경계를 명시한 절차이며, 실제 배포 자동화가 확인된 것은 아니다.

1. 변경 동결: 대상 commit, 영향 API와 rollback 기준을 기록한다.
2. 사전 검증: 운영 자원 비의존 lint·unit·contract와 build 결과를 확인한다.
3. artifact 준비: source와 `dist/`의 동일 commit 관계를 유지하고 기본 sensor 제외 JSON과 운영 가이드 누락 여부를 확인한다.
4. 환경 대조: service manager가 주입할 이름과 파일 read 권한만 확인한다.
5. traffic 처리: proxy·무중단 전환 방식은 `Unknown`이므로 운영 승인 없이 변경하지 않는다.
6. service 반영: 확인된 manager 절차로 한 instance씩 반영한다. 실제 instance 수는 `Unknown`이다.
7. liveness 확인: `/`가 정상 HTTP 응답을 반환하는지 확인한다.
8. read-only 기능 확인: Dashboard와 주요 화면 API를 승인된 방식으로 확인한다.
9. DB write·mail 기능은 실제 데이터를 생성하지 않고 담당자 확인과 기존 운영 증거로 판정한다.
10. log·오류·resource 상태를 확인한 뒤 release를 종료한다.

정적 mode에서 시작 중 build를 피하려면 사전 build 후 `BUILD_ON_START=0`을 사용할 수 있다.
이는 코드가 지원하는 mode이지만 실제 운영 정책으로 채택됐는지는 `Unknown`이다.

## 8. 배포 후 정상 판정

| 영역 | 최소 판정 | 실패 시 |
|---|---|---|
| process | 확인된 service manager에서 active·안정 상태 | [runbook](../operations/runbook.md)·[systemd](../operations/systemd.md) |
| listener | 승인된 host·port에서 예상 process가 listen | port 충돌·설정 확인 |
| UI | `/`와 주요 route의 static asset 응답 | `dist`, Vite mode, proxy 확인 |
| Dashboard | read-only 조회가 정상 또는 계약된 빈 상태 | data root·latest file 확인 |
| Self·abnormal | mapping·index·image/scatter read 경계 정상 | `/appdata`와 path 권한 확인 |
| DB 연계 | current-user·등록 조회의 기존 read 흐름 정상 | credential·network·helper log 확인 |
| STEP | `step=ALL` MY EQP 호환 유지 | 비-ALL HMAC은 현재 구현 `Unknown` |
| Mailing | 등록 기능과 template 자산만 현재 범위 | 실제 sender는 별도 owner로 escalation |
| log | 새 반복 오류·비밀·절대 path 노출 없음 | 즉시 영향 격리·보안 escalation |

전용 `/health` 또는 readiness endpoint는 확인되지 않았다.
따라서 process active만으로 DB와 운영 file까지 준비됐다고 판단하지 않는다.

## 9. Rollback 경계

현재 저장소에는 release artifact 보관, symlink 전환, database migration rollback 또는 자동 rollback 구현이 없다.
구체적인 rollback 명령과 이전 경로는 `Unknown`이며 추정해서 실행하지 않는다.

Rollback 전에 확인할 경계:

- 이전 정상 commit·artifact가 실제로 존재하고 동일 환경 계약을 갖는가
- 이번 release가 DB row·DDL 또는 외부 mail에 이미 영향을 줬는가
- frontend artifact와 server source를 함께 되돌릴 수 있는가
- path·Schema·API 변경이 이전 code와 양방향 호환되는가
- rollback 중 traffic·중복 process·port 충돌을 어떻게 막는가

DB write나 runtime DDL이 발생한 뒤에는 application file만 되돌려 완전 복구됐다고 판단하지 않는다.
운영 데이터·메일·DB의 되돌리기는 각 owner 승인과 별도 복구 절차가 필요하다.

## 10. 책임 경계

| 책임 | 현재 기준 | owner |
|---|---|---|
| source·contract·문서 | `main` Core Harness | 저장소 owner |
| build·artifact 동일성 | release 절차에서 확인 | `Unknown` |
| service manager·host·port | 저장소 밖 운영 설정 | `Unknown` |
| proxy·TLS·firewall | 저장소 밖 network 경계 | `Unknown` |
| `/appdata` 생성·mount·backup | L0 Spider는 read consumer | `Unknown` |
| DB schema·credential·backup | Python helper consumer와 일부 writer | `Unknown` |
| mail sender·scheduler | 저장소에서 구현 미확인 | `Unknown` |
| 장애 escalation·승인 | 조직 운영 절차 | `Unknown` |

## 11. Mismatch·Unknown·Risk

### Mismatch

- Vite 단독 `npm run dev`는 `server.mjs`보다 API route 범위가 좁다.
- 코드가 여러 환경변수를 소비하지만 tracked 환경변수 예제와 배포 주입 설정은 없다.

### Unknown

- 실제 운영 mode, server 수, topology, service manager와 배포 자동화
- 실제 `User`, `Group`, `WorkingDirectory`, `ExecStart`, Node path와 port
- reverse proxy, TLS, firewall, health·readiness와 monitoring
- artifact 보관·승격·rollback, release owner와 승인 절차
- Node·Python 지원 version과 OS

### Risk

- 시작 시 build는 운영 restart를 toolchain·dependency 상태와 결합한다.
- graceful shutdown·drain·restart policy가 확인되지 않아 재시작 중 요청 손실 가능성을 평가할 수 없다.
- startup readiness가 없어 DB·mount 장애가 첫 요청에서 나타날 수 있다.
- absolute data path와 내부 오류가 response·log에 노출될 수 있다.
- runtime DB DDL 가능성은 code rollback과 DB rollback 경계를 다르게 만든다.

## 12. 근거

- `package.json`, `package-lock.json` — npm script·dependency·lock
- `server.mjs:35-40,65-87,263-304` — build, static/live mode, listen·오류
- `vite.config.mjs:118-145` — Vite port·allowed host·HMR
- `scripts/requirements.txt`, `server/*.mjs` — Python dependency·child process
- `docs/system/environment-definition.md` — 환경변수·외부 의존성
- `docs/system/architecture.md`, `docs/system/data-flow.md` — runtime·데이터 경계
- `docs/system/security.md` — 비밀·권한·log 정책
- `reports/audit/system-inventory.md` — tracked 배포 자산 부재와 Mismatch

실제 배포, build, test, server, systemd, Docker, DB, mail과 `/appdata` 접근은 수행하지 않았다.

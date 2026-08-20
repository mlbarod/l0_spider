# L0 Spider systemd 운영 기준

## 1. 문서 목적과 현재 판정

이 문서는 L0 Spider가 systemd로 운영되는 경우 확인해야 할 unit 계약과 안전한 절차를 정의한다.
현재 checkout에는 tracked `*.service` unit이 없고 실제 운영 서버의 unit도 조사하지 않았다.
따라서 systemd 사용 자체와 모든 실제 field는 `Unknown`이다.

아래 명령은 모두 **이번 작업에서 실행하지 않은 운영자용 조건부 명령**이다.
실제 unit 이름과 권한을 운영자가 확인하기 전에는 실행하지 않는다.

배포 구조는 [deployment](../system/deployment.md), 일상 점검은 [runbook](runbook.md), 장애 대응은 [troubleshooting](troubleshooting.md)을 따른다.

## 2. 후보 정보 대조

| 후보 | 저장소 근거 | 판정 | 사용 원칙 |
|---|---|---|---|
| `server.mjs` | `package.json`의 `start`, `preview` | 진입점 `Confirmed` | 실제 `ExecStart`는 별도 확인 |
| `PORT=32640` | 코드·tracked 문서에서 발견하지 못함 | `Unknown` | 코드 fallback `5173`과 구분 |
| `/usr/local/node-v24.16.0/bin/node` | Node version·절대 path 선언 없음 | `Unknown` | 실제 host에서 owner가 확인 |
| `/etc/systemd/system/l0-spider.service` | tracked unit·운영 unit 미조사 | `Unknown` | 실제 unit 이름·fragment path 확인 |

후보를 예시 unit에 복사하거나 `Confirmed`로 표현하지 않는다.

## 3. Unit field 확인표

| field | 현재 확인 결과 | 요구되는 확인 | 상태 |
|---|---|---|---|
| unit 이름·위치 | tracked file 없음 | `FragmentPath`와 unit 이름 | `Unknown` |
| `User` | 없음 | 비-root 최소권한 user | `Unknown` |
| `Group` | 없음 | source·data·credential 접근 group | `Unknown` |
| `WorkingDirectory` | 없음 | release root의 절대 경로 | `Unknown` |
| `ExecStart` | 앱 진입점은 `node server.mjs` | 실제 Node 절대 path·argument | `Unknown` |
| `Environment` | 코드가 환경변수 소비 | 실제 이름·값 주입 | `Unknown` |
| `EnvironmentFile` | tracked file 없음 | 존재·owner·mode·optional 여부 | `Unknown` |
| `PORT` | 코드 fallback `5173` | 실제 운영 port | `Unknown` |
| `Restart` | 설정 없음 | 실패·정상 종료별 policy | `Unknown` |
| `RestartSec` | 설정 없음 | restart backoff | `Unknown` |
| `TimeoutStartSec` | 설정 없음 | 시작 build·mount 지연 경계 | `Unknown` |
| `TimeoutStopSec` | 설정 없음 | graceful shutdown 부재 영향 | `Unknown` |
| `KillSignal` | 설정 없음 | Node 종료 signal·drain | `Unknown` |
| resource limit | 설정 없음 | memory·CPU·open file | `Unknown` |
| hardening | 설정 없음 | filesystem·privilege 제한 | `Unknown` |
| journal | app은 stdout/stderr 사용 | journal 연결·보존·권한 | `Unknown` |

## 4. 애플리케이션 권한 경계

systemd 실행 user는 다음 최소 범위만 가져야 한다.

- application source, `dist/`, `server/`, `scripts/` 읽기
- 필요한 Node module과 Python package 읽기·실행
- build를 unit 시작 중 수행한다면 `dist/` 쓰기; 그렇지 않으면 runtime 쓰기 불필요
- mapping, Parquet와 image의 필요한 root 읽기
- `DB_INFO_PATH` credential file 읽기
- 설정된 비특권 port bind와 DB network 접근

분석 `/appdata` write, credential 수정, source 수정과 광범위한 DB 권한을 기본으로 부여하지 않는다.
현재 실제 owner·mode·ACL과 application user는 `Unknown`이다.

## 5. Environment 주입

현재 코드가 소비하는 주요 이름은 다음과 같다.

- `HOST`, `PORT`, `LIVE_RELOAD`, `BUILD_ON_START`
- `VITE_SITE_URL`
- `MAPPING_CONFIG_PATH`, `COMMONALITY_ROOT_PATH`, `COMMON_COMMONALITY_ROOT_PATH`, `SPIDER_DASHBOARD_PATH_ROOT`
- `DB_INFO_PATH`

`REMOTE_ADDR`는 요청별 Python helper에 전달되는 내부 값이며 static unit 설정으로 고정하지 않는다.
실제 HMAC secret과 mail sender 환경변수는 구현·이름이 확인되지 않았다.

`EnvironmentFile`을 사용한다면 실제 값은 문서·journal·Git에 출력하지 않고 file owner와 mode를 제한한다.
`VITE_*`에는 browser bundle에 노출될 수 있는 secret을 넣지 않는다.

## 6. 실제 unit 확인 절차

다음 절차는 systemd 사용과 `<unit-name>`이 확인된 경우에만 수행한다.

```bash
# 실행하지 않은 운영자용 명령
systemctl show <unit-name> \
  -p FragmentPath -p User -p Group -p WorkingDirectory \
  -p ExecStart -p EnvironmentFiles -p Restart -p RestartUSec
systemctl cat <unit-name>
systemctl status <unit-name> --no-pager
```

출력에 credential·token·내부 주소가 포함될 수 있으므로 그대로 ticket이나 문서에 붙이지 않는다.
보고에는 민감값을 `<redacted>`로 처리하고 field 존재와 판정만 남긴다.

## 7. 상태·로그 확인

```bash
# 실행하지 않은 운영자용 명령
systemctl is-active <unit-name>
systemctl is-enabled <unit-name>
journalctl -u <unit-name> --since "<approved-time>" --no-pager
```

journal은 application stdout/stderr, build 출력과 Python helper 오류를 포함할 수 있다.
절대 path, DB detail, 사용자 식별값과 URL query를 공유하기 전에 마스킹한다.
실제 journal 보존·rotation·reader 권한은 `Unknown`이다.

## 8. `daemon-reload`와 unit 반영

Unit 또는 drop-in을 실제로 변경한 경우에만 다음 순서를 사용한다.

```bash
# 실행하지 않은 운영자용 명령
systemctl daemon-reload
systemctl show <unit-name> -p FragmentPath -p ExecStart -p EnvironmentFiles
systemctl restart <unit-name>
systemctl status <unit-name> --no-pager
```

`daemon-reload`는 application source만 변경한 경우의 일반 절차가 아니다.
restart 전에는 [deployment](../system/deployment.md)의 build·rollback·traffic 경계를 확인한다.
unit 변경 권한, 승인자와 무중단 정책은 `Unknown`이다.

## 9. Enable·start·stop·restart

다음은 실제 unit이 확인됐을 때의 표준 동작이며 이번 조사로 현재 운영 정책임을 확인한 것은 아니다.

```bash
# 실행하지 않은 운영자용 명령
systemctl enable <unit-name>
systemctl start <unit-name>
systemctl stop <unit-name>
systemctl restart <unit-name>
systemctl status <unit-name> --no-pager
```

- `enable`은 boot 자동 시작 정책을 변경하므로 운영 승인 후 수행한다.
- `stop`은 전체 서비스 중단 가능성이 있으므로 traffic·instance 수를 먼저 확인한다.
- `restart`는 graceful shutdown 구현이 확인되지 않았음을 전제로 영향 시간을 관리한다.
- 수동 `node server.mjs`와 managed unit을 동시에 실행하지 않는다.
- 실패가 반복되면 restart loop를 지속하지 말고 log와 dependency 상태를 확인한다.

## 10. 정상 판정

1. `is-active` 결과가 active이고 반복 restart가 없다.
2. `ExecStart`, working directory와 release commit이 계획과 일치한다.
3. 승인된 port에 단일 기대 process가 listen한다.
4. `/` liveness와 read-only 기능 점검이 통과한다.
5. journal에 `MODULE_NOT_FOUND`, `EADDRINUSE`, build 실패, DB·file permission 오류가 반복되지 않는다.
6. log에 secret·credential·운영 token이 출력되지 않는다.

전용 health endpoint가 없으므로 systemd active만으로 application readiness를 확정하지 않는다.

## 11. Mismatch·Unknown·Risk

### Mismatch

확인된 systemd unit과 저장소 설정 사이의 `Mismatch`는 unit을 조사하지 않았으므로 판정할 수 없다.

### Unknown

- systemd 사용 여부, unit 이름·위치와 drop-in
- `User`, `Group`, `WorkingDirectory`, `ExecStart`와 Node path
- 실제 port, `EnvironmentFile`, restart·timeout·resource policy
- journal 보존·rotation, 권한과 alert 연동
- boot enable 상태와 instance 수

### Risk

- 확인되지 않은 후보값으로 unit을 만들거나 제어하면 다른 service·port에 영향을 줄 수 있다.
- root 또는 광범위한 group 실행은 credential·운영 file·DB 권한을 확대한다.
- 시작 시 build는 restart 가용성을 npm·filesystem 쓰기 상태와 결합한다.
- restart loop는 DB·mount 장애를 증폭하고 원인 log를 빠르게 누적할 수 있다.
- journal 원문 공유는 내부 path·DB detail·사용자 정보를 노출할 수 있다.

## 12. 근거

- `package.json` — `start`, `preview`가 `node server.mjs`
- `server.mjs:35-40,65-87,291-304` — cwd 기반 path, 환경변수, 종료·log
- `docs/system/environment-definition.md` — service manager·환경 주입 `Unknown`
- `docs/system/security.md` — 실행 user·filesystem·journal 권한 경계
- `reports/audit/system-inventory.md` — tracked unit·Docker 설정 부재

실제 systemd unit 조회·제어와 운영 server 접근은 수행하지 않았다.

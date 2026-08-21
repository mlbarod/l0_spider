# L0 Spider 운영 Runbook

## 1. 목적과 사용 원칙

이 문서는 `main`의 L0 Spider를 일상 운영할 때 사전 점검, 상태 확인, service 제어, log 확인과 escalation 순서를 제공한다.
배포 판단은 [deployment](../system/deployment.md), systemd field와 명령은 [systemd](systemd.md), 증상별 조치는 [troubleshooting](troubleshooting.md)을 따른다.

현재 실제 service manager, unit 이름, application root, host·port와 운영 owner는 `Unknown`이다.
명령의 `<...>` placeholder를 운영자가 확인하기 전에는 실행하지 않는다.
모든 명령 블록은 **이번 작업에서 실행하지 않은 운영자용 명령**이다.

운영 DB 쓰기, 실제 mail 발송, `/appdata` 변경, secret 출력과 임의 service 재시작은 점검 절차에 포함하지 않는다.
`mock-agent`, mock server·데이터와 Playwright는 운영 runbook 범위가 아니다.

## 2. 운영 기준 정보 카드

운영 시작 전에 아래 값을 조직의 승인된 비밀정보가 아닌 저장 위치에 기록한다.

| 항목 | 저장소 기준 | 실제 운영값 |
|---|---|---|
| source 기준 | `main` | 배포 commit 확인 필요 |
| server 진입점 | `server.mjs` | `Confirmed` |
| package 명령 | `npm start` | service `ExecStart`는 `Unknown` |
| code port fallback | `5173` | 실제 port `Unknown` |
| service manager | tracked 설정 없음 | `Unknown` |
| systemd unit | tracked unit 없음 | `Unknown` |
| application root | 저장소 checkout 기준 | 실제 절대 경로 `Unknown` |
| liveness endpoint | 전용 endpoint 없음 | `/` HTTP 응답으로 제한 확인 |
| readiness | 단일 endpoint 없음 | dependency별 read-only 확인 |
| log | stdout/stderr | 수집 위치·보존 `Unknown` |
| escalation owner | 저장소에 없음 | `Unknown` |

`PORT=32640`, 특정 Node 절대 경로와 특정 service 경로는 현재 저장소에서 확인되지 않았다.

## 3. 교대·작업 전 사전 점검

1. 작업 ticket, 승인 범위, 대상 환경과 영향 시간을 확인한다.
2. 현재 장애인지 planned change인지 구분한다.
3. 실제 service manager·unit·instance 수·traffic 경로를 확인한다.
4. release commit과 실행 directory가 일치하는지 확인한다.
5. 최근 배포·환경·DB·data pipeline·mail 변경 여부를 확인한다.
6. log를 공유할 때 secret, 사용자 식별값, email, query와 절대 path를 마스킹한다.
7. stop·restart·enable·환경 변경 전 rollback 경계와 승인자를 확인한다.

```bash
# 실행하지 않은 운영자용 명령
cd <application-root>
git branch --show-current
git rev-parse --short HEAD
git status --short
```

dirty worktree가 있으면 변경 주체를 확인하기 전 pull, checkout, reset, clean 또는 overwrite를 하지 않는다.

## 4. 상태 확인

### 4.1 Process manager

systemd 사용이 확인된 경우에만 실행한다.

```bash
# 실행하지 않은 운영자용 명령
systemctl status <unit-name> --no-pager
systemctl is-active <unit-name>
systemctl show <unit-name> -p MainPID -p ActiveState -p SubState -p NRestarts
```

systemd가 아니면 실제 manager의 승인된 상태 명령을 사용한다.
저장소에 Docker·다른 process manager 명령은 확인되지 않았다.

### 4.2 Listener

실제 port를 먼저 service 설정에서 확인한다.
운영 host에 `ss`가 설치된 것이 확인된 경우에만 다음을 사용한다.

```bash
# 실행하지 않은 운영자용 조건부 명령
ss -ltnp 'sport = :<confirmed-port>'
```

code fallback `5173`을 실제 port로 가정하지 않는다.
예상하지 않은 PID가 listen하면 새 process를 시작하지 않고 port owner를 escalation한다.

### 4.3 Liveness

전용 `/health` endpoint는 없다.
승인된 base URL과 `curl` 사용 가능 여부가 확인된 경우 `/`의 HTTP 응답만 확인한다.

```bash
# 실행하지 않은 운영자용 조건부 명령
curl --fail --silent --show-error --head <base-url>/
```

이 확인은 Node·static/Vite 응답만 나타내며 DB와 `/appdata` readiness를 증명하지 않는다.

### 4.4 Dependency readiness

| 의존성 | 안전한 확인 | 정상 판정 | 금지 |
|---|---|---|---|
| Dashboard file | 승인된 read-only Dashboard 조회 | 계약된 payload 또는 설명 가능한 빈 상태 | `/appdata` 순회·수정 |
| mapping | 주요 화면의 Line·SDWT option | API 오류 없이 option 표시 | 실제 file 원문 공유 |
| DB | current-user 또는 등록 목록 read 흐름 | timeout·credential 오류 없음 | test row·DDL·직접 DB 접속 |
| Self/common | 승인된 기존 조회 조건 | filter·chart의 정상/계약된 빈 상태 | 운영 path를 임의 query로 입력 |
| STEP | MY EQP `step=ALL` | 전체 STEP 예약 분기 유지 | HMAC secret 추정·출력 |
| Mailing | 등록 화면과 template 존재 | 등록 read·자산 제공 | test mail 발송 |

실제 HMAC과 mail sender는 저장소에서 확인되지 않아 readiness 대상으로 확정하지 않는다.

### 4.5 Sensor 제외 설정

기본 설정 파일은 application root의 `config/sensor-exclusions.json`이며 웹 UI가 아닌 개발자·배포 담당자가 관리한다.
`PORT=<port> node server.mjs` 실행 시 별도 환경변수 없이 이 파일을 자동으로 읽는다.
source 밖의 파일이 필요한 환경에서만 `SENSOR_EXCLUSION_CONFIG_PATH`로 경로를 override한다.
형식은 기본 파일, `config/sensor-exclusions.example.json`과 `harness/contracts/sensor-exclusions.schema.json`을 기준으로 한다.
별도 서버의 파일 작성, 환경변수 주입, 검증, 반영 확인, 복구와 `ALL`·Mailing 경계는
[Sensor 제외 설정 운영 가이드](sensor-exclusion-config.md)를 단일 절차로 사용한다.

```bash
# 실행하지 않은 운영자용 명령
cd <application-root>
npm run sensor-exclusions:validate -- config/sensor-exclusions.next.json
```

활성 파일을 직접 편집하지 않고 같은 directory의 임시본을 검증한 뒤 기본 파일로 교체한다. 자세한 명령과 owner·mode 보존 절차는 전용 운영 가이드를 따른다.
검증된 기본 파일로 교체하면 프로세스 재build·재시작은 필요하지 않으며 다음 관련 API 요청에서 mtime·size 변경을 확인해 새 규칙을 읽는다.
최초 설정 읽기에 실패하면 server log에 고정 오류를 한 번 남기고 제외 없음으로 계속 동작한다. 정상 설정을 한 번 읽은 뒤 잘못된 JSON으로 바뀌면 마지막 정상 설정을 유지하며, 같은 파일 상태의 반복 오류 log는 억제한다.
실제 경로, 제외 단어와 내부 sensor 이름을 ticket·journal 원문으로 공유하지 않는다.

## 5. 시작·중지·재시작

### 5.1 시작

systemd와 unit이 확인된 경우:

```bash
# 실행하지 않은 운영자용 명령
systemctl start <unit-name>
systemctl status <unit-name> --no-pager
```

시작 전 port 중복, working directory, environment 주입과 `dist/index.html` 조건을 확인한다.
수동 `npm start`는 manifest상 유효하지만 managed service와 중복 실행할 수 있으므로 운영 service 시작 절차로 임의 사용하지 않는다.

### 5.2 중지

```bash
# 실행하지 않은 운영자용 명령
systemctl stop <unit-name>
systemctl is-active <unit-name>
```

graceful shutdown·drain과 다중 instance 구성이 확인되지 않았다.
중지 전에 traffic 영향과 DB helper 진행 요청을 운영자와 확인한다.

### 5.3 재시작

```bash
# 실행하지 않은 운영자용 명령
systemctl restart <unit-name>
systemctl status <unit-name> --no-pager
```

재시작은 설정·source 반영 필요성과 장애 원인이 확인된 뒤 수행한다.
DB·mount 장애 상태에서 반복 restart하지 않는다.
unit 변경이 있었다면 [systemd](systemd.md)의 조건부 `daemon-reload` 절차를 먼저 따른다.

## 6. Log 확인

systemd journal 사용이 확인된 경우:

```bash
# 실행하지 않은 운영자용 명령
journalctl -u <unit-name> --since "<approved-time>" --no-pager
```

우선 찾을 event:

- startup mode와 listen 성공
- `EADDRINUSE`, `MODULE_NOT_FOUND`, build 실패와 `dist/index.html is missing`
- Python helper timeout·exit·JSON parse 오류
- DB credential·connection·permission 오류
- mapping·Parquet·image file 누락·권한 오류
- 반복 `400`, `403`, `404`, `500`의 기능·시간대 분포

검색 결과를 공유할 때 URL query, email, 사용자 ID, credential, token, 내부 host와 실제 path를 제거한다.
application log file, journal retention·rotation과 alert rule은 `Unknown`이다.

## 7. 일상 점검

### 매 교대 또는 정기 점검

- process가 active이고 restart count가 급증하지 않았는지 확인
- `/` liveness와 주요 read-only 화면을 확인
- Dashboard 최신 시각이 data owner의 기대와 일치하는지 확인
- Self·동일성·공통부에서 file 없음·부분 image 오류가 증가하지 않았는지 확인
- DB 연계 read가 timeout 없이 동작하는지 확인
- mail 등록 기능 오류와 외부 sender 장애를 분리해 확인
- log에 secret·path·DB detail이 과도하게 남지 않는지 확인
- disk·memory·CPU·file descriptor 기준은 미정이므로 platform owner 기준을 사용

### 배포 후 점검

- 실행 commit과 artifact가 release 기록과 일치
- server mode가 계획한 live/static mode와 일치
- Vite 단독 route 범위 `Mismatch`가 운영 mode에 유입되지 않음
- 주요 API가 호환되고 `step=ALL` 링크가 유지
- 새 DB DDL, 실제 mail 발송과 운영 file write가 발생하지 않았는지 확인

## 8. 장애 분류와 초기 대응

| 등급 후보 | 조건 | 초기 대응 |
|---|---|---|
| 전체 중단 | process·listener·UI 전체 불가 | traffic 영향 확인, log 보존, manager 상태 확인 |
| 핵심 기능 장애 | Dashboard 또는 Self 전체 실패 | file·mapping·DB 경계로 분류 |
| 부분 장애 | 특정 SDWT·image·history만 실패 | 실패 path 범위와 부분 성공 보존 |
| 데이터 신선도 | 화면은 응답하나 latest가 오래됨 | producer·mount·cache owner 확인 |
| 보안·개인정보 | secret·사용자·path 노출 또는 오식별 | 공유 중단, 보안 owner 즉시 escalation |
| mail 사고 | 오발송·중복·수신자 혼합 | sender 차단 owner 호출; 앱 재시작으로 해결 추정 금지 |

상세 순서는 [troubleshooting](troubleshooting.md)을 사용한다.

## 9. Escalation

저장소에는 연락처와 조직별 owner가 없으므로 실제 escalation 대상은 `Unknown`이다.
다음 책임 범위로 전달한다.

| 장애 범위 | 전달 대상 후보 |
|---|---|
| process·artifact·Node | application/release owner |
| service·host·journal | platform/systemd owner |
| proxy·TLS·allowed host | network/proxy owner |
| Parquet·image·freshness | 분석 data producer·filesystem owner |
| DB·credential·schema | DB owner와 application owner |
| STEP/HMAC | feature·security owner |
| mail 발송·중복 | external sender/scheduler owner |
| secret·개인정보 | security/privacy owner |

Escalation 묶음에는 다음만 포함한다.

- 발생·종료 시각과 timezone
- 영향 화면·API와 재현 조건
- 배포 commit·mode·instance 범위
- HTTP status와 마스킹한 오류 요약
- 수행한 read-only 확인과 service 제어 여부
- 최근 변경, 정상/실패 경계와 rollback 판단
- `Unknown`인 owner·환경값과 필요한 승인

실제 credential, email, token, 내부 주소·서버명과 전체 운영 path는 첨부하지 않는다.

## 10. 정상화와 종료

1. 증상이 사라진 것뿐 아니라 원인 dependency가 정상인지 확인한다.
2. restart·rollback 후 release commit과 mode를 다시 확인한다.
3. 전체·핵심·부분 기능의 read-only 정상 판정을 기록한다.
4. DB write·mail·운영 file 변경이 없었는지 기록한다.
5. 남은 `Unknown`, recurrence risk와 후속 owner를 지정한다.
6. 임시 우회가 있다면 제거 조건과 만료 시점을 기록한다.

## 11. Mismatch·Unknown·Risk

### Mismatch

- `npm run dev`의 Vite API 범위는 통합 `server.mjs`보다 좁다.

### Unknown

- 실제 service manager·unit·instance·traffic 구조
- 실제 port·application root·Node path와 환경 주입
- 외부 health probe 구성, monitoring·alert·log 보존과 SLO
- 운영 owner·연락처·장애 등급·승인 체계
- data freshness SLA, DB·mail escalation 절차

### Risk

- 원인 미확인 반복 restart는 dependency 장애와 log 폭증을 악화시킬 수 있다.
- liveness 성공을 readiness로 오인하면 DB·file 장애를 놓칠 수 있다.
- log 공유 중 path·DB detail·사용자·token이 노출될 수 있다.
- IP 기반 사용자 식별은 proxy header 신뢰 설정에 의존한다.
- mail sender가 외부에 있어 application 상태와 실제 발송 상태가 분리된다.

## 12. 근거

- `server.mjs` — server mode, listen, startup·port 오류
- `package.json` — 확인된 실행·build·test 명령
- `docs/system/deployment.md` — 배포·rollback 경계
- `docs/system/environment-definition.md` — 환경변수와 외부 의존성
- `docs/system/security.md` — 비밀·log·권한 원칙
- `docs/features/{dashboard,self-equipment,step-deeplink,mailing,abnormal-data}.md` — 기능별 정상·오류 경계

실제 명령, server, test, build, DB, mail, `/appdata`와 systemd 제어는 수행하지 않았다.

# L0 Spider Troubleshooting

## 1. 사용 원칙

이 문서는 운영 장애를 `증상 → 확인 명령 → 가능한 원인 → 안전한 조치 → 정상 판정 → escalation` 순서로 다룬다.
일상 상태·service 제어는 [runbook](runbook.md), systemd 상세는 [systemd](systemd.md), 배포·rollback은 [deployment](../system/deployment.md)을 따른다.

아래 명령은 모두 **이번 작업에서 실행하지 않은 운영자용 명령**이다.
`<unit-name>`, `<application-root>`, `<base-url>`, `<confirmed-port>`와 `<expected-file>`은 실제 운영자가 확인해야 한다.
명령이나 log 출력의 secret, email, 사용자 식별값, token, 내부 host·서버명과 실제 path는 공유하지 않는다.

systemd, `curl`, `ss` 등 운영 도구의 실제 설치 여부는 저장소에서 확인되지 않았다.
조건부 명령은 해당 도구와 실행 권한이 확인된 경우에만 사용한다.
실제 DB 접속, mail 발송, `/appdata` 순회·수정과 무승인 service 재시작은 수행하지 않는다.

## 2. 공통 초기 분류

1. 장애 시작 시각과 timezone, 영향 화면·사용자 범위를 기록한다.
2. 전체 UI, 특정 API, 특정 data path, DB 연계, STEP 또는 mail 중 실패 경계를 나눈다.
3. 최근 release·환경·data pipeline·DB·proxy 변경을 확인한다.
4. HTTP status와 마스킹한 첫 오류를 확보한다.
5. restart 전에 process·listener·log·release commit을 보존한다.
6. 여러 장애가 동시에 보이면 process → static UI → read-only file → DB → 외부 sender 순으로 경계를 좁힌다.

## 3. 서버 미기동 또는 전체 접속 불가

### 증상

- `/`가 응답하지 않거나 connection refused다.
- service가 inactive·failed이거나 restart를 반복한다.

### 확인 명령

```bash
# 실행하지 않은 운영자용 조건부 명령
systemctl status <unit-name> --no-pager
systemctl show <unit-name> -p ActiveState -p SubState -p MainPID -p NRestarts
journalctl -u <unit-name> --since "<approved-time>" --no-pager
ss -ltnp 'sport = :<confirmed-port>'
```

### 가능한 원인

- unit·`ExecStart`·`WorkingDirectory` 또는 환경 주입 오류
- Node/Python dependency·`dist/index.html` 누락
- port 충돌, source permission 또는 build 실패
- DB·`/appdata` 장애가 아닌 process startup 자체의 실패

### 안전한 조치

- 실제 unit과 release path를 확인하고 첫 startup 오류를 해결한다.
- port owner가 확인되지 않으면 새 process를 추가로 시작하지 않는다.
- unit 변경 시에만 승인 후 `daemon-reload`를 사용한다.
- 원인이 외부 dependency라면 restart loop를 중단하고 해당 owner에게 전달한다.

### 정상 판정

- process가 active이고 restart count가 증가하지 않는다.
- 승인된 port의 예상 process와 `/` HTTP 응답이 정상이다.
- startup journal에 같은 fatal 오류가 반복되지 않는다.

### Escalation

unit·host는 platform owner, artifact·Node startup은 application/release owner에게 전달한다.
graceful restart·traffic 구조가 `Unknown`이면 운영 승인 없이 반복 재시작하지 않는다.

## 4. `MODULE_NOT_FOUND`

### 증상

Node 시작·build 또는 Python helper에서 module import 오류가 발생한다.

### 확인 명령

```bash
# 실행하지 않은 운영자용 명령
cd <application-root>
git rev-parse --short HEAD
git status --short
node --version
npm --version
```

Python 오류이면 실제 service user의 Python 경로와 `scripts/requirements.txt` 설치 상태를 별도로 확인한다.

### 가능한 원인

- release와 `node_modules` 또는 Python dependency가 동기화되지 않음
- 잘못된 working directory·Node path·Python interpreter
- incomplete artifact 또는 permission 오류
- Node/Python version 비호환; 지원 version은 저장소에서 `Unknown`

### 안전한 조치

- `package.json`, `package-lock.json`, `scripts/requirements.txt`와 release commit을 대조한다.
- 승인된 배포 절차로 dependency를 복구한다. 운영 중 임의 package version을 추가하지 않는다.
- source import path 문제면 current `main`과 실제 artifact 차이를 확인한다.

README에 확인된 설치 명령은 다음이지만 운영 적용은 release owner 승인 후 수행한다.

```bash
# 실행하지 않은 운영자용 명령
npm install
python3 -m pip install -r scripts/requirements.txt
```

### 정상 판정

동일 release로 build 또는 service startup이 성공하고 module 오류가 재발하지 않는다.

### Escalation

runtime version·global path는 platform owner, lockfile·source import는 application owner에게 전달한다.

## 5. Port 충돌 또는 `EADDRINUSE`

### 증상

server가 `Port ... is already in use`를 기록하고 종료한다.

### 확인 명령

```bash
# 실행하지 않은 운영자용 조건부 명령
systemctl status <unit-name> --no-pager
ss -ltnp 'sport = :<confirmed-port>'
```

### 가능한 원인

- 기존 managed process와 수동 `node server.mjs`의 중복 실행
- 다른 service가 같은 port 사용
- 배포 중 이전 instance가 종료되지 않음
- 실제 `PORT`와 문서·proxy target 불일치

### 안전한 조치

- PID·service owner를 확인하고 임의 kill하지 않는다.
- 승인된 unit 하나만 실행되도록 중복 시작 원인을 제거한다.
- 다른 port 사용은 proxy·firewall·monitoring 영향 확인 후 승인된 설정으로만 변경한다.

### 정상 판정

승인된 port에 예상 process 하나만 listen하고 service가 안정적으로 active다.

### Escalation

port owner 불명은 platform/network owner, 중복 배포는 release owner에게 전달한다.
코드 fallback은 `5173`이지만 실제 운영 port와 `32640` 후보는 `Unknown`이다.

## 6. Vite `allowedHosts` 또는 HMR 접속 오류

### 증상

Vite가 host를 허용하지 않거나 개발 HMR 연결이 실패한다.
일부 화면은 열리지만 통합 server에만 있는 API가 `404`일 수 있다.

### 확인 명령

```bash
# 실행하지 않은 운영자용 명령
cd <application-root>
git rev-parse --short HEAD
```

실제 실행 mode와 `VITE_SITE_URL` 존재 여부는 값을 노출하지 않는 승인된 service 설정 조회로 확인한다.

### 가능한 원인

- `npm run dev` Vite 단독 mode에서 허용되지 않은 host 사용
- `VITE_SITE_URL`과 접속 host 불일치
- proxy·TLS WebSocket 전달 문제
- Vite 단독 API route가 `server.mjs`보다 좁은 기존 `Mismatch`

### 안전한 조치

- 실제 목적이 통합 L0 Spider라면 운영 mode를 `server.mjs` 기준으로 확인한다.
- host allowlist·proxy를 임의 완화하지 말고 network owner와 필요한 host만 승인한다.
- HMR이 필요 없는 정적 운영 mode인지 먼저 확인한다.

### 정상 판정

승인된 host에서 UI와 필요한 API가 같은 mode로 동작하고 HMR 필요 시 WebSocket 오류가 없다.

### Escalation

host·TLS·WebSocket은 proxy/network owner, route 차이는 application owner에게 전달한다.

## 7. DB 연결·현재 사용자·등록 기능 실패

### 증상

- current-user, MY EQP·Mailing 등록, PASS·HIT·click 이력 API가 timeout 또는 `500`이다.
- Python helper exit·JSON parse·credential permission 오류가 기록된다.

### 확인 명령

```bash
# 실행하지 않은 운영자용 조건부 명령
journalctl -u <unit-name> --since "<approved-time>" --no-pager
test -r <confirmed-db-info-path>
```

`DB_INFO_PATH` 실제 값과 credential file 내용을 출력하지 않는다.

### 가능한 원인

- credential file 누락·읽기 권한·형식 오류
- DB network·account·schema·permission 장애
- Python dependency 또는 helper timeout
- proxy header 신뢰·사용자 IP mapping 문제
- runtime `ALTER TABLE` 권한과 schema 상태 불일치

### 안전한 조치

- credential 존재·read permission만 확인하고 원문은 열거나 복사하지 않는다.
- 직접 DB query나 test write 대신 DB owner에게 connection·account 상태를 요청한다.
- registration·history write를 재시도하기 전에 중복·부분 commit 여부를 확인한다.
- DDL 권한 문제를 application account 권한 확대로 즉시 해결하지 않는다.

### 정상 판정

승인된 read 흐름이 timeout 없이 성공하고 기존 row 범위가 유지된다.
write 기능은 실제 test row를 만들지 않고 운영 증거 또는 승인된 절차로 확인한다.

### Escalation

credential·network·schema는 DB/platform owner, helper payload·오류 변환은 application owner에게 전달한다.
사용자 오식별은 security/privacy owner도 포함한다.

## 8. `/appdata` 파일 누락 또는 권한 오류

### 증상

mapping, Dashboard, Self, 동일성·공통부 API가 file 없음·permission 오류로 실패한다.

### 확인 명령

대상 기능이 이미 보고한 정확한 `<expected-file>`만 확인하고 root를 순회하지 않는다.

```bash
# 실행하지 않은 운영자용 조건부 명령
test -e <expected-file>
test -r <expected-file>
stat <expected-file>
```

### 가능한 원인

- mount 미준비·해제, producer 지연 또는 파일 보존·정리
- index가 아직 없는 sibling data/image를 가리키는 부분 publish
- application user의 read permission·ACL·symlink 문제
- data root 환경변수와 code path 불일치

### 안전한 조치

- 파일을 생성·복사·이동·chmod하거나 다른 운영 path로 우회하지 않는다.
- data/filesystem owner에게 expected path, 시각과 기능 범위를 마스킹해 전달한다.
- history file만 실패한 부분 성공과 주 data 실패를 구분한다.
- cache 문제로 단정하기 전에 source file publish·mtime 상태를 확인한다.

### 정상 판정

필요한 exact file이 read 가능하고 해당 read-only API가 정상 또는 계약된 부분 결과를 반환한다.

### Escalation

mount·ACL·보존은 filesystem owner, producer 지연·Schema는 data owner, path resolver는 application owner에게 전달한다.

## 9. Dashboard 빈 데이터·오래된 데이터

### 증상

Dashboard가 0건·빈 chart·오래된 latest 시각을 보이거나 `404`·`500`이다.

### 확인 명령

```bash
# 실행하지 않은 운영자용 조건부 명령
journalctl -u <unit-name> --since "<approved-time>" --no-pager
curl --fail --silent --show-error <base-url>/api/dashboard-data
```

API payload를 ticket에 그대로 첨부하지 말고 status, latest 시각과 count 요약만 기록한다.

### 가능한 원인

- 유효한 날짜·시각 detail file 없음
- latest detail에 대응하는 stats·mapping 누락
- Line mapping 제외 또는 실제 정상 0건
- producer 지연·timezone 차이·cache freshness
- root override·permission·Schema 오류

### 안전한 조치

- 빈 성공과 HTTP 오류를 구분한다.
- expected latest 기준을 data owner에게 확인하고 filename timezone을 추정하지 않는다.
- Dashboard root를 순회·수정하거나 이전 file을 latest로 이름 변경하지 않는다.
- 특정 날짜만 누락된 trend 0과 전체 latest 실패를 구분한다.

### 정상 판정

API가 계약된 구조를 반환하고 latest·Line count가 data owner의 승인된 기준과 일치한다.

### Escalation

file 생성·freshness는 data owner, mapping·집계·API 계약은 application owner에게 전달한다.

## 10. STEP 딥링크·HMAC 오류

### 증상

- `/self-equipment` 링크에서 STEP이 선택되지 않는다.
- `step=ALL` MY EQP 또는 `eqpCh` 초기 선택이 기대와 다르다.
- 비-`ALL` token이 검증되지 않는 것처럼 보인다.

### 확인 명령

server 명령보다 browser URL의 query 이름·중복·encoding을 민감값 없이 비교한다.
실제 token, query 전체와 사용자 정보를 log·ticket에 복사하지 않는다.

```text
실행하지 않은 운영자용 확인 항목:
line, sdwt, grade, step, eqpCh의 존재와 query 이름만 확인
```

### 가능한 원인

- `sdwt=MY_EQP`에서 `step`이 현재 계약대로 `ALL`로 강제됨
- `eqpCh`·`eqp_ch`, 반복 query 또는 URL encoding 차이
- 비-`ALL` HMAC 생성·검증·매핑 구현이 현재 저장소에 없음
- Self data·mapping·registration 조회 실패

### 안전한 조치

- `step=ALL` 예약 분기와 일반 STEP 후보를 구분한다.
- secret·algorithm·token을 추정하거나 임의 환경변수를 추가하지 않는다.
- 비-`ALL` 링크를 운영 설정 문제로 단정하지 말고 현재 `Mismatch`로 application/security owner에게 전달한다.

### 정상 판정

현재 확인된 계약에서는 MY EQP `step=ALL`, query round trip과 `eqpCh` 선택이 유지된다.
비-`ALL` HMAC 성공 기준은 구현이 없어 `Unknown`이다.

### Escalation

URL producer·Self 화면은 application owner, HMAC 요구·secret 경계는 security/feature owner에게 전달한다.

## 11. Mail 등록 또는 실제 발송 실패

### 증상

- Mailing 등록 API가 실패한다.
- template 자산이 깨지거나 실제 mail이 미발송·중복·오발송된다.

### 확인 명령

```bash
# 실행하지 않은 운영자용 조건부 명령
journalctl -u <unit-name> --since "<approved-time>" --no-pager
```

수신자 주소, 본문, recipient list와 credential을 출력하지 않는다.

### 가능한 원인

- 등록 DB helper·credential·validation 오류
- `public/mailing-report.html`과 외부 renderer context 불일치
- 외부 scheduler·sender·mail transport 장애
- retry·dedupe·timeout 정책 부재 또는 저장소 밖 변경
- Dashboard mailing summary와 sender 소비 경계 불일치

### 안전한 조치

- 등록 저장과 실제 발송 단계를 분리한다.
- test mail을 보내거나 운영 수신자를 검증 대상으로 사용하지 않는다.
- 중복·오발송이면 application restart보다 external sender owner의 발송 차단 절차를 우선한다.
- template 원문과 개인정보를 ticket에 첨부하지 않는다.

### 정상 판정

등록 read·validation은 오류 없이 동작하고 template 자산이 기대 위치에 있다.
실제 발송의 성공 기준은 sender 구현이 저장소에 없어 external owner가 판정한다.

### Escalation

등록 API는 application/DB owner, renderer·scheduler·transport·중복은 external mail owner에게 전달한다.
오발송은 privacy/security owner를 즉시 포함한다.

## 12. 일반 파일·실행 권한 오류

### 증상

`EACCES`, permission denied, build output 쓰기 실패 또는 credential read 실패가 발생한다.

### 확인 명령

```bash
# 실행하지 않은 운영자용 조건부 명령
systemctl show <unit-name> -p User -p Group -p WorkingDirectory
test -r <required-read-file>
test -w <approved-build-output-directory>
```

### 가능한 원인

- unit user/group과 release·dist owner 불일치
- runtime build가 `dist/` write를 요구하지만 read-only 배치
- credential·data file의 최소 read 권한 누락
- mount ACL·symlink 또는 상위 directory execute permission 문제

### 안전한 조치

- 광범위한 `chmod`, `chown`, root 실행으로 우회하지 않는다.
- 필요한 read·build write·DB 권한을 분리해 platform owner에게 요청한다.
- 정적 artifact가 사전 build됐다면 runtime build 비활성 정책 채택 여부를 release owner와 확인한다.

### 정상 판정

확인된 service user가 필요한 최소 file만 읽고, 승인된 build 단계만 `dist/`에 쓸 수 있다.

### Escalation

filesystem·unit identity는 platform owner, 필요 권한 범위는 application/security owner에게 전달한다.

## 13. Build 또는 `dist/index.html` 실패

### 증상

정적 mode 시작 중 build가 실패하거나 `dist/index.html is missing` 오류가 발생한다.

### 확인 명령

```bash
# 실행하지 않은 운영자용 명령
cd <application-root>
git rev-parse --short HEAD
git status --short
npm run build
```

### 가능한 원인

- frontend compile·dependency 오류
- `BUILD_ON_START=0`인데 artifact 누락
- build output permission·disk 문제
- source와 dependency·artifact commit 불일치

### 안전한 조치

- build 오류를 숨기거나 오래된 `dist`를 임의 복사하지 않는다.
- 승인된 release artifact를 다시 만들고 source commit과 연결한다.
- service restart 전에 build 성공과 `dist/index.html` 존재를 확인한다.

### 정상 판정

`npm run build`가 성공하고 계획한 static mode에서 `/`와 SPA route가 정상 응답한다.

### Escalation

source compile은 application owner, disk·permission·artifact 배포는 release/platform owner에게 전달한다.

## 14. 공통 종료 및 재발 방지

- 원인, 영향, 정상화 시각과 수행한 service 제어를 기록한다.
- 실제 DB write, mail 발송, 운영 file·환경 변경 여부를 명시한다.
- 임시 우회의 owner·만료·제거 조건을 남긴다.
- `Unknown`이 원인이었다면 [deployment](../system/deployment.md), [runbook](runbook.md) 또는 [systemd](systemd.md)의 근거 상태를 후속 갱신한다.
- code·설정·문서 차이는 추정 수정하지 않고 `Mismatch`로 등록한다.

## 15. Mismatch·Unknown·Risk

### Mismatch

- Vite 단독 mode와 통합 server의 API route 범위가 다르다.
- 비-`ALL` STEP HMAC 후보와 달리 현재 생성·검증·매핑 구현이 없다.
- 환경변수는 코드에 있으나 tracked 예제·service 주입 설정은 없다.

### Unknown

- 실제 service manager·unit·port·Node path·application root
- health/readiness, monitoring·alert와 log 보존
- data producer schedule·timezone·freshness SLA
- DB owner·migration·backup과 mail sender·retry·dedupe
- 실제 rollback·traffic·escalation 절차

### Risk

- restart 중심 대응은 외부 dependency 장애와 부분 commit을 숨길 수 있다.
- file·DB 오류 원문에는 내부 path와 상세정보가 포함될 수 있다.
- exact file 확인을 넘어 `/appdata`를 순회하면 운영 부하·노출 위험이 있다.
- mail 오발송과 DB write는 application rollback만으로 복구되지 않는다.
- proxy header·URL query·journal은 사용자·STEP 정보 노출 경계다.

## 16. 근거

- `server.mjs:65-87,291-304` — build·dist·port·startup 오류
- `vite.config.mjs:126-145` — port·allowedHosts·HMR
- `docs/features/dashboard.md` — 빈 데이터·file 오류
- `docs/features/self-equipment.md`, `docs/features/abnormal-data.md` — DB·Parquet·image·부분 결과
- `docs/features/step-deeplink.md`, `docs/decisions/ADR-003-step-hmac-token.md` — 현재 HMAC 공백
- `docs/features/mailing.md` — 등록과 외부 sender 경계
- `docs/system/environment-definition.md`, `docs/system/security.md` — 환경·권한·log 경계

실제 장애 재현, server·test·build 실행, systemd 제어, DB·mail·`/appdata` 접근은 수행하지 않았다.

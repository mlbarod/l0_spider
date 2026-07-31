# L0 Spider 백업·복구 기준

| 항목 | 내용 |
|---|---|
| 문서 목적 | L0 Spider 자산의 백업 책임과 부분·전체 복구 순서를 정의한다. |
| 기준 브랜치 | `main` |
| 기준 commit | `0f4cfbe` |
| 조사 범위 | 저장소와 기존 기준 문서의 정적 조사 |
| 조사 제외 | 실제 backup, DB, `/appdata`, `.env`, secret, systemd와 운영 server |

## 1. 범위와 사용 원칙

이 문서는 자산 분류, 백업 준비, 복구 순서와 복구 후 검증의 기준이다.
릴리스 판단은 [release-checklist](release-checklist.md), 상세 운영은 [runbook](runbook.md), systemd는 [systemd](systemd.md), 장애 대응은 [troubleshooting](troubleshooting.md)을 따른다.
배포 단위·rollback 경계는 [deployment](../system/deployment.md), 비밀정보와 권한은 [security](../system/security.md)를 우선한다.

- Git에 있는 자산과 저장소 밖 운영 자산을 같은 backup으로 간주하지 않는다.
- 실제 backup 명령, DB dump 도구, snapshot 방식과 저장 위치는 저장소에서 확인되지 않아 만들지 않는다.
- 실제 값, email, token, HMAC secret, credential, 내부 주소와 운영 data를 이 문서나 Git에 기록하지 않는다.
- `mock-agent` 자산은 `main`의 Core Harness 백업·복구 필수 구성요소가 아니다.
- 삭제·overwrite·schema 변경 전에 별도 승인, 대상 확인, 무결성 검증과 복구 가능성 확인이 필요하다.

상태는 `Confirmed`, `Documented`, `Unknown`, `Mismatch`를 사용하고 데이터 손실·노출·호환성 위험은 `Risk`로 구분한다.

## 2. 자산 분류

| ID | 자산 | 확인된 위치·형태 | Git 복구 | 별도 backup | 책임 경계 | 상태 |
|---|---|---|---|---|---|---|
| `BR-A01` | 애플리케이션 source | `src/`, `server/`, `server.mjs`, `scripts/` | 가능 | release artifact는 별도 정책 | 저장소 owner | `Confirmed` |
| `BR-A02` | manifest·lock | `package.json`, `package-lock.json`, `scripts/requirements.txt` | 가능 | runtime package cache 불필요 | 저장소 owner | `Confirmed` |
| `BR-A03` | 시스템·기능·운영 문서 | `docs/`, `AGENTS.md`, README·구조 문서 | 가능 | 외부 승인 기록은 별도 | 저장소 owner | `Confirmed` |
| `BR-A04` | API·메일 계약 | `harness/contracts/` | 가능 | 없음 | Core Harness owner | `Confirmed` |
| `BR-A05` | synthetic fixture·test | `harness/fixtures/`, `tests/` | 가능 | 운영 data를 섞지 않음 | Core Harness owner | `Confirmed` |
| `BR-A06` | 메일 template | `public/mailing-report.html` | 가능 | 외부 renderer 설정은 별도 | template은 저장소, sender는 외부 | `Confirmed`/외부 `Unknown` |
| `BR-A07` | user manual·image | `docs/user-manual/` | 가능 | 생성 도구 결과와 일치 검증 | 저장소 owner | `Confirmed` |
| `BR-A08` | frontend build | `dist/` | Git ignored | 재build 또는 artifact 보관 필요 | release owner `Unknown` | 생성 방식 `Confirmed` |
| `BR-A09` | Node·Python dependency | `node_modules/`, 설치된 Python package | Git 제외 | manifest로 재설치; runtime image 정책 별도 | platform/release owner `Unknown` | `Confirmed` |
| `BR-A10` | runtime 환경설정 | process environment, `.env` 후보 | 불가·Git 금지 | 승인된 secret/config backup 필요 | platform owner `Unknown` | 방식 `Unknown` |
| `BR-A11` | DB credential file | `DB_INFO_PATH`가 가리키는 file | 불가·Git 금지 | 보안 저장소에서 별도 | platform·DB owner `Unknown` | 소비 `Confirmed` |
| `BR-A12` | 업무 DB | 사용자·등록·PASS·HIT·click 이력·기준정보 | 불가 | DB owner backup 필요 | DB owner `Unknown`; L0 일부 write | 사용 `Confirmed` |
| `BR-A13` | mapping·분석 file | `/appdata`의 JSON·Parquet·image | 불가 | filesystem/data owner backup 필요 | producer·filesystem owner `Unknown` | L0 read `Confirmed` |
| `BR-A14` | HMAC secret | 현재 이름·구현 없음 | Git 금지 | 도입 시 secret store backup·rotation 필요 | security owner `Unknown` | `Unknown` |
| `BR-A15` | mail sender 설정 | renderer·scheduler·transport·credential | 불가 | 외부 시스템에서 별도 | mail owner `Unknown` | 구현 `Unknown` |
| `BR-A16` | service·network 설정 | systemd unit, proxy, TLS, firewall | tracked 설정 없음 | 존재 시 platform backup 필요 | platform/network owner `Unknown` | `Unknown` |
| `BR-A17` | application·journal log | stdout/stderr, 외부 collector 후보 | 불가 | 보존 정책에 따른 별도 archive | platform/security owner `Unknown` | 출력 `Confirmed`, 보존 `Unknown` |

## 3. Git으로 복구 가능한 범위

Git은 reachable commit에 포함된 source, 문서, 계약, fixture, test와 template을 복구 근거로 사용할 수 있다.
다음 조건이 충족돼야 한다.

- 대상 commit·branch·tag 또는 remote reference가 실제로 존재한다.
- uncommitted 사용자 변경이 별도로 보존돼 있다.
- source와 contract·fixture·test·문서를 같은 release 기준으로 선택한다.
- `package-lock.json`과 manifest를 source와 분리하지 않는다.
- submodule·LFS 사용은 현재 확인되지 않았으므로 있다고 가정하지 않는다.

Git 상태 확인에 사용할 수 있는 명령은 기존 배포 문서에서 확인된 다음 범위다.

```bash
# 실행하지 않은 운영자용 명령
git branch --show-current
git rev-parse --short HEAD
git status --short
```

Git은 다음을 복구하지 않는다.

- 실제 `.env`, process environment와 secret
- DB credential file과 DB row·schema
- `/appdata` mapping·Parquet·image
- `dist/`, installed dependency와 host runtime
- systemd·proxy·TLS·firewall의 저장소 밖 설정
- 외부 mail renderer·sender 설정과 발송 이력
- journal·중앙 log와 외부 승인 기록

## 4. 자산 소유권과 책임 경계

| 자산군 | L0 Spider 책임 | 외부 책임 | 복구 시 합의 |
|---|---|---|---|
| source·Core 문서·계약 | version과 호환성 관리 | Git hosting 가용성 후보 | release commit·remote 보존 |
| `dist/` | build 가능 source 제공 | artifact 생성·보관·승격 | source-artifact 동일성 |
| DB | helper를 통한 read와 일부 write | engine·backup·restore·권한·schema 관리 | 일관 시점·DDL·row 검증 |
| `/appdata` | path 검증·read·집계·stream | 생성·publish·mount·보존·backup | index·data·image 동시점 |
| HMAC | 현재 구현 없음 | 향후 secret 관리 owner 필요 | key version·기존 link 영향 |
| Mailing | summary·등록·template | recipient 해석·render·schedule·send | 오발송 차단·발송 이력 |
| service·network | app 환경 이름·listen 지원 | unit·proxy·TLS·firewall | 실제 port·host·권한 |
| log | stdout/stderr와 오류 생성 | 수집·masking·보존·접근 | 사고 조사와 개인정보 |

운영 file 생성 주체를 L0 Spider로 간주하지 않는다.
L0 Spider는 분석 결과의 read consumer이며 DB에는 등록·이력 기능으로 실제 write할 수 있다.

## 5. 비밀정보 백업 원칙

- 실제 `.env`, credential pickle, 인증서, token, HMAC secret과 mail credential을 Git에 추가하지 않는다.
- 일반 운영 문서, ticket, chat, fixture와 test output에 값을 복사하지 않는다.
- backup 대상 목록에는 secret 이름·owner·version·복구 확인 상태만 기록하고 값은 기록하지 않는다.
- secret backup은 승인된 secret manager 또는 조직 보안 절차를 사용해야 하나 현재 방식은 `Unknown`이다.
- 복구 과정에서 secret을 명령행 argument나 journal에 노출하지 않는다.
- HMAC이 도입되면 이전 secret 복구가 기존 link 유효성에 미치는 영향과 rotation 정책을 별도 승인한다.
- mail recipient와 실제 email 주소는 개인정보 자산으로 별도 접근통제·보존 정책을 적용한다.

## 6. 백업 전 점검

백업 실행 전에 다음을 기록한다.

1. 대상 환경, 자산 ID, owner와 승인 번호
2. 기준 release commit과 application mode
3. backup 기준 시각과 timezone
4. DB write·data publish·mail job의 동시 실행 여부
5. DB, index Parquet, sibling data/image 간 일관 시점 요구
6. secret·개인정보 포함 여부와 암호화·접근권한
7. 저장 위치·용량·보존기간·삭제 승인자
8. 복구 검증 방법과 책임자

DB transaction-consistent backup, filesystem snapshot, application quiesce와 mail job 정지 방식은 확인되지 않았다.
해당 방식이 확정되지 않으면 일관된 전체 backup이라고 판정하지 않는다.

## 7. 백업 결과 확인

실제 도구에 독립적으로 다음 증거가 필요하다.

- 자산별 성공·실패·제외 목록과 backup 시각
- source commit, contract와 artifact version의 대응
- DB schema와 row backup의 동일 시점 정보
- `/appdata` index·data·image·mapping의 포함 범위
- file count·size·checksum 등 승인된 무결성 결과
- encrypted secret backup의 존재·접근 가능 여부만 확인한 기록
- restore test 또는 별도 격리 환경의 검증 결과
- RPO·RTO 기준 충족 여부; 기준이 없으면 `Unknown`

backup command 성공만으로 복구 가능성을 확정하지 않는다.
실제 restore 검증 없이 `Verified`라고 표시하지 않는다.

## 8. 복구 유형

| 유형 | 목적 | 포함 범위 | 주의 |
|---|---|---|---|
| 부분 복구 | 단일 file·설정·DB table·artifact 문제 | 영향 자산만 | cross-resource 일관성 확인 |
| 전체 복구 | service·DB·file store의 광범위한 손실 | 모든 필수 자산 | owner 공동 승인·복구 순서 필요 |
| 서버 이전 | 새 host·runtime·mount·network로 이동 | source+config+data 연결+service | path·권한·proxy·secret 재검증 |
| release rollback | 최근 code/artifact 변경 취소 | 이전 compatible release | DB·mail·data side effect는 별도 |

Rollback은 disaster recovery와 같지 않다.
서버 이전은 backup copy만이 아니라 runtime, permission, mount, port, proxy와 monitoring 재구성을 포함한다.

## 9. 권장 복구 순서

실제 복구 명령은 확인되지 않았으며 아래는 의존성 순서다.

1. **사고 범위 고정**: 손실 자산·마지막 정상 시점·write·mail 영향을 기록한다.
2. **승인과 격리**: overwrite·삭제·traffic 전환 전에 owner 승인과 대상 식별을 완료한다.
3. **기반 환경**: OS·Node·Python·filesystem·network 기준을 확인한다. 지원 version은 `Unknown`이다.
4. **source 기준선**: 선택한 Git commit의 source·문서·계약·test를 함께 확보한다.
5. **dependency·artifact**: manifest 기준 dependency와 계획한 `dist/`를 준비하고 source 동일성을 확인한다.
6. **service config·secret**: 환경 이름, credential location과 필요한 secret version을 승인된 저장소에서 복구한다.
7. **운영 file**: mapping과 `/appdata` index·Parquet·image를 일관 시점으로 복구하고 read permission을 확인한다.
8. **DB**: schema·기준정보·등록·이력 row를 DB owner 절차로 복구하고 file identity와 시점을 대조한다.
9. **Mailing 경계**: external sender는 recipient·context·중복 상태가 확인될 때까지 발송 차단 상태를 유지한다.
10. **service 반영**: 확인된 manager 절차로 시작하고 liveness 후 dependency readiness를 확인한다.
11. **기능 검증**: Dashboard → Self·abnormal → DB read → STEP `ALL` → Mailing 등록 순으로 read-only 검증한다.
12. **승인·관찰**: log·data freshness·오류를 확인하고 traffic·mail 재개를 owner가 승인한다.

실제 mail sender 차단 기능과 HMAC secret은 현재 저장소에서 확인되지 않았다.
없다고 확정하거나 임의 설정을 추가하지 않는다.

## 10. 자산별 복구 영향

| 자산 | 잘못된 복구의 영향 | 필수 동시 확인 |
|---|---|---|
| code·`dist` | API/UI version 불일치 | commit, contract, lock, asset |
| 환경설정 | port·mode·data root·DB 연결 변경 | 이름·주입 owner·비밀 노출 |
| DB | 사용자·등록·SKIP·HIT·click 손실·중복 | schema, timezone, file identity, runtime DDL |
| Parquet·mapping | Dashboard·filter·chart 오류 | path·Schema·latest·mapping |
| image | 부분 card `404`와 history path 불일치 | sibling data·index와 시점 |
| HMAC secret | 기존 token 무효·검증 장애 후보 | 현재 구현 여부, key version·rotation |
| mail template | context·link·표시 불일치 | Dashboard summary, `step=ALL`, encoding |
| mail sender 설정 | 미발송·중복·오발송 | recipient, idempotency, last run |
| systemd·proxy | 실행 불가·port·header 오식별 | unit, user, environment, trust boundary |
| log | 감사·사고 분석 공백 또는 개인정보 재노출 | retention, masking, access |

## 11. 부분 복구 기준

- source만 복구할 때 API·Schema·fixture·test와 `dist`를 같은 version으로 맞춘다.
- `dist`만 복구할 때 server API와 frontend consumer 호환성을 확인한다.
- DB만 복구할 때 `/appdata` path identity, 등록 기간, history와 timezone을 대조한다.
- `/appdata` 일부만 복구할 때 index가 없는 data/image 또는 data가 없는 index를 만들지 않는다.
- mapping만 복구할 때 Line·SDWT 집계와 MY EQP path mapping 영향을 검증한다.
- template만 복구할 때 context producer·Dashboard field·link 계약을 확인한다.
- secret만 복구할 때 version·consumer·rotation과 기존 session/link 영향을 확인한다.
- log 복구는 runtime 복구와 분리하되 사고·감사 보존 요구를 따른다.

부분 복구가 다른 자산을 오래된 상태로 만드는 경우 전체 일관 복구 또는 명시적 migration이 필요하다.

## 12. 복구 후 검증

확인된 repository 명령만 사용한다.

```bash
# 실행하지 않은 운영자용 명령
git branch --show-current
git rev-parse --short HEAD
git status --short
npm run lint
npm run test:unit
npm run test:contract
npm run test:integration
npm run build
```

그 다음 [runbook](runbook.md)의 조건부 process·liveness·dependency 확인을 수행한다.

검증 기록에는 다음을 포함한다.

- 복구 asset·시점·source commit
- 명령별 exit code와 `Pass`, `Fail`, `Not Run`, `Partial`
- Dashboard 계약·빈 데이터·latest 시각
- Self·abnormal path·부분 결과와 DB read
- `step=ALL`, `eqpCh` 호환; 비-`ALL` HMAC은 현재 `Unknown`
- mail context·template·recipient 경계와 실제 발송 `Not Run`
- log에 secret·내부 detail 노출이 없는지 여부
- 남은 `Unknown`, data loss와 후속 owner

## 13. 삭제·교체 전 강제 조건

운영 data, backup과 이전 artifact를 삭제하거나 overwrite하기 전 다음을 모두 충족해야 한다.

- 정확한 대상과 환경을 read-only 방식으로 재확인
- data·DB·platform owner의 별도 승인
- 최신 backup의 완료·무결성·복구 가능성 증거
- 보존기간·legal hold·감사 요구 확인
- 다른 release·service·consumer 참조 여부 확인
- rollback·restore 대상과 책임자 확인
- 작업 후 검증과 실패 시 중단 기준 확인

RPO·RTO·retention과 삭제 승인 체계가 `Unknown`인 상태에서는 자동 삭제·정리 절차를 만들지 않는다.

## 14. RPO·RTO·보존·주체

| 항목 | 현재 상태 | 필요한 결정 |
|---|---|---|
| source RPO | Git remote·push 정책 미확인 | commit·remote·mirror 기준 |
| source RTO | checkout·build 환경 미확인 | artifact·runtime 준비 시간 |
| DB RPO·RTO | `Unknown` | 업무 write 손실 허용·복구 순서 |
| `/appdata` RPO·RTO | `Unknown` | producer 재생성 가능성·file 규모 |
| secret RPO·RTO | `Unknown` | secret store·rotation·break-glass |
| mail 설정·발송 이력 | `Unknown` | dedupe·last run·recipient audit |
| log 보존기간 | `Unknown` | 운영·보안·개인정보 기준 |
| backup 보존기간 | `Unknown` | daily/weekly 등은 추정하지 않음 |
| backup·restore owner | `Unknown` | asset별 RACI와 승인자 |
| restore drill 주기 | `Unknown` | 격리 검증과 증거 보관 |

## 15. Mismatch·Unknown·Risk

### Mismatch

- 코드가 여러 환경변수를 소비하지만 tracked `.env.example`과 배포 주입 설정은 없다.
- 개별 STEP HMAC 후보와 달리 현재 secret·생성·검증·복구 계약은 없다.
- Vite 단독 mode와 통합 server의 API 범위가 달라 source 복구 후 실행 mode에 따라 기능 범위가 달라질 수 있다.

### Unknown

- DB·`/appdata`·secret·log의 backup 방식, 위치, 암호화와 owner
- RPO, RTO, 보존기간, restore drill과 삭제 승인 절차
- artifact repository, Git remote 보존·tag·release 정책
- systemd·proxy·TLS·firewall 설정의 실제 backup 범위
- DB와 filesystem의 일관 snapshot·quiesce 방식
- 외부 mail sender 설정·발송 이력·dedupe 복구

### Risk

- Git 복구만으로 운영 DB·file·secret이 복구됐다고 오판할 수 있다.
- DB와 `/appdata` 시점 불일치는 history path·등록·화면 결과를 어긋나게 할 수 있다.
- index·data·image의 부분 복구는 `404`, `500` 또는 잘못된 화면 결과를 만들 수 있다.
- secret 복구·rotation 오류는 기존 link·DB·mail 연계를 중단하거나 secret을 노출할 수 있다.
- mail sender의 last-run·idempotency가 없으면 복구 후 중복·오발송 위험이 있다.
- 무결성·restore 검증 없는 이전 backup 삭제는 영구 손실로 이어질 수 있다.

## 16. 근거

- `.gitignore` — `.env`, credential, `dist`, log와 certificate 후보 제외
- `package.json`, `package-lock.json` — 재현 가능한 명령·dependency 기준
- `docs/system/deployment.md` — artifact·환경·rollback 경계
- `docs/system/environment-definition.md` — runtime 자산·보존 정책 공백
- `docs/system/data-flow.md`, `docs/features/abnormal-data.md` — DB·file 소유권과 path 연결
- `docs/system/security.md` — secret·log·권한 정책
- `docs/features/mailing.md`, `docs/features/step-deeplink.md` — sender·HMAC 복구 공백
- `docs/decisions/ADR-002-parquet-storage.md`, `ADR-003-step-hmac-token.md` — file 기준선·HMAC 상태
- `docs/operations/runbook.md`, `systemd.md`, `troubleshooting.md` — 운영 확인·장애 경계

실제 backup·restore, Git 변경, build·test, server, systemd, DB, mail과 `/appdata` 작업은 수행하지 않았다.

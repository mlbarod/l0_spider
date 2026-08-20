# L0 Spider 릴리스 체크리스트

## 1. 사용 원칙

이 문서는 `main`의 Core Harness와 실제 L0 Spider release 판단·증거 기록의 기준이다.
복구 준비는 [backup-restore](backup-restore.md), 배포 순서는 [deployment](../system/deployment.md), 상세 운영 명령은 [runbook](runbook.md), systemd는 [systemd](systemd.md), 장애 대응은 [troubleshooting](troubleshooting.md)을 따른다.

- 모든 항목은 `Pass`, `Fail`, `Not Run`, `Partial`, `N/A` 중 하나와 근거를 기록한다.
- `N/A`는 이유와 승인자가 있을 때만 사용한다.
- 실패·미확인 필수 항목을 구두 승인만으로 통과 처리하지 않는다.
- 실제 `.env`, secret, email, token, 내부 host·서버명과 운영 data를 증거에 첨부하지 않는다.
- `mock-agent` 자산과 mock 의존 검증은 `main` release 필수 항목이 아니다.
- 이 문서의 명령은 **이번 작업에서 실행하지 않은 릴리스 담당자용 명령**이다.

## 2. 릴리스 기록

- [ ] Release ID 또는 ticket: `<record>`
- [ ] 대상 환경: `<record without internal address>`
- [ ] 예정 시작·종료 시각과 timezone: `<record>`
- [ ] release owner: `<record>`
- [ ] 운영 승인자: `<record>`
- [ ] 기준 branch: `main`
- [ ] 대상 commit: `<record>`
- [ ] 이전 정상 commit·artifact: `<record or Unknown>`
- [ ] application mode: `<integrated live reload | integrated static | Unknown>`
- [ ] service manager·unit: `<record or Unknown>`
- [ ] 실제 port·instance·traffic 방식: `<record or Unknown>`
- [ ] 변경 등급과 예상 영향 시간: `<record>`

## 3. 릴리스 범위와 변경 영향

- [ ] 사용자 요구와 승인된 변경 범위를 한 문장으로 기록했다.
- [ ] 변경 파일을 application, document, contract, fixture, test, environment, DB, data path와 mail로 분류했다.
- [ ] 화면 → route → frontend → API → handler → DB·file 영향 경로를 확인했다.
- [ ] 기존 route, query 이름, API field와 nullable·빈 데이터 계약의 호환성을 확인했다.
- [ ] Dashboard, Self Equipment, 동일성, 공통부, 등록·이력 중 영향 기능을 표시했다.
- [ ] DB read·write·DDL, `/appdata` read·path·Schema와 mail 발송 영향을 표시했다.
- [ ] secret·개인정보·권한·log 노출 영향을 [security](../system/security.md) 기준으로 확인했다.
- [ ] 변경 범위 밖 대규모 refactor·source 이동·저장소 교체가 없음을 확인했다.
- [ ] `mock-agent` 구현을 `main`에 포함하거나 의존하지 않음을 확인했다.

### 변경 영향 기록

| 영역 | 영향 여부 | 근거·승인 |
|---|---|---|
| UI·route | `<Yes/No/Unknown>` | `<record>` |
| API·Schema | `<Yes/No/Unknown>` | `<record>` |
| DB·migration | `<Yes/No/Unknown>` | `<record>` |
| `/appdata` path·Schema | `<Yes/No/Unknown>` | `<record>` |
| STEP/HMAC | `<Yes/No/Unknown>` | `<record>` |
| Mailing·recipient | `<Yes/No/Unknown>` | `<record>` |
| environment·secret | `<Yes/No/Unknown>` | `<record>` |
| service·network | `<Yes/No/Unknown>` | `<record>` |

## 4. 작업 트리·branch·commit

```bash
# 실행하지 않은 릴리스 담당자용 명령
git branch --show-current
git rev-parse --short HEAD
git status --short
git diff --check
```

- [ ] 현재 저장소 root와 대상 worktree를 확인했다.
- [ ] branch가 승인된 `main` 또는 승인된 release 흐름과 일치한다.
- [ ] 대상 commit을 release 기록에 고정했다.
- [ ] 예상하지 않은 modified·untracked file이 없다.
- [ ] 기존 사용자 변경을 덮거나 되돌리지 않았다.
- [ ] `git diff --check`가 성공했다.
- [ ] release commit이 remote·artifact 기준으로 복구 가능한지 확인했다.
- [ ] commit·push·merge 권한과 수행 주체를 별도로 확인했다.

예상하지 않은 dirty worktree는 원인을 확인할 때까지 release 중단 조건이다.

## 5. 문서·Schema·fixture·test 일치

- [ ] 변경된 기능의 `docs/system/`, `docs/features/`, `docs/operations/` 기준 문서를 검토했다.
- [ ] API 변경 시 `harness/contracts/` Schema를 함께 갱신했다.
- [ ] Schema의 required, nullable, enum, 빈 성공과 오류 경계가 실제 producer와 일치한다.
- [ ] `harness/fixtures/`는 최소 synthetic 값만 포함하고 운영 data·개인정보가 없다.
- [ ] success·empty fixture가 해당 Schema와 producer 의미에 일치한다.
- [ ] unit·contract·integration test가 변경된 계약을 검증한다.
- [ ] 문서만 변경한 경우 application·contract 영향이 없다는 근거를 기록했다.
- [ ] 사용자 메뉴얼·image 갱신 필요성을 판정했다.
- [ ] `Confirmed`, `Mismatch`, `Unknown`, `Risk` 상태를 사실처럼 섞지 않았다.
- [ ] audit snapshot의 과거 상태를 현재 구현보다 우선하지 않았다.

### 현재 Core 계약 자산

| 영역 | Schema·fixture·test | 릴리스 확인 |
|---|---|---|
| Dashboard | `dashboard-api.schema.json`, success·empty fixture, contract test | [ ] |
| Mailing summary | `mailing-summary.schema.json`, success·empty fixture, contract test | [ ] |
| STEP URL | unit·integration test가 `step=ALL`·`eqpCh`·현재 비-HMAC 경계를 검증 | [ ] |
| 실제 HMAC | 구현·Schema·secret 계약 없음 | [ ] `Unknown/Mismatch` 유지 |
| Mail render·send | renderer·sender test 없음 | [ ] `Blocked/Unknown` 유지 |

## 6. 정적·자동 검증

현재 `package.json`에서 확인된 명령만 사용한다.

```bash
# 실행하지 않은 릴리스 담당자용 명령
npm run lint
npm run test:unit
npm run test:contract
npm run test:integration
npm run build
```

- [ ] `npm run lint` — 결과·exit code 기록
- [ ] `npm run test:unit` — 결과·실행 test 수 기록
- [ ] `npm run test:contract` — Schema compile·fixture·producer 결과 기록
- [ ] `npm run test:integration` — 운영 자원 미사용 여부와 결과 기록
- [ ] `npm run build` — artifact 경로·exit code 기록
- [ ] 실패 assertion·Schema를 완화하거나 skip해 통과시키지 않았다.
- [ ] 실행하지 못한 명령을 `Not Run`과 사유로 기록했다.
- [ ] 부분 실행은 `Partial`로 범위와 미검증 위험을 기록했다.
- [ ] 실제 DB, `/appdata`, mail과 외부 API를 test에서 사용하지 않았다.

lint·필수 test·build 실패는 원인과 승인된 예외가 없으면 release 중단 조건이다.

## 7. 환경변수·secret·runtime dependency

- [ ] `HOST`, `PORT`, `LIVE_RELOAD`, `BUILD_ON_START`의 이름과 적용 mode를 확인했다.
- [ ] `VITE_SITE_URL`에 secret이 없고 host·HMR 영향이 검토됐다.
- [ ] `MAPPING_CONFIG_PATH`, `COMMONALITY_ROOT_PATH`, `COMMON_COMMONALITY_ROOT_PATH`, `SPIDER_DASHBOARD_PATH_ROOT` 영향이 검토됐다.
- [ ] `DB_INFO_PATH` 위치와 service user read 권한을 값 노출 없이 확인했다.
- [ ] 실제 환경값을 CLI output, journal, ticket, 문서와 Git에 기록하지 않았다.
- [ ] tracked `.env.example` 부재를 알고 실제 주입 source와 owner를 확인했다.
- [ ] Node·Python version과 dependency 준비 상태를 확인했다. 저장소 지원 version은 `Unknown`이다.
- [ ] `dist/`, source, `package-lock.json`과 release commit의 동일성을 확인했다.
- [ ] 실제 HMAC·mail secret 이름을 추정하거나 새로 만들지 않았다.
- [ ] secret 변경 시 rotation·이전 consumer·rollback 영향을 승인받았다.

환경 주입 source, secret owner 또는 application mode가 `Unknown`이면 해당 변경을 release하지 않는다.

## 8. `/appdata`와 데이터 경로 호환성

- [ ] 실제 file을 수정·순회하지 않고 코드 path contract와 변경 diff를 검토했다.
- [ ] Dashboard detail·stats·mapping 경로와 latest 선택 규칙을 유지했다.
- [ ] Self·MY EQP `df_path.parquet`, sibling `data.parquet`·history·image 관계를 확인했다.
- [ ] 동일성 `erd_commonality`, 공통부 동일성 `path_common_commonality`와 공통부 `path_common`·common data/image 관계를 확인했다.
- [ ] `latest_date`, `line`, `sdwt`, `grade`, `step_seq`, `step_desc`, `eqp_model`, `ppid`, `sensor`, `ch_step`, `eqp`, `ver` 전파 영향을 검토했다.
- [ ] Parquet column·type·nullable·dynamic axis 변경을 producer와 consumer가 함께 승인했다.
- [ ] index·data·image의 부분 publish·복구 가능성을 평가했다.
- [ ] data producer·mount·permission·freshness owner의 release 준비 확인을 받았다.
- [ ] absolute path·오류 detail 노출이 증가하지 않았는지 확인했다.
- [ ] 운영 file write·rename·delete가 release 절차에 포함되지 않았다.

호환되지 않는 path·Schema 변경에 producer migration·rollback이 없으면 release 중단 조건이다.

## 9. API·화면 호환성

- [ ] `/`, `/self-equipment`, `/matching-anomaly`, `/common-anomaly`, `/common-commonality-anomaly`의 route 영향을 검토했다.
- [ ] `GET /api/dashboard-data`의 request·response·empty·error 계약을 유지했다.
- [ ] `lineDashboard.mailingSummary`가 `summary`의 sibling이라는 실제 위치를 유지했다.
- [ ] Self·commonality·common-commonality·common anomaly API의 query·option·부분 결과를 유지했다.
- [ ] DB 등록·history API의 body limit·validation·현재 사용자 결정 영향을 확인했다.
- [ ] Vite 단독 mode와 통합 `server.mjs` route 범위 `Mismatch`를 배포 mode에서 고려했다.
- [ ] frontend와 server를 서로 다른 incompatible version으로 반영하지 않는다.
- [ ] 오류 status·body·path masking 변경을 보안 문서와 함께 검토했다.

## 10. STEP 딥링크·HMAC

- [ ] 일반 `/self-equipment` link의 `line`, 반복 `sdwt`, 반복 `grade`가 보존된다.
- [ ] MY EQP의 `sdwt=MY_EQP`, `step=ALL`, `eqpCh`가 보존된다.
- [ ] `eqpCh`와 호환 alias `eqp_ch`의 parser 우선순위가 유지된다.
- [ ] URL encoding·`URLSearchParams` round trip 결과를 확인했다.
- [ ] `step=ALL`을 HMAC token으로 검증하거나 만료시키지 않는다.
- [ ] 비-`ALL` token은 현재 생성·검증·매핑 구현이 없다는 상태를 유지하거나, 도입 시 별도 승인·계약을 완료했다.
- [ ] HMAC 도입 시 input byte 규칙, algorithm, digest, secret 이름, 누락·변조·rotation·expiry를 확정했다.
- [ ] HMAC secret이 browser·`VITE_*`·Git·fixture·log에 노출되지 않는다.
- [ ] 기존 Dashboard·mail·공유 link의 migration·rollback을 확인했다.
- [ ] token·query가 proxy·journal·referrer에 노출될 위험을 검토했다.

HMAC 구현을 변경하면서 canonical vector·server 검증·기존 link 정책이 없으면 release 중단 조건이다.

## 11. Mailing 영향

- [ ] `lineDashboard.mailingSummary`의 field·Grade·정렬·빈 배열 계약을 확인했다.
- [ ] `dashboard_monitoring_sensor_total`, `dashboard_change_from_previous_day`, `dashboard_previous_date_time`, `dashboard_change_color` mapping을 확인했다.
- [ ] `public/mailing-report.html` context 변경과 실제 producer 존재 여부를 구분했다.
- [ ] 전체설비·MY EQP link의 route, query와 encoding을 확인했다.
- [ ] `step=ALL`·`eqpCh` link가 Self Equipment 소비 계약과 일치한다.
- [ ] recipient identifier, 실제 주소 lookup, union·dedupe와 row 격리 owner를 확인했다.
- [ ] 발신자·CC·BCC·reply-to·수신 동의 영향이 승인됐다.
- [ ] scheduler·sender·timeout·retry·idempotency·last-run 상태를 확인했다.
- [ ] 실제 mail 발송 여부와 영향 범위를 release 기록에 명시했다.
- [ ] 검증 목적으로 실제 mail·운영 recipient를 사용하지 않았다.
- [ ] sender 구현이 확인되지 않으면 실제 발송 성공을 application release 결과로 주장하지 않는다.

recipient 격리, 발송 차단 또는 중복 방지 상태가 불명확한 mail 변경은 release 중단 조건이다.

## 12. 백업·복구·rollback 준비

- [ ] [backup-restore](backup-restore.md)의 자산 ID별 backup 책임자를 확인했다.
- [ ] Git으로 복구할 commit과 저장소 밖 DB·file·secret·service 설정을 분리했다.
- [ ] 변경 자산의 backup 완료·시각·무결성·접근 가능 증거를 확인했다.
- [ ] DB와 `/appdata`의 일관 시점과 producer publish 상태를 확인했다.
- [ ] RPO·RTO·보존기간이 `Unknown`이면 risk와 승인자를 기록했다.
- [ ] 이전 정상 source·artifact와 호환 가능한 환경설정이 존재한다.
- [ ] DB write·DDL, data migration과 mail 발송은 code rollback과 별도 복구가 필요함을 확인했다.
- [ ] 부분 복구·전체 복구·서버 이전·release rollback 중 해당 유형을 선택했다.
- [ ] rollback trigger, 의사결정자, traffic·service 절차를 기록했다.
- [ ] 이전 backup·artifact 삭제가 release 작업에 포함되지 않았다.

data-changing release에 검증된 backup과 owner 승인 없이 진행하지 않는다.

## 13. 배포·systemd 반영

- [ ] [deployment](../system/deployment.md)의 사전 확인과 반영 순서를 검토했다.
- [ ] 실제 service manager·unit·instance 수와 traffic 방식을 확인했다.
- [ ] systemd 사용 시 [systemd](systemd.md)의 `FragmentPath`, `User`, `Group`, `WorkingDirectory`, `ExecStart`를 확인했다.
- [ ] 실제 Node path·port·`EnvironmentFile`·restart policy를 확인했다.
- [ ] `PORT=32640`, 특정 Node 절대 경로와 unit 경로 후보를 근거 없이 사용하지 않았다.
- [ ] unit·drop-in 변경이 있을 때만 `daemon-reload` 절차를 적용한다.
- [ ] source만 변경할 때 unit 변경으로 잘못 처리하지 않는다.
- [ ] 시작 시 build 여부와 사전 build artifact 사용 여부를 결정했다.
- [ ] 수동 `node server.mjs`와 managed service를 중복 실행하지 않는다.
- [ ] graceful shutdown·drain이 `Unknown`임을 반영해 영향 시간을 관리한다.

service·unit·port가 확인되지 않으면 실제 배포 단계로 진행하지 않는다.

## 14. 배포 후 검증

- [ ] service가 active이고 restart count가 증가하지 않는다.
- [ ] 승인된 port에 예상 process 하나가 listen한다.
- [ ] `/` liveness가 정상이다.
- [ ] 전용 health endpoint가 없으므로 dependency readiness를 별도로 확인했다.
- [ ] Dashboard가 계약된 성공·빈 상태를 반환하고 latest 시각을 확인했다.
- [ ] Self Equipment와 MY EQP의 filter·chart·등록 read 흐름을 확인했다.
- [ ] 동일성·공통부 image·scatter의 정상·부분 결과를 확인했다.
- [ ] DB current-user·등록 read가 timeout·permission 오류 없이 동작한다.
- [ ] `step=ALL`, `eqpCh` 기존 link가 정상이다.
- [ ] Mailing 등록·template asset을 확인하고 실제 sender 상태는 외부 owner가 판정했다.
- [ ] journal·log에 새 fatal·반복 `500`, secret·개인정보·내부 path 노출이 없다.
- [ ] DB test write, 실제 mail, `/appdata` 변경 없이 검증했다.
- [ ] release 전후 주요 count·latency 비교는 기준이 있는 경우에만 기록했다.

## 15. 즉시 중단 조건

다음 중 하나라도 발생하면 신규 반영을 중단하고 영향 격리·rollback 판단으로 전환한다.

- [ ] 예상하지 않은 dirty worktree·commit·artifact 발견
- [ ] lint·build·필수 unit·contract·integration 실패
- [ ] Schema·fixture·producer 또는 frontend·server 호환 불일치
- [ ] 환경 주입·secret owner·data root·service unit 미확인
- [ ] DB·`/appdata`의 손상·누락·permission 또는 Schema 불일치
- [ ] HMAC 변경의 secret·canonicalization·기존 link 정책 부재
- [ ] mail recipient 혼합·중복·오발송 또는 발송 차단 불가
- [ ] secret·credential·사용자·내부 path 노출
- [ ] 예상하지 않은 DB DDL·write 또는 운영 file 변경
- [ ] rollback 대상·owner·backup 무결성 미확인

체크박스는 사고 발생 표시가 아니라 해당 중단 조건을 이해하고 감시했음을 기록한다.

## 16. Rollback 판단 조건

다음은 rollback 검토 trigger이며 실제 명령은 현재 `Unknown`이다.

- [ ] service 미기동·restart loop·liveness 지속 실패
- [ ] 핵심 API의 반복 `500` 또는 주요 화면 전체 실패
- [ ] Dashboard·Parquet·mapping의 잘못된 집계·Schema·path 해석
- [ ] DB registration·history 손실·중복·오사용 또는 runtime DDL 문제
- [ ] `step=ALL`·`eqpCh`와 기존 공유 link 호환 실패
- [ ] mail 오발송·recipient 격리 실패·중복 발송
- [ ] secret·개인정보·credential 노출
- [ ] 운영 owner가 정의한 error·latency·data freshness 임계값 초과

Rollback 전 확인:

- [ ] 이전 artifact와 source가 동일하고 현재 환경과 호환된다.
- [ ] DB·data·mail side effect를 code rollback과 분리했다.
- [ ] traffic·service 제어와 의사결정자가 확인됐다.
- [ ] rollback 후 검증 항목과 escalation owner를 지정했다.

## 17. 검증 증거와 승인

| 항목 | 상태 | 근거 위치·exit code | 승인자 |
|---|---|---|---|
| Git·diff | `<Pass/Fail/Not Run/Partial>` | `<record>` | `<record>` |
| lint | `<...>` | `<record>` | `<record>` |
| unit | `<...>` | `<record>` | `<record>` |
| contract | `<...>` | `<record>` | `<record>` |
| integration | `<...>` | `<record>` | `<record>` |
| build | `<...>` | `<record>` | `<record>` |
| backup·rollback | `<...>` | `<record>` | `<record>` |
| environment·secret | `<...>` | `<record without values>` | `<record>` |
| data·DB readiness | `<...>` | `<record without data>` | `<record>` |
| post-deploy | `<...>` | `<record>` | `<record>` |
| mail 영향 | `<...>` | `<record without recipient>` | `<record>` |

- [ ] 모든 `Not Run`·`Partial`의 이유와 남은 risk를 기록했다.
- [ ] 실제 운영 자원 변경 목록과 수행자를 기록했다.
- [ ] secret·개인정보 없는 log·screenshot·test report만 연결했다.
- [ ] 최종 `Go`, `No-Go`, `Rollback`, `Partial Acceptance` 결정을 기록했다.
- [ ] 최종 승인 시각과 timezone을 기록했다.
- [ ] 후속 action, owner와 기한을 기록했다.

## 18. 완료 보고

- [ ] release ID·commit·mode·영향 범위를 보고했다.
- [ ] 생성·수정 file과 contract 변경을 보고했다.
- [ ] 실행한 검증·exit code·미실행 검증을 보고했다.
- [ ] 배포·systemd·DB·mail·`/appdata` 작업 여부를 보고했다.
- [ ] Mismatch·Unknown·Risk와 잔여 영향도를 보고했다.
- [ ] backup·rollback 준비와 실제 수행 여부를 구분했다.
- [ ] 장애·rollback이 있었다면 [troubleshooting](troubleshooting.md) 근거를 연결했다.
- [ ] commit·push·merge 수행 여부를 명시했다.

## 19. 현재 Mismatch·Unknown·Risk 기준

### Mismatch

- Vite 단독 mode와 통합 `server.mjs`의 API route 범위가 다르다.
- `lineDashboard.mailingSummary`는 `lineDashboard.summary`의 하위가 아니다.
- 개별 STEP HMAC 후보와 달리 현재 생성·검증·secret 계약이 없다.
- 코드가 환경변수를 소비하지만 tracked `.env.example`·service 주입 설정은 없다.

### Unknown

- 실제 deployment topology, systemd unit, port, Node path와 environment source
- backup·restore 명령, RPO·RTO·retention, artifact repository와 rollback 자동화
- DB·`/appdata` owner·snapshot·migration·freshness·복구 절차
- HMAC 도입 여부·secret·rotation·기존 token 정책
- mail renderer·scheduler·sender·recipient lookup·retry·dedupe
- health probe·monitoring·SLO·release owner와 승인 체계

### Risk

- frontend·server·Schema·artifact version 불일치
- DB와 `/appdata`의 비일관 backup·migration·부분 복구
- `step=ALL`·`eqpCh` 또는 path·Schema 변경에 따른 기존 link·화면 단절
- secret·path·DB detail·recipient가 log·artifact·증거에 노출될 가능성
- mail 중복·오발송과 runtime DB DDL은 code rollback만으로 복구되지 않음
- startup readiness·graceful shutdown·rollback 자동화 부재

## 20. 근거

- `AGENTS.md` — 기존 호환·운영 안전·Core/mock 경계
- `package.json`, `package-lock.json` — 확인된 build·test 명령
- `docs/system/deployment.md` — build·반영·rollback 기준
- `docs/operations/backup-restore.md` — 자산·복구 책임
- `docs/operations/runbook.md`, `systemd.md`, `troubleshooting.md` — 상세 운영 절차
- `docs/system/environment-definition.md`, `security.md`, `data-flow.md` — 환경·비밀·data 경계
- `docs/features/{dashboard,self-equipment,step-deeplink,mailing,abnormal-data}.md` — 기능별 계약·영향
- `harness/contracts/`, `harness/fixtures/`, `tests/` — Core 계약 검증 자산
- `docs/decisions/ADR-002-parquet-storage.md`, `ADR-003-step-hmac-token.md` — 저장·HMAC 기준

이번 문서 작성에서는 Git 확인 외의 build·test·release, backup·restore, systemd, DB, mail과 `/appdata` 작업을 수행하지 않았다.

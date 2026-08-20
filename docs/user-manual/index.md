# L0 Spider 사용자 메뉴얼 탐색 인덱스

## 1. 목적과 범위

이 문서는 기존 [SPIDER 사용자 매뉴얼](USER_MANUAL.md)과 화면 이미지, 현재 route·기능 문서·계약·운영 문서를 연결하는 탐색 기준이다.
상세 사용 절차를 복사하지 않으며 사용자는 목적에 맞는 기존 안내로 이동한다.
용어 정의는 [L0 Spider 용어 사전](../system/glossary.md)을 단일 기준으로 사용한다.
대상은 `main`의 실제 시스템이며 `mock-agent`의 메뉴얼·화면·mock 검증은 범위 밖이다.

## 2. 판정 기준과 최신성 경계

- `Confirmed`: 파일 존재, 현재 route 또는 코드 연결이 확인됨
- `Documented`: 기존 메뉴얼·이미지에만 설명됨
- `Unknown`: 이번 정적 조사로 현재 브라우저 화면과의 일치 여부를 확인하지 못함
- `Mismatch`: 현재 route·메뉴·기능과 기존 설명 또는 이미지가 명확히 다름
- `Risk`: 오래된 안내나 미확인 발송 동작이 사용자 오조작으로 이어질 수 있음

`USER_MANUAL.md`의 기준일은 2026-08-20이다. 이번 작업은 아직 브라우저를 실행하지 않았으므로 이미지의 존재·정적 내용과 코드 비교만 확인했으며 픽셀 단위 최신성은 `Unknown`이다.

## 3. 빠른 탐색

| 사용자 목적 | 기존 메뉴얼·이미지 | 현재 화면 route | 기능 기준 | 데이터 흐름 | API·계약 | 운영·장애 안내 |
|---|---|---|---|---|---|---|
| 대시보드 조회 | [2. 메인 화면과 라인별 대시보드](USER_MANUAL.md#2-메인-화면과-라인별-대시보드), [01-main-screen.png](images/01-main-screen.png) | `/`, alias `/fdc_trend` | [dashboard.md](../features/dashboard.md) | [DF-DASH-01](../system/data-flow.md#9-대시보드-데이터-흐름) | `GET /api/dashboard-data`; [Dashboard Schema](../../harness/contracts/dashboard-api.schema.json) | [Dashboard 빈 데이터](../operations/troubleshooting.md#9-dashboard-빈-데이터오래된-데이터), [runbook](../operations/runbook.md) |
| Self Equipment 조회 | [4. 자설비 이상감지](USER_MANUAL.md#4-자설비-이상감지), `03`~`07` 이미지 | `/self-equipment`, alias `/fdc_trend/self-equipment` | [self-equipment.md](../features/self-equipment.md) | [DF-SELF-01~03](../system/data-flow.md#10-self-equipment-및-이상-데이터-흐름) | `/api/self-equipment-data`, `/api/my-eqp-equipment-data`, `/api/erd-scatter-data`; 별도 JSON Schema 없음 | [파일 누락·권한](../operations/troubleshooting.md#8-appdata-파일-누락-또는-권한-오류) |
| 직접 URL로 Self Equipment 진입 | [Mailing Report LINK 설명](USER_MANUAL.md#7-mailing-report-메일-확인) | `/self-equipment?...` | [step-deeplink.md](../features/step-deeplink.md), [self-equipment.md](../features/self-equipment.md) | `DF-STEP-01` in [data-flow.md](../system/data-flow.md) | URL parser와 [integration test](../../tests/integration/step-deeplink.test.mjs) | [STEP/HMAC 오류](../operations/troubleshooting.md#10-step-딥링크hmac-오류), [security.md](../system/security.md) |
| `step=ALL`·`eqpCh`로 My EQP 이동 | [7. Mailing Report 메일 확인](USER_MANUAL.md#7-mailing-report-메일-확인) | `/self-equipment?sdwt=MY_EQP&step=ALL&eqpCh=...` | [step-deeplink.md](../features/step-deeplink.md), [ADR-003](../decisions/ADR-003-step-hmac-token.md) | `DF-STEP-01`, `DF-SELF-03` | [unit test](../../tests/unit/step-hmac.test.mjs), [integration test](../../tests/integration/step-deeplink.test.mjs) | [STEP/HMAC 오류](../operations/troubleshooting.md#10-step-딥링크hmac-오류) |
| 동일성 이상 이미지 확인 | [6.1 동일성 이상감지](USER_MANUAL.md#61-동일성-이상감지), [08-matching-anomaly.png](images/08-matching-anomaly.png) | `/matching-anomaly`, alias `/fdc_trend/matching-anomaly` | [abnormal-data.md](../features/abnormal-data.md) | `DF-ABN-01` in [data-flow.md](../system/data-flow.md) | `/api/commonality-data`, `/api/commonality-image`; 별도 JSON Schema 없음 | [파일 누락·권한](../operations/troubleshooting.md#8-appdata-파일-누락-또는-권한-오류) |
| 공통부 차트·이미지 확인 | [6.2 공통부 이상감지](USER_MANUAL.md#62-공통부-이상감지), [09-common-anomaly-filters.png](images/09-common-anomaly-filters.png), [10-common-anomaly-image.png](images/10-common-anomaly-image.png) | `/common-anomaly`, alias `/fdc_trend/common-anomaly` | [abnormal-data.md](../features/abnormal-data.md) | `DF-ABN-02` in [data-flow.md](../system/data-flow.md) | `/api/common-anomaly-data`, `/api/common-anomaly-scatter-data`, `/api/common-anomaly-image`; 별도 JSON Schema 없음 | [파일 누락·권한](../operations/troubleshooting.md#8-appdata-파일-누락-또는-권한-오류) |
| 공통부 동일성 이미지 확인 | [6.3 공통부 동일성 이상감지](USER_MANUAL.md#63-공통부-동일성-이상감지) | `/common-commonality-anomaly`, alias `/fdc_trend/common-commonality-anomaly` | [abnormal-data.md](../features/abnormal-data.md) | `DF-ABN-03` in [data-flow.md](../system/data-flow.md) | `/api/common-commonality-data`, `/api/common-commonality-image`; 별도 JSON Schema 없음 | [파일 누락·권한](../operations/troubleshooting.md#8-appdata-파일-누락-또는-권한-오류) |
| Mailing·My EQP 조건 등록 | [5. Mailing Report 및 My EQP 등록](USER_MANUAL.md#5-mailing-report-및-my-eqp-등록) | `/registration`; aliases `/my-eqp`, `/recipients` | [mailing.md](../features/mailing.md), [self-equipment.md](../features/self-equipment.md) | `DF-MAIL-01` in [data-flow.md](../system/data-flow.md) | 등록 API군; 메일 요약만 [Mailing Schema](../../harness/contracts/mailing-summary.schema.json) | [메일 등록·발송 실패](../operations/troubleshooting.md#11-mail-등록-또는-실제-발송-실패) |
| 메일 요약과 상세 LINK 확인 | [7. Mailing Report 메일 확인](USER_MANUAL.md#7-mailing-report-메일-확인) | 메일 LINK → `/self-equipment?...` | [mailing.md](../features/mailing.md), [dashboard.md](../features/dashboard.md) | `DF-MAIL-02` in [data-flow.md](../system/data-flow.md) | `lineDashboard.mailingSummary`; [Mailing Schema](../../harness/contracts/mailing-summary.schema.json) | [메일 장애 안내](../operations/troubleshooting.md#11-mail-등록-또는-실제-발송-실패) |
| 오류·빈 데이터 대응 | [9. 문제 해결과 주의사항](USER_MANUAL.md#9-문제-해결과-주의사항) | 발생 화면 route 유지 | 관련 기능 문서의 오류·빈값 절 | [data-flow.md](../system/data-flow.md) | endpoint별 오류 계약 | [troubleshooting.md](../operations/troubleshooting.md), [runbook.md](../operations/runbook.md) |

개별 STEP HMAC 링크는 현재 구현 기능이 아니다. 사용자에게 안내 가능한 직접 링크는 일반 Dashboard 상세 URL과 My EQP의 `step=ALL`·`eqpCh` 흐름이다.

## 4. 현재 route와 메뉴 연결

| 사용자 화면 | 메인 메뉴명 | canonical route | 호환 route·alias | 상태 | 근거 |
|---|---|---|---|---|---|
| Line Dashboard | 메인 하단 Dashboard | `/` | `/fdc_trend` | `Confirmed` | `routes.jsx:12-14,61-67`; `L0SpiderHomePage.jsx` |
| Self Equipment | 자설비 이상감지 | `/self-equipment` | `/fdc_trend/self-equipment` | `Confirmed` | `routes.jsx:16-19`; `L0SpiderHomePage.jsx:11-19` |
| 동일성 이상감지 | 동일성 이상감지 | `/matching-anomaly` | `/fdc_trend/matching-anomaly` | `Confirmed` | `routes.jsx:28-31`; `L0SpiderHomePage.jsx:20-28` |
| 공통부 이상감지 | 공통부 이상감지 | `/common-anomaly` | `/fdc_trend/common-anomaly` | `Confirmed` | `routes.jsx:32-35`; `L0SpiderHomePage.jsx:29-37` |
| 공통부 동일성 이상감지 | 공통부 동일성 이상감지 | `/common-commonality-anomaly` | `/fdc_trend/common-commonality-anomaly` | `Confirmed` | `routes.jsx`; `L0SpiderHomePage.jsx` |
| 등록 Hub | Mailing Report 및 My EQP 등록 | `/registration` | `/my-eqp`, `/recipients` 및 `/fdc_trend/...` | `Confirmed` | `routes.jsx:20-27,40-43`; `L0SpiderHomePage.jsx:52-60` |
| 사용자 메뉴얼 | 사용자 메뉴얼 | `/manual` | `/fdc_trend/manual` | `Confirmed` | `routes.jsx:36-39`; `L0SpiderHomePage.jsx:61-69` |

라우트 alias는 현재 router에 등록돼 있지만 메인 카드가 직접 연결하는 주소는 canonical route 열의 값이다.

## 5. 기존 사용자 자료 인벤토리

| 경로 | 형식 | 대상 화면·내용 | 본문 연결 | 최신성 상태 |
|---|---|---|---|---|
| `docs/user-manual/USER_MANUAL.md` | Markdown | 서비스 개요, Dashboard, Self, 등록, 동일성·공통부, 메일, 오류 안내 | `/manual`에서 raw import 후 HTML sanitize | 파일·화면 연결 `Confirmed`; 브라우저 재현 `Not Run` |
| `images/01-main-screen.png` | PNG 1920×1080 | 메인 화면과 Dashboard | 2장에 직접 삽입 | 존재 `Confirmed`; 현재 픽셀 일치 `Unknown` |
| `images/02-main-menu.png` | PNG 1920×1080 | 과거 메인 메뉴 설명 표시 | 본문 미참조 | 현재 메뉴명·상태와 `Mismatch` |
| `images/03-self-equipment-filters.png` | PNG 1920×1080 | Self Equipment 필터 | 4.1에 직접 삽입 | 현재 3일 동일성 toggle을 완전히 반영하지 않아 `Mismatch` |
| `images/04-self-equipment-chart.png` | PNG 1920×1080 | Self Equipment chart | 4.2에 직접 삽입 | 현재 모아보기 pair를 완전히 반영하지 않아 `Mismatch` |
| `images/05-self-equipment-actions.png` | PNG 608×465 | chart 작업 버튼 | 4.3에 직접 삽입 | 존재 `Confirmed`; 현재 픽셀 일치 `Unknown` |
| `images/06-self-equipment-skip-dialog.png` | PNG 448×220 | SKIP 확인 dialog | 4.3에 직접 삽입 | 존재 `Confirmed`; 현재 픽셀 일치 `Unknown` |
| `images/07-self-equipment-identity-chart.png` | PNG 1844×918 | Self 동일성 chart modal | 본문 미참조 | 기능 존재 `Confirmed`; 이미지 최신성 `Unknown` |
| `images/08-matching-anomaly.png` | PNG 1920×1080 | 동일성 이상감지 | 본문 미참조 | 현재 `Line → SDWT → STEP → Sensor → ch_step`에서 STEP이 빠진 과거 화면으로 `Mismatch` |
| `images/09-common-anomaly-filters.png` | PNG 1920×1080 | 공통부 filter | 6.2에 직접 삽입 | 존재 `Confirmed`; 현재 픽셀 일치 `Unknown` |
| `images/10-common-anomaly-image.png` | PNG 919×584 | 공통부 결과 image와 작업 버튼 | 본문 미참조 | 기능 존재 `Confirmed`; 이미지 최신성 `Unknown` |
| `images/15-manual-status.png` | PNG 1920×1080 | 사용자 메뉴얼 화면·상태 설명 | 본문 미참조 | 캡처의 문서 기준일이 현재 `USER_MANUAL.md`보다 오래돼 `Mismatch` |

화면 이미지는 합성·마스킹된 안내용 자산이며 실제 사용자·설비·운영 데이터를 현재 상태 근거로 사용하지 않는다.
`UserManualPage.jsx:10-52`는 `USER_MANUAL.md`와 PNG를 Vite asset으로 읽고 `DOMPurify.sanitize` 후 표시한다.
코드가 제외 대상으로 선언한 `11-fdc-hard-limit.png`, `12-yield-hard-limit.png`, `13-history.png`, `14-recipients.png`는 현재 저장소에 존재하지 않으며 생성된 자료로 취급하지 않는다.

## 6. 메뉴얼과 현재 시스템의 Mismatch

| ID | 기존 자료 | 현재 코드·문서 | 사용자 영향 | 안내 기준 |
|---|---|---|---|---|
| `MAN-M01` | `02-main-menu.png`의 메뉴명·운영 상태 | 현재 메인에는 `Mailing Report 및 My EQP 등록` 카드와 변경된 기능 상태가 있음 | 오래된 카드명으로 메뉴를 찾지 못할 수 있음 | 현재 `L0SpiderHomePage.jsx`의 메뉴명을 사용 |
| `MAN-M02` | `03`, `04` 이미지 | 현재 Self 화면에는 3일 동일성 toggle과 모아보기 pair가 있음 | 이미지에 없는 조작을 놓칠 수 있음 | `USER_MANUAL.md:71-108` 본문과 `self-equipment.md`를 우선 |
| `MAN-M03` | `08-matching-anomaly.png`는 SDWT 다음에 Sensor를 표시 | 현재 동일성 filter는 SDWT 다음 STEP 선택을 요구 | STEP을 선택하지 않아 하위 option이 비어 보일 수 있음 | `USER_MANUAL.md:169-179` 본문을 우선 |
| `MAN-M04` | `15-manual-status.png`의 과거 문서 기준일 | 현재 `USER_MANUAL.md` 기준일은 2026-08-20 | 캡처만 보고 최신 문서 상태를 오판할 수 있음 | Markdown 기준일과 Git 변경 이력을 확인 |
| `MAN-M05` | 문제 해결 표는 “표시된 경로” 확인을 안내 | 현재 browser 오류는 파일 경로를 `[파일 경로 숨김]`으로 마스킹 | 사용자가 경로를 직접 확인할 수 없을 수 있음 | 메시지·시각·선택 조건만 기록하고 운영 담당자가 server 측을 확인 |
| `MAN-M06` | 메일 절은 발송 메일 구성을 사용자 절차로 설명 | 저장소에는 sender·scheduler·renderer가 확인되지 않음 | 저장소 문서만으로 실제 발송 주기·성공을 보장한다고 오해할 수 있음 | 화면 등록은 `Confirmed`, 실제 발송은 `Unknown`으로 구분 |

## 7. 누락·오래된 안내와 Unknown

- 현재 본문은 `02`, `07`, `08`, `10`, `15` 이미지를 직접 연결하지 않는다. 파일은 존재하지만 의도적 참고 자산인지 본문 누락인지는 `Unknown`이다.
- 개별 STEP HMAC token의 생성·검증·실패 화면 안내는 없다. 현재 구현도 없어 사용자 절차를 추가하지 않는다.
- 메일 renderer, 발송 trigger·주기, 실제 수신 성공·retry 안내는 `Unknown`이며 [mailing.md](../features/mailing.md)의 `Blocked` 경계를 따른다.
- 빈 Dashboard, 부분 Parquet 실패, 잘못된 query의 실제 browser 화면 이미지는 확인되지 않았다.
- 이미지의 현재 UI 일치 여부를 확정할 browser 검증은 `Not Run`이다.

## 8. 오류·빈 데이터 탐색 순서

1. [사용자 메뉴얼 9장](USER_MANUAL.md#9-문제-해결과-주의사항)에서 사용자 선택 조건과 표시 메시지를 확인한다.
2. 용어가 불명확하면 [glossary.md](../system/glossary.md)에서 UI·API·데이터 표현을 대조한다.
3. 화면별 빈값·오류 계약은 해당 [기능 문서](../features/)와 [data-flow.md](../system/data-flow.md)를 확인한다.
4. 운영자가 확인할 명령·원인·조치는 [troubleshooting.md](../operations/troubleshooting.md)를 따른다.
5. 비밀값, 실제 사용자·장비 정보, 내부 URL과 운영 파일 경로는 문의 자료에 기록하지 않는다.

## 9. 유지보수 기준

- route, 메뉴명, query parameter 또는 화면 흐름을 변경하면 이 인덱스와 `USER_MANUAL.md`의 영향 범위를 함께 확인한다.
- 이미지를 교체할 때는 합성 데이터 여부, 대상 route, 캡처 기준일과 본문 참조를 기록한다.
- 실제 발송이나 운영 데이터 접근 없이 확인할 수 없는 내용은 `Unknown` 또는 `Not Run`으로 유지한다.
- 기능 설명은 기능 문서, 장애 대응은 operations 문서, 용어 정의는 glossary에 두고 사용자 절차를 중복 작성하지 않는다.

## 10. 주요 근거

- `src/features/fdc-trend/routes.jsx:11-67` — 화면 route와 `/fdc_trend` alias
- `src/features/fdc-trend/pages/L0SpiderHomePage.jsx:11-69` — 현재 사용자 메뉴명과 canonical link
- `src/features/fdc-trend/pages/UserManualPage.jsx:10-52` — Markdown·이미지 로딩과 sanitize
- `src/features/fdc-trend/utils/selfEquipmentUrlFilters.mjs` — `line`, `sdwt`, `grade`, `step`, `eqpCh` 처리
- [system inventory](../../reports/audit/system-inventory.md), [data-flow.md](../system/data-flow.md), [abnormal-data.md](../features/abnormal-data.md) — 화면·API·데이터 근거
- [self-equipment.md](../features/self-equipment.md), [step-deeplink.md](../features/step-deeplink.md), [mailing.md](../features/mailing.md) — Mismatch·Unknown 경계

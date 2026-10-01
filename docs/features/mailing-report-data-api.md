# Mailing Report 발송기용 대시보드 조회

외부 Mailing Report 발송기가 브라우저 SSO 세션 없이 데이터를 읽는 전용 API다.
`npm start`로 실행하는 Node 서버에서 기존 웹서비스와 같은 포트를 사용한다.
Vite 단독 개발 서버(`npm run dev`)에는 이 경로를 추가하지 않는다.
본문 생성·수신자 선택·메일 전송은 외부 발송기의 책임이며 이 API는 발송하지 않는다.

## L0 Spider 설정

서버 환경변수 또는 저장소 루트의 `.env.mail`에 `MAILING_REPORT_API_KEY`를 설정한다.
서버는 `.env.mail`을 읽으며 이미 설정된 환경변수가 우선한다. 적용에는 Node 서버 재시작이 필요하다.
실제 키를 저장소에 기록하지 않는다. 설정 예시는 [`.env.mail.example`](../../.env.mail.example)에 있다.

- 키 형식: 영문 대소문자, 숫자, `_`, `-`로 구성한 32~256자.
- 권장 생성 방식: 암호학적으로 안전한 무작위 32바이트를 hex 64자로 변환한 값.
- `KNOX_MAIL_TOKEN`, `SSO_SESSION_SECRET`과 별도 키를 사용한다.
- 누락·빈 값·형식 오류이면 전용 API만 `503 MAILING_REPORT_API_DISABLED`로 닫힌다.
- 키는 서버 시작 시 읽는다. 교체 시 L0 Spider와 발송기에 같은 새 키를 배포하고 재시작한다.
- 이 키는 전체 대시보드 조회 권한이다. 사용자별 SSO 접근 권한과는 별개이며 수신자별 필터링은 발송기가 수행한다.

SSO 운영에서는 기존 HTTPS 프록시 주소를 사용한다. 신뢰된 프록시 IP와
프록시가 덮어쓴 단일 `X-Forwarded-Proto: https` 조건을 그대로 검증한다.
브라우저 SSO 세션과 사용자 접근 권한 검사는 이 정확한 경로에서만 전용 키 검증으로 대체한다.
발송기가 `X-Forwarded-Proto`를 직접 추가하거나 Node 내부 HTTP 포트를 직접 호출하는 방식은 사용하지 않는다.
기존 프록시가 `Authorization`을 애플리케이션까지 전달해야 한다.
SSO 비활성 로컬 개발 환경에서도 전용 키 검증은 유지한다.

## 외부 발송기 변경

1. 조회 URL을 `https://<기존 L0 Spider 호스트>/api/mailing-report/dashboard-data`로 변경한다.
2. 발송기에도 동일한 `MAILING_REPORT_API_KEY`를 환경변수 또는 비밀 설정으로 주입한다.
3. `Authorization: Bearer <키>`와 `Accept: application/json` 헤더로 `GET` 요청한다.
4. 자동 리다이렉트를 끄고 HTTP `200` 및 JSON `ok: true`를 확인한 후 본문을 생성한다.
5. 키·Authorization 헤더·전체 응답을 로그에 남기지 않는다. 장애 확인에는 상태 코드와 응답의 `code`, `requestId`만 사용한다.

키를 URL query에 넣거나 브라우저에 전달하지 않는다. 기존 메일 본문에 들어가는 화면 링크는
기존 사용자용 주소를 유지한다. 사용자가 메일 링크를 열 때는 계속 SSO 인증을 거친다.

Python `requests`를 사용하는 발송기의 적용 예시:

```python
import os
import requests

response = requests.get(
    os.environ["L0_SPIDER_BASE_URL"].rstrip("/")
    + "/api/mailing-report/dashboard-data",
    headers={
        "Authorization": "Bearer " + os.environ["MAILING_REPORT_API_KEY"],
        "Accept": "application/json",
    },
    timeout=(10, 60),
    allow_redirects=False,
)
if response.status_code != 200:
    raise RuntimeError(f"Mailing Report data API HTTP {response.status_code}")
payload = response.json()
if payload.get("ok") is not True:
    raise RuntimeError("Mailing Report data API returned an unsuccessful result")
dashboard = payload["lineDashboard"]
kpi = dashboard["summary"]
mailing_rows = dashboard["mailingSummary"]
mailing_critical_summary = dashboard["mailingCriticalSummary"]
# 아래 본문 연결 규칙에 따라 수신자별 등록 조건과 함께 렌더링한다.
```

`L0_SPIDER_BASE_URL`은 발송기에서 사용하는 기존 HTTPS 서비스 주소이며 새로 추가된 L0 Spider 서버 설정이 아니다.
예시는 기존 기본 조회 기간을 사용한다. 특정 기간이 필요하면 기존 API와 같은
`startDate=YYYY-MM-DD`, `endDate=YYYY-MM-DD` query를 전달한다.
`line` 반복 query도 기존대로 지원하지만, 전체 Dashboard KPI를 메일에 표시할 때는 `line` 필터를 넣지 않는다.

## 전체 이상현황 Report의 CRITICAL 본문 연결

`lineDashboard.mailingCriticalSummary`는 기존 `mailingSummary`와 같은 위치·행 구조의 추가 배열이다.
`lineId`, `sdwt`, `sensorGrade`, `abnormalCount`를 제공하며, `status`를 공백 제거·대문자화한 값이
`ALARM`인 원본 행만 기존 날짜별 고유 조합 기준으로 집계한다. API의 Grade는 `A`, `B`, `D`, `M`, `N`으로
분리한다. 기존 센서 제외 규칙과 Line·기간 필터를 적용하며, 기존 요약에 존재하는 조건에 CRITICAL이 없으면
`abnormalCount: 0`이다. 기존 `mailingSummary`, Dashboard KPI와 MY EQP 집계는 바뀌지 않는다.

외부 발송기의 `public/mailing-report.html` 렌더링 context에 다음 값을 연결해야 한다.

```python
# rows에는 이상건수와 관계없이 수신자의 모든 등록 조건을 전달한다.
# 각 행: knox_id, line_name(API의 lineId 원문), sdwt(API 표시 SDWT), sensor_grade
# 기존 KPI와 my_eqp_rows 등 다른 context는 그대로 유지한다.
context["rows"] = registered_condition_rows
context["mailing_critical_summary"] = dashboard["mailingCriticalSummary"]
html = template.render(**context)
```

템플릿은 `recipient_knox_id`로 등록 조건을 먼저 제한한 뒤 Line·SDWT·Grade를 정확히 대조한다.
등록된 A/B는 한 행으로 합산하고 D·M·N은 각각 표시하며, 미등록 Grade는 표시하거나 합산하지 않는다.
등록 조건에 대응하는 summary 행이 없으면 0건을 표시한다. 등록 행 자체를 이상건이 있는 조건으로만
제한하면 0건 Grade가 누락되므로 반드시 **모든 등록 조건**을 전달한다. 등록 화면에서 선택한 Grade만 전달한다.
수신인에게 DB 행이 여러 개 있으면 각 행의 SDWT·Grade 조합을 유지하여 펼친다. 수신인 전체의 SDWT와 Grade를
각각 합친 뒤 재조합하면 등록하지 않은 조건이 추가되므로 그렇게 처리하지 않는다.
`mailing_critical_summary`가 누락되거나 `None`이면 건수 대신 `집계 미연결`을 표시하며 전체 건수로 대체하지 않는다.

Jinja 3.1 이상에서 HTML autoescape를 켜고 렌더링한다. 검증 명령은
`python3 scripts/mailing_report_template_test.py`다(Jinja2 필요, 실제 발송 없음).

전체 Report 링크는 `status=ALARM`을 추가하여 CRITICAL 필터로 진입한다.
Grade는 기존 상세 화면의 `A/B`, `D`, `M`, `N` 필터를 사용한다. A 또는 B만 등록된 경우 메일 건수에는
등록된 Grade만 합산하지만, 상세 화면의 기존 A/B 통합 조회는 유지한다.
일반 SDWT에서는 STEP 등 하위 조건을 선택해야 차트가 표시되며, 링크는 메일 발송 시점의 데이터를 고정하지 않는다.
MY EQP Report 링크에는 이 상태 조건을 추가하지 않는다.

이 저장소에는 운영 발송기 코드가 없으므로 실제 배포 시 외부 발송기의 context 연결도 함께 반영해야 한다.

## 응답과 오류

기존 `/api/dashboard-data`의 처리기를 그대로 사용한다. 성공 JSON 구조, 집계 규칙, 센서 제외 규칙,
날짜 기본값과 필터 검증은 동일하다. `lineDashboard.mailingSummary`는 `summary`의 하위가 아닌 같은 레벨이다.
MY EQP 전용 집계나 수신자 목록을 새로 생성하지 않는다. `HEAD`는 같은 인증과 조회를 수행하되 본문을 반환하지 않는다.
모든 응답에 `Cache-Control: no-store`를 적용한다.

| HTTP / code | 의미와 조치 |
|---|---|
| `200`, `ok: true` | 기존 대시보드 형식의 데이터. 본문 생성 가능 |
| `503 MAILING_REPORT_API_DISABLED` | L0 Spider의 키 설정·형식 및 재시작 여부 확인 |
| `401 MAILING_REPORT_AUTHENTICATION_REQUIRED` | 누락·불일치·잘못된 형식·중복 인증 헤더. 양쪽 키와 프록시 헤더 전달 확인 |
| `400 SSO_PROXY_REQUIRED` | HTTPS 프록시 경유 및 기존 신뢰 프록시 설정 확인 |
| `405 METHOD_NOT_ALLOWED` | `GET`, `HEAD`만 허용 |
| `400 DASHBOARD_INVALID_FILTER` | 날짜·필터 조건 확인 |
| `404 DASHBOARD_LATEST_DATE_NOT_FOUND` | 조회할 대시보드 데이터 파일이 없음 |
| `500` + 기존 Dashboard 오류 코드 | 데이터 조회 실패. `code`, `requestId`로 추적 |

`401 SSO_AUTHENTICATION_REQUIRED` 또는 로그인 리다이렉트가 나오면 기존 API URL 사용,
미배포 서버 또는 앞단의 별도 인증 정책 여부를 확인한다. 프록시 자체가 SSO 인증을 강제하는 구성은
이 Node 변경만으로 처리되지 않는다.

전용 키로 `/api/dashboard-data`, 다른 API 또는 화면에 접근할 수 없다.
실제 운영 배포, 키 주입, 프록시 경유 조회 및 외부 메일 발송은 별도 운영 확인이 필요하다.

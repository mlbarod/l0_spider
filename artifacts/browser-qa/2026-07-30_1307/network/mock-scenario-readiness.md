# Mock 시나리오 준비 상태 확인

## 범위

브라우저를 사용하지 않고 기존 Mock 명령과 합성 API의 상대 path만 사용해 시나리오 전환 및 대표 대시보드 응답 상태를 확인했다. 아래 결과는 UI 렌더링 또는 사용자 흐름 통과를 의미하지 않는다.

## 결과

| 시나리오 | reset 후 활성화 | `/api/dashboard-data` 관찰 |
|---|---:|---|
| `normal` | 성공 | HTTP 200 |
| `empty` | 성공 | HTTP 200 |
| `single` | 성공 | HTTP 200 |
| `partial` | 성공 | HTTP 200 |
| `slow` | 성공 | HTTP 200, 약 1초 |
| `error-400` | 성공 | HTTP 400 |
| `error-401` | 성공 | HTTP 401 |
| `error-403` | 성공 | HTTP 403 |
| `error-404` | 성공 | HTTP 404 |
| `error-500` | 성공 | HTTP 500 |
| `error-502` | 성공 | HTTP 502 |
| `timeout` | 성공 | 12초 동안 응답 없음, 클라이언트 중단 |
| `race-condition` | 성공 | HTTP 200, 기본 요청 약 1초 |
| `inconsistent` | 성공 | HTTP 200 |
| `edge-values` | 성공 | HTTP 200 |
| `large` | 성공 | HTTP 200 |

마지막에 `npm run mock:reset`을 실행해 `normal` 상태로 복원했다.

## 직접 URL 문서 제공 확인

라우터에 정의된 `/`, `/self-equipment`, `/my-eqp`, `/registration`, `/matching-anomaly`, `/common-anomaly`, `/manual`, `/recipients`, `/defect-spider`, `/l1-spider`, `/l3-spider`, `/fdc_trend`는 모두 HTTP 200의 HTML 문서를 반환했다. 브라우저가 실행되지 않았으므로 React 렌더링, 직접 URL 화면 표시, 새로고침 및 history 동작은 확인하지 못했다.

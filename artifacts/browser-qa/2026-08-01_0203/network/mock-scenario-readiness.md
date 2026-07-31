# 합성 Mock 시나리오 준비성

브라우저가 아닌 localhost Mock API 수준에서 필수 16개 시나리오를 순차 전환했다. 각 시나리오의 health는 모두 성공했다.

| 시나리오 | Dashboard API 관찰 |
|---|---|
| `normal` | HTTP 200 |
| `empty` | HTTP 200 |
| `single` | HTTP 200 |
| `partial` | HTTP 200 |
| `slow` | 지연 후 HTTP 200 |
| `error-400` | HTTP 400 |
| `error-401` | HTTP 401 |
| `error-403` | HTTP 403 |
| `error-404` | HTTP 404 |
| `error-500` | HTTP 500 |
| `error-502` | HTTP 502 |
| `timeout` | 제한 시간 동안 응답 없음 |
| `race-condition` | 지연 후 HTTP 200 |
| `inconsistent` | HTTP 200 |
| `edge-values` | HTTP 200 |
| `large` | HTTP 200 |

주요 SPA route와 `/fdc_trend` 호환 route는 직접 HTTP 요청에서 모두 HTML 200을 반환했다. 알 수 없는 route도 Vite SPA fallback으로 HTTP 200을 반환했다. React DOM 렌더링, 뒤로/앞으로 가기와 사용자 조작은 Chromium 시작 실패로 확인하지 못했다.

# Code Audit 검사 결과

- 실행 시각: 2026-07-30 KST
- 브랜치 / commit: `agent/code-audit` / `c8e9ee9`

| 명령 | 결과 | 요약 |
|---|---|---|
| `npm run lint` | 성공 | ESLint 오류 없음 |
| `npm run test:unit` | 성공 | 21 tests, 21 pass |
| `npm run test:contract` (샌드박스) | 환경 실패 | loopback bind가 `EPERM`으로 차단됨 |
| `node tests/contract/mock-api.test.mjs` (원인 분리) | 환경 실패 | 동일한 loopback bind 제한 확인 |
| `npm run test:contract` (승인된 샌드박스 외 재실행) | 성공 | 39 tests, 39 pass |
| 합성 `inconsistent` 직접 생성 | 성공 | 요청 외 라인 혼합 및 요약·상세 불일치 확인 |
| 성공 상태 빈 객체 직접 주입 | 성공 | 목록 API의 빈 배열 치환과 필터 API의 무검증 반환 확인 |
| 잘못된 합성 날짜 직접 주입 | 성공 | 두 scatter 생성기가 잘못된 날짜를 포인트로 채택 |
| `npm run test:e2e` | 미실행 | 기본 설정이 허용 경로 밖에 결과물을 생성하므로 실행하지 않음 |
| `npm run build` | 미실행 | 감사 지시의 필수 검사가 아니며 허용 경로 밖의 build 산출물을 생성함 |

계약 테스트가 최종 통과했더라도 Mock 응답 자체가 의도한 스키마를 만족한다는 뜻일 뿐, 프런트엔드의 범위·합계·성공 응답 스키마 방어가 충분하다는 의미는 아니다.


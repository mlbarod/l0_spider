# 2026-08-01 Code Audit 테스트 요약

| 명령 또는 검증 | 결과 | 핵심 내용 |
|---|---|---|
| `npm run lint` | 성공 | ESLint 오류 없음 |
| `npm run test:unit` | 성공 | 1 pass; 뒤쪽 중복 script 정의만 실행 |
| `node --test server/*.test.mjs src/features/fdc-trend/api/*.test.mjs src/features/fdc-trend/utils/*.test.mjs` | 성공 | 22 pass |
| `npm run test:integration` | 성공 | 1 pass |
| Python 등록 helper 단위 테스트 2개 모듈 | 성공 | 6 pass; 생성된 bytecode cache는 종료 전에 제거 |
| `npm run test:contract` | 실패 | 설치 상태의 `ajv` major 불일치와 `ajv-formats` 누락으로 Schema test 2개가 load 단계에서 중단; Mock test는 sandbox bind 제한으로 중단 |
| Mock API contract 단독 재실행 | 성공 | sandbox 밖 합성 loopback 환경에서 39 pass |
| 합성 직접 재현 6종 | 성공 | 날짜, 숫자, 스키마, placeholder, 라인 범위, HTTP 상태 재현 |

## 제한

- 의존성 설치·업데이트는 역할상 금지되어 Schema contract 2개를 복구 실행하지 않았다.
- 브라우저 E2E, 실제 DB·파일·메일·운영 API는 실행하지 않았다.
- 계약 테스트 최초 실패 중 sandbox bind 제한은 제품 결함으로 분류하지 않는다.

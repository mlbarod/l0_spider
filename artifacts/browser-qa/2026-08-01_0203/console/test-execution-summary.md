# Browser QA 검증 명령 요약

| 명령 | 결과 | 확인 내용 |
|---|---|---|
| `npm run lint` | Pass | ESLint 오류 없음 |
| `npm run test:unit` | Pass | 중복 script key로 인해 `tests/unit/step-hmac.test.mjs` 1개 파일만 실행 |
| 기존 unit 범위를 명시한 `node --test` | Pass | server 14개, frontend API·utility 8개 등 총 22개 subtest 통과 |
| `npm run test:integration` | Pass | STEP deep-link integration 1개 파일 통과 |
| `npm run test:contract` | Fail | 3개 파일 모두 `ajv/dist/2020.js`를 찾지 못해 시작 단계 실패 |
| `npm run test:e2e` | Fail | Chromium 시작 전 공유 라이브러리 누락, 1개 실패·5개 미실행 |

## 설치 상태 제한

- `package.json`은 `ajv` 8 계열을 선언한다.
- 현재 `node_modules`에는 호환되지 않는 `ajv` 6 계열이 확인됐다.
- Browser QA 역할은 설치·업데이트를 금지하므로 `npm install` 또는 `npm ci`를 실행하지 않았다.

## 자동 생성 파일

Playwright가 ignored 경로인 `test-results/`와 `playwright-report/`를 갱신했다. 애플리케이션·테스트·설정·의존성 파일은 수정하지 않았다.

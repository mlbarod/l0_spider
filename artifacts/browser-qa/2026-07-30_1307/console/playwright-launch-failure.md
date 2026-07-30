# Playwright 브라우저 실행 실패 요약

- 실행 시각: 2026-07-30 13:08 KST
- 실행 명령: `npm run test:e2e`
- Playwright: `1.61.1`
- 대상 브라우저 메타데이터: Chromium `149.0.7827.55` (revision `1228`)
- 결과: 첫 테스트에서 브라우저 페이지가 생성되기 전에 Chromium 프로세스 종료
- 직접 오류: `libnspr4.so: cannot open shared object file: No such file or directory`
- 테스트 결과: 1개 실패, 5개 미실행
- 사용자 화면 도달 여부: 도달하지 못함
- 수집 불가 근거: 화면 스크린샷, 브라우저 console, page error, failed request, 사용자 동작 trace

## 판정

이 결과는 애플리케이션 결함이 아니라 QA 실행 환경 제한이다. 의존성 설치가 금지된 작업이므로 공유 라이브러리를 설치하지 않았고, 브라우저 검수를 통과한 것으로 처리하지 않았다.

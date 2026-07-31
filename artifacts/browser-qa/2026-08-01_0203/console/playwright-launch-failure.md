# Playwright Chromium 시작 실패

- 실행 시각: 2026-08-01 02:03 KST 이전 검수 구간
- 명령: `npm run test:e2e`
- 결과: 실패
- 테스트 결과: 1개 실패, 5개 미실행
- 실패 단계: 첫 페이지 생성 전 Chromium process 시작 단계
- 핵심 오류: `libnspr4.so: cannot open shared object file: No such file or directory`
- 사용자 화면 진입 여부: 진입하지 못함
- console/page/network 수집 여부: page가 생성되지 않아 수집하지 못함
- screenshot: 없음
- trace: Playwright 자동 산출물은 생성됐으나 page 생성 전 실패 자료이므로 제품 화면 증거로 사용하지 않음
- 판정: 호스트 브라우저 라이브러리 제한이며 애플리케이션 결함으로 판정하지 않음

역할 경계에 따라 OS 라이브러리나 npm 의존성을 설치하지 않았고 Playwright 설정도 변경하지 않았다.

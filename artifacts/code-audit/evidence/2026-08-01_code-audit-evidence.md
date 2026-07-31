# 2026-08-01 Code Audit 합성 재현 근거

실제 운영 데이터·내부 주소·실제 식별자·비밀은 사용하거나 기록하지 않았다. 아래 결과는 합성 값과 import 가능한 순수 함수 또는 라이브러리 동작만으로 확인했다.

## E-01 잘못된 날짜와 숫자 변환

- 대시보드 `TL.total`에 숫자로 변환할 수 없는 합성 문자열을 전달하면 `monitoringSensorTotal`이 `0`이 됐다.
- 달력·시간 범위를 벗어난 날짜를 자설비와 공통부 scatter builder에 전달하면 두 경로 모두 포인트 1건을 생성했다.
- 두 포인트의 `actTimeMs`는 유한한 숫자였고, 공통부의 `invalidActTimeRows`는 `0`이었다.

## E-02 HTTP 200 스키마 불일치

- HTTP 성공과 빈 객체를 반환하는 합성 `fetch`를 주입했다.
- My EQP 및 Mailing 등록 조회 함수는 예외 없이 빈 배열을 반환했다.
- 자설비 및 공통부 데이터 조회 함수는 예외 없이 빈 객체를 반환했다.

## E-03 React Query placeholder 범위

- 첫 번째 합성 라인 결과를 캐시에 넣고 다른 라인 query key로 전환했다.
- 두 번째 요청이 완료되지 않은 동안 결과는 `isPlaceholderData=true`, `isFetching=true`였고 데이터에는 첫 번째 라인이 남았다.

## E-04 My EQP 라인 범위

- 서로 다른 두 합성 라인 행에 `includeAllLines=true`를 적용했다.
- 요청 라인은 하나였지만 반환 행의 라인 집합에는 두 라인이 모두 포함됐다.

## E-05 입력 오류 HTTP 상태

- 잘못된 형식의 합성 수신자 ID를 Mailing 등록 handler에 전달했다.
- DB helper 실행 전 검증에서 실패했지만 HTTP 상태는 `500`이었다.

## E-06 테스트 진입점

- `package.json`을 표준 JSON parser로 읽으면 뒤쪽 `test:unit`만 남는다.
- `npm run test:unit`은 `tests/unit/`의 파일 1개만 실행했다.
- 저장소의 기존 서버·프런트 단위 테스트 경로를 직접 실행하면 테스트 파일 22개가 실행됐다.

## E-07 유지보수 구조

- `FdcTrendPage.jsx`는 2,257줄이며 같은 파일에 다수의 query, mutation, 필터, 차트와 이력 책임이 결합돼 있다.
- 서버 모듈 12개에 `sendJson`, 5개에 `readJsonBody`, 7개에 Python subprocess 실행 구조가 각각 존재한다.
- 정적 import 검색에서 `@heroicons/react`, `@tabler/icons-react`, `@tanstack/react-table`, `date-fns`, `framer-motion`, `plotly.js-dist-min`, `quill`, `react-icons`, `react-is`, `react-use`, `vis-data`, `vis-timeline`, `zustand`는 실행 코드·테스트의 직접 참조를 찾지 못했다.
- `pages/versions/*.bak` 두 파일은 README에 복구 버전으로 문서화돼 있어 미사용 파일 판정에서 제외했다.

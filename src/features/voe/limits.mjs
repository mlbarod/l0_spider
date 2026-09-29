// 서버와 브라우저가 공유하는 공개 상수. 인증·환경설정을 추가하지 않는다.
// 기존 MEDIUMTEXT 컬럼의 최대 바이트보다 작게 유지한다.
export const MAX_QNA_HTML_BYTES = 15 * 1024 * 1024
export const MAX_QNA_REQUEST_BYTES = 20 * 1024 * 1024
export const QNA_SIZE_MESSAGE = "글과 사진의 전체 용량이 너무 큽니다. 사진 크기를 줄이거나 여러 글로 나누어 등록해 주세요."

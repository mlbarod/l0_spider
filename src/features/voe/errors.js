import { QNA_SIZE_MESSAGE } from "./limits.mjs"

export function qnaFailureMessage(error) {
  if (error?.status === 413 || error?.code === "BODY_TOO_LARGE") return QNA_SIZE_MESSAGE
  if (error?.status === 401 || error?.code === "AUTHENTICATION_REDIRECT") return "로그인이 만료되어 저장할 수 없습니다. 작성 내용을 복사해 보관한 뒤 다시 로그인해 주세요."
  if (error?.status === 403) return "이 내용을 저장할 권한이 없습니다. 관리자에게 사용 권한을 확인해 주세요."
  if (error?.status === 404) return "게시글이 삭제되었거나 더 이상 이용할 수 없습니다. 작성 내용을 보관한 뒤 목록에서 게시글을 확인해 주세요."
  if (error?.status === 409) return "다른 사용자가 내용을 변경했습니다. 작성 내용을 보관한 뒤 최신 게시글을 확인해 주세요."
  if (error?.status === 429) return "요청이 한꺼번에 많아 지금은 저장할 수 없습니다. 잠시 후 다시 시도해 주세요."
  if (error?.code === "VALIDATION_FAILED" && typeof error.message === "string") return error.message
  if (error?.status === 400 || error?.status === 422) return "입력한 내용 중 저장할 수 없는 항목이 있습니다. 제목과 본문을 확인해 주세요."
  if (error?.code === "NETWORK_ERROR" || error?.code === "INVALID_RESPONSE" || [408, 502, 504].includes(error?.status)) return "서버의 응답을 받지 못해 저장 여부를 확인할 수 없습니다. 연결 상태를 확인하고, 중복 등록을 피하려면 목록에서 등록 여부를 먼저 확인해 주세요."
  if (error?.status >= 500) return "일시적인 서버 문제로 저장을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요."
  return "저장 결과를 확인할 수 없습니다. 작성 내용을 보관한 뒤 목록에서 등록 여부를 확인해 주세요. 문제가 계속되면 관리자에게 문의해 주세요."
}

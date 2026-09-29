// 편집기·게시글·메일에서 공통으로 허용하는 글씨 크기(pt).
export const QNA_FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36]
export const QNA_DEFAULT_FONT_SIZE = 11
export function isQnaFontSize(value) {
  return QNA_FONT_SIZES.some((size) => String(size) === String(value))
}

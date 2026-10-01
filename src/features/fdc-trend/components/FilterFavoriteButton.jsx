import { Star } from "lucide-react"

export function FilterFavoriteHint() {
  return (
    <p className="absolute -top-7 left-1 flex items-center gap-1 whitespace-nowrap text-[13px] font-normal text-muted-foreground">
      <Star className="size-4 shrink-0" aria-label="별표" />
      <span>을 클릭하여 즐겨찾기 등록</span>
    </p>
  )
}

export function FilterFavoriteButton({ field, label, saved, disabled, onClick }) {
  return (
    <button
      type="button"
      aria-label={`${field === "line" ? "Line Name" : "SDWT"} ${label} 즐겨찾기 ${saved ? "해제" : "등록"}`}
      aria-pressed={Boolean(saved)}
      title={saved ? `${label}: 클릭하여 즐겨찾기 해제` : `${label}: 다음 접속의 기본값으로 저장`}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-40 ${saved ? "text-amber-600" : "text-muted-foreground hover:bg-amber-50 hover:text-amber-600"}`}
    >
      <Star className="size-4" fill={saved ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  )
}

import { useEffect, useRef, useState } from "react"
import { GripHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

function clampHeight(value, minHeight, maxHeight) {
  return Math.min(maxHeight, Math.max(minHeight, value))
}

export function ResizableFilterArea({
  children,
  className,
  defaultHeight = 320,
  minHeight = 160,
  maxHeight = 720,
  label = "필터 영역 높이 조절",
}) {
  const [height, setHeight] = useState(() => clampHeight(defaultHeight, minHeight, maxHeight))
  const dragRef = useRef(null)

  useEffect(() => () => {
    dragRef.current = null
  }, [])

  const finishResize = (event) => {
    if (!dragRef.current) return
    event.currentTarget.releasePointerCapture?.(event.pointerId)
    dragRef.current = null
  }

  return (
    <div className={cn("relative shrink-0", className)} style={{ height }}>
      <div className="h-full min-h-0 pb-3">{children}</div>
      <div
        role="separator"
        aria-label={label}
        aria-orientation="horizontal"
        aria-valuemin={minHeight}
        aria-valuemax={maxHeight}
        aria-valuenow={Math.round(height)}
        tabIndex={0}
        className={cn(
          "group absolute inset-x-0 bottom-0 z-30 flex h-3 touch-none cursor-row-resize items-center justify-center",
          "border-t border-transparent bg-gradient-to-b from-transparent to-muted/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          dragRef.current = { startY: event.clientY, startHeight: height }
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (!dragRef.current) return
          const nextHeight = dragRef.current.startHeight + event.clientY - dragRef.current.startY
          setHeight(clampHeight(nextHeight, minHeight, maxHeight))
        }}
        onPointerUp={finishResize}
        onPointerCancel={finishResize}
        onDoubleClick={() => setHeight(clampHeight(defaultHeight, minHeight, maxHeight))}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 40 : 12
          if (event.key === "ArrowUp") {
            event.preventDefault()
            setHeight((current) => clampHeight(current - step, minHeight, maxHeight))
          } else if (event.key === "ArrowDown") {
            event.preventDefault()
            setHeight((current) => clampHeight(current + step, minHeight, maxHeight))
          } else if (event.key === "Home") {
            event.preventDefault()
            setHeight(minHeight)
          } else if (event.key === "End") {
            event.preventDefault()
            setHeight(maxHeight)
          }
        }}
      >
        <span className="grid h-2.5 w-12 place-items-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors group-hover:border-primary/40 group-hover:text-primary">
          <GripHorizontal className="size-3" aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}

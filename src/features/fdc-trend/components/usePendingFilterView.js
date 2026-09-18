import { useLayoutEffect, useRef } from "react"

// Retain only the committed filter presentation, never query data or chart results.
// The caller must block interaction with the retained children while pending.
export function usePendingFilterView(view, isPending) {
  const settledViewRef = useRef(null)

  useLayoutEffect(() => {
    if (!isPending) settledViewRef.current = view
  })

  return isPending && settledViewRef.current ? settledViewRef.current : view
}

import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { fetchCurrentUser } from "../api/currentUserApi"
import { FAVORITE_VIRTUAL_SDWTS, inspectFavoriteFilters, normalizeFavorites } from "../utils/filterFavorites.mjs"

async function requestFavorites(body) {
  const response = await fetch("/api/filter-favorites", {
    method: body ? "PUT" : "GET",
    credentials: "same-origin",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(12000),
  })
  if (!response.ok) throw new Error("즐겨찾기를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.")
  const result = await response.json()
  if (!result.ok) throw new Error("즐겨찾기를 처리하지 못했습니다.")
  return normalizeFavorites(result.favorites ?? result.favorite)
}

export function useFilterFavorites({ initialLine, initialTeam, skipRestore, mappingReady, lineMapping }) {
  const [selectedLine, updateLine] = useState(initialLine)
  const [selectedTeam, updateTeam] = useState(initialTeam)
  const [restored, setRestored] = useState(false)
  const interacted = useRef(false)
  const client = useQueryClient()
  const user = useQuery({ queryKey: ["current-user"], queryFn: fetchCurrentUser, staleTime: Infinity, retry: false })
  const knoxId = user.data?.knoxId
  const queryKey = ["filter-favorites", knoxId]
  const query = useQuery({ queryKey, queryFn: () => requestFavorites(), enabled: Boolean(knoxId), staleTime: Infinity, retry: false })
  useEffect(() => {
    if (restored || !mappingReady || user.isPending || (knoxId && query.isPending)) return
    if (!skipRestore && !interacted.current) {
      const { selection: favorite, changed } = inspectFavoriteFilters(query.data, lineMapping)
      if (favorite) {
        updateLine(favorite.line)
        updateTeam(favorite.sdwt)
      }
      if (changed) {
        toast.warning("기준정보가 변경되어 즐겨찾기 일부를 적용하지 못했습니다. 다시 등록해 주세요.", {
          id: "filter-favorites-mapping-changed",
          description: "적용하지 못한 필터는 기존 기본값으로 선택했습니다. 저장된 즐겨찾기는 유지됩니다.",
          duration: 8000,
        })
      }
    }
    setRestored(true)
  }, [restored, mappingReady, user.isPending, knoxId, query.isPending, query.data, skipRestore, lineMapping])
  const mutation = useMutation({
    mutationFn: requestFavorites,
    onSuccess: (favorite, variables) => {
      client.setQueryData(queryKey, favorite)
      toast.success(variables.selected ? "즐겨찾기 등록완료" : "즐겨찾기 해제완료")
    },
    onError: (error) => toast.error(error.message),
  })
  const savedFavorites = normalizeFavorites(query.data)
  const isSaved = (field, line, sdwt) => field === "line"
    ? savedFavorites.lines.includes(line)
    : savedFavorites.sdwts.some(item => item.line === line && item.sdwt === sdwt)
  return {
    selectedLine, selectedTeam,
    setSelectedLine: (value) => { interacted.current = true; updateLine(value) },
    setSelectedTeam: (value) => { interacted.current = true; updateTeam(value) },
    ready: restored || skipRestore || interacted.current,
    buttonProps: (field, line, sdwt) => ({
      field,
      saved: isSaved(field, line, sdwt),
      disabled: !knoxId || !restored || mutation.isPending || !line || (field === "sdwt" && lineMapping[sdwt] !== line && !FAVORITE_VIRTUAL_SDWTS.includes(sdwt)),
      onClick: () => mutation.mutate({ field, line, selected: !isSaved(field, line, sdwt), ...(field === "sdwt" ? { sdwt } : {}) }),
    }),
  }
}

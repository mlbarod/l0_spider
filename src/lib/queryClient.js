// 파일 경로: src/lib/queryClient.js
// React Query 클라이언트를 한 곳에서 생성/관리합니다.
// - 기본 옵션을 통일해 각 feature가 동일한 페칭 규칙을 따르도록 합니다.
// - staleTime/refetchOnWindowFocus 등을 중앙에서 조절해 UX 일관성을 확보합니다.

import { QueryClient } from "@tanstack/react-query"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}

import { useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "@/lib/queryClient"
import { ThemeProvider } from "@/lib/theme"

export function AppProviders({ children }) {
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" defaultColor="violet">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

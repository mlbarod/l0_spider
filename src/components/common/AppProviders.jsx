import { useState } from "react"
import { QueryClientProvider } from "@tanstack/react-query"

import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/features/auth"
import { createQueryClient } from "@/lib/queryClient"
import { ThemeProvider } from "@/lib/theme"

export function AppProviders({ children }) {
  const [queryClient] = useState(() => createQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" defaultColor="sky">
        <AuthProvider>
          {children}
          <Toaster richColors position="top-center" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

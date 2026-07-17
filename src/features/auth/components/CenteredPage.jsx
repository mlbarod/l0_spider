export function CenteredPage({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      {children}
    </main>
  )
}

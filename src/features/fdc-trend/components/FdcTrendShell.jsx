import { Outlet } from "react-router-dom"

export function FdcTrendShell() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <Outlet />
    </div>
  )
}

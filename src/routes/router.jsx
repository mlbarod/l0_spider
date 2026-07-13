import { Outlet, createBrowserRouter } from "react-router-dom"

import { fdcTrendRoutes } from "@/features/fdc-trend"

function RootShell() {
  return (
    <div className="h-screen min-h-0 bg-background text-foreground">
      <Outlet />
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootShell />,
    children: fdcTrendRoutes,
  },
])

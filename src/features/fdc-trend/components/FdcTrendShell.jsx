import { Outlet } from "react-router-dom"
import { SsoSession } from "@/components/common/SsoSession"

import { SiteNotice } from "./SiteNotice"

export function FdcTrendShell() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <SsoSession />
      <Outlet />
      <SiteNotice />
    </div>
  )
}

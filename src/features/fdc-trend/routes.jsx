// 파일 경로: src/features/fdc-trend/routes.jsx
import { FdcTrendShell } from "./components/FdcTrendShell"
import { CommonalityAnomalyPage } from "./pages/CommonalityAnomalyPage"
import { CommonAnomalyPage } from "./pages/CommonAnomalyPage"
import { FdcTrendPage } from "./pages/FdcTrendPage"
import { L0SpiderHomePage } from "./pages/L0SpiderHomePage"
import { RegistrationHubPage } from "./pages/RegistrationHubPage"
import { SpiderFeaturePage } from "./pages/SpiderFeaturePage"
import { UserManualPage } from "./pages/UserManualPage"

const fdcTrendChildren = [
  {
    index: true,
    element: <L0SpiderHomePage />,
  },
  {
    path: "self-equipment",
    element: <FdcTrendPage />,
  },
  {
    path: "my-eqp",
    element: <RegistrationHubPage />,
  },
  {
    path: "registration",
    element: <RegistrationHubPage />,
  },
  {
    path: "matching-anomaly",
    element: <CommonalityAnomalyPage />,
  },
  {
    path: "common-anomaly",
    element: <CommonAnomalyPage />,
  },
  {
    path: "manual",
    element: <UserManualPage />,
  },
  {
    path: "recipients",
    element: <RegistrationHubPage />,
  },
  {
    path: "defect-spider",
    element: <SpiderFeaturePage type="defect" />,
  },
  {
    path: "l1-spider",
    element: <SpiderFeaturePage type="l1" />,
  },
  {
    path: "l3-spider",
    element: <SpiderFeaturePage type="l3" />,
  },
]

export const fdcTrendRoutes = [
  {
    element: <FdcTrendShell />,
    children: fdcTrendChildren,
  },
  {
    path: "fdc_trend",
    element: <FdcTrendShell />,
    children: fdcTrendChildren,
  },
]

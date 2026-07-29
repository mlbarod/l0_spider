import { expect, test } from "./fixtures.mjs"

test.describe.configure({ mode: "serial" })

async function setScenario(request, scenario) {
  const response = await request.post("/__mock/scenario", { data: { scenario } })
  expect(response.ok()).toBeTruthy()
}

test.beforeEach(async ({ request }) => {
  const response = await request.post("/__mock/reset")
  expect(response.ok()).toBeTruthy()
})

test("app entry, dashboard, primary routes, refresh, and direct URL work", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /SPIDER/i }).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: /라인별 이상 현황 Dashboard/ })).toBeVisible()

  await page.goto("/self-equipment")
  await expect(page.getByRole("heading", { name: /자설비 이상감지/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("heading", { name: /자설비 이상감지/ })).toBeVisible()

  await page.goto("/matching-anomaly")
  await expect(page.getByRole("heading", { name: /동일성 이상감지/ })).toBeVisible()
  await page.goto("/common-anomaly")
  await expect(page.getByRole("heading", { name: /공통부 이상감지/ })).toBeVisible()
  await page.goto("/registration")
  await expect(page.getByRole("heading", {
    level: 1,
    name: "Mailing Report 및 My EQP 등록",
  })).toBeVisible()
})

test("dashboard line filter can be opened and selected", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /라인별 이상 현황 Dashboard/ })).toBeVisible()
  const filterButton = page.locator("form").filter({ hasText: "라인 선택" }).getByRole("button").first()
  await filterButton.click()
  const lineOption = page.getByText("LINE_A", { exact: true }).last()
  await expect(lineOption).toBeVisible()
  await lineOption.click()
})

test("empty scenario renders a valid dashboard", async ({ page, request }) => {
  await setScenario(request, "empty")
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /라인별 이상 현황 Dashboard/ })).toBeVisible()
  await expect(page.getByText("0", { exact: true }).first()).toBeVisible()
})

test("slow scenario exposes the loading state", async ({ page, request }) => {
  await setScenario(request, "slow")
  await page.goto("/")
  await expect(page.getByText(/대시보드를 불러오는 중/)).toBeVisible()
  await expect(page.getByRole("heading", { name: /라인별 이상 현황 Dashboard/ })).toBeVisible()
})

test("error-500 scenario exposes the application error state", async ({ page, request }) => {
  await setScenario(request, "error-500")
  await page.goto("/")
  await expect(page.getByText(/Synthetic HTTP 500 response/).first()).toBeVisible()
})

test("large scenario completes a basic dashboard render", async ({ page, request }) => {
  await setScenario(request, "large")
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /라인별 이상 현황 Dashboard/ })).toBeVisible()
})

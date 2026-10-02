// Run after npm run build. All requests and notices are synthetic; no DB is contacted.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import test from "node:test"
import { chromium } from "playwright"

test("공지 수정·취소·실패 복구와 팝업 갱신, 모바일 스크롤", async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on("pageerror", error => errors.push(error.message))
    let notices = [
      { noticeId: 1, title: "서비스 점검 안내", body: "서비스 이용 안내입니다.\n점검 시간을 확인해 주세요.", status: "ACTIVE", createdAt: "2026-10-02 09:00", createdBy: "test.admin" },
      { noticeId: 2, title: "완료된 공지", body: "완료된 공지 본문", status: "COMPLETED", createdAt: "2026-10-01 09:00", createdBy: "test.admin", completedBy: "test.admin", completedAt: "2026-10-02 09:00" },
    ]
    const writes = []
    let failSave = false
    await page.route("**/*", async route => {
      const url = new URL(route.request().url())
      const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
      if (url.pathname.startsWith("/api/")) {
        if (url.pathname === "/api/auth/session") return json({ ok: true, enabled: false })
        if (url.pathname === "/api/current-user") return json({ ok: true, knoxId: "test.admin" })
        if (url.pathname === "/api/notices/permissions") return json({ ok: true, permissions: { canManage: true } })
        if (url.pathname === "/api/notices/manage") return json({ ok: true, notices })
        if (url.pathname === "/api/notices") {
          const method = route.request().method()
          if (method !== "GET") {
            const data = route.request().postDataJSON()
            writes.push({ method, data })
            if (failSave) return json({ error: "저장 실패 테스트" }, 500)
            if (method === "PUT") notices = notices.map(notice => notice.noticeId === data.noticeId ? { ...notice, ...data } : notice)
            if (method === "POST") notices.push({ ...data, noticeId: 3, status: "ACTIVE" })
            if (method === "PATCH") notices = notices.map(notice => notice.noticeId === data.noticeId ? { ...notice, status: "COMPLETED" } : notice)
            return json({ ok: true, affectedRows: 1, notice: notices.find(notice => notice.noticeId === data.noticeId) })
          }
          return json({ ok: true, notices: notices.filter(notice => notice.status === "ACTIVE") })
        }
        return json({ ok: true, rows: [], filters: {}, records: [], registrations: [] })
      }
      if (url.origin !== "http://notice.test") return route.abort()
      const file = url.pathname.startsWith("/assets/") ? url.pathname.slice(1) : "index.html"
      return route.fulfill({ body: await readFile(resolve("dist", file)), contentType: file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html" })
    })
    await page.goto("http://notice.test/")
    await page.getByRole("heading", { name: "ETCH Spider 공지사항" }).waitFor()
    await page.screenshot({ path: "/tmp/notice-popup-desktop.png" })
    await page.getByRole("button", { name: "확인", exact: true }).click()
    await page.getByRole("button", { name: /공지 등록/ }).click()
    const card = title => page.locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    await card("서비스 점검 안내").getByRole("button", { name: "수정", exact: true }).click()
    assert.equal(await page.getByLabel("제목", { exact: true }).inputValue(), "서비스 점검 안내")
    await page.getByLabel("제목", { exact: true }).fill("취소할 내용")
    await page.getByRole("button", { name: "수정 취소" }).click()
    assert.equal(await page.getByLabel("제목", { exact: true }).inputValue(), "")
    assert.equal(writes.length, 0)
    await card("서비스 점검 안내").getByRole("button", { name: "수정", exact: true }).click()
    await page.getByLabel("제목", { exact: true }).fill("수정된 점검 안내")
    await page.getByLabel("본문", { exact: true }).fill("수정된 본문입니다.\n변경 사항을 확인해 주세요.")
    await page.screenshot({ path: "/tmp/notice-management-desktop.png" })
    failSave = true
    await page.getByRole("button", { name: "수정 저장" }).click()
    await page.getByText("저장 실패 테스트", { exact: true }).waitFor()
    assert.equal(await page.getByLabel("제목", { exact: true }).inputValue(), "수정된 점검 안내")
    failSave = false
    await page.getByRole("button", { name: "수정 저장" }).click()
    await card("수정된 점검 안내").waitFor()
    assert.equal(writes.at(-1).method, "PUT")
    assert.equal(writes.at(-1).data.noticeId, 1)
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await page.getByRole("button", { name: "공지사항 열기" }).click()
    await page.getByRole("heading", { name: "수정된 점검 안내", exact: true }).waitFor()
    await page.getByRole("button", { name: "확인", exact: true }).click()
    await page.getByRole("button", { name: /공지 등록/ }).click()
    await card("완료된 공지").getByRole("button", { name: "수정", exact: true }).click()
    await page.getByLabel("제목", { exact: true }).fill("완료 공지 수정")
    await page.getByRole("button", { name: "수정 저장" }).click()
    await card("완료 공지 수정").waitFor()
    assert.equal(notices[1].status, "COMPLETED")
    await page.getByLabel("제목", { exact: true }).fill("신규 공지")
    await page.getByLabel("본문", { exact: true }).fill("신규 본문")
    await page.getByRole("button", { name: "신규 등록", exact: true }).click()
    await card("신규 공지").waitFor()
    assert.equal(writes.at(-1).method, "POST")
    await card("신규 공지").getByRole("button", { name: "완료 처리", exact: true }).click()
    await page.getByRole("button", { name: "완료 확인", exact: true }).click()
    await card("신규 공지").getByText("완료", { exact: true }).waitFor()
    assert.equal(writes.at(-1).method, "PATCH")
    await page.setViewportSize({ width: 390, height: 700 })
    await card("완료 공지 수정").getByRole("button", { name: "수정", exact: true }).click()
    await page.getByRole("button", { name: "수정 취소" }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: "/tmp/notice-management-mobile.png" })
    const bounds = await page.getByRole("dialog").boundingBox()
    assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 700)
    assert.ok(await page.getByRole("dialog").evaluate(node => node.scrollWidth <= node.clientWidth))
    await page.getByRole("button", { name: "Close", exact: true }).click()
    notices[0].body = "긴 공지 본문입니다.\n".repeat(200)
    await page.reload()
    await page.getByRole("heading", { name: "ETCH Spider 공지사항" }).waitFor()
    const scroll = await page.getByRole("dialog").locator("article").evaluate(node => {
      const scroller = node.parentElement
      scroller.scrollTop = scroller.scrollHeight
      return { top: scroller.scrollTop, overflow: scroller.scrollHeight > scroller.clientHeight }
    })
    assert.ok(scroll.overflow && scroll.top > 0)
    await page.getByRole("button", { name: "확인", exact: true }).click()
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
})

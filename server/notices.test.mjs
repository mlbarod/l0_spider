import assert from "node:assert/strict"
import { Readable } from "node:stream"
import test from "node:test"

import {
  buildNoticeCompletePayload,
  buildNoticeCreatePayload,
  handleNoticesRequest,
  isNoticeAdmin,
} from "./notices.mjs"

function createRequest(method, body = "") {
  const request = Readable.from(body ? [JSON.stringify(body)] : [])
  request.method = method
  return request
}

function createResponse() {
  return {
    statusCode: null,
    body: "",
    writeHead(statusCode) {
      this.statusCode = statusCode
    },
    end(body = "") {
      this.body = body
    },
  }
}

const adminDependencies = {
  configuredAdminKnoxId: "notice.admin",
  remoteIpReader: () => "127.0.0.1",
  userResolver: async () => ({ ok: true, knoxId: "notice.admin" }),
}

test("공지 관리자 권한은 서버 환경변수 Knox ID와 비교한다", () => {
  assert.equal(isNoticeAdmin("notice.admin", "notice.admin"), true)
  assert.equal(isNoticeAdmin(" NOTICE.ADMIN ", "notice.admin"), true)
  assert.equal(isNoticeAdmin("other.user", "notice.admin"), false)
  assert.equal(isNoticeAdmin("notice.admin", ""), false)
})

test("공지 등록 및 완료 payload는 입력값과 서버 사용자 ID를 정규화한다", () => {
  assert.deepEqual(buildNoticeCreatePayload({
    title: " 점검 안내 ",
    body: " 본문입니다. ",
  }, " NOTICE.ADMIN "), {
    title: "점검 안내",
    body: "본문입니다.",
    createdBy: "notice.admin",
  })
  assert.deepEqual(buildNoticeCompletePayload({ noticeId: "12" }, "NOTICE.ADMIN"), {
    noticeId: 12,
    completedBy: "notice.admin",
  })
  assert.throws(() => buildNoticeCreatePayload({ title: "", body: "본문" }, "admin"), /제목/)
  assert.throws(() => buildNoticeCompletePayload({ noticeId: 0 }, "admin"), /공지 번호/)
})

test("일반 공지 조회는 진행중 목록과 관리 권한을 함께 반환한다", async () => {
  const response = createResponse()
  await handleNoticesRequest(
    createRequest("GET"),
    response,
    new URL("http://localhost/api/notices"),
    {
      ...adminDependencies,
      helper: async (payload) => ({
        ok: true,
        notices: [{
          noticeId: 1,
          title: "점검 안내",
          body: "본문",
          status: "ACTIVE",
          createdBy: "notice.admin",
          createdAt: "2026-08-31 09:00:00",
        }],
        action: payload.action,
      }),
    },
  )

  const payload = JSON.parse(response.body)
  assert.equal(response.statusCode, 200)
  assert.equal(payload.notices.length, 1)
  assert.equal(payload.notices[0].status, "ACTIVE")
  assert.equal(payload.permissions.canManage, true)
})

test("관리자가 아닌 사용자의 공지 등록은 DB 호출 전에 거부한다", async () => {
  let helperCalled = false
  const response = createResponse()
  await handleNoticesRequest(
    createRequest("POST", { title: "제목", body: "본문" }),
    response,
    new URL("http://localhost/api/notices"),
    {
      ...adminDependencies,
      userResolver: async () => ({ ok: true, knoxId: "other.user" }),
      helper: async () => {
        helperCalled = true
        return { ok: true }
      },
    },
  )

  assert.equal(response.statusCode, 403)
  assert.equal(JSON.parse(response.body).code, "NOTICE_ADMIN_REQUIRED")
  assert.equal(helperCalled, false)
})

test("관리자 공지 등록은 요청의 사용자 값 대신 서버 Knox ID를 기록한다", async () => {
  let helperPayload
  const response = createResponse()
  await handleNoticesRequest(
    createRequest("POST", { title: "신규 공지", body: "공지 본문", createdBy: "forged.user" }),
    response,
    new URL("http://localhost/api/notices"),
    {
      ...adminDependencies,
      helper: async (payload) => {
        helperPayload = payload
        return {
          ok: true,
          notice: {
            noticeId: 3,
            title: payload.title,
            body: payload.body,
            status: "ACTIVE",
            createdBy: payload.createdBy,
          },
        }
      },
    },
  )

  assert.equal(response.statusCode, 201)
  assert.equal(helperPayload.createdBy, "notice.admin")
  assert.equal(helperPayload.action, "create")
})

test("완료 처리는 진행중 공지 한 건이 변경된 경우에만 성공한다", async () => {
  const response = createResponse()
  await handleNoticesRequest(
    createRequest("PATCH", { noticeId: 7 }),
    response,
    new URL("http://localhost/api/notices"),
    {
      ...adminDependencies,
      helper: async (payload) => {
        assert.deepEqual(payload, {
          action: "complete",
          noticeId: 7,
          completedBy: "notice.admin",
        })
        return { ok: true, affectedRows: 1 }
      },
    },
  )

  assert.equal(response.statusCode, 200)
  assert.equal(JSON.parse(response.body).affectedRows, 1)
})

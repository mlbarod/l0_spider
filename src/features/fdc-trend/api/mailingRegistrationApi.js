async function readPayload(response) {
  return response.json().catch(() => ({}))
}

export async function createMailingRegistration({ knoxId, knoxIds, sdwts }) {
  const recipientKnoxIds = Array.isArray(knoxIds) && knoxIds.length
    ? knoxIds
    : knoxId
      ? [knoxId]
      : []
  const primaryKnoxId = knoxId || recipientKnoxIds[0] || ""
  const response = await fetch("/api/mailing-registration", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ knoxId: primaryKnoxId, knoxIds: recipientKnoxIds, sdwts }),
  })
  const payload = await readPayload(response)

  if (!response.ok) {
    const error = new Error(payload.error || "Mailing 기준정보를 저장하지 못했습니다.")
    error.table = payload.table
    error.debugRow = payload.debugRow
    error.dbErrorCode = payload.dbErrorCode
    error.dbErrorDetail = payload.dbErrorDetail
    throw error
  }
  return payload
}

export async function deleteMailingRegistrationLine({ knoxId, line, sdwts }) {
  const response = await fetch("/api/mailing-registration", {
    method: "DELETE",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ knoxId, line, sdwts }),
  })
  const payload = await readPayload(response)

  if (!response.ok) {
    const error = new Error(payload.error || "Mailing Line 조건을 삭제하지 못했습니다.")
    error.dbErrorCode = payload.dbErrorCode
    error.dbErrorDetail = payload.dbErrorDetail
    throw error
  }
  return payload
}

export async function fetchMailingRegistrations({ knoxId }) {
  const searchParams = new URLSearchParams({ knoxId })
  const response = await fetch(`/api/mailing-registration?${searchParams.toString()}`, {
    headers: { Accept: "application/json" },
  })
  const payload = await readPayload(response)

  if (!response.ok) {
    throw new Error(payload.error || "Mailing 등록 조건을 불러오지 못했습니다.")
  }
  return Array.isArray(payload.registrations) ? payload.registrations : []
}

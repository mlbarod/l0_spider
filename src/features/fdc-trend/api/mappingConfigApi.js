import { getApiErrorMessage } from "./errorMessage.js"
import { validateLineMappingPayload } from "./mappingContract.mjs"

export async function fetchLineMapping() {
  const response = await fetch("/api/mapping-config", {
    headers: { Accept: "application/json" },
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(getApiErrorMessage(payload, "기준정보 매핑을 불러오지 못했습니다."))
  }

  return { ...payload, ...validateLineMappingPayload(payload) }
}

import { createHmac, timingSafeEqual } from "node:crypto"

export const ALL_STEPS = "ALL"
export const STEP_URL_TOKEN_ENV = "SPIDER_STEP_URL_SECRET"

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim()
}

function readStepUrlSecret() {
  const secret = normalizeText(process.env[STEP_URL_TOKEN_ENV])
  if (!secret) {
    const error = new Error(`${STEP_URL_TOKEN_ENV} 환경변수가 필요합니다.`)
    error.code = "STEP_URL_SECRET_MISSING"
    throw error
  }
  return secret
}

export function createStepUrlToken(step, secret) {
  const normalizedStep = normalizeText(step)
  if (!normalizedStep) throw new Error("STEP 값이 필요합니다.")
  if (normalizedStep === ALL_STEPS) return ALL_STEPS
  const tokenSecret = normalizeText(secret) || readStepUrlSecret()
  return createHmac("sha256", tokenSecret)
    .update(`self-equipment-step:v1\u0000${normalizedStep}`, "utf8")
    .digest("base64url")
}

function tokensEqual(left, right) {
  const leftBuffer = Buffer.from(normalizeText(left))
  const rightBuffer = Buffer.from(normalizeText(right))
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function resolveStepUrlToken(token, steps, secret) {
  const normalizedToken = normalizeText(token)
  if (!normalizedToken) return ""
  if (normalizedToken === ALL_STEPS) return ALL_STEPS
  const tokenSecret = normalizeText(secret) || readStepUrlSecret()

  return Array.from(new Set(
    (Array.isArray(steps) ? steps : []).map(normalizeText).filter(Boolean),
  )).find((step) => tokensEqual(createStepUrlToken(step, tokenSecret), normalizedToken)) ?? ""
}

async function readJsonBody(req) {
  let body = ""
  for await (const chunk of req) {
    body += chunk
    if (body.length > 64 * 1024) throw new Error("요청 데이터가 너무 큽니다.")
  }
  if (!body.trim()) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new Error("요청 JSON이 올바르지 않습니다.")
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(payload))
}

export async function handleSelfEquipmentStepTokenRequest(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" })
    return
  }

  try {
    const body = await readJsonBody(req)
    const steps = Array.from(new Set(
      (Array.isArray(body.steps) ? body.steps : [body.step])
        .map(normalizeText)
        .filter(Boolean),
    ))
    if (!steps.length || steps.length > 500) {
      sendJson(res, 400, { ok: false, error: "STEP은 1개 이상 500개 이하로 입력해야 합니다." })
      return
    }
    sendJson(res, 200, {
      ok: true,
      tokens: steps.map((step) => ({ step, token: createStepUrlToken(step) })),
    })
  } catch (error) {
    sendJson(res, error.code === "STEP_URL_SECRET_MISSING" ? 503 : 400, {
      ok: false,
      error: error.message,
    })
  }
}

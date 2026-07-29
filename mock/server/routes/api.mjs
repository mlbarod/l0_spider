import {
  SYNTHETIC,
  createChartPayload,
  createCommonalityPayload,
  createCommonPayload,
  createDashboardPayload,
  createFilterPayload,
  createPassRecords,
  createRegistrations,
} from "../../generators/synthetic-data.mjs"
import { queryObject, readJson, sendJson, sendSvg } from "../../utils/http.mjs"

const IMAGE_ROUTES = new Set([
  "/api/commonality-image",
  "/api/common-anomaly-image",
  "/api/erd-file",
])

function methodAllowed(req, res, methods) {
  if (methods.includes(req.method)) return true
  sendJson(res, 405, { ok: false, error: "Method not allowed" }, { Allow: methods.join(", ") })
  return false
}

function requireQuery(res, params, keys) {
  const missing = keys.filter((key) => !params[key])
  if (!missing.length) return true
  sendJson(res, 400, {
    ok: false,
    error: `Required query parameters are missing: ${missing.join(", ")}`,
    code: "MOCK_INVALID_QUERY",
  })
  return false
}

function mutationResult(extra = {}) {
  return { ok: true, affectedRows: 1, ...extra }
}

export async function handleApiRoute(req, res, url, scenario) {
  const params = queryObject(url)

  if (IMAGE_ROUTES.has(url.pathname)) {
    if (!methodAllowed(req, res, ["GET"])) return true
    if (!requireQuery(res, params, ["path"])) return true
    sendSvg(res, `${scenario} ${url.pathname.split("/").at(-1)}`)
    return true
  }

  switch (url.pathname) {
    case "/api/dashboard-data": {
      if (!methodAllowed(req, res, ["GET"])) return true
      sendJson(res, 200, createDashboardPayload(scenario, params.line ?? []))
      return true
    }
    case "/api/current-user": {
      if (!methodAllowed(req, res, ["GET"])) return true
      sendJson(res, 200, {
        ok: true,
        knoxId: scenario === "partial" ? null : SYNTHETIC.user,
        source: "synthetic-mock",
      })
      return true
    }
    case "/api/hit-history":
    case "/api/clicked-category-history": {
      if (!methodAllowed(req, res, ["POST"])) return true
      await readJson(req)
      sendJson(res, 200, mutationResult())
      return true
    }
    case "/api/latest-commonality-path": {
      if (!methodAllowed(req, res, ["GET"])) return true
      sendJson(res, 200, {
        name: "SYNTHETIC_LATEST",
        path: `fixture://${scenario}/commonality/latest`,
        date: scenario === "empty" ? "" : "2026-01-15 12:00:00",
      })
      return true
    }
    case "/api/commonality-data": {
      if (!methodAllowed(req, res, ["GET"])) return true
      if (!requireQuery(res, params, ["line", "pathSdwt", "sdwt"])) return true
      sendJson(res, 200, createCommonalityPayload(scenario, params))
      return true
    }
    case "/api/common-anomaly-data": {
      if (!methodAllowed(req, res, ["GET"])) return true
      if (!requireQuery(res, params, ["line", "pathSdwt", "sdwt"])) return true
      sendJson(res, 200, createCommonPayload(scenario, params))
      return true
    }
    case "/api/common-anomaly-scatter-data": {
      if (!methodAllowed(req, res, ["GET"])) return true
      if (!requireQuery(res, params, ["path", "eqp", "sensor", "chStep"])) return true
      sendJson(res, 200, createChartPayload(scenario, params, params.mode === "identity"))
      return true
    }
    case "/api/pass-history": {
      if (!methodAllowed(req, res, ["GET", "POST", "DELETE"])) return true
      if (req.method !== "GET") {
        await readJson(req)
        sendJson(res, 200, mutationResult())
        return true
      }
      if (params.view === "filters") {
        sendJson(res, 200, createFilterPayload(scenario, {
          ...params,
          line: params.lineId,
          priorities: params.priority ?? [],
        }))
        return true
      }
      if (params.view === "common-filters") {
        sendJson(res, 200, createCommonPayload(scenario, {
          ...params,
          line: params.lineId,
          pathSdwt: "__SKIP_LIST__",
          sdwt: "SKIP LIST",
        }))
        return true
      }
      sendJson(res, 200, { ok: true, records: createPassRecords(scenario) })
      return true
    }
    case "/api/mapping-config": {
      if (!methodAllowed(req, res, ["GET"])) return true
      sendJson(res, 200, {
        line_mapping: {
          PRODUCT_001: "LINE_A",
          PRODUCT_002: "LINE_B",
        },
        sdwt_mapping: {
          PRODUCT_001: "PRODUCT_001",
          PRODUCT_002: "PRODUCT_002",
        },
        source_path: `fixture://${scenario}/mapping`,
      })
      return true
    }
    case "/api/my-eqp-reference": {
      if (!methodAllowed(req, res, ["GET"])) return true
      const rows = scenario === "empty" ? [] : SYNTHETIC.equipment.map((eqp, index) => ({
        id: `REFERENCE_TEST_${index + 1}`,
        main: SYNTHETIC.lines[index % 2],
        label: SYNTHETIC.products[index % 2],
        prc_group: SYNTHETIC.recipe,
        eqp,
        disp_name: `SYNTHETIC_EQUIPMENT_${index + 1}`,
      }))
      sendJson(res, 200, { ok: true, rows })
      return true
    }
    case "/api/my-eqp-registration": {
      if (!methodAllowed(req, res, ["GET", "POST", "DELETE"])) return true
      if (req.method === "GET") {
        sendJson(res, 200, { ok: true, registrations: createRegistrations(scenario) })
      } else {
        await readJson(req)
        sendJson(res, 200, mutationResult({ knoxId: SYNTHETIC.user }))
      }
      return true
    }
    case "/api/mailing-registration": {
      if (!methodAllowed(req, res, ["GET", "POST", "DELETE"])) return true
      if (req.method === "GET") {
        const registrations = scenario === "empty" ? [] : [{
          id: "MAILING_TEST_001",
          knoxId: SYNTHETIC.user,
          sdwts: SYNTHETIC.products,
          priorities: SYNTHETIC.grades,
        }]
        sendJson(res, 200, { ok: true, registrations })
      } else {
        await readJson(req)
        sendJson(res, 200, mutationResult())
      }
      return true
    }
    case "/api/self-equipment-data": {
      if (!methodAllowed(req, res, ["GET"])) return true
      if (!requireQuery(res, params, ["line", "pathSdwt", "sdwt"])) return true
      sendJson(res, 200, createFilterPayload(scenario, {
        ...params,
        priorities: params.priority ?? [],
      }))
      return true
    }
    case "/api/my-eqp-equipment-data": {
      if (!methodAllowed(req, res, ["GET"])) return true
      if (!requireQuery(res, params, ["line"])) return true
      sendJson(res, 200, createFilterPayload(scenario, {
        ...params,
        priorities: params.priority ?? [],
      }, "my"))
      return true
    }
    case "/api/erd-scatter-data": {
      if (!methodAllowed(req, res, ["GET"])) return true
      if (!requireQuery(res, params, ["path", "eqp"])) return true
      sendJson(res, 200, createChartPayload(scenario, params, params.mode === "identity"))
      return true
    }
    default:
      return false
  }
}

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value)
const isArray = Array.isArray
const hasKeys = (value, keys) => isObject(value) && keys.every((key) => Object.hasOwn(value, key))

export const API_CONTRACTS = Object.freeze([
  { path: "/api/dashboard-data", methods: ["GET"], query: ["startDate?", "endDate?", "line[]?"], response: "dashboard" },
  { path: "/api/current-user", methods: ["GET"], response: "currentUser" },
  { path: "/api/hit-history", methods: ["POST"], body: ["lineId", "filePath", "execDate"], response: "mutation" },
  { path: "/api/clicked-category-history", methods: ["POST"], body: ["app", "lineId", "filePaths", "clickedAt"], response: "mutation" },
  { path: "/api/latest-commonality-path", methods: ["GET"], response: "latestPath" },
  { path: "/api/commonality-data", methods: ["GET"], query: ["line", "pathSdwt", "sdwt", "stepDesc?", "sensor?", "chStep?"], response: "commonality" },
  { path: "/api/commonality-image", methods: ["GET"], query: ["path"], response: "image" },
  { path: "/api/common-anomaly-data", methods: ["GET"], query: ["line", "pathSdwt", "sdwt", "prcGroup?", "eqp?", "sensor?"], response: "common" },
  { path: "/api/common-anomaly-scatter-data", methods: ["GET"], query: ["path", "eqp", "sensor", "chStep", "mode?"], response: "chart" },
  { path: "/api/common-anomaly-image", methods: ["GET"], query: ["path"], response: "image" },
  { path: "/api/pass-history", methods: ["GET", "POST", "DELETE"], response: "passHistory" },
  { path: "/api/mapping-config", methods: ["GET"], response: "mapping" },
  { path: "/api/my-eqp-reference", methods: ["GET"], response: "reference" },
  { path: "/api/my-eqp-registration", methods: ["GET", "POST", "DELETE"], response: "registration" },
  { path: "/api/mailing-registration", methods: ["GET", "POST", "DELETE"], response: "mailing" },
  { path: "/api/self-equipment-data", methods: ["GET"], query: ["line", "pathSdwt", "sdwt", "priority[]?", "desc?", "eqpCh?", "sensor?", "chStep?"], response: "filters" },
  { path: "/api/my-eqp-equipment-data", methods: ["GET"], query: ["line", "priority[]?", "desc?", "eqpCh?", "sensor?", "chStep?"], response: "filters" },
  { path: "/api/erd-scatter-data", methods: ["GET"], query: ["path", "eqp", "sensor?", "chStep?", "mode?", "days?"], response: "chart" },
  { path: "/api/erd-file", methods: ["GET"], query: ["path"], response: "image" },
])

export function validateMockResponse(contract, payload, method = "GET") {
  const failures = []
  const require = (condition, message) => {
    if (!condition) failures.push(message)
  }

  switch (contract.response) {
    case "dashboard":
      require(hasKeys(payload, ["ok", "lineDashboard"]), "dashboard root fields")
      require(hasKeys(payload?.lineDashboard, ["filters", "options", "summary", "lineSummary", "dailyTrend", "mailingSummary"]), "dashboard fields")
      require(isArray(payload?.lineDashboard?.lineSummary), "lineSummary array")
      require(isArray(payload?.lineDashboard?.dailyTrend), "dailyTrend array")
      require(isArray(payload?.lineDashboard?.mailingSummary), "mailingSummary array")
      break
    case "currentUser":
      require(hasKeys(payload, ["ok", "knoxId"]), "current user fields")
      break
    case "latestPath":
      require(hasKeys(payload, ["name", "path", "date"]), "latest path fields")
      break
    case "mapping":
      require(isObject(payload?.line_mapping), "line_mapping object")
      require(isObject(payload?.sdwt_mapping), "sdwt_mapping object")
      break
    case "commonality":
      require(hasKeys(payload, ["filters", "stepDescs", "sensors", "chSteps", "counts", "rows"]), "commonality fields")
      require(isArray(payload?.rows), "commonality rows array")
      break
    case "common":
      require(hasKeys(payload, ["filters", "prcGroups", "eqps", "sensors", "counts", "rows"]), "common fields")
      require(isArray(payload?.rows), "common rows array")
      break
    case "filters":
      require(hasKeys(payload, ["filters", "steps", "eqpChannels", "sensors", "chSteps", "counts", "rows"]), "filter payload fields")
      require(isArray(payload?.rows), "filter rows array")
      break
    case "chart":
      require(hasKeys(payload, ["eqp", "axisColumn", "sourcePath"]), "chart base fields")
      require(isArray(payload?.points) || isArray(payload?.groups), "chart points or groups")
      break
    case "passHistory":
      if (method === "GET") require(isArray(payload?.records) || isArray(payload?.rows), "pass history array")
      else require(payload?.ok === true, "pass history mutation ok")
      break
    case "reference":
      require(payload?.ok === true && isArray(payload?.rows), "reference fields")
      break
    case "registration":
      if (method === "GET") require(isArray(payload?.registrations), "registrations array")
      else require(payload?.ok === true, "registration mutation ok")
      break
    case "mailing":
      if (method === "GET") require(isArray(payload?.registrations), "mailing registrations array")
      else require(payload?.ok === true, "mailing mutation ok")
      break
    case "mutation":
      require(payload?.ok === true && Number(payload?.affectedRows) >= 1, "mutation result")
      break
    default:
      break
  }
  return failures
}

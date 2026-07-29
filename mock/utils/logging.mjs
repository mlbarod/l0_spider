export function requestLogger(logger = console) {
  return function logRequest(req, res, pathname, startedAt) {
    let logged = false
    const write = (status) => {
      if (logged) return
      logged = true
      const duration = Math.max(0, Math.round(performance.now() - startedAt))
      logger.info(`[mock-api] ${req.method ?? "GET"} ${pathname} ${status} ${duration}ms`)
    }
    res.once("finish", () => write(res.statusCode))
    res.once("close", () => write(res.writableEnded ? res.statusCode : 499))
  }
}

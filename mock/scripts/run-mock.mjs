import { spawn } from "node:child_process"

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm"
const children = new Set()
let shuttingDown = false

function start(script) {
  const child = spawn(npmCommand, ["run", script], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: "inherit",
    detached: process.platform !== "win32",
  })
  children.add(child)
  child.once("exit", (code, signal) => {
    children.delete(child)
    if (!shuttingDown) shutdown(code ?? (signal ? 1 : 0), `${script} exited`)
  })
  child.once("error", (error) => {
    console.error(`[mock] failed to start ${script}: ${error.message}`)
    shutdown(1, `${script} failed`)
  })
  return child
}

function terminate(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === "win32") child.kill("SIGTERM")
  else {
    try {
      process.kill(-child.pid, "SIGTERM")
    } catch {
      child.kill("SIGTERM")
    }
  }
}

function shutdown(code = 0, reason = "shutdown requested") {
  if (shuttingDown) return
  shuttingDown = true
  console.info(`[mock] ${reason}; stopping child processes`)
  const activeChildren = Array.from(children)
  const completions = activeChildren.map((child) => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve()
    else child.once("exit", resolve)
  }))
  for (const child of activeChildren) terminate(child)
  const forceTimer = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL")
    }
  }, 5000)
  forceTimer.unref()
  Promise.all(completions)
    .finally(() => process.exit(code))
}

start("mock:server")
start("dev:mock")

process.once("SIGINT", () => shutdown(0, "received SIGINT"))
process.once("SIGTERM", () => shutdown(0, "received SIGTERM"))

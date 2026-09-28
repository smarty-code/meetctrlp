import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const isWindows = process.platform === "win32"

export function prependPath(env, dir) {
  if (!dir || !fs.existsSync(dir)) {
    return
  }

  const current = env.PATH ?? env.Path ?? ""
  const parts = current.split(path.delimiter).filter(Boolean)
  if (parts.some((entry) => entry.toLowerCase() === dir.toLowerCase())) {
    return
  }

  const next = `${dir}${path.delimiter}${current}`
  env.PATH = next
  env.Path = next
}

export function applyDevPath(env = process.env) {
  if (!isWindows) {
    return env
  }

  const pnpmHome =
    env.PNPM_HOME ?? path.join(os.homedir(), "AppData", "Local", "pnpm")

  prependPath(env, path.join(os.homedir(), ".cargo", "bin"))
  prependPath(env, "C:\\Program Files\\dotnet")
  prependPath(env, "C:\\Program Files\\nodejs")
  prependPath(env, pnpmHome)
  prependPath(env, path.join(pnpmHome, "bin"))

  return env
}

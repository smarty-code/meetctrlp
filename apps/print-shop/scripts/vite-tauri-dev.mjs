import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const shopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const production = process.env.TAURI_ENV_PROD === "1"
const script = production ? "dev:prod" : "dev"

const child = spawn("pnpm", ["run", script], {
  cwd: shopRoot,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

import { spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { applyDevPath } from "../../../scripts/dev-path.mjs"

const shopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const isWindows = process.platform === "win32"

function which(name) {
  const ext = isWindows ? [".exe", ".cmd", ".bat", ""] : [""]
  const parts = (process.env.PATH ?? "").split(path.delimiter)
  for (const dir of parts) {
    for (const suffix of ext) {
      const candidate = path.join(dir, `${name}${suffix}`)
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }
  }
  return null
}

function addMsvcLinkDir() {
  const roots = [
    "C:\\Program Files (x86)\\Microsoft Visual Studio\\2022\\BuildTools",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community",
    "C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional",
  ]

  for (const root of roots) {
    const hostDir = path.join(root, "VC", "Tools", "MSVC")
    if (!fs.existsSync(hostDir)) {
      continue
    }

    const versions = fs.readdirSync(hostDir).sort().reverse()
    for (const version of versions) {
      const binDir = path.join(hostDir, version, "bin", "Hostx64", "x64")
      if (fs.existsSync(path.join(binDir, "link.exe"))) {
        prependPath(binDir)
        return
      }
    }
  }
}

applyDevPath(process.env)
addMsvcLinkDir()

if (!which("cargo")) {
  console.error(
    "cargo was not found. Run `pnpm desktop:setup`, then retry `pnpm desktop:dev` from a new terminal."
  )
  process.exit(1)
}

const tauriBin = path.join(
  shopRoot,
  "node_modules",
  ".bin",
  isWindows ? "tauri.cmd" : "tauri"
)

if (!fs.existsSync(tauriBin)) {
  console.error(`Tauri CLI missing at ${tauriBin}. Run pnpm install from the repo root.`)
  process.exit(1)
}

const child = spawn(tauriBin, process.argv.slice(2), {
  cwd: shopRoot,
  env: process.env,
  stdio: "inherit",
  shell: isWindows,
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})

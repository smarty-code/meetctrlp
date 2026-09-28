import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const shopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repoRoot = path.resolve(shopRoot, "../..")
const cargoBin = path.join(os.homedir(), ".cargo", "bin")
if (fs.existsSync(cargoBin)) {
  process.env.PATH = process.env.Path = `${cargoBin}${path.delimiter}${process.env.PATH ?? ""}`
}

const agentProject = path.join(
  repoRoot,
  "apps/print-agent/src/Ctrlp.PrintAgent.Host/Ctrlp.PrintAgent.Host.csproj"
)
const publishDir = path.join(shopRoot, "src-tauri/.sidecar-publish")
const binariesDir = path.join(shopRoot, "src-tauri/binaries")

function findDotnet() {
  const direct = spawnSync("dotnet", ["--version"], { encoding: "utf8", shell: true })
  if (direct.status === 0) {
    return "dotnet"
  }

  const candidates = [
    path.join(process.env.ProgramFiles ?? "C:\\Program Files", "dotnet", "dotnet.exe"),
    path.join(process.env.USERPROFILE ?? "", ".dotnet", "dotnet.exe"),
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "dotnet", "dotnet.exe"),
  ]
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    "The .NET 8 SDK is required to build the print agent. Run `pnpm desktop:setup` first."
  )
}

function targetTriple() {
  try {
    return execFileSync("rustc", ["--print", "host-tuple"], { encoding: "utf8" }).trim()
  } catch {
    const rustc = spawnSync("rustc", ["-vV"], { encoding: "utf8", shell: true })
    const match = /host: (\S+)/.exec(rustc.stdout ?? "")
    if (match) {
      return match[1]
    }
    return "x86_64-pc-windows-msvc"
  }
}

fs.mkdirSync(publishDir, { recursive: true })
fs.mkdirSync(binariesDir, { recursive: true })

const dotnet = findDotnet()
const configuration = process.env.CTRLP_AGENT_CONFIGURATION ?? "Release"
execFileSync(
  dotnet,
  [
    "publish",
    agentProject,
    "-c",
    configuration,
    "-r",
    "win-x64",
    "--self-contained",
    "true",
    "-p:PublishSingleFile=true",
    "-p:IncludeNativeLibrariesForSelfExtract=true",
    "-p:EnableCompressionInSingleFile=true",
    "-p:DebugType=none",
    "-o",
    publishDir,
  ],
  { stdio: "inherit" }
)

const published = path.join(publishDir, "ctrlp-print-agent.exe")
if (!fs.existsSync(published)) {
  throw new Error(`Expected sidecar at ${published}`)
}

const dest = path.join(binariesDir, `ctrlp-print-agent-${targetTriple()}.exe`)
fs.copyFileSync(published, dest)
console.log(`sidecar ready: ${dest}`)

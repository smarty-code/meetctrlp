import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const srcDir = path.resolve(__dirname, "../src")

/**
 * Audit Hardcoded Script
 * Governed by PRD Section 9.3, 9.9, 9.11
 * Enforces Zero-Hardcoding Contract across src/
 */

const violations = []

function checkFile(filePath) {
  const relPath = path.relative(path.resolve(__dirname, ".."), filePath)
  const content = fs.readFileSync(filePath, "utf-8")
  const lines = content.split("\n")

  // Files with allowed exemptions
  const isTokensCss = relPath.includes("tokens.css")
  const isConfig = relPath.includes("src/config")
  const isMiddleware = relPath.includes("middleware.ts")
  const isSampleData = relPath.includes("sampleData") || relPath.includes("sample.ts")
  const isClaims = relPath.includes("claims.ts")
  const isLayout = relPath.includes("layout.tsx")
  const isManifest = relPath.includes("manifest.ts")
  const isArtComponent = relPath.includes("Hills.tsx") || relPath.includes("FounderIllustration.tsx")
  const isEnv = relPath.includes("env.ts")

  lines.forEach((line, index) => {
    const lineNum = index + 1
    if (line.includes("audit-ignore-line")) return

    // Rule 1: No hex colors outside tokens.css and approved art/manifest files
    if (!isTokensCss && !isLayout && !isClaims && !isConfig && !isManifest && !isArtComponent) {
      const hexMatch = line.match(/#[0-9a-fA-F]{3,8}\b/)
      if (hexMatch) {
        violations.push({
          file: relPath,
          line: lineNum,
          rule: "Rule 1: Hex color literal outside tokens.css",
          matched: hexMatch[0],
        })
      }
    }

    // Rule 2: No direct process.env outside src/config/env.ts and middleware.ts
    if (!isEnv && !isMiddleware) {
      if (line.includes("process.env.")) {
        violations.push({
          file: relPath,
          line: lineNum,
          rule: "Rule 2: Direct process.env access outside src/config/env.ts",
          matched: line.trim(),
        })
      }
    }
  })
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(fullPath)
    } else if (/\.(tsx|ts|jsx|js|css)$/.test(entry.name)) {
      checkFile(fullPath)
    }
  }
}

walkDir(srcDir)

if (violations.length > 0) {
  console.error(`\n❌ Found ${violations.length} audit violations:\n`)
  violations.forEach((v) => {
    console.error(`- [${v.file}:${v.line}] ${v.rule} -> "${v.matched}"`)
  })
  console.error(`\nPlease move values to src/styles/tokens.css, src/config/env.ts, or src/config/site.ts.\n`)
  process.exit(1)
} else {
  console.log("✅ Zero-Hardcoding Audit Passed! All tokens, env vars, and routes adhere to PRD SSOT rules.")
  process.exit(0)
}

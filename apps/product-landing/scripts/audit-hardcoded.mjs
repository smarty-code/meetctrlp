#!/usr/bin/env node
/**
 * Hardcoded-value audit (PRD 9.3). Scans src/ and fails on:
 *  - colour literals outside src/styles/tokens.css
 *  - arbitrary Tailwind values (w-[537px], top-(--x))
 *  - http(s) URLs outside src/config
 *  - phone numbers or email addresses outside src/config
 *  - ₹ amounts outside the sampleData module
 *  - process.env access outside src/config
 * A line may opt out with an `audit-ignore-line` comment that says why.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const srcDir = join(root, "src")

const rules = [
  {
    name: "colour literal outside tokens.css",
    pattern: /#[0-9a-fA-F]{3,8}\b(?![\w-])|\b(?:rgb|rgba|hsl|hsla|oklch)\(/,
    allow: (file) => file.endsWith(`styles${sep}tokens.css`),
  },
  {
    name: "arbitrary Tailwind value",
    pattern: /(?:^|[\s"'`])!?[a-z][\w:/.-]*-(?:\[[^\]\s]+\]|\(--[\w-]+\))/,
    allow: (file) => file.endsWith(".css"),
  },
  {
    name: "URL outside src/config",
    pattern: /https?:\/\//,
    allow: (file) => file.includes(`src${sep}config${sep}`),
  },
  {
    name: "email address outside src/config",
    pattern: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,
    allow: (file) => file.includes(`src${sep}config${sep}`),
  },
  {
    name: "phone number outside src/config",
    pattern: /\+91[\s-]?\d|\b91[6-9]\d{9}\b|\b[6-9]\d{9}\b/,
    allow: (file) => file.includes(`src${sep}config${sep}`),
  },
  {
    name: "₹ amount outside sampleData",
    pattern: /₹\s?\d/,
    allow: (file) => file.endsWith("sampleData.ts"),
  },
  {
    name: "process.env outside src/config",
    pattern: /process\.env\b/,
    allow: (file) => file.includes(`src${sep}config${sep}`),
  },
]

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory()
      ? walk(path)
      : /\.(tsx?|css|mjs)$/.test(name)
        ? [path]
        : []
  })
}

const violations = []
for (const file of walk(srcDir)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/)
  lines.forEach((line, index) => {
    if (line.includes("audit-ignore-line")) return
    for (const rule of rules) {
      if (rule.allow(file)) continue
      const match = line.match(rule.pattern)
      if (match)
        violations.push(
          `${relative(root, file)}:${index + 1}  ${rule.name}  →  ${match[0].trim()}`
        )
    }
  })
}

if (violations.length > 0) {
  console.error(`audit:hardcoded found ${violations.length} violation(s):\n`)
  for (const violation of violations) console.error(`  ${violation}`)
  process.exit(1)
}
console.log("audit:hardcoded passed: no hardcoded values in src/")

#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const INCLUDED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".sql",
  ".yml",
  ".yaml",
  ".toml",
  ".css",
  ".html",
  ".txt",
]);

const IGNORE_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  ".vercel",
  ".turbo",
  "dist",
  "build",
]);

const SUSPICIOUS_PATTERNS = [
  /Ã./g, // classic UTF-8 shown as Latin-1
  /Â./g, // extra marker from wrong decode
  /â[\u0080-\u00BF]/g, // smart quotes/dashes garbled
  /ï¿½/g, // replacement char sequence in mojibake text
  /�/g, // replacement char
];

const offenders = [];
const changedOnly = process.argv.includes("--changed");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walk(fullPath);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (!INCLUDED_EXTENSIONS.has(ext)) continue;
    scanFile(fullPath);
  }
}

function getChangedFiles() {
  try {
    const working = cp
      .execSync("git diff --name-only", { cwd: ROOT })
      .toString()
      .split(/\r?\n/)
      .filter(Boolean);
    const staged = cp
      .execSync("git diff --cached --name-only", { cwd: ROOT })
      .toString()
      .split(/\r?\n/)
      .filter(Boolean);
    const localSet = new Set([...working, ...staged]);
    if (localSet.size > 0) return [...localSet];

    const baseRef = process.env.GITHUB_BASE_REF;
    if (baseRef) {
      try {
        cp.execSync(`git fetch origin ${baseRef} --depth=1`, {
          cwd: ROOT,
          stdio: "ignore",
        });
      } catch {
        // ignore fetch issues and fallback below
      }
      const mergeBase = cp
        .execSync(`git merge-base HEAD origin/${baseRef}`, { cwd: ROOT })
        .toString()
        .trim();
      const out = cp
        .execSync(`git diff --name-only ${mergeBase}..HEAD`, { cwd: ROOT })
        .toString();
      return out.split(/\r?\n/).filter(Boolean);
    }

    const out = cp
      .execSync("git diff --name-only HEAD~1..HEAD", { cwd: ROOT })
      .toString();
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function scanFile(filePath) {
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    offenders.push({
      filePath,
      message: `No se pudo leer archivo: ${error.message}`,
    });
    return;
  }

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) continue;
    for (const pattern of SUSPICIOUS_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        offenders.push({
          filePath,
          line: i + 1,
          snippet: line.slice(0, 180),
        });
        break;
      }
    }
  }
}

if (changedOnly) {
  const changedFiles = getChangedFiles();
  for (const relPath of changedFiles) {
    if (!relPath) continue;
    const fullPath = path.join(ROOT, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;
    const ext = path.extname(fullPath).toLowerCase();
    if (!INCLUDED_EXTENSIONS.has(ext)) continue;
    if (fullPath.endsWith(path.join("scripts", "check-encoding.js"))) continue;
    scanFile(fullPath);
  }
} else {
  walk(ROOT);
}

if (offenders.length > 0) {
  console.error("\n[check:encoding] Se detectaron posibles casos de mojibake:\n");
  for (const offender of offenders) {
    if (offender.line) {
      console.error(
        `- ${path.relative(ROOT, offender.filePath)}:${offender.line}\n  ${offender.snippet}`,
      );
    } else {
      console.error(`- ${path.relative(ROOT, offender.filePath)}\n  ${offender.message}`);
    }
  }
  console.error(
    "\nSugerencia: corregir esos textos y guardar siempre en UTF-8 (sin conversiones intermedias).\n",
  );
  process.exit(1);
}

console.log(
  `[check:encoding] OK - no se detecto mojibake${changedOnly ? " en archivos cambiados" : ""}.`,
);

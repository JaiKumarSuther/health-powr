import { execSync } from "node:child_process";

function getTrackedFiles() {
  const out = execSync("git ls-files", { encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}

function normalizePath(p) {
  return p.replace(/\\/g, "/").toLowerCase();
}

const files = getTrackedFiles();
const map = new Map();

for (const f of files) {
  const n = normalizePath(f);
  const arr = map.get(n) ?? [];
  arr.push(f);
  map.set(n, arr);
}

const dups = [...map.entries()].filter(([, v]) => v.length > 1);

if (dups.length > 0) {
  console.error("Duplicate normalized paths detected (case/separator collisions):");
  for (const [n, v] of dups) {
    console.error(`- ${n}`);
    for (const o of v) console.error(`  - ${o}`);
  }
  process.exit(1);
}

console.log(`OK: ${files.length} tracked files; no duplicate normalized paths.`);


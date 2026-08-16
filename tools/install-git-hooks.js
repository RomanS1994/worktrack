#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gitDir = path.join(repoRoot, ".git");
const hooksDir = path.join(repoRoot, ".githooks");

if (!existsSync(gitDir) || !existsSync(hooksDir)) {
  console.log("Skipping git hook installation.");
  process.exit(0);
}

execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdio: "inherit",
});

console.log("Configured core.hooksPath to .githooks");

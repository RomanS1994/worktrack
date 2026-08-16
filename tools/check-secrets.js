#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const mode = args.has("--staged") ? "staged" : "all";

const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const exactPlaceholderValues = new Set([
  "user",
  "username",
  "password",
  "pass",
  "host",
  "hostname",
  "database",
  "db",
]);
const placeholderFragments = [
  "change-me",
  "changeme",
  "example",
  "placeholder",
  "replace-with",
  "your-",
  "your_",
  "db_user",
  "db_password",
  "db_host",
  "db_name",
];
const localCredentialDefaults = new Set([
  "postgres:postgres",
  "root:root",
  "admin:admin",
  "user:user",
]);
const sensitiveKeyPatterns = [
  /^DATABASE_URL$/,
  /^DIRECT_DATABASE_URL$/,
  /(?:^|_)API_KEY$/,
  /(?:^|_)TOKEN$/,
  /(?:^|_)TOKEN_SECRET$/,
  /(?:^|_)SECRET$/,
  /(?:^|_)SECRET_KEY$/,
  /(?:^|_)PASSWORD$/,
  /(?:^|_)PRIVATE_KEY$/,
];
const credentialedUrlPattern =
  /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/([^:\s@/]+):([^@\s/]+)@([^\s/:?#]+)[^\s]*/gi;
const skTokenPattern = /\bsk_[A-Za-z0-9]{12,}\b/g;
const privateKeyPattern = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

function listFiles() {
  const gitArgs =
    mode === "staged"
      ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
      : ["ls-files", "--cached", "--others", "--exclude-standard", "-z"];
  return runGit(gitArgs)
    .toString("utf8")
    .split("\u0000")
    .filter(Boolean);
}

function readFileFromSource(filePath) {
  if (mode === "staged") {
    return runGit(["show", `:${filePath}`]);
  }
  return readFileSync(path.join(repoRoot, filePath));
}

function isBinary(buffer) {
  return buffer.includes(0);
}

function normalizeValue(rawValue) {
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed === '""' || trimmed === "''") {
    return "";
  }
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function isPlaceholderLike(value) {
  if (!value) {
    return true;
  }
  const lowerValue = value.toLowerCase();
  if (exactPlaceholderValues.has(lowerValue)) {
    return true;
  }
  if (/^\$\{[^}]+\}$/.test(value) || /^\$\{\{[^}]+\}\}$/.test(value)) {
    return true;
  }
  if (/^[A-Z][A-Z0-9_:-]*$/.test(value)) {
    return true;
  }
  return placeholderFragments.some((fragment) => lowerValue.includes(fragment));
}

function isAllowedCredentialedUrl(urlValue) {
  try {
    const parsed = new URL(urlValue);
    const hostname = parsed.hostname.toLowerCase();
    const username = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    if (localHosts.has(hostname)) {
      return (
        [username, password].every((part) => isPlaceholderLike(part)) ||
        localCredentialDefaults.has(`${username}:${password}`)
      );
    }
    return [username, password, hostname].every((part) => isPlaceholderLike(part));
  } catch {
    return false;
  }
}

function shouldInspectSensitiveKey(key) {
  return sensitiveKeyPatterns.some((pattern) => pattern.test(key));
}

function scanLine(filePath, lineNumber, line, findings) {
  const trimmedLine = line.trim();
  if (!trimmedLine || trimmedLine.startsWith("#")) {
    return;
  }

  if (privateKeyPattern.test(line)) {
    findings.push({
      filePath,
      lineNumber,
      reason: "private key material",
    });
  }

  for (const match of line.matchAll(skTokenPattern)) {
    findings.push({
      filePath,
      lineNumber,
      reason: `token-like secret (${match[0]})`,
    });
  }

  for (const match of line.matchAll(credentialedUrlPattern)) {
    const [urlValue] = match;
    if (isAllowedCredentialedUrl(urlValue)) {
      continue;
    }
    findings.push({
      filePath,
      lineNumber,
      reason: "credentialed service URL",
    });
  }

  const assignmentMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!assignmentMatch) {
    return;
  }

  const [, key, rawValue] = assignmentMatch;
  if (!shouldInspectSensitiveKey(key)) {
    return;
  }

  const value = normalizeValue(rawValue);
  if (!value || isPlaceholderLike(value)) {
    return;
  }
  if (value.includes("://") && isAllowedCredentialedUrl(value)) {
    return;
  }

  findings.push({
    filePath,
    lineNumber,
    reason: `non-placeholder value assigned to ${key}`,
  });
}

function scanFile(filePath) {
  const buffer = readFileFromSource(filePath);
  if (isBinary(buffer)) {
    return [];
  }

  const findings = [];
  const lines = buffer.toString("utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    scanLine(filePath, index + 1, line, findings);
  });

  return findings;
}

const findings = listFiles()
  .flatMap((filePath) => scanFile(filePath))
  .filter(
    (finding, index, allFindings) =>
      allFindings.findIndex(
        (candidate) =>
          candidate.filePath === finding.filePath &&
          candidate.lineNumber === finding.lineNumber &&
          candidate.reason === finding.reason,
      ) === index,
  );

if (findings.length > 0) {
  const label = mode === "staged" ? "staged files" : "tracked files";
  console.error(`Potential secrets detected in ${label}:`);
  findings.forEach((finding) => {
    console.error(`- ${finding.filePath}:${finding.lineNumber} ${finding.reason}`);
  });
  process.exit(1);
}

const successLabel = mode === "staged" ? "staged files" : "tracked files";
console.log(`No secrets detected in ${successLabel}.`);

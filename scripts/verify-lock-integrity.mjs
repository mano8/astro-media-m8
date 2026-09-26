#!/usr/bin/env node
// Lock integrity guard — `B34-npm-lock-integrity-guard`, finding `G34`(b).
//
// `npm ci` verifies a package's bytes only against the `integrity` its lock
// entry records, and fetches it from the `resolved` URL that entry names. An
// entry with neither is installed from whatever the registry serves on the day,
// unverified, and npm reports nothing: `fa-ui-m8`'s lock carried 909 such
// entries for weeks (`G33`), through three regenerations that never noticed.
// This script makes that state a red build. It exits non-zero, naming every
// offending key, when:
//
//   * `lockfileVersion` is below 3;
//   * a `packages` entry lacks `integrity` or `resolved`;
//   * an `integrity` is not `sha512-`;
//   * a `resolved` is not under https://registry.npmjs.org/;
//   * an entry is a `link`, a `file:` source, or any key outside
//     `node_modules/` — a workspace-relative path that no clean checkout has.
//
// The root entry (`""`) describes this package itself and is exempt.
//
// Dependency-free, so it runs before `npm ci` (CI, and the UI image build).
// Byte-identical in astro-auth-m8, astro-media-m8, astro-prompt-m8,
// astro-reparto-m8, astro-ui-m8 and fa-ui-m8 (`app/scripts/`): change all six
// together.
//
// Usage: node scripts/verify-lock-integrity.mjs [path/to/package-lock.json]
// (default: the `package-lock.json` beside this script's `scripts/` folder).

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MIN_LOCKFILE_VERSION = 3;
export const REGISTRY = "https://registry.npmjs.org/";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Why one `packages` entry is not pinned to the registry, or `[]` if it is.
 *
 * @param {string} key
 * @param {unknown} entry
 * @returns {string[]}
 */
function entryReasons(key, entry) {
  if (!key.startsWith("node_modules/")) {
    return ["is a local folder, not a registry package"];
  }
  if (!isObject(entry)) {
    return ["is not an object"];
  }
  if (entry.link === true) {
    return [`is a link to ${JSON.stringify(entry.resolved)}`];
  }
  const reasons = [];
  const { resolved, integrity } = entry;
  if (typeof resolved !== "string" || resolved === "") {
    reasons.push("has no resolved");
  } else if (resolved.startsWith("file:")) {
    reasons.push(`is a file: source (${resolved})`);
  } else if (!resolved.startsWith(REGISTRY)) {
    reasons.push(`resolves outside ${REGISTRY} (${resolved})`);
  }
  if (typeof integrity !== "string" || integrity.trim() === "") {
    reasons.push("has no integrity");
  } else {
    const weak = integrity.trim().split(/\s+/).filter((hash) => !hash.startsWith("sha512-"));
    if (weak.length > 0) {
      reasons.push(`has a non-sha512 integrity (${weak.map((hash) => hash.split("-")[0]).join(", ")})`);
    }
  }
  return reasons;
}

/**
 * Every problem in a parsed `package-lock.json`, in lock order.
 *
 * @param {unknown} lock
 * @returns {{ key: string, reasons: string[] }[]}
 */
export function findLockProblems(lock) {
  if (!isObject(lock)) {
    return [{ key: "(lock)", reasons: ["is not a JSON object"] }];
  }
  const problems = [];
  const version = lock.lockfileVersion;
  if (typeof version !== "number" || version < MIN_LOCKFILE_VERSION) {
    problems.push({
      key: "lockfileVersion",
      reasons: [`is ${JSON.stringify(version)}, expected ${MIN_LOCKFILE_VERSION} or above`],
    });
  }
  if (!isObject(lock.packages)) {
    problems.push({ key: "packages", reasons: ["is missing"] });
    return problems;
  }
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (key === "") continue;
    const reasons = entryReasons(key, entry);
    if (reasons.length > 0) problems.push({ key, reasons });
  }
  return problems;
}

/**
 * CLI entry: reads the lock, prints a verdict, returns the exit code.
 *
 * @param {string} lockPath
 * @returns {number}
 */
export function main(lockPath) {
  let lock;
  try {
    lock = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch (error) {
    console.error(`lock-integrity: cannot read ${lockPath}: ${error.message}`);
    return 1;
  }
  const problems = findLockProblems(lock);
  const entries = Object.keys(isObject(lock?.packages) ? lock.packages : {}).filter((key) => key !== "").length;
  if (problems.length > 0) {
    console.error(`lock-integrity: ${lockPath}: ${problems.length} problem(s) across ${entries} entries`);
    for (const { key, reasons } of problems) {
      console.error(`  ${key} ${reasons.join("; ")}`);
    }
    console.error(
      "Every entry must carry a sha512 integrity and resolve under " +
        `${REGISTRY}. Restore the missing fields from the registry's record of each ` +
        "exact version; do not delete the lock and re-resolve.",
    );
    return 1;
  }
  console.log(`lock-integrity: ${lockPath}: ${entries} entries, each sha512-pinned to ${REGISTRY}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv[2] ?? fileURLToPath(new URL("../package-lock.json", import.meta.url)));
}

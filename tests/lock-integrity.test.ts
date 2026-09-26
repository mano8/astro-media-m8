// @vitest-environment node
//
// Lock integrity guard — `B34-npm-lock-integrity-guard`, finding `G34`(b).
//
// Each fixture lock below breaks exactly one rule of
// `scripts/verify-lock-integrity.mjs` and must be refused with its key named;
// the clean fixture must pass. The last group runs the guard against this
// repository's real `package-lock.json`: that is the assertion that went red
// on a lock whose entries had lost their `integrity` and `resolved` (`G33`,
// `G34`(a)), and it keeps any regeneration from dropping them again.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { findLockProblems } from "../scripts/verify-lock-integrity.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/verify-lock-integrity.mjs", import.meta.url));
const REAL_LOCK = fileURLToPath(new URL("../package-lock.json", import.meta.url));

const SHA512 = "sha512-Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cQ==";

const tarball = (name: string, version: string) =>
  `https://registry.npmjs.org/${name}/-/${name.split("/").pop()}-${version}.tgz`;

function cleanLock() {
  return {
    name: "fixture",
    version: "1.0.0",
    lockfileVersion: 3,
    requires: true,
    packages: {
      "": { name: "fixture", version: "1.0.0", dependencies: { "left-pad": "^1.3.0" } },
      "node_modules/left-pad": {
        version: "1.3.0",
        resolved: tarball("left-pad", "1.3.0"),
        integrity: SHA512,
      },
      "node_modules/@scope/pkg": {
        version: "2.0.0",
        resolved: tarball("@scope/pkg", "2.0.0"),
        integrity: SHA512,
        dev: true,
      },
      "node_modules/@scope/pkg/node_modules/left-pad": {
        version: "1.2.0",
        resolved: tarball("left-pad", "1.2.0"),
        integrity: SHA512,
        dev: true,
      },
    },
  };
}

type Lock = ReturnType<typeof cleanLock>;
type Entry = Record<string, unknown>;

function withEntry(key: string, patch: (entry: Entry) => Entry): Lock {
  const lock = cleanLock();
  const packages = lock.packages as Record<string, Entry>;
  packages[key] = patch({ ...(packages[key] ?? {}) });
  return lock;
}

function without(field: string) {
  return (entry: Entry) => {
    const copy = { ...entry };
    delete copy[field];
    return copy;
  };
}

const scratch = mkdtempSync(join(tmpdir(), "lock-integrity-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function runGuard(lock: unknown, name: string) {
  const path = join(scratch, `${name}.json`);
  writeFileSync(path, typeof lock === "string" ? lock : JSON.stringify(lock));
  return spawnSync(process.execPath, [SCRIPT, path], { encoding: "utf8" });
}

describe("findLockProblems — fixture locks", () => {
  it("passes a clean lock, exempting the root entry", () => {
    expect(findLockProblems(cleanLock())).toEqual([]);
  });

  it("refuses an entry with no integrity", () => {
    const lock = withEntry("node_modules/left-pad", without("integrity"));
    expect(findLockProblems(lock)).toEqual([{ key: "node_modules/left-pad", reasons: ["has no integrity"] }]);
  });

  it("refuses an entry with no resolved", () => {
    const lock = withEntry("node_modules/@scope/pkg", without("resolved"));
    expect(findLockProblems(lock)).toEqual([{ key: "node_modules/@scope/pkg", reasons: ["has no resolved"] }]);
  });

  it("names both reasons for an entry stripped of both fields, as G33's were", () => {
    const lock = withEntry("node_modules/left-pad", (entry) => without("resolved")(without("integrity")(entry)));
    expect(findLockProblems(lock)).toEqual([
      { key: "node_modules/left-pad", reasons: ["has no resolved", "has no integrity"] },
    ]);
  });

  it("refuses a nested entry, not only a top-level one", () => {
    const lock = withEntry("node_modules/@scope/pkg/node_modules/left-pad", without("integrity"));
    expect(findLockProblems(lock).map(({ key }) => key)).toEqual(["node_modules/@scope/pkg/node_modules/left-pad"]);
  });

  it("refuses a foreign host", () => {
    const lock = withEntry("node_modules/left-pad", (entry) => ({
      ...entry,
      resolved: "https://registry.example.com/left-pad/-/left-pad-1.3.0.tgz",
    }));
    const [problem] = findLockProblems(lock);
    expect(problem.key).toBe("node_modules/left-pad");
    expect(problem.reasons).toEqual([
      "resolves outside https://registry.npmjs.org/ (https://registry.example.com/left-pad/-/left-pad-1.3.0.tgz)",
    ]);
  });

  it("refuses a registry look-alike that only shares the prefix", () => {
    const lock = withEntry("node_modules/left-pad", (entry) => ({
      ...entry,
      resolved: "https://registry.npmjs.org.example.com/left-pad-1.3.0.tgz",
    }));
    expect(findLockProblems(lock)).toHaveLength(1);
  });

  it("refuses a sha1 hash", () => {
    const lock = withEntry("node_modules/left-pad", (entry) => ({
      ...entry,
      integrity: "sha1-2oqfDeLXYVtOMCALhq8Lm4dHbyA=",
    }));
    expect(findLockProblems(lock)).toEqual([
      { key: "node_modules/left-pad", reasons: ["has a non-sha512 integrity (sha1)"] },
    ]);
  });

  it("refuses a sha1 hash listed beside a sha512 one", () => {
    const lock = withEntry("node_modules/left-pad", (entry) => ({
      ...entry,
      integrity: `${SHA512} sha1-2oqfDeLXYVtOMCALhq8Lm4dHbyA=`,
    }));
    expect(findLockProblems(lock)).toEqual([
      { key: "node_modules/left-pad", reasons: ["has a non-sha512 integrity (sha1)"] },
    ]);
  });

  it("refuses a link, the shape da40e03 removed", () => {
    const lock = withEntry("node_modules/@scope/pkg", () => ({ resolved: "../astro-auth-m8", link: true }));
    expect(findLockProblems(lock)).toEqual([
      { key: "node_modules/@scope/pkg", reasons: ['is a link to "../astro-auth-m8"'] },
    ]);
  });

  it("refuses a file: source", () => {
    const lock = withEntry("node_modules/left-pad", (entry) => ({
      ...entry,
      resolved: "file:../left-pad-1.3.0.tgz",
    }));
    expect(findLockProblems(lock)).toEqual([
      { key: "node_modules/left-pad", reasons: ["is a file: source (file:../left-pad-1.3.0.tgz)"] },
    ]);
  });

  it("refuses a key outside node_modules/, a link's workspace-relative target", () => {
    const lock = withEntry("../astro-auth-m8", () => ({ name: "@mano8/astro-auth-m8", version: "2.7.0" }));
    expect(findLockProblems(lock)).toEqual([
      { key: "../astro-auth-m8", reasons: ["is a local folder, not a registry package"] },
    ]);
  });

  it("refuses an entry that is not an object", () => {
    const lock = withEntry("node_modules/left-pad", () => null as unknown as Entry);
    expect(findLockProblems(lock)).toEqual([{ key: "node_modules/left-pad", reasons: ["is not an object"] }]);
  });

  it("refuses lockfileVersion 2", () => {
    const lock = { ...cleanLock(), lockfileVersion: 2 };
    expect(findLockProblems(lock)).toEqual([
      { key: "lockfileVersion", reasons: ["is 2, expected 3 or above"] },
    ]);
  });

  it("refuses a lock with no lockfileVersion or packages", () => {
    expect(findLockProblems({ name: "fixture" })).toEqual([
      { key: "lockfileVersion", reasons: ["is undefined, expected 3 or above"] },
      { key: "packages", reasons: ["is missing"] },
    ]);
  });

  it("refuses something that is not a lock at all", () => {
    expect(findLockProblems([])).toEqual([{ key: "(lock)", reasons: ["is not a JSON object"] }]);
  });
});

describe("verify-lock-integrity CLI", () => {
  it("exits 0 on a clean fixture", () => {
    const run = runGuard(cleanLock(), "clean");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("3 entries, each sha512-pinned to https://registry.npmjs.org/");
  });

  it("exits 1 and names every offending key", () => {
    const lock = withEntry("node_modules/left-pad", without("integrity"));
    (lock.packages as Record<string, Entry>)["node_modules/@scope/pkg"].resolved = "https://evil.example/pkg.tgz";
    const run = runGuard(lock, "two-bad");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("2 problem(s) across 3 entries");
    expect(run.stderr).toContain("node_modules/left-pad has no integrity");
    expect(run.stderr).toContain("node_modules/@scope/pkg resolves outside");
  });

  it("exits 1 on a file that is not JSON", () => {
    const run = runGuard("{ not json", "broken");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("cannot read");
  });

  it("reads the package-lock.json beside scripts/ when given no path", () => {
    const run = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    expect(run.stdout + run.stderr).toContain(REAL_LOCK);
  });
});

describe("this repository's package-lock.json", () => {
  it("pins every entry to the npm registry by sha512 hash", () => {
    const lock: unknown = JSON.parse(readFileSync(REAL_LOCK, "utf8"));
    expect(findLockProblems(lock)).toEqual([]);
  });
});

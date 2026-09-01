/**
 * Registry drift gate (`C12`).
 *
 * Regenerates the shadcn registry and fails when the working tree moves, so a
 * generated `registry/r/**` can never disagree with the sources it is built
 * from. `git status --porcelain` rather than `git diff` on purpose: a brand new
 * generated item is untracked, and a diff would not see it.
 *
 * The tracked-path check comes first and is not a formality. A watched path
 * that git ignores produces an empty `git status`, so the gate would report
 * green while checking nothing at all — which is exactly the shape of failure
 * this step exists to remove.
 */
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const WATCHED = ["registry.json", "registry/r"];

function git(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", shell: false });
  if (result.error) throw result.error;
  return result;
}

function assertWatchedPathsAreTracked() {
  for (const path of WATCHED) {
    const tracked = git(["ls-files", "--", path]);
    if (tracked.status !== 0) {
      console.error(`[verify-registry-drift] git ls-files failed for ${path}:`);
      console.error(tracked.stderr.trim());
      process.exit(tracked.status ?? 1);
    }
    if (tracked.stdout.trim() === "") {
      console.error(
        `[verify-registry-drift] ${path} is not tracked by git, so this gate would pass without checking anything.`,
      );
      console.error(
        "  The generated registry is published through `files` and its item names are a frozen consumer contract; commit it rather than ignoring it.",
      );
      process.exit(1);
    }
  }
}

assertWatchedPathsAreTracked();

const build = spawnSync(process.execPath, [join(ROOT, "scripts", "build-registry.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
  shell: false,
});
if (build.status !== 0) {
  console.error("[verify-registry-drift] the registry build failed");
  process.exit(build.status ?? 1);
}

const status = git(["status", "--porcelain", "--", ...WATCHED]);
if (status.status !== 0) {
  console.error("[verify-registry-drift] git status failed:");
  console.error(status.stderr.trim());
  process.exit(status.status ?? 1);
}

const drifted = status.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
if (drifted.length > 0) {
  console.error(
    "[verify-registry-drift] the generated registry is out of date; run `npm run build:registry` and commit:",
  );
  for (const entry of drifted) console.error(`  ${entry}`);
  const diff = git(["--no-pager", "diff", "--", ...WATCHED]);
  if (diff.stdout.trim()) console.error(diff.stdout);
  process.exit(1);
}

console.log(`[verify-registry-drift] ${WATCHED.join(", ")} match their sources`);

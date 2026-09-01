/**
 * Registry skin typecheck (`C12`).
 *
 * `tsconfig.json` scopes `include` to `src/**` and `bin/**`, so `npm run
 * typecheck` never reads `registry/blocks/**`, and ESLint was scoped the same
 * way until `C12`. The published skins were therefore read by no gate at all.
 *
 * This installs the skins the way a consumer receives them: the inline content
 * of each generated `registry/r/*.json` is written to its declared `target`
 * inside a fixture that owns the `@/*` alias, stub shadcn primitives, and stub
 * types for the packages a consumer brings. The shared `@mano8/astro-ui-m8`
 * blocks the skins import are installed from the *installed* dependency, which
 * is what a consumer would copy in as `components/m8-ui/*`.
 *
 * Requires `npm run build` first: the fixture resolves this package's public
 * subpaths against `dist/`, so the check runs against the published surface
 * rather than against `src/`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = join(ROOT, "fixtures", "registry-consumer");
const REGISTRY_DIR = join(ROOT, "registry", "r");
const SHARED_UI_REGISTRY = join(ROOT, "node_modules", "@mano8", "astro-ui-m8", "registry", "r");
const DIST_ENTRY = join(ROOT, "dist", "src", "integration.d.ts");
const WORK_DIR = join(ROOT, ".tmp", "registry-consumer");

function assertExists(path, label) {
  if (!existsSync(path)) {
    throw new Error(`[verify-registry-consumer] ${label} does not exist: ${path}`);
  }
}

/** Copy every inline registry file to its `target`, as a shadcn install does. */
function installRegistryItems(registryDir, label) {
  const installed = new Set();
  for (const entry of readdirSync(registryDir)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;
    const item = JSON.parse(readFileSync(join(registryDir, entry), "utf8"));
    for (const file of item.files ?? []) {
      if (!file.target || typeof file.content !== "string") {
        throw new Error(`[verify-registry-consumer] ${label}/${entry} has a file without inline content or target`);
      }
      const targetPath = join(WORK_DIR, ...file.target.split("/"));
      mkdirSync(dirname(targetPath), { recursive: true });
      writeFileSync(targetPath, file.content);
      installed.add(file.target);
    }
  }
  if (installed.size === 0) {
    throw new Error(`[verify-registry-consumer] ${label} installed no files into the fixture`);
  }
  return installed.size;
}

function runTsc() {
  const tsc = join(ROOT, "node_modules", "typescript", "bin", "tsc");
  assertExists(tsc, "TypeScript compiler");
  const result = spawnSync(process.execPath, [tsc, "-p", "tsconfig.json", "--noEmit"], {
    cwd: WORK_DIR,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`[verify-registry-consumer] the installed skins failed to compile (exit ${result.status})`);
  }
}

/**
 * Every `@/components/m8-ui/*` a skin imports must have been installed by the
 * shared-UI pass above.
 *
 * Checked before `tsc` so a shared block that the *installed* `astro-ui-m8` does
 * not carry reports as a version problem rather than as a wall of TS2307s. That
 * happens when this package's declared range outruns what is published.
 */
function assertSharedBlocksResolve() {
  const uiPackage = join(ROOT, "node_modules", "@mano8", "astro-ui-m8", "package.json");
  const installed = existsSync(uiPackage)
    ? JSON.parse(readFileSync(uiPackage, "utf8")).version
    : "not installed";
  const declared = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"))
    .dependencies?.["@mano8/astro-ui-m8"];

  const missing = new Map();
  for (const entry of readdirSync(REGISTRY_DIR)) {
    if (!entry.endsWith(".json") || entry === "registry.json") continue;
    const item = JSON.parse(readFileSync(join(REGISTRY_DIR, entry), "utf8"));
    for (const file of item.files ?? []) {
      for (const match of file.content.matchAll(/from\s+"@\/components\/m8-ui\/([^"]+)"/g)) {
        const block = join(WORK_DIR, "components", "m8-ui", `${match[1]}.tsx`);
        if (!existsSync(block)) missing.set(match[1], entry);
      }
    }
  }

  if (missing.size > 0) {
    const lines = [...missing].map(([block, item]) => `  ${block} (imported by ${item})`);
    throw new Error(
      `[verify-registry-consumer] the installed @mano8/astro-ui-m8 ${installed} does not ` +
        `provide ${missing.size} shared block(s) the skins import:\n${lines.join("\n")}\n` +
        `  package.json declares ${declared}. Publish the shared-UI version that carries ` +
        `these blocks, or drop the skins that import them.`,
    );
  }
}

function main() {
  assertExists(FIXTURE_DIR, "registry consumer fixture");
  assertExists(REGISTRY_DIR, "generated registry");
  assertExists(SHARED_UI_REGISTRY, "installed @mano8/astro-ui-m8 registry");
  assertExists(DIST_ENTRY, "compiled package types; run `npm run build` first");

  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });
  cpSync(FIXTURE_DIR, WORK_DIR, { recursive: true });

  const shared = installRegistryItems(SHARED_UI_REGISTRY, "@mano8/astro-ui-m8");
  const own = installRegistryItems(REGISTRY_DIR, "registry/r");
  assertSharedBlocksResolve();
  runTsc();

  console.log(
    `[verify-registry-consumer] compiled ${own} installed skin file(s) against ${shared} shared block file(s)`,
  );
}

main();

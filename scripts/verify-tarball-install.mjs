// Standalone install-from-tarball smoke (`C12`).
//
// Packs this repository, installs the tarball into a throwaway directory that
// has no workspace checkout above it, then type-checks *and runs* a headless
// consumer against the installed package. `STANDALONE-CHILD-USABILITY` is the
// invariant under test: what a consumer gets from npm has to work on its own.
//
// Deliberately headless — no React, no Astro, no running service — so the check
// stays fast and has one failure mode: the package as published. The Astro
// integration surface is covered separately by `verify:starter-routes`.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_DIR = join(ROOT, "fixtures", "tarball-consumer");
const TMP_DIR = join(ROOT, ".tmp", "tarball-install");
const PACK_DIR = join(TMP_DIR, "pack");
const WORK_DIR = join(TMP_DIR, "workspace");
const NPM_CACHE_DIR = join(ROOT, ".tmp", "npm-cache");

// Spawned through node rather than an `npm`/`npm.cmd` shim so the script runs
// the same way on Windows and CI Linux, with no shell interpolation.
// The two platforms disagree on where npm sits relative to the node binary:
// Windows keeps it beside the executable, POSIX puts it under a sibling `lib`.
// Probe both rather than assuming, so neither platform is the odd one out.
const NPM_CLI = resolveNpmCli();

/** Every subpath `package.json` publishes must resolve from the install. */
const EXPECTED_EXPORT_SUBPATHS = [
  ".",
  "./api",
  "./client",
  "./schemas",
  "./auth-adapter",
  "./upload",
  "./hooks",
  "./react",
  "./default-ui",
  "./list-params",
  "./routes",
  "./middleware",
  "./internal-server",
  "./compatibility"
];

/** Files a consumer relies on that are easy to drop from `files` by accident. */
const EXPECTED_PACKAGE_FILES = [
  "LICENSE",
  "README.md",
  "registry.json",
  "dist/src/integration.js",
  "dist/src/runtime/client.js",
  "dist/src/runtime/compatibility.js",
  "dist/src/runtime/upload/uploadController.js",
  "dist/src/runtime/api/internal.server.js",
  "dist/src/runtime/react/index.js",
  "src/routes/upload.astro",
  "src/routes/library.astro",
  "src/routes/presets.astro",
  "src/routes/admin/media.astro",
  "src/scaffold/styles/media.css"
];

const EXPECTED_REGISTRY_ITEMS = [
  "registry.json",
  "admin-media-dashboard.json",
  "media-category-tree.json",
  "media-dashboard-overview.json",
  "media-library-tree.json",
  "media-maintenance-panel.json",
  "media-storage-chart.json"
];

function resolveNpmCli() {
  const nodeDir = dirname(process.execPath);
  const candidates = [
    // Windows: node.exe and node_modules/ share a directory.
    join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    // POSIX, including the CI runner's hosted toolcache: bin/node with the
    // package tree one level up under lib/.
    join(nodeDir, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js")
  ];

  const found = candidates.find((candidate) => existsSync(candidate));
  if (found === undefined) {
    throw new Error(`npm cli not found next to ${process.execPath}; tried:\n${candidates.join("\n")}`);
  }

  return found;
}

function assert(condition, message) {
  if (!condition) throw new Error(`[verify-tarball-install] ${message}`);
}

function assertExists(path, label) {
  assert(existsSync(path), `${label} does not exist: ${path}`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
    env: { ...process.env, npm_config_cache: NPM_CACHE_DIR }
  });

  if (result.status !== 0) {
    const stdout = result.stdout?.trim();
    const stderr = result.stderr?.trim();
    throw new Error(
      [
        `${command} ${args.join(" ")} failed in ${cwd} (exit ${result.status})`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : ""
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  return result;
}

function npm(args, cwd) {
  return run(process.execPath, [NPM_CLI, ...args], cwd);
}

function packTarball() {
  mkdirSync(PACK_DIR, { recursive: true });
  npm(["pack", "--pack-destination", PACK_DIR], ROOT);

  const tarballs = readdirSync(PACK_DIR).filter((entry) => entry.endsWith(".tgz"));
  assert(tarballs.length === 1, `expected one tarball in ${PACK_DIR}, found ${tarballs.length}`);
  return join(PACK_DIR, tarballs[0]);
}

function installTarball(tarballPath) {
  cpSync(FIXTURE_DIR, WORK_DIR, { recursive: true });
  // `--legacy-peer-deps` keeps the smoke to the headless graph: the optional
  // React/Astro peers are the consumer's to bring, and auto-installing them
  // would turn a package check into a several-minute dependency download.
  // `zod` is the one runtime peer the headless surface actually imports.
  npm(
    [
      "install",
      "--ignore-scripts",
      "--no-package-lock",
      "--legacy-peer-deps",
      tarballPath,
      "zod@^4.0.0"
    ],
    WORK_DIR
  );
}

function verifyPackageContents(installedRoot) {
  for (const relativePath of EXPECTED_PACKAGE_FILES) {
    assertExists(join(installedRoot, ...relativePath.split("/")), `packaged file ${relativePath}`);
  }

  const registryItems = new Set(readdirSync(join(installedRoot, "registry", "r")));
  for (const item of EXPECTED_REGISTRY_ITEMS) {
    assert(registryItems.has(item), `missing generated registry item in the install: ${item}`);
  }

  // The registry ships generated output only — never the sources it is built
  // from, which would double the tarball and invite a consumer to edit the
  // wrong copy.
  assert(
    !existsSync(join(installedRoot, "registry", "blocks")),
    "registry/blocks was published; only registry/r belongs in the tarball"
  );
}

function verifyExports(installedRoot) {
  const fixtureRequire = createRequire(join(WORK_DIR, "package.json"));
  const packageJson = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));

  for (const subpath of EXPECTED_EXPORT_SUBPATHS) {
    assert(packageJson.exports?.[subpath] !== undefined, `package.json dropped the ${subpath} export`);
    const specifier = subpath === "." ? "@mano8/astro-media-m8" : `@mano8/astro-media-m8/${subpath.slice(2)}`;
    const resolved = fixtureRequire.resolve(specifier);
    assertExists(resolved, `resolved entry for ${specifier}`);
    assert(
      resolved.startsWith(installedRoot + sep),
      `${specifier} resolved outside the installed package: ${resolved}`
    );
  }

  // The published contract metadata is what a host reads to pin its service.
  assert(
    packageJson.mediaServiceM8?.contract === "media-service-m8@1.1",
    `unexpected published contract: ${packageJson.mediaServiceM8?.contract}`
  );
}

function verifyConsumerTypechecks() {
  const tsc = join(ROOT, "node_modules", "typescript", "bin", "tsc");
  assertExists(tsc, "TypeScript compiler");
  run(process.execPath, [tsc, "-p", "tsconfig.json"], WORK_DIR);
}

function verifyConsumerRuns() {
  const tsc = join(ROOT, "node_modules", "typescript", "bin", "tsc");
  // Emit beside the source so NodeNext resolution sees the same package tree,
  // then actually execute it: a consumer that compiles but throws on import is
  // not a consumer that works.
  run(
    process.execPath,
    [tsc, "consumer.ts", "--target", "ES2022", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--skipLibCheck"],
    WORK_DIR
  );
  const compiled = join(WORK_DIR, "consumer.js");
  assertExists(compiled, "compiled consumer entry");
  run(process.execPath, [compiled], WORK_DIR);
}

function main() {
  assertExists(FIXTURE_DIR, "tarball consumer fixture");

  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(WORK_DIR, { recursive: true });

  const tarballPath = packTarball();
  installTarball(tarballPath);

  const installedRoot = join(WORK_DIR, "node_modules", "@mano8", "astro-media-m8");
  assertExists(installedRoot, "installed tarball package root");

  verifyPackageContents(installedRoot);
  verifyExports(installedRoot);
  verifyConsumerTypechecks();
  verifyConsumerRuns();

  console.log(
    `[verify-tarball-install] packed, installed and ran ${tarballPath} standalone — exports, files and headless runtime all resolved`
  );
}

main();

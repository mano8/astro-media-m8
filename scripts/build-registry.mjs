// Zero-dependency registry builder for @fa-m8/astro-media-m8.
//
// Mirrors the output of `shadcn build`: reads registry.json, inlines the
// `content` of each item file, and writes one `<output>/<name>.json` per item
// (plus a `registry.json` index) using the shadcn registry-item schema.
//
// We intentionally do NOT depend on the `shadcn` CLI here so the published
// plugin's build + CI stay dependency-free and audit-clean (the CLI is a heavy
// dev-only generator). The emitted JSON is the shadcn registry-item format, so
// consumers still install items with `npx shadcn add @fa-m8-media/<name>`.
//
// Output fidelity is verified against the real `shadcn build` in the fa-ui-m8
// consumer (which already ships the CLI) — see the plugin's shadcn-views docs.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY_PATH = join(ROOT, "registry.json");
const OUTPUT_DIR = join(ROOT, "registry", "r");

const ITEM_SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";

/** Build a single registry item, inlining the content of each declared file. */
function buildItem(item) {
  const files = (item.files ?? []).map((file) => {
    const content = readFileSync(join(ROOT, file.path), "utf8");
    // shadcn ships file content inline; `add` rewrites aliases on insertion, so
    // we keep the source verbatim (including the `@/` + package imports).
    const out = { path: file.path, content, type: file.type };
    if (file.target !== undefined) out.target = file.target;
    return out;
  });

  const built = {
    $schema: ITEM_SCHEMA,
    name: item.name,
    type: item.type,
    ...(item.title ? { title: item.title } : {}),
    ...(item.description ? { description: item.description } : {}),
    ...(item.author ? { author: item.author } : {}),
    ...(item.dependencies ? { dependencies: item.dependencies } : {}),
    ...(item.devDependencies ? { devDependencies: item.devDependencies } : {}),
    ...(item.registryDependencies
      ? { registryDependencies: item.registryDependencies }
      : {}),
    ...(item.cssVars ? { cssVars: item.cssVars } : {}),
    ...(item.css ? { css: item.css } : {}),
    ...(item.meta ? { meta: item.meta } : {}),
    files,
  };
  return built;
}

function main() {
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  // Clean only the generated JSON, then recreate the output dir.
  rmSync(OUTPUT_DIR, { recursive: true, force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const names = [];
  for (const item of registry.items ?? []) {
    const built = buildItem(item);
    writeFileSync(
      join(OUTPUT_DIR, `${item.name}.json`),
      `${JSON.stringify(built, null, 2)}\n`,
    );
    names.push(item.name);
  }

  // A small index so the registry is browsable as a single file too.
  const index = {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: registry.name,
    ...(registry.homepage ? { homepage: registry.homepage } : {}),
    items: (registry.items ?? []).map((item) => ({
      name: item.name,
      type: item.type,
      ...(item.title ? { title: item.title } : {}),
      ...(item.description ? { description: item.description } : {}),
    })),
  };
  writeFileSync(
    join(OUTPUT_DIR, "registry.json"),
    `${JSON.stringify(index, null, 2)}\n`,
  );

  const written = readdirSync(OUTPUT_DIR).length;
  console.log(
    `[build-registry] wrote ${names.length} item(s) (${written} files) to registry/r: ${names.join(", ")}`,
  );
}

main();

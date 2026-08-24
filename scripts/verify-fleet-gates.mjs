/**
 * Fleet alignment gates (`C12`).
 *
 * The M8 astro plugin fleet shares a handful of structural rules that were
 * enforced by review rather than by a gate: one canonical data table, no
 * cross-plugin runtime imports, a closed import surface for the registry skins,
 * a server/client split that browser bundles cannot cross, token-only scaffold
 * CSS, and a route map with no self-collision.
 *
 * Static and dependency-free on purpose. The repository has to stay verifiable
 * with no parent workspace checkout, so this file describes only this package.
 *
 * Gates:
 *   no-cross-plugin-import   no other business plugin is imported at runtime
 *   skin-import-surface      registry skins import from the declared surface
 *   no-duplicate-data-table  skins consume the canonical table, never fork it
 *   ssr-client-boundary      server-only modules never reach a client module
 *   token-only-css           scaffold styles resolve colour through tokens
 *   no-inline-style          skins and default UI style through classes
 *   route-collision          no two starter routes claim the same pattern
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

const CONFIG = {
  /** This package. Its own public subpaths are always importable. */
  packageName: "@mano8/astro-media-m8",
  /** Where installed skins land in a consumer app, as `@/components/<dir>`. */
  skinComponentDir: "fa-media",
  /** Trees scanned for imports. */
  sourceDirs: ["src", "registry/blocks"],
  /** Client-side trees that must not reach a server-only module. */
  clientDirs: ["src/runtime/react", "src/runtime/hooks", "registry/blocks"],
  /** Compiled route builder, read after `npm run build`. */
  routesModule: "dist/src/runtime/routes.js",
  routesBuilder: "buildMediaRoutes",
};

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".astro"];
const BUSINESS_PLUGIN = /^@mano8[/]astro-(auth|media|prompt|reparto)-m8(?:[/]|$)/;
const SHARED_UI = /^@mano8[/]astro-ui-m8(?:[/]|$)/;
/** Written as separate anchored patterns rather than one nested alternation. */
const SERVER_SPECIFIERS = [
  /[.]server$/,
  /[.]server[.]js$/,
  /[.]server[.]jsx$/,
  /[.]server[.]ts$/,
  /[.]server[.]tsx$/,
  /[/]internal-server$/,
];
const SERVER_FILES = [/[.]server[.]ts$/, /[.]server[.]tsx$/, /[.]server[.]js$/, /[.]server[.]jsx$/];
const matchesAny = (patterns, value) => patterns.some((pattern) => pattern.test(value));
const BROWSER_GLOBAL = /\b(?:window|document|localStorage|sessionStorage|navigator)\b/;
const BROWSER_GUARD = /typeof\s+window\s*!==\s*["']undefined["']/;
/** Window of characters after the guard in which the refusal must throw. */
const REFUSAL_WINDOW = 200;
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/;
const INLINE_STYLE = /\bstyle\s*=\s*(?:\{|")/;
const TABLE_IMPLEMENTATION = /\buseReactTable\b|<table[\s>]/;

/** Alias prefixes a registry skin is allowed to import from. */
const ALLOWED_ALIASES = [
  "@/components/ui/",
  "@/components/m8-ui/",
  `@/components/${CONFIG.skinComponentDir}/`,
  "@/lib/utils",
];

/** Strip comments without disturbing string or template content. */
function stripComments(source) {
  const BACKSLASH = String.fromCharCode(92);
  let out = "";
  let quote = null;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (quote) {
      out += char;
      if (char === BACKSLASH) {
        out += next ?? "";
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      out += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      i += 2;
      // Newlines are kept so every reported line number still points at the
      // line the reader will open.
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") out += "\n";
        i += 1;
      }
      i += 1;
      continue;
    }
    out += char;
  }
  return out;
}

/** Module specifiers this file actually loads, comments excluded. */
function importSpecifiers(source) {
  const code = stripComments(source);
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s+["']([^"']+)["']/g,
  ];
  const found = new Set();
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

function walk(dir, accept) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const child = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      files.push(...walk(child, accept));
    } else if (accept(entry.name)) {
      files.push(child);
    }
  }
  return files;
}

const isSource = (name) => SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension));
const sourceFiles = CONFIG.sourceDirs.flatMap((dir) => walk(dir, isSource));
const skinFiles = sourceFiles.filter((file) => file.startsWith("registry/blocks/"));
const clientFiles = sourceFiles.filter((file) =>
  CONFIG.clientDirs.some((dir) => file.startsWith(`${dir}/`)),
);
const cssFiles = walk("src", (name) => name.endsWith(".css"));
const read = (file) => readFileSync(join(ROOT, file), "utf8");
const sources = new Map(sourceFiles.map((file) => [file, read(file)]));

const failures = [];
const fail = (gate, where, detail) => failures.push({ gate, where, detail });

function gateNoCrossPluginImport() {
  for (const [file, source] of sources) {
    for (const specifier of importSpecifiers(source)) {
      if (!BUSINESS_PLUGIN.test(specifier)) continue;
      if (specifier === CONFIG.packageName || specifier.startsWith(`${CONFIG.packageName}/`)) continue;
      fail("no-cross-plugin-import", file, `imports another business plugin: ${specifier}`);
    }
  }
}

function gateSkinImportSurface() {
  for (const file of skinFiles) {
    for (const specifier of importSpecifiers(sources.get(file))) {
      if (specifier.startsWith("@/")) {
        if (!ALLOWED_ALIASES.some((prefix) => specifier === prefix || specifier.startsWith(prefix))) {
          fail("skin-import-surface", file, `alias outside the skin surface: ${specifier}`);
        }
        continue;
      }
      if (specifier.startsWith(".")) {
        if (specifier.includes("src/") || specifier.includes("dist/")) {
          fail("skin-import-surface", file, `reaches into package internals: ${specifier}`);
        }
        continue;
      }
      if (specifier === CONFIG.packageName || SHARED_UI.test(specifier)) continue;
      if (specifier.startsWith(`${CONFIG.packageName}/`)) {
        const subpath = specifier.slice(CONFIG.packageName.length + 1);
        if (subpath.startsWith("src/") || subpath.startsWith("dist/")) {
          fail(
            "skin-import-surface",
            file,
            `imports a private path rather than a published subpath: ${specifier}`,
          );
        }
        continue;
      }
      if (BUSINESS_PLUGIN.test(specifier)) continue; // reported by no-cross-plugin-import
      if (specifier.includes("fa-ui-m8")) {
        fail("skin-import-surface", file, `imports host internals: ${specifier}`);
      }
    }
  }
}

function gateNoDuplicateDataTable() {
  for (const file of skinFiles) {
    if (!TABLE_IMPLEMENTATION.test(stripComments(sources.get(file)))) continue;
    fail(
      "no-duplicate-data-table",
      file,
      "builds its own table; skins consume @/components/m8-ui/data-table",
    );
  }
}

function gateSsrClientBoundary() {
  for (const file of clientFiles) {
    for (const specifier of importSpecifiers(sources.get(file))) {
      if (matchesAny(SERVER_SPECIFIERS, specifier)) {
        fail("ssr-client-boundary", file, `a client module imports the server-only ${specifier}`);
      }
    }
  }
  for (const [file, source] of sources) {
    if (!matchesAny(SERVER_FILES, file)) continue;
    const code = stripComments(source);
    const guard = code.search(BROWSER_GUARD);
    if (guard === -1 || !code.slice(guard, guard + REFUSAL_WINDOW).includes("throw")) {
      fail(
        "ssr-client-boundary",
        file,
        "a server-only module must refuse a browser bundle with a `typeof window` guard that throws",
      );
    }
    // The refusal guard is the one sanctioned mention, so `typeof <global>`
    // is removed before looking for a module that actually *uses* the browser.
    code
      .replace(/\btypeof\s+(?:window|document|localStorage|sessionStorage|navigator)\b/g, "")
      .split("\n")
      .forEach((line, index) => {
        if (BROWSER_GLOBAL.test(line)) {
          fail(
            "ssr-client-boundary",
            `${file}:${index + 1}`,
            "a server-only module uses a browser global",
          );
        }
      });
  }
}

function gateTokenOnlyCss() {
  for (const file of cssFiles) {
    read(file)
      .split("\n")
      .forEach((line, index) => {
        if (COLOUR_LITERAL.test(line)) {
          fail(
            "token-only-css",
            `${file}:${index + 1}`,
            "colour literal; scaffold styles resolve colour through tokens",
          );
        }
      });
  }
  // The headless default UI styles itself without Tailwind (mode B), so it may
  // carry `CSSProperties` constants — but a colour belongs in the token bridge
  // wherever it is written, so the literal check follows it there.
  for (const file of sourceFiles) {
    if (!file.startsWith("src/runtime/react/") && !file.startsWith("registry/blocks/")) continue;
    stripComments(sources.get(file))
      .split("\n")
      .forEach((line, index) => {
        if (COLOUR_LITERAL.test(line)) {
          fail(
            "token-only-css",
            `${file}:${index + 1}`,
            "colour literal; resolve colour through a token, not a hard-coded value",
          );
        }
      });
  }
}

function gateNoInlineStyle() {
  // Scoped to the shadcn skins, the same way `no-duplicate-data-table` is: a
  // skin styles through classes because that is the contract a consumer copies
  // it into. `src/runtime/react/**` is the framework-neutral headless layer,
  // which has no Tailwind to reach for — its colours are covered by
  // `token-only-css` above rather than by banning the attribute outright.
  for (const file of skinFiles) {
    sources
      .get(file)
      .split("\n")
      .forEach((line, index) => {
        if (INLINE_STYLE.test(line)) {
          fail("no-inline-style", `${file}:${index + 1}`, "inline style attribute");
        }
      });
  }
}

async function gateRouteCollision() {
  const modulePath = join(ROOT, ...CONFIG.routesModule.split("/"));
  let builder;
  try {
    const module = await import(pathToFileURL(modulePath).href);
    builder = module[CONFIG.routesBuilder];
  } catch {
    fail(
      "route-collision",
      CONFIG.routesModule,
      "the compiled route builder is missing; run `npm run build` before this gate",
    );
    return;
  }
  if (typeof builder !== "function") {
    fail("route-collision", CONFIG.routesModule, `${CONFIG.routesBuilder} is not exported`);
    return;
  }

  // Defaults, and the same map re-based, because `base` is the option a host
  // reaches for first and a fragment that ignores it collides silently.
  for (const [label, routes] of [
    ["defaults", builder()],
    ["base=/app", builder({ base: "/app" })],
  ]) {
    const seen = new Map();
    for (const [name, pattern] of Object.entries(routes)) {
      if (typeof pattern !== "string") continue;
      if (seen.has(pattern)) {
        fail("route-collision", `${label}:${pattern}`, `claimed by both ${seen.get(pattern)} and ${name}`);
      }
      seen.set(pattern, name);
    }
    if (seen.size === 0) fail("route-collision", label, "the route builder produced no routes");
  }
}

gateNoCrossPluginImport();
gateSkinImportSurface();
gateNoDuplicateDataTable();
gateSsrClientBoundary();
gateTokenOnlyCss();
gateNoInlineStyle();
await gateRouteCollision();

const scanned = `${sourceFiles.length} source file(s), ${skinFiles.length} skin(s), ${cssFiles.length} stylesheet(s)`;
if (failures.length > 0) {
  console.error(`[verify-fleet-gates] ${failures.length} violation(s) across ${scanned}:`);
  for (const { gate, where, detail } of failures) {
    console.error(`  ${gate}: ${where} — ${detail}`);
  }
  process.exitCode = 1;
} else {
  console.log(`[verify-fleet-gates] 7 gate(s) green over ${scanned}`);
}

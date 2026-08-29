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
 *   no-cross-plugin-import   no other business plugin is imported at runtime,
 *                            except the auth peer's framework-neutral
 *                            authorization primitives (decision 4)
 *   authorization-purity     that exemption stays pure: no React, no runtime
 *                            effects, anywhere in its import closure
 *   skin-import-surface      registry skins import from the declared surface
 *   no-duplicate-data-table  skins consume the canonical table, never fork it
 *   ssr-client-boundary      server-only modules never reach a client module
 *   token-only-css           scaffold styles resolve colour through tokens
 *   no-inline-style          skins and default UI style through classes
 *   route-collision          no two starter routes claim the same pattern
 *   island-error-boundary    every island a route mounts sits under a boundary
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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
  /** Starter routes, scanned for the components they mount as islands. */
  routesDir: "src/routes",
  /** Trees searched for those components' definitions. */
  componentDirs: ["src/runtime/react"],
  /** The boundary every island root must resolve to (`A-C3`). */
  errorBoundary: "MediaErrorBoundary",
};

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".astro"];
const BUSINESS_PLUGIN = /^@mano8[/]astro-(auth|media|prompt|reparto)-m8(?:[/]|$)/;
const SHARED_UI = /^@mano8[/]astro-ui-m8(?:[/]|$)/;
/**
 * The one cross-plugin specifier this gate permits (decision 4, 2026-08-29).
 *
 * `@mano8/astro-auth-m8/authorization` is a pure, framework-neutral module: the
 * TypeScript mirror of `auth_sdk_m8/authorization.py`, exporting the role
 * hierarchy and the role/flag truth table and nothing else - no component, no
 * hook, no store, no Astro binding. `RBAC-06` asks for exactly one role
 * hierarchy in the fleet, and until this widening the two rules could not both
 * be satisfied: a plugin could only re-implement the hierarchy and pin the copy
 * with a test.
 *
 * The exemption is one exact specifier, not a package prefix. Every other
 * subpath of `@mano8/astro-auth-m8` stays refused, so no plugin reaches its
 * runtime, its React surface or its integration through this door, and the
 * plugins stay independently installable in every other respect. A plugin that
 * uses it already declares the auth peer in `peerDependencies`, so the import
 * adds no install the consumer did not already owe.
 */
const AUTHORIZATION_PRIMITIVES = "@mano8/astro-auth-m8/authorization";
/** The package that specifier belongs to, and the subpath within it. */
const AUTHORIZATION_PACKAGE = "@mano8/astro-auth-m8";
const AUTHORIZATION_SUBPATH = "./authorization";
/**
 * Bare specifiers the authorization closure may reach.
 *
 * The exemption above is only worth having while the module it names stays
 * what it claims to be. `zod` is a pure schema library and the hierarchy is
 * sourced from a schema; anything else — `react` and `react-dom` first among
 * them — turns a shared predicate into a shared runtime, which is the coupling
 * `no-cross-plugin-import` exists to prevent.
 */
const AUTHORIZATION_PURE_DEPENDENCIES = new Set(["zod"]);
/**
 * Runtime effects a pure authorization module must not reach for.
 *
 * A predicate answers from its arguments. A module that touches the DOM, the
 * network, storage or the process is doing something a second plugin cannot
 * safely share, whatever its exports look like.
 */
const AUTHORIZATION_GLOBALS = [
  "document",
  "window",
  "localStorage",
  "sessionStorage",
  "globalThis",
  "XMLHttpRequest",
  "fetch",
  "process",
];
/**
 * Matches a *read of the global*, not a property that happens to share its
 * name: `window.location` is an effect, `{ window: RetentionWindowSchema }` and
 * `client.fetch(...)` are not.
 */
const globalRead = (name) => new RegExp(String.raw`(?<![.\w$])${name}(?![\w$]|\s*:)`);
const AUTHORIZATION_EFFECTS = AUTHORIZATION_GLOBALS.map((name) => [name, globalRead(name)]);
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
      if (specifier === AUTHORIZATION_PRIMITIVES) continue;
      if (specifier === CONFIG.packageName || specifier.startsWith(`${CONFIG.packageName}/`)) continue;
      fail("no-cross-plugin-import", file, `imports another business plugin: ${specifier}`);
    }
  }
}

/**
 * The authorization exemption stays an exemption for a *pure* module.
 *
 * `no-cross-plugin-import` lets one specifier through. This gate is the reason
 * that is safe: it resolves the module the auth peer actually publishes for
 * `./authorization`, walks its relative import closure, and fails if anything
 * in it reaches a bare dependency outside the pure set or touches a runtime
 * effect. The exemption is one exact subpath, never `@mano8/astro-auth-m8/*`,
 * so nothing else in the peer is reachable through it.
 *
 * It runs only in a package that actually imports the module — the other
 * plugins carry the same code and skip it — and it fails closed: if the peer is
 * not installed, an importer cannot be verified and that is a failure, not a
 * pass.
 */
function gateAuthorizationPurity() {
  const importers = [...sources]
    .filter(([, source]) => importSpecifiers(source).includes(AUTHORIZATION_PRIMITIVES))
    .map(([file]) => file);
  if (importers.length === 0) return;

  // In the package that *owns* the module the import is not cross-plugin at
  // all, and the promise is this repository's own to keep: verify what it
  // publishes, from its own build, rather than a copy under `node_modules`.
  const owned = CONFIG.packageName === AUTHORIZATION_PACKAGE;
  const packageRoot = owned ? ROOT : join(ROOT, "node_modules", ...AUTHORIZATION_PACKAGE.split("/"));
  const show = (file) =>
    `${owned ? "" : `${AUTHORIZATION_PACKAGE}:`}${file.slice(packageRoot.length + 1).split("\\").join("/")}`;

  let entry;
  try {
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
    entry = manifest.exports?.[AUTHORIZATION_SUBPATH];
  } catch {
    entry = undefined;
  }
  if (typeof entry !== "string") {
    fail(
      "authorization-purity",
      importers[0],
      owned
        ? `this package no longer publishes ${AUTHORIZATION_SUBPATH}, which the fleet gate exempts by name`
        : `cannot verify ${AUTHORIZATION_PRIMITIVES}: ${AUTHORIZATION_PACKAGE} is not installed, or no longer publishes ${AUTHORIZATION_SUBPATH}`,
    );
    return;
  }

  const seen = new Set();
  const queue = [resolve(packageRoot, entry)];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);

    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      fail("authorization-purity", show(file), "reachable from the authorization module but unreadable");
      continue;
    }

    const code = stripComments(source);
    for (const [name, effect] of AUTHORIZATION_EFFECTS) {
      if (effect.test(code)) {
        fail("authorization-purity", show(file), `the authorization closure reaches the runtime global ${name}`);
      }
    }

    for (const specifier of importSpecifiers(source)) {
      if (specifier.startsWith(".")) {
        queue.push(resolve(dirname(file), specifier));
        continue;
      }
      const scoped = specifier.startsWith("@");
      const bare = specifier.split("/").slice(0, scoped ? 2 : 1).join("/");
      if (AUTHORIZATION_PURE_DEPENDENCIES.has(bare)) continue;
      fail(
        "authorization-purity",
        show(file),
        `the authorization closure depends on ${specifier}; only ${[...AUTHORIZATION_PURE_DEPENDENCIES].join(", ")} is pure enough to share`,
      );
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
      // Refused ones are reported by no-cross-plugin-import; the authorization
      // primitives are permitted there, and so permitted in a skin too.
      if (BUSINESS_PLUGIN.test(specifier)) continue;
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

/**
 * `A-C3`: a render throw inside an island unmounts the whole island, so every
 * component a starter route mounts with a `client:*` directive has to sit under
 * the error boundary.
 *
 * Checked structurally rather than by grepping for the boundary's name
 * somewhere in the file: the island's own outermost element is followed through
 * the local components it renders — typically `View -> Shell -> boundary` —
 * until the boundary is reached or the chain ends. A view that quietly stops
 * going through the shared shell therefore fails here rather than silently
 * losing its boundary.
 */
function gateIslandErrorBoundary() {
  const islandNames = new Set();
  for (const file of walk(CONFIG.routesDir, (name) => name.endsWith(".astro"))) {
    const code = stripComments(readFileSync(join(ROOT, file), "utf8"));
    // Tag name first, then the attribute text up to the tag's `>` examined
    // separately. One regex spanning both wants a `[^>]*` between two `\b`
    // anchors, which is the backtracking shape `security/detect-unsafe-regex`
    // objects to — rightly, on input this gate does not control.
    for (const match of code.matchAll(/<([A-Z][A-Za-z0-9_]*)/g)) {
      const end = code.indexOf(">", match.index);
      const attributes = code.slice(match.index + match[0].length, end === -1 ? undefined : end);
      if (/\bclient:[a-z]+/.test(attributes)) islandNames.add(match[1]);
    }
  }

  if (islandNames.size === 0) {
    fail("island-error-boundary", CONFIG.routesDir, "no island mount was found to check");
    return;
  }

  // name -> the tag its render returns first, i.e. what wraps everything else.
  const FRAGMENT = "#fragment";
  const outermost = new Map();
  const definedIn = new Map();
  const componentFiles = CONFIG.componentDirs.flatMap((dir) =>
    walk(dir, (name) => name.endsWith(".tsx")),
  );
  for (const file of componentFiles) {
    const code = stripComments(readFileSync(join(ROOT, file), "utf8"));
    // `function Name` matches the exported and local forms alike; an optional
    // `export\s+` prefix in front of `function\s+` only adds the ambiguous
    // adjacent-quantifier shape the security rule flags.
    for (const match of code.matchAll(/function\s+([A-Z][A-Za-z0-9_]*)/g)) {
      const name = match[1];
      if (outermost.has(name)) continue;
      const body = code.slice(match.index);
      // Either a named element or a fragment. A fragment is recorded as such
      // rather than skipped: an island root that opens with `<>` has no
      // outermost component to follow, and reporting it as "not defined" —
      // which is what skipping it produced — sends the reader to the wrong
      // problem entirely.
      const returned = body.match(/\breturn\s*\(?\s*<\s*([A-Za-z][A-Za-z0-9_.]*|>)/);
      if (returned) {
        outermost.set(name, returned[1] === ">" ? FRAGMENT : returned[1]);
        definedIn.set(name, file);
      }
    }
  }

  const reaches = (name, seen = new Set()) => {
    if (name === CONFIG.errorBoundary) return true;
    if (seen.has(name)) return false;
    seen.add(name);
    const next = outermost.get(name);
    return next === undefined ? false : reaches(next, seen);
  };

  for (const island of [...islandNames].sort()) {
    if (!outermost.has(island)) {
      fail(
        "island-error-boundary",
        island,
        `mounted by a starter route but not defined under ${CONFIG.componentDirs.join(", ")}`,
      );
      continue;
    }
    if (outermost.get(island) === FRAGMENT) {
      fail(
        "island-error-boundary",
        `${definedIn.get(island)}:${island}`,
        `renders a fragment at its root; an island root must render ${CONFIG.errorBoundary} as its outermost element`,
      );
      continue;
    }
    if (!reaches(island)) {
      fail(
        "island-error-boundary",
        `${definedIn.get(island)}:${island}`,
        `an island root must render through ${CONFIG.errorBoundary}; a render throw otherwise blanks the island`,
      );
    }
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
gateAuthorizationPurity();
gateSkinImportSurface();
gateNoDuplicateDataTable();
gateSsrClientBoundary();
gateTokenOnlyCss();
gateNoInlineStyle();
gateIslandErrorBoundary();
await gateRouteCollision();

const scanned = `${sourceFiles.length} source file(s), ${skinFiles.length} skin(s), ${cssFiles.length} stylesheet(s)`;
if (failures.length > 0) {
  console.error(`[verify-fleet-gates] ${failures.length} violation(s) across ${scanned}:`);
  for (const { gate, where, detail } of failures) {
    console.error(`  ${gate}: ${where} — ${detail}`);
  }
  process.exitCode = 1;
} else {
  console.log(`[verify-fleet-gates] 9 gate(s) green over ${scanned}`);
}

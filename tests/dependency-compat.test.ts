// @vitest-environment node
//
// Dependency compatibility gate: `scripts/verify-dependency-compat.mjs`.
//
// Each fixture below is a trimmed `npm ls --all --json --long` tree shaped
// after a case the fleet actually hit: a fleet peer range the host outgrew
// (`lucide-react` against `@mano8/astro-ui-m8`), a Dependabot bump outside a
// plugin's peer range (`@astrojs/react` 7), a required peer npm stopped
// installing under `legacy-peer-deps` (`@types/react-dom`), a third-party
// optional peer hoisted out of range (`ajv-formats`), and a platform binary's
// peer that is legitimately absent (`@emnapi/core`). The last group runs the
// gate against this repository's real installed tree.

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { edgeOf, findCompatProblems, parseWaivers } from "../scripts/verify-dependency-compat.mjs";

const SCRIPT = fileURLToPath(new URL("../scripts/verify-dependency-compat.mjs", import.meta.url));
const ROOT = "/fixture";

type Node = Record<string, unknown> & { dependencies?: Record<string, Node> };

const at = (location: string) => `${ROOT}/${location}`;

function installed(location: string, version: string, fields: Record<string, unknown> = {}): Node {
  const name = location.split("node_modules/").pop() as string;
  return { name, version, path: at(location), _dependencies: {}, ...fields };
}

function cleanTree(): Node {
  return {
    name: "fixture-host",
    version: "1.0.0",
    path: ROOT,
    _dependencies: { "@mano8/astro-ui-m8": "^1.5.2", "lucide-react": "^1.28.0" },
    devDependencies: { "@types/react-dom": "^19.0.0" },
    problems: [],
    dependencies: {
      "@mano8/astro-ui-m8": installed("node_modules/@mano8/astro-ui-m8", "1.5.3", {
        peerDependencies: { "lucide-react": "^1.28.0" },
        peerDependenciesMeta: { "lucide-react": { optional: true } },
        dependencies: { "lucide-react": installed("node_modules/lucide-react", "1.45.0") },
      }),
      "lucide-react": installed("node_modules/lucide-react", "1.45.0"),
      "@types/react-dom": installed("node_modules/@types/react-dom", "19.3.0"),
    },
  };
}

function withChild(tree: Node, parent: string | null, name: string, child: Node): Node {
  const host = parent === null ? tree : (tree.dependencies as Record<string, Node>)[parent];
  host.dependencies = { ...(host.dependencies ?? {}), [name]: child };
  return tree;
}

function invalid(location: string, version: string, marker: string): Node {
  return { ...installed(location, version), invalid: marker };
}

const scratch = mkdtempSync(join(tmpdir(), "dependency-compat-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function runGate(tree: unknown, name: string, waivers?: unknown) {
  const treePath = join(scratch, `${name}.tree.json`);
  const waiversPath = join(scratch, `${name}.waivers.json`);
  writeFileSync(treePath, typeof tree === "string" ? tree : JSON.stringify(tree));
  if (waivers !== undefined) writeFileSync(waiversPath, JSON.stringify(waivers));
  return spawnSync(process.execPath, [SCRIPT, "--tree", treePath, "--waivers", waiversPath], { encoding: "utf8" });
}

describe("edgeOf: npm's own edge precedence", () => {
  it("reads a required peer and an optional one", () => {
    const node = {
      peerDependencies: { a: "^1", b: "^2" },
      peerDependenciesMeta: { b: { optional: true } },
    };
    expect(edgeOf(node, "a", false)).toEqual({ type: "peer", spec: "^1" });
    expect(edgeOf(node, "b", false)).toEqual({ type: "peerOptional", spec: "^2" });
  });

  it("lets optional replace prod, and dev replace both at the root only", () => {
    const node = { _dependencies: { a: "^1" }, optionalDependencies: { a: "^1" }, devDependencies: { a: "^1" } };
    expect(edgeOf(node, "a", false)).toEqual({ type: "optional", spec: "^1" });
    expect(edgeOf(node, "a", true)).toEqual({ type: "dev", spec: "^1" });
  });

  it("names an undeclared edge unknown", () => {
    expect(edgeOf({}, "a", true)).toEqual({ type: "unknown", spec: undefined });
  });
});

describe("findCompatProblems: fixture trees", () => {
  it("passes a tree whose every range is satisfied", () => {
    expect(findCompatProblems(cleanTree())).toEqual({ packages: 3, problems: [], waived: [], skipped: [] });
  });

  it("refuses a package outside a fleet package's optional peer range (lucide-react)", () => {
    const tree = cleanTree();
    const ui = (tree.dependencies as Record<string, Node>)["@mano8/astro-ui-m8"];
    ui.peerDependencies = { "lucide-react": "1.28.0" };
    ui.dependencies = {
      "lucide-react": invalid("node_modules/lucide-react", "1.45.0", '"1.28.0" from node_modules/@mano8/astro-ui-m8'),
    };
    expect(findCompatProblems(tree).problems).toEqual([
      'lucide-react@1.45.0 is outside "1.28.0", the peerOptional range of @mano8/astro-ui-m8 (node_modules/@mano8/astro-ui-m8)',
    ]);
  });

  it("refuses a Dependabot bump outside a plugin's required peer range (@astrojs/react 7)", () => {
    const tree = withChild(
      cleanTree(),
      null,
      "@mano8/astro-auth-m8",
      installed("node_modules/@mano8/astro-auth-m8", "2.7.1", {
        peerDependencies: { "@astrojs/react": "^6.0.1" },
        dependencies: {
          "@astrojs/react": invalid("node_modules/@astrojs/react", "7.0.0", '"^6.0.1" from node_modules/@mano8/astro-auth-m8'),
        },
      }),
    );
    expect(findCompatProblems(tree).problems).toEqual([
      '@astrojs/react@7.0.0 is outside "^6.0.1", the peer range of @mano8/astro-auth-m8 (node_modules/@mano8/astro-auth-m8)',
    ]);
  });

  it("refuses the root's own dev dependency when it is out of range", () => {
    const tree = cleanTree();
    tree.dependencies!["@types/react-dom"] = invalid(
      "node_modules/@types/react-dom",
      "18.3.0",
      '"^19.0.0" from the root project',
    );
    expect(findCompatProblems(tree).problems).toEqual([
      '@types/react-dom@18.3.0 is outside "^19.0.0", the dev range of the root project',
    ]);
  });

  it("reports an out-of-range package once, however many times the tree shows it", () => {
    const marker = '"^7.3.0" from node_modules/astro';
    const tree = withChild(
      cleanTree(),
      null,
      "astro",
      installed("node_modules/astro", "7.3.4", {
        peerDependencies: { "@astrojs/markdown-remark": "^7.3.0" },
        peerDependenciesMeta: { "@astrojs/markdown-remark": { optional: true } },
        dependencies: { "@astrojs/markdown-remark": invalid("node_modules/@astrojs/markdown-remark", "7.2.2", marker) },
      }),
    );
    withChild(tree, null, "@astrojs/markdown-remark", invalid("node_modules/@astrojs/markdown-remark", "7.2.2", marker));
    expect(findCompatProblems(tree).problems).toHaveLength(1);
  });

  it("refuses a required peer that npm did not install (@types/react-dom)", () => {
    const tree = withChild(
      cleanTree(),
      null,
      "@astrojs/react",
      installed("node_modules/@astrojs/react", "7.0.0", {
        peerDependencies: { "@types/react": "^19.0.0" },
        dependencies: { "@types/react": { missing: true, problems: ["missing: @types/react@^19.0.0"] } },
      }),
    );
    expect(findCompatProblems(tree).problems).toEqual([
      '@types/react is missing: @astrojs/react (node_modules/@astrojs/react) requires "^19.0.0" (peer)',
    ]);
  });

  it("skips a missing peer of a package installed only as an optional platform binary", () => {
    const tree = withChild(
      cleanTree(),
      null,
      "@napi-rs/wasm-runtime",
      installed("node_modules/@napi-rs/wasm-runtime", "1.2.0", {
        optional: true,
        peerDependencies: { "@emnapi/core": "^2.0.0" },
        dependencies: { "@emnapi/core": { missing: true } },
      }),
    );
    const result = findCompatProblems(tree);
    expect(result.problems).toEqual([]);
    expect(result.skipped).toHaveLength(1);
  });

  it("ignores an absent optional peer or optional dependency", () => {
    const tree = withChild(
      cleanTree(),
      null,
      "astro",
      installed("node_modules/astro", "7.3.4", {
        optionalDependencies: { sharp: "^0.35.0" },
        peerDependencies: { "@astrojs/markdown-remark": "^7.3.0" },
        peerDependenciesMeta: { "@astrojs/markdown-remark": { optional: true } },
        dependencies: { sharp: { missing: true }, "@astrojs/markdown-remark": { missing: true } },
      }),
    );
    expect(findCompatProblems(tree)).toMatchObject({ problems: [], skipped: [] });
  });

  it("skips a missing peer of a platform binary npm 10 leaves extraneous", () => {
    const tree = withChild(
      cleanTree(),
      null,
      "@napi-rs/wasm-runtime",
      installed("node_modules/@napi-rs/wasm-runtime", "1.2.4", {
        extraneous: true,
        peerDependencies: { "@emnapi/core": "^1.7.1" },
        dependencies: { "@emnapi/core": { missing: true } },
      }),
    );
    tree.problems = ["extraneous: @napi-rs/wasm-runtime@1.2.4 /fixture/node_modules/@napi-rs/wasm-runtime"];
    const result = findCompatProblems(tree);
    expect(result.problems).toEqual([]);
    expect(result.skipped).toEqual([
      '@emnapi/core is missing: @napi-rs/wasm-runtime (node_modules/@napi-rs/wasm-runtime) requires "^1.7.1" (peer)',
      "extraneous: @napi-rs/wasm-runtime@1.2.4 /fixture/node_modules/@napi-rs/wasm-runtime (reached by no edge)",
    ]);
  });

  it("refuses an npm ls problem of a kind it does not know", () => {
    const tree = { ...cleanTree(), problems: ["unexpected: left-pad@1.3.0 /fixture/node_modules/left-pad"] };
    expect(findCompatProblems(tree).problems).toEqual([
      "npm ls: unexpected: left-pad@1.3.0 /fixture/node_modules/left-pad",
    ]);
  });

  it("refuses output that is not a --long tree", () => {
    expect(findCompatProblems({ name: "x" }).problems).toEqual(["the npm ls output is not a --long JSON tree"]);
  });
});

describe("findCompatProblems: waivers", () => {
  function hoistedOptionalPeer(): Node {
    return withChild(
      cleanTree(),
      null,
      "@hookform/resolvers",
      installed("node_modules/@hookform/resolvers", "5.5.7", {
        peerDependencies: { "ajv-formats": "^2.1.1", "react-hook-form": "^7.55.0" },
        peerDependenciesMeta: { "ajv-formats": { optional: true } },
        dependencies: {
          "ajv-formats": invalid("node_modules/ajv-formats", "3.0.1", '"^2.1.1" from node_modules/@hookform/resolvers'),
        },
      }),
    );
  }
  const ajvWaiver = {
    waivers: [{ requirer: "@hookform/resolvers", dependency: "ajv-formats", reason: "the ajv resolver is unused" }],
  };

  it("excuses a third-party optional peer with a written reason, and says so", () => {
    const result = findCompatProblems(hoistedOptionalPeer(), ajvWaiver);
    expect(result.problems).toEqual([]);
    expect(result.waived).toEqual([
      'ajv-formats@3.0.1 is outside "^2.1.1", the peerOptional range of @hookform/resolvers ' +
        "(node_modules/@hookform/resolvers) (waived: the ajv resolver is unused)",
    ]);
  });

  it("refuses the same edge without the waiver", () => {
    expect(findCompatProblems(hoistedOptionalPeer()).problems).toHaveLength(1);
  });

  it("cannot excuse a required peer", () => {
    const tree = hoistedOptionalPeer();
    const resolvers = tree.dependencies!["@hookform/resolvers"];
    resolvers.peerDependenciesMeta = {};
    const [problem] = findCompatProblems(tree, ajvWaiver).problems;
    expect(problem).toContain("(a waiver cannot excuse a peer edge)");
  });

  it("refuses a waiver that names a fleet package", () => {
    const waivers = { waivers: [{ requirer: "@mano8/astro-ui-m8", dependency: "lucide-react", reason: "later" }] };
    expect(parseWaivers(waivers).errors).toEqual([
      "waiver #0 names @mano8/astro-ui-m8: a fleet package's range is fixed, not waived",
    ]);
  });

  it("refuses a waiver that matches nothing any more", () => {
    expect(findCompatProblems(cleanTree(), ajvWaiver).problems).toEqual([
      "waiver for @hookform/resolvers -> ajv-formats matches nothing any more; remove it",
    ]);
  });

  it("refuses a malformed waivers file", () => {
    expect(parseWaivers([]).errors).toEqual(['waivers file must be an object with a "waivers" array']);
    expect(parseWaivers({ waivers: [{ requirer: "x", dependency: "" }] }).errors).toEqual([
      "waiver #0 needs a non-empty dependency, reason",
    ]);
  });
});

describe("verify-dependency-compat CLI", () => {
  it("exits 0 on a clean tree", () => {
    const run = runGate(cleanTree(), "clean");
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("3 installed packages, every declared range satisfied");
  });

  it("exits 1 and names the offending edge", () => {
    const tree = cleanTree();
    tree.dependencies!["@types/react-dom"] = invalid("node_modules/@types/react-dom", "18.3.0", '"^19.0.0" from the root project');
    const run = runGate(tree, "invalid");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("1 problem(s) across 3 installed packages");
    expect(run.stderr).toContain("@types/react-dom@18.3.0 is outside");
  });

  it("exits 1 on a tree file that is not JSON", () => {
    const run = runGate("{ not json", "broken");
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("dependency-compat:");
  });
});

describe("this repository's installed tree", () => {
  it("satisfies every range declared on it", () => {
    const run = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  }, 120_000);
});

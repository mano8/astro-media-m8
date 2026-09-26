// npm publish workflow lock — `B30-pre-publish-hardening` leg 5 (`G25`).
//
// The workflow used to run `npm publish` on any `workflow_dispatch`, from any
// branch, into an `npm` environment with no protection, and nothing checked
// that a release tag named the version it published. These assertions keep
// the fix in place: npm is reached only from a published release whose tag
// is `package.json`'s version, a dispatch only rehearses with `--dry-run`, the
// environment links this package, and the tarball ships its changelog.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(
  new URL("../.github/workflows/npm-publish.yml", import.meta.url),
  "utf-8",
).replace(/\r\n/g, "\n");
const PACKAGE = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
) as { name: string; files?: string[] };

const STEPS = WORKFLOW.split(/\n(?= {6}- )/).filter((block) => block.startsWith("      - "));

function runsNpmPublish(step: string, dryRun: boolean): boolean {
  return step
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .some((line) => /\bnpm publish\b/.test(line) && line.includes("--dry-run") === dryRun);
}

describe("npm publish workflow", () => {
  it("publishes to npm only from a published release", () => {
    const publishes = STEPS.filter((step) => runsNpmPublish(step, false));
    expect(publishes).toHaveLength(1);
    expect(publishes[0]).toContain("if: github.event_name == 'release'");
  });

  it("only rehearses the publish on any other event", () => {
    const rehearsals = STEPS.filter((step) => runsNpmPublish(step, true));
    expect(rehearsals).toHaveLength(1);
    expect(rehearsals[0]).toContain("if: github.event_name != 'release'");
  });

  it("refuses a release whose tag is not the package version", () => {
    const check = STEPS.find((step) => step.includes("github.ref_name"));
    expect(check).toBeDefined();
    expect(check).toContain("if: github.event_name == 'release'");
    expect(check).toContain("package.json");
    expect(check).toContain("exit 1");
    const publishAt = STEPS.findIndex((step) => runsNpmPublish(step, false));
    expect(STEPS.indexOf(check as string)).toBeLessThan(publishAt);
  });

  it("links the environment to this package", () => {
    expect(WORKFLOW).toContain(`url: https://www.npmjs.com/package/${PACKAGE.name}\n`);
  });

  it("ships the changelog in the tarball", () => {
    expect(PACKAGE.files ?? []).toContain("CHANGELOG.md");
  });
});

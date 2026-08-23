import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("media-transfer-dialog registry skin", () => {
  it("declares and generates a dialog-form + data-table composition", async () => {
    const registry = await readFile(new URL("../registry.json", import.meta.url), "utf8");
    const built = await readFile(new URL("../registry/r/media-transfer-dialog.json", import.meta.url), "utf8");

    expect(registry).toContain('"name": "media-transfer-dialog"');
    expect(registry).toContain("dialog-form.json");
    expect(registry).toContain("data-table.json");
    expect(built).toContain('"name": "media-transfer-dialog"');
    expect(built).toContain("DialogForm");
    expect(built).toContain("DataTable");
  });
});

import { describe, expect, it } from "vitest";
import { mediaKeys } from "../src/runtime/queryKeys.js";

describe("mediaKeys", () => {
  it("builds stable keys for object lists regardless of parameter order", () => {
    const first = mediaKeys.objects({
      q: "banner",
      limit: 25,
      include_deleted: false,
      cursor: undefined
    });
    const second = mediaKeys.objects({
      include_deleted: false,
      limit: 25,
      q: "banner"
    });

    expect(first).toEqual(["media", "objects", { include_deleted: false, limit: 25, q: "banner" }]);
    expect(second).toEqual(first);
    expect(first[2]).not.toBe(second[2]);
  });

  it("builds stable keys for detail and admin scopes", () => {
    expect(mediaKeys.all()).toEqual(["media"]);
    expect(mediaKeys.objects()).toEqual(["media", "objects", {}]);
    expect(mediaKeys.object("obj_123")).toEqual(["media", "object", "obj_123"]);
    expect(mediaKeys.variants("obj_123")).toEqual(["media", "variants", "obj_123"]);
    expect(mediaKeys.presets()).toEqual(["media", "presets"]);
    expect(mediaKeys.downloadUrl("obj_123")).toEqual(["media", "download-url", "obj_123"]);
    expect(mediaKeys.adminStats()).toEqual(["media", "admin", "stats"]);
    expect(mediaKeys.adminStaleUploads()).toEqual(["media", "admin", "stale-uploads", {}]);
    expect(mediaKeys.adminOrphans()).toEqual(["media", "admin", "orphans", {}]);
  });

  it("normalizes optional admin params and strips undefined values", () => {
    const stale = mediaKeys.adminStaleUploads({
      cursor: undefined,
      include_deleted: false,
      q: "pending"
    });
    const orphans = mediaKeys.adminOrphans({
      confirm: null,
      dry_run: true,
      cursor: undefined
    });

    expect(stale).toEqual(["media", "admin", "stale-uploads", { include_deleted: false, q: "pending" }]);
    expect(orphans).toEqual(["media", "admin", "orphans", { confirm: null, dry_run: true }]);
  });
});

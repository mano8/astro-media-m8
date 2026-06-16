import { describe, expect, it } from "vitest";
import * as s from "../src/runtime/schemas.js";

const uuid = "11111111-1111-4111-8111-111111111111";
const iso = "2026-06-16T00:00:00Z";

const mediaObject = {
  id: uuid,
  tenant_id: null,
  owner_user_id: uuid,
  category: "asset",
  visibility: "private",
  storage_bucket: "media-private",
  object_key: "x/y.png",
  original_filename: "y.png",
  mime_type: "image/png",
  extension: "png",
  size_bytes: 10,
  sha256: "a".repeat(64),
  etag: "etag",
  storage_class: "standard",
  status: "ready",
  scan_status: "clean",
  moderation_status: "approved",
  created_at: iso,
  updated_at: iso,
  deleted_at: null
};

describe("enum schemas", () => {
  it("accepts known values and rejects unknown", () => {
    expect(s.MediaCategorySchema.parse("receipt")).toBe("receipt");
    expect(s.MediaVisibilitySchema.parse("tenant")).toBe("tenant");
    expect(s.MediaObjectStatusSchema.parse("rejected")).toBe("rejected");
    expect(s.ScanStatusSchema.parse("quarantined")).toBe("quarantined");
    expect(s.ModerationStatusSchema.parse("skipped")).toBe("skipped");
    expect(s.ImageFormatSchema.parse("AVIF")).toBe("AVIF");
    expect(s.VariantJobStatusSchema.parse("completed")).toBe("completed");
    expect(s.SortFieldSchema.parse("size_bytes")).toBe("size_bytes");
    expect(s.SortOrderSchema.parse("asc")).toBe("asc");
    expect(() => s.MediaCategorySchema.parse("nope")).toThrow();
  });
});

describe("object schemas", () => {
  it("parses a media object and list/download responses", () => {
    expect(s.MediaObjectPublicSchema.parse(mediaObject).id).toBe(uuid);
    expect(
      s.ObjectListResponseSchema.parse({ items: [mediaObject], next_cursor: "c", count: 1 }).count
    ).toBe(1);
    expect(s.DownloadUrlResponseSchema.parse({ url: "https://x", expires_at: iso }).url).toBe("https://x");
    expect(s.MediaObjectUpdateSchema.parse({ visibility: "public" }).visibility).toBe("public");
    expect(s.ScanResultRequestSchema.parse({ scan_status: "clean" }).scan_status).toBe("clean");
  });

  it("applies defaults for nullable fields", () => {
    const minimal = { ...mediaObject };
    delete (minimal as Record<string, unknown>).tenant_id;
    delete (minimal as Record<string, unknown>).deleted_at;
    const parsed = s.MediaObjectPublicSchema.parse(minimal);
    expect(parsed.tenant_id).toBeNull();
    expect(parsed.deleted_at).toBeNull();
  });
});

describe("upload schemas", () => {
  it("parses requests and responses", () => {
    expect(
      s.UploadInitiateRequestSchema.parse({
        category: "avatar",
        visibility: "public",
        original_filename: "a.png",
        mime_type: "image/png",
        expected_size_bytes: 1
      }).category
    ).toBe("avatar");
    expect(
      s.UploadInitiateResponseSchema.parse({
        session_id: uuid,
        upload_url: "https://s3",
        upload_fields: { key: "v" },
        expires_at: iso
      }).upload_fields.key
    ).toBe("v");
    expect(s.UploadCompleteRequestSchema.parse({}).sha256).toBeUndefined();
    expect(s.UploadCompleteResponseSchema.parse({ media_object: mediaObject }).media_object.id).toBe(uuid);
  });
});

describe("variant schemas", () => {
  const variant = {
    id: uuid,
    media_object_id: uuid,
    variant_name: "thumb",
    storage_bucket: "media-public",
    object_key: "k",
    width: 10,
    height: 10,
    size_bytes: 5,
    format: "WEBP",
    created_at: iso
  };

  it("parses generate request, variant, list and job", () => {
    expect(s.VariantGenerateRequestSchema.parse({ presets: ["thumb"] }).presets).toEqual(["thumb"]);
    expect(s.VariantPublicSchema.parse(variant).variant_name).toBe("thumb");
    expect(s.VariantListResponseSchema.parse({ items: [variant], count: 1 }).count).toBe(1);
    expect(
      s.VariantJobPublicSchema.parse({
        id: uuid,
        media_object_id: uuid,
        owner_user_id: uuid,
        status: "queued",
        requested_presets: ["thumb"],
        variants_expected: 1,
        variants_created: 0,
        error: null,
        created_at: iso,
        updated_at: iso
      }).status
    ).toBe("queued");
    expect(
      s.VariantRegisterRequestSchema.parse({
        variant_name: "t",
        storage_bucket: "bkt",
        object_key: "k",
        size_bytes: 1,
        format: "WEBP"
      }).format
    ).toBe("WEBP");
    expect(s.VariantJobUpdateSchema.parse({ status: "completed" }).status).toBe("completed");
  });
});

describe("preset schemas", () => {
  it("parses spec, create, update, public", () => {
    const spec = {
      image_size: { fixed_width: 100, fixed_height: null, fixed_size: null },
      formats: [{ ext: "WEBP", quality: 80 }],
      allow_upscale: false,
      max_byte_size: null
    };
    expect(s.PresetSpecSchema.parse(spec).formats[0].quality).toBe(80);
    expect(s.ImagePresetCreateSchema.parse({ name: "p", spec }).name).toBe("p");
    expect(s.ImagePresetUpdateSchema.parse({ spec }).spec.allow_upscale).toBe(false);
    const preset = s.ImagePresetPublicSchema.parse({ name: "p", spec, builtin: true });
    expect(preset.id).toBeNull();
    expect(s.ImagePresetListSchema.parse([preset]).length).toBe(1);
  });
});

describe("share schemas", () => {
  it("parses create, public, list", () => {
    expect(s.ShareTokenCreateSchema.parse({ expires_in: 60 }).expires_in).toBe(60);
    const share = {
      id: uuid,
      media_object_id: uuid,
      token: "tok",
      expires_at: iso,
      max_uses: null,
      uses: 0,
      revoked: false,
      created_at: iso
    };
    expect(s.ShareTokenPublicSchema.parse(share).token).toBe("tok");
    expect(s.ShareTokenListResponseSchema.parse({ items: [share], count: 1 }).count).toBe(1);
  });
});

describe("admin & maintenance schemas", () => {
  it("parses stats, usage, quota, stale, purge, orphans, subscriptions", () => {
    const usage = {
      owner_user_id: uuid,
      tenant_id: null,
      total_bytes: 1,
      object_count: 1,
      quota_bytes: null,
      quota_objects: null,
      effective_quota_bytes: null,
      effective_quota_objects: null
    };
    expect(
      s.StorageStatsResponseSchema.parse({
        by_status: [{ status: "ready", count: 1, total_bytes: 1 }],
        by_category: [{ category: "asset", count: 1, total_bytes: 1 }],
        total_objects: 1,
        total_bytes: 1,
        deleted_objects: 0,
        usage: [usage]
      }).total_objects
    ).toBe(1);
    expect(s.StorageUsagePublicSchema.parse(usage).object_count).toBe(1);
    expect(s.QuotaUpdateRequestSchema.parse({ quota_bytes: null }).quota_bytes).toBeNull();
    expect(
      s.StaleUploadsResponseSchema.parse({
        count: 1,
        sessions: [
          {
            id: uuid,
            owner_user_id: uuid,
            category: "asset",
            visibility: "private",
            storage_bucket: "b",
            object_key: "k",
            expires_at: iso,
            created_at: iso
          }
        ]
      }).count
    ).toBe(1);
    expect(s.PurgeStaleResponseSchema.parse({ purged: 2 }).purged).toBe(2);
    expect(
      s.OrphanReportSchema.parse({
        db_orphans: [{ bucket: "b", object_key: "k", object_id: null, owner_user_id: null }],
        storage_orphans: [],
        db_orphan_count: 1,
        storage_orphan_count: 0,
        repaired: 0
      }).db_orphan_count
    ).toBe(1);
    expect(s.HardPurgeResponseSchema.parse({ purged: 3 }).purged).toBe(3);
    expect(
      s.SubscriptionCreateRequestSchema.parse({ url: "https://x", secret: "0123456789abcdef" }).event_types
    ).toEqual([]);
    const sub = { id: uuid, url: "https://x", event_types: [], active: true, created_at: iso };
    expect(s.SubscriptionPublicSchema.parse(sub).active).toBe(true);
    expect(s.SubscriptionListResponseSchema.parse({ count: 1, items: [sub] }).count).toBe(1);
  });
});

describe("dashboard & legacy category schemas", () => {
  it("parses activity and category envelopes", () => {
    expect(
      s.UsersActivitySchema.parse({
        nb_users: 1,
        activity: { min: 0, max: 1, activity: [{ model: "m", updated: 1, added: 1 }] }
      }).nb_users
    ).toBe(1);
    const category = { id: 1, owner_id: uuid, name: "n", slug: "n" };
    expect(s.CategoryPublicSchema.parse(category).slug).toBe("n");
    expect(s.CategoriesPublicSchema.parse({ data: [category], count: 1 }).count).toBe(1);
    expect(s.CategoryCreateSchema.parse({ name: "n" }).name).toBe("n");
    expect(s.CategoryUpdateSchema.parse({ name: "n" }).name).toBe("n");
    expect(s.ResponseMessageSchema.parse({ success: true, msg: "ok" }).success).toBe(true);
    expect(s.ResponseModelBaseSchema.parse({ success: true, data: { a: 1 } }).success).toBe(true);
    expect(s.ResponseModelOrMessageSchema.parse({ success: false, msg: "x" })).toBeTruthy();
  });
});

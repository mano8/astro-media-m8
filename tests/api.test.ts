import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("../src/runtime/client.js", () => ({
  request: requestMock
}));

import * as uploads from "../src/runtime/api/uploads.js";
import * as objects from "../src/runtime/api/objects.js";
import * as variants from "../src/runtime/api/variants.js";
import * as presets from "../src/runtime/api/presets.js";
import * as shares from "../src/runtime/api/shares.js";
import * as categories from "../src/runtime/api/categories.js";
import * as dashboard from "../src/runtime/api/dashboard.js";
import * as admin from "../src/runtime/api/admin.js";
import * as index from "../src/runtime/api/index.js";
import { ApiError } from "../src/runtime/errors.js";

function lastOptions() {
  return requestMock.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  requestMock.mockReset();
  requestMock.mockResolvedValue({});
});

describe("uploads API", () => {
  it("initiate, complete (default + body), abort", async () => {
    await uploads.initiateUpload({
      category: "asset",
      visibility: "private",
      original_filename: "a.png",
      mime_type: "image/png",
      expected_size_bytes: 1
    });
    expect(lastOptions()).toMatchObject({ method: "POST", path: "/uploads/initiate", auth: true });
    await uploads.completeUpload("s 1");
    expect(lastOptions().path).toBe("/uploads/s%201/complete");
    await uploads.completeUpload("s1", { sha256: "x" });
    expect(lastOptions().body).toEqual({ sha256: "x" });
    await uploads.abortUpload("s1");
    expect(lastOptions()).toMatchObject({ path: "/uploads/s1/abort", method: "POST" });
  });
});

describe("objects API", () => {
  it("list, get, downloadUrl, update, delete", async () => {
    await objects.listObjects();
    expect(lastOptions()).toMatchObject({ method: "GET", path: "/objects", auth: true });
    await objects.listObjects({ category: "asset", limit: 10 });
    expect(lastOptions().query).toMatchObject({ category: "asset", limit: 10 });
    await objects.getObject("o 1");
    expect(lastOptions().path).toBe("/objects/o%201");
    await objects.getDownloadUrl("o1");
    expect(lastOptions().path).toBe("/objects/o1/download-url");
    await objects.updateObject("o1", { visibility: "public" });
    expect(lastOptions()).toMatchObject({ method: "PATCH", path: "/objects/o1" });
    await objects.deleteObject("o1");
    expect(lastOptions()).toMatchObject({ method: "DELETE", path: "/objects/o1" });
  });

  it("retries new sort fields with a legacy sort when the service rejects them", async () => {
    const response = { items: [], next_cursor: null, count: 0 };
    requestMock
      .mockRejectedValueOnce(new ApiError(422, [{ loc: ["query", "sort_by"], msg: "invalid" }]))
      .mockResolvedValueOnce(response);

    await expect(
      objects.listObjects({ sort_by: "original_filename", order: "asc", limit: 10 })
    ).resolves.toBe(response);

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        query: expect.objectContaining({ sort_by: "original_filename", order: "asc" })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        query: expect.objectContaining({ sort_by: "created_at", order: "asc" })
      })
    );
  });

  it("does not retry list failures unrelated to new sort-field validation", async () => {
    const serverError = new ApiError(500, "failed");
    requestMock.mockRejectedValueOnce(serverError);

    await expect(objects.listObjects({ sort_by: "category" })).rejects.toBe(serverError);
    expect(requestMock).toHaveBeenCalledOnce();

    const validationError = new ApiError(422, "invalid");
    requestMock.mockRejectedValueOnce(validationError);
    await expect(objects.listObjects({ sort_by: "created_at" })).rejects.toBe(validationError);
    expect(requestMock).toHaveBeenCalledTimes(2);

    const unknownError = new Error("network");
    requestMock.mockRejectedValueOnce(unknownError);
    await expect(objects.listObjects({ sort_by: "status" })).rejects.toBe(unknownError);
    expect(requestMock).toHaveBeenCalledTimes(3);

    const unsortedValidationError = new ApiError(422, "invalid");
    requestMock.mockRejectedValueOnce(unsortedValidationError);
    await expect(objects.listObjects({ category: "asset" })).rejects.toBe(
      unsortedValidationError
    );
    expect(requestMock).toHaveBeenCalledTimes(4);
  });
});

describe("variants API", () => {
  it("generate, list, getJob, delete", async () => {
    await variants.generateVariants("o1", { presets: ["thumb"] });
    expect(lastOptions().path).toBe("/objects/o1/variants:generate");
    await variants.listVariants("o1");
    expect(lastOptions().path).toBe("/objects/o1/variants");
    await variants.getVariantJob("o1", "j1");
    expect(lastOptions().path).toBe("/objects/o1/variants/jobs/j1");
    await variants.deleteVariant("o1", "v1");
    expect(lastOptions()).toMatchObject({ method: "DELETE", path: "/objects/o1/variants/v1" });
  });

  it("waitForVariantJob returns on terminal status", async () => {
    requestMock.mockResolvedValue({ status: "completed" });
    const job = await variants.waitForVariantJob("o1", "j1");
    expect(job.status).toBe("completed");
  });

  it("waitForVariantJob aborts when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      variants.waitForVariantJob("o1", "j1", { signal: controller.signal })
    ).rejects.toThrow("aborted");
  });

  it("waitForVariantJob times out without a terminal status", async () => {
    requestMock.mockResolvedValue({ status: "queued" });
    await expect(
      variants.waitForVariantJob("o1", "j1", { timeoutMs: 0, intervalMs: 5 })
    ).rejects.toThrow("Timed out");
  });

  it("waitForVariantJob polls until terminal and reports updates", async () => {
    requestMock
      .mockResolvedValueOnce({ status: "processing" })
      .mockResolvedValueOnce({ status: "completed" });
    const updates: string[] = [];
    const job = await variants.waitForVariantJob("o1", "j1", {
      intervalMs: 0,
      timeoutMs: 1000,
      onUpdate: (j) => updates.push(j.status)
    });
    expect(job.status).toBe("completed");
    expect(updates).toEqual(["processing", "completed"]);
  });
});

describe("presets API", () => {
  it("list, create, update, delete", async () => {
    await presets.listPresets();
    expect(lastOptions()).toMatchObject({ method: "GET", path: "/presets" });
    await presets.createPreset({
      name: "p",
      spec: { image_size: { fixed_width: null, fixed_height: null, fixed_size: null }, formats: [{ ext: "WEBP", quality: 80 }], allow_upscale: false, max_byte_size: null }
    });
    expect(lastOptions()).toMatchObject({ method: "POST", path: "/presets" });
    await presets.updatePreset("p1", {
      spec: { image_size: { fixed_width: null, fixed_height: null, fixed_size: null }, formats: [{ ext: "PNG", quality: 90 }], allow_upscale: true, max_byte_size: null }
    });
    expect(lastOptions().path).toBe("/presets/p1");
    await presets.deletePreset("p1");
    expect(lastOptions()).toMatchObject({ method: "DELETE", path: "/presets/p1" });
  });
});

describe("shares API", () => {
  it("create (default + body), list, revoke, resolve (public)", async () => {
    await shares.createShare("o1");
    expect(lastOptions()).toMatchObject({ method: "POST", path: "/objects/o1/shares", body: {} });
    await shares.createShare("o1", { expires_in: 60 });
    expect(lastOptions().body).toEqual({ expires_in: 60 });
    await shares.listShares("o1");
    expect(lastOptions().path).toBe("/objects/o1/shares");
    await shares.revokeShare("t1");
    expect(lastOptions()).toMatchObject({ method: "DELETE", path: "/shares/t1" });
    await shares.resolveShare("tok en");
    expect(lastOptions()).toMatchObject({ path: "/shares/tok%20en" });
    expect(lastOptions().auth).toBeUndefined();
  });
});

describe("categories API (legacy base)", () => {
  it("list (default + args), get, create, update, delete", async () => {
    await categories.listCategories();
    expect(lastOptions()).toMatchObject({ base: "legacy", path: "/category/", query: { skip: 0, limit: 100 } });
    await categories.listCategories(5, 10);
    expect(lastOptions().query).toEqual({ skip: 5, limit: 10 });
    await categories.getCategory(3);
    expect(lastOptions().path).toBe("/category/get/3/");
    await categories.createCategory({ name: "n" });
    expect(lastOptions()).toMatchObject({ method: "POST", path: "/category/add/" });
    await categories.updateCategory(3, { name: "n2" });
    expect(lastOptions()).toMatchObject({ method: "PUT", path: "/category/edit/3/" });
    await categories.deleteCategory(3);
    expect(lastOptions()).toMatchObject({ method: "DELETE", path: "/category/delete/3/" });
  });
});

describe("dashboard API (legacy base)", () => {
  it("activity all and current", async () => {
    await dashboard.getActivityAll();
    expect(lastOptions()).toMatchObject({ base: "legacy", path: "/dashboard/users/activity/" });
    await dashboard.getActivityCurrent();
    expect(lastOptions().path).toBe("/dashboard/users/activity/current/");
  });
});

describe("admin API", () => {
  it("covers every superuser-gated wrapper", async () => {
    await admin.getStorageStats();
    await admin.getStaleUploads();
    await admin.purgeStaleUploads();
    await admin.getQuota("u1");
    expect(lastOptions()).toMatchObject({ path: "/admin/quotas/u1", query: { tenant_id: undefined } });
    await admin.getQuota("u1", "t1");
    expect(lastOptions().query).toEqual({ tenant_id: "t1" });
    await admin.setQuota("u1", { quota_bytes: 1 }, "t1");
    expect(lastOptions()).toMatchObject({ method: "PUT", path: "/admin/quotas/u1" });
    await admin.getOrphans();
    await admin.repairOrphans();
    expect(lastOptions().query).toEqual({ confirm: false });
    await admin.repairOrphans(true);
    expect(lastOptions().query).toEqual({ confirm: true });
    await admin.purgeExpired();
    await admin.createSubscription({ url: "https://x", secret: "0123456789abcdef", event_types: [] });
    await admin.listSubscriptions();
    await admin.deleteSubscription("sub1");
    expect(lastOptions()).toMatchObject({ method: "DELETE", path: "/admin/subscriptions/sub1", admin: true });
    expect(requestMock.mock.calls.every(([opts]) => opts.admin === true)).toBe(true);
  });
});

describe("api index namespaces", () => {
  it("wires grouped namespaces to the flat functions", async () => {
    expect(index.uploads.initiate).toBe(uploads.initiateUpload);
    expect(index.objects.list).toBe(objects.listObjects);
    expect(index.variants.waitForJob).toBe(variants.waitForVariantJob);
    expect(index.presets.create).toBe(presets.createPreset);
    expect(index.shares.resolve).toBe(shares.resolveShare);
    expect(index.categories.update).toBe(categories.updateCategory);
    expect(index.dashboard.activityCurrent).toBe(dashboard.getActivityCurrent);
    expect(index.admin.repairOrphans).toBe(admin.repairOrphans);
  });
});

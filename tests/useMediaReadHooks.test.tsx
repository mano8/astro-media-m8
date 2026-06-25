// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../src/runtime/errors.js";
import { MediaProvider } from "../src/runtime/react/MediaProvider.js";
import type {
  DownloadUrlResponse,
  HardPurgeResponse,
  ImagePresetPublic,
  MediaObjectPublic,
  OrphanReport,
  PurgeStaleResponse,
  StaleUploadsResponse,
  StorageStatsResponse,
  SubscriptionListResponse,
  VariantJobPublic,
  VariantListResponse,
  VariantPublic
} from "../src/runtime/schemas.js";

const apiMocks = vi.hoisted(() => ({
  deleteObject: vi.fn(),
  deletePreset: vi.fn(),
  deleteSubscription: vi.fn(),
  deleteVariant: vi.fn(),
  generateVariants: vi.fn(),
  getDownloadUrl: vi.fn(),
  getObject: vi.fn(),
  getOrphans: vi.fn(),
  getStaleUploads: vi.fn(),
  getStorageStats: vi.fn(),
  listPresets: vi.fn(),
  listSubscriptions: vi.fn(),
  listVariants: vi.fn(),
  purgeExpired: vi.fn(),
  purgeStaleUploads: vi.fn(),
  repairOrphans: vi.fn(),
  resolveShare: vi.fn(),
  updateObject: vi.fn(),
  updatePreset: vi.fn(),
  createPreset: vi.fn(),
  waitForVariantJob: vi.fn()
}));

vi.mock("../src/runtime/api/objects.js", () => ({
  deleteObject: apiMocks.deleteObject,
  getDownloadUrl: apiMocks.getDownloadUrl,
  getObject: apiMocks.getObject,
  updateObject: apiMocks.updateObject
}));

vi.mock("../src/runtime/api/variants.js", () => ({
  deleteVariant: apiMocks.deleteVariant,
  generateVariants: apiMocks.generateVariants,
  listVariants: apiMocks.listVariants,
  waitForVariantJob: apiMocks.waitForVariantJob
}));

vi.mock("../src/runtime/api/presets.js", () => ({
  createPreset: apiMocks.createPreset,
  deletePreset: apiMocks.deletePreset,
  listPresets: apiMocks.listPresets,
  updatePreset: apiMocks.updatePreset
}));

vi.mock("../src/runtime/api/shares.js", () => ({
  resolveShare: apiMocks.resolveShare
}));

vi.mock("../src/runtime/api/admin.js", () => ({
  deleteSubscription: apiMocks.deleteSubscription,
  getOrphans: apiMocks.getOrphans,
  getStaleUploads: apiMocks.getStaleUploads,
  getStorageStats: apiMocks.getStorageStats,
  listSubscriptions: apiMocks.listSubscriptions,
  purgeExpired: apiMocks.purgeExpired,
  purgeStaleUploads: apiMocks.purgeStaleUploads,
  repairOrphans: apiMocks.repairOrphans
}));

import { useDownloadUrl } from "../src/runtime/hooks/useDownloadUrl.js";
import { useMediaAdmin, type UseMediaAdmin } from "../src/runtime/hooks/useMediaAdmin.js";
import { useMediaObject, type UseMediaObject } from "../src/runtime/hooks/useMediaObject.js";
import { useMediaPresets, type UseMediaPresets } from "../src/runtime/hooks/useMediaPresets.js";
import { useMediaVariants, type UseMediaVariants } from "../src/runtime/hooks/useMediaVariants.js";
import { mediaKeys } from "../src/runtime/queryKeys.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OBJECT_ID = "11111111-1111-4111-8111-111111111111";
const OWNER_ID = "22222222-2222-4222-8222-222222222222";
const SUBSCRIPTION_ID = "33333333-3333-4333-8333-333333333333";
const NOW = "2026-06-25T00:00:00Z";

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function render(element: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(<>{element}</>);
  });
  return {
    unmount: () => act(() => root.unmount())
  };
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });
    }
  }
  throw lastError;
}

function withQueryClient(children: ReactNode, client = createClient()) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function makeObject(id: string, originalFilename: string): MediaObjectPublic {
  return {
    id,
    tenant_id: null,
    owner_user_id: OWNER_ID,
    category: "asset",
    visibility: "private",
    storage_bucket: "media",
    object_key: `objects/${originalFilename}`,
    original_filename: originalFilename,
    mime_type: "image/png",
    extension: "png",
    size_bytes: 10,
    sha256: null,
    etag: null,
    storage_class: "standard",
    status: "ready",
    scan_status: "clean",
    moderation_status: "approved",
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null
  };
}

function makeVariant(id: string, variantName: string): VariantPublic {
  return {
    id,
    media_object_id: OBJECT_ID,
    variant_name: variantName,
    storage_bucket: "media",
    object_key: `variants/${variantName}.webp`,
    width: 100,
    height: 100,
    size_bytes: 5,
    format: "WEBP",
    created_at: NOW
  };
}

function makeJob(status: VariantJobPublic["status"]): VariantJobPublic {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    media_object_id: OBJECT_ID,
    owner_user_id: OWNER_ID,
    status,
    requested_presets: ["thumb"],
    variants_expected: 1,
    variants_created: status === "completed" ? 1 : 0,
    error: null,
    created_at: NOW,
    updated_at: NOW
  };
}

function makePreset(id: string, name: string): ImagePresetPublic {
  return {
    id,
    name,
    builtin: false,
    created_at: NOW,
    updated_at: NOW,
    spec: {
      image_size: {
        fixed_width: 100,
        fixed_height: null,
        fixed_size: null
      },
      formats: [{ ext: "WEBP", quality: 80 }],
      allow_upscale: false,
      max_byte_size: null
    }
  };
}

function makeStats(): StorageStatsResponse {
  return {
    by_status: [{ status: "ready", count: 1, total_bytes: 10 }],
    by_category: [{ category: "asset", count: 1, total_bytes: 10 }],
    total_objects: 1,
    total_bytes: 10,
    deleted_objects: 0,
    usage: [
      {
        owner_user_id: OWNER_ID,
        tenant_id: null,
        total_bytes: 10,
        object_count: 1,
        quota_bytes: null,
        quota_objects: null,
        effective_quota_bytes: null,
        effective_quota_objects: null
      }
    ]
  };
}

function makeStale(): StaleUploadsResponse {
  return {
    count: 1,
    sessions: [
      {
        id: "55555555-5555-4555-8555-555555555555",
        owner_user_id: OWNER_ID,
        category: "asset",
        visibility: "private",
        storage_bucket: "media",
        object_key: "uploads/stale",
        expires_at: NOW,
        created_at: NOW
      }
    ]
  };
}

function makeOrphans(repaired: number): OrphanReport {
  return {
    db_orphans: [],
    storage_orphans: [
      {
        bucket: "media",
        object_key: "orphans/file.png",
        object_id: null,
        owner_user_id: null
      }
    ],
    db_orphan_count: 0,
    storage_orphan_count: 1,
    repaired
  };
}

function makeSubscriptions(): SubscriptionListResponse {
  return {
    count: 1,
    items: [
      {
        id: SUBSCRIPTION_ID,
        url: "https://example.test/hook",
        event_types: ["media.created"],
        active: true,
        created_at: NOW
      }
    ]
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
  for (const mock of Object.values(apiMocks)) mock.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("media read hooks", () => {
  it("loads object detail through React Query while preserving update and remove fields", async () => {
    const original = makeObject(OBJECT_ID, "original.png");
    const updated = makeObject(OBJECT_ID, "updated.png");
    const client = createClient();
    let latest: UseMediaObject | undefined;
    apiMocks.getObject.mockResolvedValueOnce(original);
    apiMocks.updateObject.mockResolvedValueOnce(updated);
    apiMocks.deleteObject.mockResolvedValueOnce(undefined);
    client.setQueryData(mediaKeys.objects({ category: "asset" }), { items: [original], next_cursor: null, count: 1 });

    function Probe() {
      latest = useMediaObject(OBJECT_ID);
      return null;
    }

    const view = render(withQueryClient(<Probe />, client));
    await waitFor(() => {
      expect(latest?.object).toEqual(original);
      expect(latest?.loading).toBe(false);
      expect(latest?.error).toBeNull();
      expect(latest?.updateMutation.status).toBe("idle");
      expect(latest?.removeMutation.status).toBe("idle");
    });

    await act(async () => {
      await latest?.update({ original_filename: "updated.png" });
    });
    await waitFor(() => {
      expect(apiMocks.updateObject).toHaveBeenCalledWith(OBJECT_ID, { original_filename: "updated.png" });
      expect(latest?.object).toEqual(updated);
      expect(latest?.updateMutation.status).toBe("success");
      expect(client.getQueryState(mediaKeys.objects({ category: "asset" }))?.isInvalidated).toBe(true);
    });

    await act(async () => {
      await latest?.remove();
    });
    await waitFor(() => {
      expect(apiMocks.deleteObject).toHaveBeenCalledWith(OBJECT_ID);
      expect(latest?.object).toBeNull();
      expect(latest?.removeMutation.status).toBe("success");
    });
    view.unmount();
  });

  it("loads variants and refreshes them after generation without losing the legacy job field", async () => {
    const thumb = makeVariant("66666666-6666-4666-8666-666666666666", "thumb");
    const card = makeVariant("77777777-7777-4777-8777-777777777777", "card");
    const started = makeJob("queued");
    const finished = makeJob("completed");
    const client = createClient();
    let latest: UseMediaVariants | undefined;
    client.setQueryData(mediaKeys.object(OBJECT_ID), makeObject(OBJECT_ID, "original.png"));
    apiMocks.listVariants
      .mockResolvedValueOnce({ items: [thumb], count: 1 } satisfies VariantListResponse)
      .mockResolvedValueOnce({ items: [thumb, card], count: 2 } satisfies VariantListResponse);
    apiMocks.generateVariants.mockResolvedValueOnce(started);
    apiMocks.waitForVariantJob.mockImplementation(
      async (_objectId: string, _jobId: string, options: { onUpdate?: (job: VariantJobPublic) => void } = {}) => {
        options.onUpdate?.(finished);
        return finished;
      }
    );
    apiMocks.deleteVariant.mockResolvedValueOnce(undefined);

    function Probe() {
      latest = useMediaVariants(OBJECT_ID);
      return null;
    }

    const view = render(withQueryClient(<Probe />, client));
    await waitFor(() => {
      expect(latest?.items).toEqual([thumb]);
      expect(latest?.error).toBeNull();
      expect(latest?.generateMutation.status).toBe("idle");
      expect(latest?.removeMutation.status).toBe("idle");
    });

    await act(async () => {
      await latest?.generate(["thumb"]);
    });
    await waitFor(() => {
      expect(latest?.job).toEqual(finished);
      expect(latest?.items).toEqual([thumb, card]);
      expect(latest?.generateMutation.status).toBe("success");
      expect(client.getQueryState(mediaKeys.object(OBJECT_ID))?.isInvalidated).toBe(true);
    });

    await act(async () => {
      await latest?.remove(thumb.id);
    });
    await waitFor(() => {
      expect(apiMocks.deleteVariant).toHaveBeenCalledWith(OBJECT_ID, thumb.id);
      expect(latest?.items).toEqual([card]);
      expect(latest?.removeMutation.status).toBe("success");
    });
    view.unmount();
  });

  it("loads presets through React Query and invalidates the list after writes", async () => {
    const original = makePreset("88888888-8888-4888-8888-888888888888", "thumb");
    const created = makePreset("99999999-9999-4999-8999-999999999999", "card");
    const updated = makePreset(original.id ?? "", "thumb-updated");
    let latest: UseMediaPresets | undefined;
    apiMocks.listPresets
      .mockResolvedValueOnce([original])
      .mockResolvedValueOnce([original, created])
      .mockResolvedValueOnce([updated, created])
      .mockResolvedValueOnce([updated]);
    apiMocks.createPreset.mockResolvedValueOnce(created);
    apiMocks.updatePreset.mockResolvedValueOnce(updated);
    apiMocks.deletePreset.mockResolvedValueOnce(undefined);

    function Probe() {
      latest = useMediaPresets();
      return null;
    }

    const view = render(withQueryClient(<Probe />));
    await waitFor(() => {
      expect(latest?.presets).toEqual([original]);
      expect(latest?.createMutation.status).toBe("idle");
      expect(latest?.updateMutation.status).toBe("idle");
      expect(latest?.removeMutation.status).toBe("idle");
    });

    await act(async () => {
      await latest?.create({ name: "card", spec: created.spec });
    });
    await waitFor(() => {
      expect(latest?.presets).toEqual([original, created]);
      expect(latest?.createMutation.status).toBe("success");
    });

    await act(async () => {
      await latest?.update(original.id ?? "", { spec: updated.spec });
    });
    await waitFor(() => {
      expect(latest?.presets).toEqual([updated, created]);
      expect(latest?.updateMutation.status).toBe("success");
    });

    await act(async () => {
      await latest?.remove(created.id ?? "");
    });
    await waitFor(() => {
      expect(latest?.presets).toEqual([updated]);
      expect(latest?.removeMutation.status).toBe("success");
    });
    view.unmount();
  });

  it("keeps download URL requests explicit while exposing loading, error, and data", async () => {
    const owned: DownloadUrlResponse = { url: "https://example.test/owned", expires_at: NOW };
    const shared: DownloadUrlResponse = { url: "https://example.test/shared", expires_at: NOW };
    let latest: ReturnType<typeof useDownloadUrl> | undefined;
    apiMocks.getDownloadUrl.mockResolvedValueOnce(owned);
    apiMocks.resolveShare.mockResolvedValueOnce(shared);

    function Probe() {
      latest = useDownloadUrl(OBJECT_ID);
      return null;
    }

    const view = render(withQueryClient(<Probe />));
    expect(latest?.data).toBeNull();

    await act(async () => {
      await latest?.request();
    });
    await waitFor(() => {
      expect(apiMocks.getDownloadUrl).toHaveBeenCalledWith(OBJECT_ID);
      expect(latest?.data).toEqual(owned);
      expect(latest?.loading).toBe(false);
      expect(latest?.error).toBeNull();
    });

    await act(async () => {
      await latest?.resolve("share-token");
    });
    await waitFor(() => {
      expect(apiMocks.resolveShare).toHaveBeenCalledWith("share-token");
      expect(latest?.data).toEqual(shared);
    });
    view.unmount();
  });
});

describe("useMediaAdmin", () => {
  function withMediaProvider(children: ReactNode, isSuperuser: boolean) {
    return withQueryClient(
      <MediaProvider
        adapter={{
          getAccessToken: () => "token",
          getUser: async () => ({ is_superuser: isSuperuser }),
          isSuperuser: (user: unknown) => Boolean((user as { is_superuser?: boolean } | null)?.is_superuser)
        }}
      >
        {children}
      </MediaProvider>
    );
  }

  it("loads admin resources through disabled queries and updates cached maintenance state", async () => {
    const stats = makeStats();
    const stale = makeStale();
    const orphans = makeOrphans(0);
    const repaired = makeOrphans(1);
    const subscriptions = makeSubscriptions();
    const purgeStale: PurgeStaleResponse = { purged: 1 };
    const hardPurge: HardPurgeResponse = { purged: 2 };
    let latest: UseMediaAdmin | undefined;
    apiMocks.getStorageStats.mockResolvedValueOnce(stats);
    apiMocks.getStaleUploads.mockResolvedValueOnce(stale);
    apiMocks.getOrphans.mockResolvedValueOnce(orphans);
    apiMocks.listSubscriptions.mockResolvedValueOnce(subscriptions);
    apiMocks.purgeStaleUploads.mockResolvedValueOnce(purgeStale);
    apiMocks.repairOrphans.mockResolvedValueOnce(repaired);
    apiMocks.purgeExpired.mockResolvedValueOnce(hardPurge);
    apiMocks.deleteSubscription.mockResolvedValueOnce(undefined);

    function Probe() {
      latest = useMediaAdmin();
      return null;
    }

    const view = render(withMediaProvider(<Probe />, true));
    await waitFor(() => {
      expect(latest?.allowed).toBe(true);
    });

    await act(async () => {
      await latest?.loadStats();
      await latest?.loadStale();
      await latest?.loadOrphans();
      await latest?.loadSubscriptions();
    });
    await waitFor(() => {
      expect(latest?.stats).toEqual(stats);
      expect(latest?.stale).toEqual(stale);
      expect(latest?.orphans).toEqual(orphans);
      expect(latest?.subscriptions).toEqual(subscriptions);
      expect(latest?.error).toBeNull();
      expect(latest?.purgeStaleMutation.status).toBe("idle");
      expect(latest?.repairMutation.status).toBe("idle");
      expect(latest?.purgeExpiredMutation.status).toBe("idle");
      expect(latest?.removeSubscriptionMutation.status).toBe("idle");
    });

    await act(async () => {
      await expect(latest?.purgeStale()).resolves.toEqual(purgeStale);
      await expect(latest?.repair(true)).resolves.toEqual(repaired);
      await expect(latest?.purgeExpiredObjects()).resolves.toEqual(hardPurge);
      await latest?.removeSubscription(SUBSCRIPTION_ID);
    });
    await waitFor(() => {
      expect(apiMocks.repairOrphans).toHaveBeenCalledWith(true);
      expect(latest?.orphans).toEqual(repaired);
      expect(latest?.subscriptions).toEqual({ count: 0, items: [] });
      expect(latest?.purgeStaleMutation.status).toBe("success");
      expect(latest?.repairMutation.status).toBe("success");
      expect(latest?.purgeExpiredMutation.status).toBe("success");
      expect(latest?.removeSubscriptionMutation.status).toBe("success");
    });
    view.unmount();
  });

  it("rejects admin reads before requests when the user is not a superuser", async () => {
    let latest: UseMediaAdmin | undefined;

    function Probe() {
      latest = useMediaAdmin();
      return null;
    }

    const view = render(withMediaProvider(<Probe />, false));
    await waitFor(() => {
      expect(latest?.allowed).toBe(false);
    });

    await expect(latest?.loadStats()).rejects.toBeInstanceOf(ForbiddenError);
    expect(apiMocks.getStorageStats).not.toHaveBeenCalled();
    view.unmount();
  });
});

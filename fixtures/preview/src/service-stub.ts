// An in-memory stand-in for `media-service-m8`, for the dev-only gallery.
//
// The gallery mounts the plugin's *real* views, so it needs a real transport:
// the views call hooks, the hooks call the api wrappers, and those wrappers
// `fetch` and then `schema.parse()` the response. Stubbing `fetch` is therefore
// the only seam that leaves every layer above it genuine — mock the hooks
// instead and the gallery stops showing the plugin and starts showing the mock.
import type {
  CategoryNode,
  MediaObjectPublic,
  ObjectListResponse
} from "../../../src/runtime/schemas.js";

const OWNER = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-08-24T09:00:00Z";

const MIME_TYPES = [
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["application/pdf", "pdf"],
  ["image/webp", "webp"]
] as const;

const CATEGORIES = ["avatar", "document", "asset", "export"] as const;
const VISIBILITIES = ["public", "private", "tenant"] as const;
const STATUSES = ["ready", "processing", "uploaded", "failed"] as const;

function makeObjects(total: number): MediaObjectPublic[] {
  return Array.from({ length: total }, (_, index) => {
    const [mime, extension] = MIME_TYPES[index % MIME_TYPES.length];
    const id = `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`;
    return {
      id,
      tenant_id: null,
      owner_user_id: OWNER,
      category: CATEGORIES[index % CATEGORIES.length],
      visibility: VISIBILITIES[index % VISIBILITIES.length],
      storage_bucket: "gallery",
      object_key: `gallery/${id}.${extension}`,
      original_filename: `sample-${index + 1}.${extension}`,
      mime_type: mime,
      extension,
      size_bytes: 12_000 + index * 977,
      sha256: null,
      etag: null,
      storage_class: "standard",
      status: STATUSES[index % STATUSES.length],
      scan_status: index % 9 === 0 ? "pending" : "clean",
      moderation_status: "approved",
      categories: [{ id: (index % 3) + 1, name: "Gallery", path: "/gallery" }],
      created_at: NOW,
      updated_at: NOW,
      deleted_at: null
    };
  });
}

const ALL_OBJECTS = makeObjects(64);

const CATEGORY_TREE: CategoryNode[] = [
  {
    id: 1,
    owner_id: OWNER,
    tenant_id: null,
    name: "Gallery",
    slug: "gallery",
    parent_id: null,
    object_count: 12,
    total_object_count: 40,
    children: [
      {
        id: 2,
        owner_id: OWNER,
        tenant_id: null,
        name: "Screenshots",
        slug: "screenshots",
        parent_id: 1,
        object_count: 18,
        total_object_count: 18,
        children: []
      },
      {
        id: 3,
        owner_id: OWNER,
        tenant_id: null,
        name: "Documents",
        slug: "documents",
        parent_id: 1,
        object_count: 10,
        total_object_count: 10,
        children: []
      }
    ]
  }
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

/** Honours the list parameters the library view actually sends. */
function listObjects(params: URLSearchParams): ObjectListResponse {
  const category = (params.get("category") ?? "").trim();
  const visibility = (params.get("visibility") ?? "").trim();
  const status = (params.get("status") ?? "").trim();
  const limit = Number(params.get("limit") ?? "24");

  const filtered = ALL_OBJECTS.filter(
    (object) =>
      (category === "" || object.category === category) &&
      (visibility === "" || object.visibility === visibility) &&
      (status === "" || object.status === status)
  );

  return {
    items: filtered.slice(0, limit),
    next_cursor: null,
    count: filtered.length
  };
}

/**
 * Replaces `globalThis.fetch` for the lifetime of the gallery page. Returns the
 * original so a caller can restore it.
 */
export function installServiceStub(): typeof globalThis.fetch {
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      window.location.origin
    );
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname;

    // Latency, so the loading states in the gallery are reachable rather than
    // theoretical.
    await new Promise((resolve) => setTimeout(resolve, 120));

    if (path.endsWith("/meta")) {
      return json({
        contract_name: "media-service-m8",
        contract_version: "1.1",
        service_version: "2.0.0",
        service_name: "media-service-m8"
      });
    }
    if (path.endsWith("/ping")) return json({ success: true, msg: "pong" });

    if (path.endsWith("/category/tree/")) {
      return json({ data: CATEGORY_TREE, count: CATEGORY_TREE.length });
    }
    if (path.includes("/category/") && method === "GET") {
      return json({ data: CATEGORY_TREE, count: CATEGORY_TREE.length });
    }

    if (path.endsWith("/presets")) {
      return json({
        items: [
          {
            id: 1,
            name: "thumbnail",
            width: 320,
            height: 320,
            format: "WEBP",
            quality: 82,
            is_default: true
          }
        ],
        count: 1
      });
    }

    if (path.includes("/admin/storage/stats")) {
      return json({
        total_bytes: ALL_OBJECTS.reduce((sum, object) => sum + object.size_bytes, 0),
        object_count: ALL_OBJECTS.length,
        by_category: []
      });
    }

    // Checked before the generic `/objects/{id}` branch: the library view asks
    // for a download URL per row, and answering that with a media object makes
    // every thumbnail fail its schema parse.
    if (path.endsWith("/download-url") && method === "GET") {
      return json({
        url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        expires_at: "2026-08-24T10:00:00Z"
      });
    }

    if (path.includes("/objects/") && method === "GET") {
      const id = path.split("/objects/")[1]?.replace(/\/$/, "") ?? "";
      const found = ALL_OBJECTS.find((object) => object.id === id) ?? ALL_OBJECTS[0];
      return json(found);
    }

    if (path.endsWith("/objects") && method === "GET") {
      return json(listObjects(url.searchParams));
    }

    if (path.includes("/dashboard/")) {
      return json({ data: [], count: 0 });
    }

    // Anything unrecognised answers 404 rather than hanging, so a gap in the
    // stub shows up as the plugin's own error surface instead of a spinner.
    return json({ detail: `No gallery stub for ${method} ${path}` }, 404);
  }) as typeof globalThis.fetch;

  return original;
}

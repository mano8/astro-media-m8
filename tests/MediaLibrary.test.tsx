// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryNode, MediaObjectPublic, ObjectListResponse } from "../src/runtime/schemas.js";

const apiMocks = vi.hoisted(() => ({
  deleteObject: vi.fn(),
  getDownloadUrl: vi.fn(),
  listObjects: vi.fn(),
  resolveShare: vi.fn(),
  getCategoryTree: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  startExport: vi.fn(),
  getExportJob: vi.fn(),
  startImport: vi.fn()
}));

vi.mock("../src/runtime/api/objects.js", () => ({
  deleteObject: apiMocks.deleteObject,
  getDownloadUrl: apiMocks.getDownloadUrl,
  listObjects: apiMocks.listObjects
}));

vi.mock("../src/runtime/api/shares.js", () => ({
  resolveShare: apiMocks.resolveShare
}));

// The tree view's left pane calls `useCategoryTree()`. Mocking the category
// API module (rather than letting it load) also keeps `client.js` — and the
// `api/index.js` barrel it re-exports, which reaches for `objects.js` exports
// this file does not stub — out of the graph, exactly as `categoryManager`'s
// suite does.
vi.mock("../src/runtime/api/categories.js", () => ({
  getCategoryTree: apiMocks.getCategoryTree,
  createCategory: apiMocks.createCategory,
  updateCategory: apiMocks.updateCategory,
  deleteCategory: apiMocks.deleteCategory
}));

// The Import/Export control (`U10`) calls `useMediaTransfer()`, which reaches
// `api/transfer.js` — mocked for the same reason as `categories.js` above:
// its real module imports `client.js`, which re-exports the `api/index.js`
// barrel this file does not stub every branch of.
vi.mock("../src/runtime/api/transfer.js", () => ({
  startExport: apiMocks.startExport,
  getExportJob: apiMocks.getExportJob,
  startImport: apiMocks.startImport
}));

vi.mock("../src/runtime/react/MediaUploadDropzone.js", () => ({
  MediaUploadDropzone: ({
    onUploaded,
    labels
  }: {
    onUploaded?: (object: MediaObjectPublic) => void;
    labels?: { category?: string; visibility?: string };
  }) => (
    <section data-testid="upload-form">
      <fieldset aria-label={labels?.category ?? "User categories"}>
        <legend>{labels?.category ?? "User categories"}</legend>
        <label>
          <input type="checkbox" /> Invoices
        </label>
      </fieldset>
      <button type="button" onClick={() => onUploaded?.({} as MediaObjectPublic)}>
        Finish upload
      </button>
    </section>
  )
}));

import { MediaLibrary } from "../src/runtime/react/MediaLibrary.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OWNER_ID = "22222222-2222-4222-8222-222222222222";
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
    container,
    unmount: () => act(() => root.unmount())
  };
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
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

function makeObject(index: number, mimeType = "image/png"): MediaObjectPublic {
  const id = `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`;
  const extension = mimeType.startsWith("image/") ? "png" : "pdf";
  return {
    id,
    tenant_id: null,
    owner_user_id: OWNER_ID,
    category: "asset",
    visibility: "private",
    storage_bucket: "media",
    object_key: `objects/file-${index}.${extension}`,
    original_filename: `file-${index}.${extension}`,
    mime_type: mimeType,
    extension,
    size_bytes: index * 2048,
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

function page(items: MediaObjectPublic[]): ObjectListResponse {
  return { items, next_cursor: null, count: items.length };
}

function categoryNode(id: number, name: string, children: CategoryNode[] = []): CategoryNode {
  return {
    id,
    owner_id: OWNER_ID,
    tenant_id: null,
    name,
    slug: name.toLowerCase(),
    parent_id: null,
    object_count: 2,
    total_object_count: 5,
    children
  };
}

function click(el: Element | null | undefined) {
  act(() => {
    (el as HTMLElement).click();
  });
}

// The clickable row is a non-focusable `<span>` inside the `<li role="treeitem">`
// that owns the tab stop, so this returns the row and `treeItemByName` its
// treeitem — the element carrying `aria-selected`/`aria-level`/`tabindex`.
function rowByName(container: HTMLElement, name: string): HTMLElement {
  const found = [...container.querySelectorAll<HTMLElement>(".fa-media-tree-select")].find(
    (row) => row.querySelector(".fa-media-tree-name")?.textContent === name
  );
  if (!found) throw new Error(`no tree row named ${name}`);
  return found;
}

function treeItemByName(container: HTMLElement, name: string): HTMLLIElement {
  const item = rowByName(container, name).closest<HTMLLIElement>('li[role="treeitem"]');
  if (!item) throw new Error(`tree row ${name} is not inside a treeitem`);
  return item;
}

function toggleByName(container: HTMLElement, name: string): HTMLElement {
  const toggle = rowByName(container, name).querySelector<HTMLElement>(".fa-media-tree-toggle");
  if (!toggle) throw new Error(`tree row ${name} has no toggle`);
  return toggle;
}

function press(item: HTMLElement, key: string) {
  act(() => {
    item.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

async function openTree(container: HTMLElement) {
  const treeButton = [...container.querySelectorAll("button")].find((b) => b.textContent === "Tree");
  click(treeButton);
  await waitFor(() => {
    expect(container.querySelector('aside[aria-label="Media categories"]')).toBeTruthy();
  });
}

function lastListCall() {
  return apiMocks.listObjects.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

beforeEach(() => {
  document.body.innerHTML = "";
  for (const mock of Object.values(apiMocks)) mock.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("MediaLibrary", () => {
  it("opens upload from the top-right toolbar in a modal with the category selector", async () => {
    apiMocks.listObjects.mockResolvedValue(page([]));

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());

    const uploadButton = [...view.container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Upload media"
    );
    expect(uploadButton?.closest(".fa-media-toolbar-actions")).not.toBeNull();
    uploadButton?.focus();
    click(uploadButton);

    const dialog = view.container.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
    expect(dialog?.getAttribute("aria-labelledby")).toBe("fa-media-upload-dialog-title");
    expect(dialog?.querySelector('fieldset[aria-label="User categories"]')).not.toBeNull();
    expect(view.container.ownerDocument.activeElement?.getAttribute("aria-label")).toBe("Close upload dialog");

    // Pointer activity inside the popup must not dismiss it.
    act(() => {
      dialog?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await waitFor(() => expect(view.container.querySelector('[role="dialog"]')).toBeNull());
    expect(view.container.ownerDocument.activeElement).toBe(uploadButton);

    view.unmount();
  });

  it("supports the legacy initially-open route, refreshes after upload, and closes from button or backdrop", async () => {
    apiMocks.listObjects.mockResolvedValue(page([]));

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary initialUploadOpen />
      </QueryClientProvider>
    );
    await waitFor(() => expect(view.container.querySelector('[role="dialog"]')).not.toBeNull());

    click(view.container.querySelector('button[aria-label="Close upload dialog"]'));
    await waitFor(() => expect(view.container.querySelector('[role="dialog"]')).toBeNull());

    click([...view.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Upload media"));
    const backdrop = view.container.querySelector<HTMLElement>(".fa-media-dialog-backdrop");
    act(() => {
      backdrop?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    await waitFor(() => expect(view.container.querySelector('[role="dialog"]')).toBeNull());

    click([...view.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Upload media"));
    const listCallsBeforeUpload = apiMocks.listObjects.mock.calls.length;
    click([...view.container.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent === "Finish upload"));
    await waitFor(() => expect(view.container.querySelector('[role="dialog"]')).toBeNull());
    await waitFor(() => expect(apiMocks.listObjects.mock.calls.length).toBeGreaterThan(listCallsBeforeUpload));

    view.unmount();
  });

  it("switches between list, grid, and masonry views with image preview loading attributes", async () => {
    const items = [...Array.from({ length: 7 }, (_value, index) => makeObject(index + 1)), makeObject(8, "application/pdf")];
    apiMocks.listObjects.mockResolvedValue(page(items));
    apiMocks.getDownloadUrl.mockImplementation(async (objectId: string) => ({
      url: `https://cdn.test/${objectId}.png`,
      expires_at: NOW
    }));
    apiMocks.deleteObject.mockResolvedValue(undefined);

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary objectHref={(id) => `/media/object/${id}`} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(view.container.querySelector("table")).not.toBeNull();
      expect(view.container.querySelectorAll("img")).toHaveLength(7);
    });
    const listImages = view.container.querySelectorAll("img");
    expect(listImages[0]?.getAttribute("loading")).toBe("lazy");
    expect(listImages[0]?.getAttribute("fetchpriority")).toBe("low");
    expect(listImages[0]?.getAttribute("width")).toBe("128");
    expect(listImages[0]?.getAttribute("height")).toBe("128");
    expect(listImages[0]?.style.maxWidth).toBe("8rem");
    expect(screenPressed(view.container, "List")?.style.background).not.toBe("");
    expect(view.container.textContent).toContain("2.0 KB");
    expect(view.container.textContent).toContain("pdf");
    expect(view.container.querySelector(".fa-media-filter-row")).not.toBeNull();
    expect(view.container.querySelector<HTMLAnchorElement>('a[aria-label="View file-1.png"]')?.getAttribute("href")).toBe(
      "/media/object/11111111-1111-4111-8111-000000000001"
    );
    expect(apiMocks.getDownloadUrl).toHaveBeenCalledTimes(7);

    await act(async () => {
      view.container.querySelector<HTMLButtonElement>("tbody button.fa-media-danger")?.click();
    });
    await waitFor(() => {
      expect(apiMocks.deleteObject).toHaveBeenCalledWith("11111111-1111-4111-8111-000000000001");
    });

    await act(async () => {
      const statusSelect = view.container.querySelectorAll<HTMLSelectElement>("select").item(1);
      statusSelect.value = "ready";
      statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() => {
      expect(apiMocks.listObjects).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ready" }));
    });

    await act(async () => {
      view.container.querySelector<HTMLButtonElement>('button[aria-pressed="false"]')?.click();
    });
    await waitFor(() => {
      expect(view.container.querySelector(".fa-media-cards--grid")).not.toBeNull();
      expect(view.container.querySelectorAll("img")).toHaveLength(7);
    });
    const gridImages = view.container.querySelectorAll("img");
    expect(gridImages[0]?.getAttribute("loading")).toBe("eager");
    expect(gridImages[0]?.getAttribute("fetchpriority")).toBe("high");
    expect(gridImages[0]?.getAttribute("width")).toBeNull();
    expect(screenPressed(view.container, "Grid")?.style.background).not.toBe("");
    expect(view.container.textContent).toContain("2.0 KB");
    expect(view.container.querySelector<HTMLAnchorElement>('article a[aria-label="View file-1.png"]')).not.toBeNull();
    expect(gridImages[6]?.getAttribute("loading")).toBe("lazy");
    expect(gridImages[6]?.getAttribute("fetchpriority")).toBe("low");

    await act(async () => {
      Array.from(view.container.querySelectorAll("button")).find((button) => button.textContent === "Masonry")?.click();
    });
    await waitFor(() => {
      expect(view.container.querySelector(".fa-media-cards--masonry")).not.toBeNull();
      expect(view.container.querySelectorAll("img")).toHaveLength(7);
    });
    const masonryImages = view.container.querySelectorAll("img");
    expect(masonryImages[0]?.getAttribute("loading")).toBe("eager");
    expect(masonryImages[4]?.getAttribute("loading")).toBe("lazy");

    view.unmount();
  });

  it("renders four switcher options and Tree activates the two-pane layout", async () => {
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.getCategoryTree.mockResolvedValue({ data: [categoryNode(10, "Invoices")], count: 1 });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());

    const switcher = view.container.querySelector('[aria-label="Media library view"]');
    const options = [...(switcher?.querySelectorAll("button") ?? [])].map((button) => button.textContent);
    expect(options).toEqual(["List", "Grid", "Masonry", "Tree"]);
    // selecting Tree must not fetch the category tree before it is pressed
    expect(apiMocks.getCategoryTree).not.toHaveBeenCalled();

    await openTree(view.container);

    expect(apiMocks.getCategoryTree).toHaveBeenCalledTimes(1);
    expect(screenPressed(view.container, "Tree")).not.toBeNull();
    // two-pane layout: the category pane and the (reused) results table both render
    expect(view.container.querySelector(".fa-media-tree-layout")).not.toBeNull();
    expect(view.container.querySelector('aside[aria-label="Media categories"]')).not.toBeNull();
    expect(view.container.querySelectorAll("table.fa-media-table")).toHaveLength(1);
    expect(view.container.querySelector(".fa-media-tree-results table.fa-media-table")).not.toBeNull();

    view.unmount();
  });

  it("renders a scan-failed badge, separate from the status badge, for infected/quarantined objects", async () => {
    const items = [
      { ...makeObject(1), status: "ready" as const, scan_status: "infected" as const },
      { ...makeObject(2), status: "ready" as const, scan_status: "quarantined" as const },
      { ...makeObject(3), status: "ready" as const, scan_status: "clean" as const }
    ];
    apiMocks.listObjects.mockResolvedValue(page(items));
    apiMocks.getDownloadUrl.mockResolvedValue({ url: "https://cdn.test/x.png", expires_at: NOW });
    apiMocks.deleteObject.mockResolvedValue(undefined);

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary objectHref={(id) => `/media/object/${id}`} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(view.container.querySelectorAll("tbody tr")).toHaveLength(3);
    });

    const scanBadges = view.container.querySelectorAll(".fa-media-badge--scan-failed");
    expect(scanBadges).toHaveLength(2);
    expect(scanBadges[0]?.textContent).toBe("Failed virus scan");
    expect(scanBadges[0]?.getAttribute("title")).toBe("Failed virus scan (infected)");
    expect(scanBadges[1]?.getAttribute("title")).toBe("Failed virus scan (quarantined)");
    // the existing status badge (mapped from `status`, not `scan_status`) is untouched
    expect(view.container.querySelectorAll(".fa-media-badge--ready")).toHaveLength(3);

    view.unmount();
  });

  it("filters the list by the selected branch, by Uncategorized, and clears it on All", async () => {
    const tree = [categoryNode(10, "Invoices", [categoryNode(11, "2026")]), categoryNode(20, "Contracts")];
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.getCategoryTree.mockResolvedValue({ data: tree, count: 3 });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());
    await openTree(view.container);
    // every branch opens shut, so only the two pseudo-rows and the two roots
    // are on screen; `2026` has to be opened for before it can be clicked
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(4));
    click(toggleByName(view.container, "Invoices"));
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(5));
    const beforeBranch = apiMocks.listObjects.mock.calls.length;

    // a server node sends `category_id` + `include_descendants` — on a *new*
    // request, which is the half `useMediaObjects`' explicit memo list can drop
    // silently: params it does not hash never change the query key.
    click(rowByName(view.container, "Invoices"));
    await waitFor(() => {
      expect(apiMocks.listObjects.mock.calls.length).toBeGreaterThan(beforeBranch);
      expect(lastListCall()).toMatchObject({ category_id: 10, include_descendants: true });
    });
    expect(lastListCall().uncategorized).toBeUndefined();
    expect(treeItemByName(view.container, "Invoices").getAttribute("aria-selected")).toBe("true");

    // a nested child replaces the parent's selection rather than adding to it
    click(rowByName(view.container, "2026"));
    await waitFor(() => expect(lastListCall()).toMatchObject({ category_id: 11, include_descendants: true }));
    expect(treeItemByName(view.container, "Invoices").getAttribute("aria-selected")).toBe("false");

    // "Uncategorized" sends `uncategorized` with both branch keys cleared, not
    // left stale beside it
    click(rowByName(view.container, "Uncategorized"));
    await waitFor(() => expect(lastListCall().uncategorized).toBe(true));
    expect(lastListCall().category_id).toBeUndefined();
    expect(lastListCall().include_descendants).toBeUndefined();
    expect(treeItemByName(view.container, "Uncategorized").getAttribute("aria-selected")).toBe("true");

    // "All media" clears all three
    click(rowByName(view.container, "All media"));
    await waitFor(() => {
      const call = lastListCall();
      expect(call.category_id).toBeUndefined();
      expect(call.include_descendants).toBeUndefined();
      expect(call.uncategorized).toBeUndefined();
    });
    expect(treeItemByName(view.container, "All media").getAttribute("aria-selected")).toBe("true");

    // reselecting the branch the list already shows is not a new request
    click(rowByName(view.container, "Contracts"));
    await waitFor(() => expect(lastListCall()).toMatchObject({ category_id: 20, include_descendants: true }));
    const settled = apiMocks.listObjects.mock.calls.length;
    click(rowByName(view.container, "Contracts"));
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    });
    expect(apiMocks.listObjects.mock.calls).toHaveLength(settled);

    view.unmount();
  });

  it("opens the pane on a caller-supplied initial branch filter", async () => {
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.getCategoryTree.mockResolvedValue({ data: [categoryNode(20, "Contracts")], count: 1 });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary initial={{ category_id: 20, include_descendants: true }} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(lastListCall()).toMatchObject({ category_id: 20 }));
    await openTree(view.container);
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(3));

    expect(treeItemByName(view.container, "Contracts").getAttribute("aria-selected")).toBe("true");
    expect(treeItemByName(view.container, "All media").getAttribute("aria-selected")).toBe("false");

    view.unmount();
  });

  it("composes the toolbar filters with the tree branch selection in both directions", async () => {
    const tree = [categoryNode(10, "Invoices"), categoryNode(20, "Contracts")];
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.getCategoryTree.mockResolvedValue({ data: tree, count: 2 });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());
    await openTree(view.container);

    // toolbar filter set first, then a branch selected: the branch must not drop `q`.
    const search = view.container.querySelector<HTMLInputElement>('input[type="search"]');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(search, "invoice");
      search!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await waitFor(() => expect(lastListCall()).toMatchObject({ q: "invoice" }));

    click(rowByName(view.container, "Contracts"));
    await waitFor(() =>
      expect(lastListCall()).toMatchObject({ q: "invoice", category_id: 20, include_descendants: true })
    );

    // branch already selected, then a toolbar filter changed: the toolbar change must not
    // clear the branch selection.
    const status = view.container.querySelectorAll<HTMLSelectElement>("select")[1];
    await act(async () => {
      status.value = "ready";
      status.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await waitFor(() =>
      expect(lastListCall()).toMatchObject({
        q: "invoice",
        status: "ready",
        category_id: 20,
        include_descendants: true
      })
    );
    expect(treeItemByName(view.container, "Contracts").getAttribute("aria-selected")).toBe("true");

    view.unmount();
  });

  it("treats the tree view's preview loading like list: lazy/low for every image", async () => {
    const items = Array.from({ length: 8 }, (_value, index) => makeObject(index + 1));
    apiMocks.listObjects.mockResolvedValue(page(items));
    apiMocks.getCategoryTree.mockResolvedValue({ data: [], count: 0 });
    apiMocks.getDownloadUrl.mockImplementation(async (objectId: string) => ({
      url: `https://cdn.test/${objectId}.png`,
      expires_at: NOW
    }));

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());
    await openTree(view.container);

    await waitFor(() => {
      expect(view.container.querySelectorAll(".fa-media-tree-results img")).toHaveLength(8);
    });
    const treeImages = view.container.querySelectorAll(".fa-media-tree-results img");
    for (const img of treeImages) {
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("fetchpriority")).toBe("low");
    }

    view.unmount();
  });

  it("prompts to create a category when the tree is empty", async () => {
    apiMocks.listObjects.mockResolvedValue(page([]));
    apiMocks.getCategoryTree.mockResolvedValue({ data: [], count: 0 });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());
    await openTree(view.container);

    await waitFor(() => {
      expect(view.container.querySelector(".fa-media-tree-pane .fa-media-category-hint")?.textContent).toContain(
        "No user categories yet"
      );
    });
    // the pseudo-rows still render so "All media"/"Uncategorized" stay reachable
    expect(view.container.querySelector('li[role="treeitem"]')).not.toBeNull();

    view.unmount();
  });

  it("surfaces a tree load failure without breaking the list pane", async () => {
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.getCategoryTree.mockRejectedValue(new Error("boom"));

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());
    await openTree(view.container);

    await waitFor(() => {
      expect(view.container.querySelector('.fa-media-tree-pane [role="alert"]')?.textContent).toBe(
        "Failed to load categories"
      );
    });
    // the list pane keeps rendering the caller's objects despite the tree failure
    expect(view.container.querySelectorAll(".fa-media-tree-results tbody tr")).toHaveLength(1);

    view.unmount();
  });

  it("exposes the tree pane as a role=tree matching the shared tree-view a11y contract", async () => {
    const tree = [
      categoryNode(10, "Invoices", [categoryNode(11, "2025"), categoryNode(12, "2026")]),
      categoryNode(20, "Contracts")
    ];
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.getCategoryTree.mockResolvedValue({ data: tree, count: 4 });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());
    await openTree(view.container);
    // the pane opens with every branch shut: two pseudo-rows and two roots,
    // no `role="group"` at all, and the parent says so on `aria-expanded`
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(4));
    expect(view.container.querySelectorAll('ul[role="group"]')).toHaveLength(0);
    expect(treeItemByName(view.container, "Invoices").getAttribute("aria-expanded")).toBe("false");
    expect(view.container.querySelector('li[role="treeitem"] [id$="-label"]')?.textContent).toBe("All media");

    click(toggleByName(view.container, "Invoices"));
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(6));

    // the pane collapses above the list on narrow viewports and only becomes a
    // second column at `md`, with its own bounded, scrollable height so a deep
    // tree cannot push the results off the bottom of the screen
    const layout = view.container.querySelector<HTMLElement>(".fa-media-tree-layout");
    expect(layout?.className).toContain("flex-col");
    expect(layout?.className).toContain("md:flex-row");
    const pane = view.container.querySelector<HTMLElement>(".fa-media-tree-pane");
    expect(pane?.className).toContain("max-h-[50vh]");
    expect(pane?.className).toContain("md:w-64");
    // both axes scroll, and the list and its labels are what can outgrow the
    // pane horizontally — a truncating label could never widen it, so the
    // horizontal bar would have had nothing to reveal
    expect(pane?.className).toContain("overflow-auto");
    expect(pane?.className).not.toContain("overflow-y-auto");
    expect(view.container.querySelector('ul[role="tree"]')?.className).toContain("min-w-max");
    const invoicesLabel = view.container.ownerDocument.getElementById(
      (treeItemByName(view.container, "Invoices").getAttribute("aria-labelledby") ?? "").split(" ")[0] ?? ""
    );
    expect(invoicesLabel?.className).toContain("whitespace-nowrap");
    expect(invoicesLabel?.className).not.toContain("truncate");

    // roles: one tree, named by the pane heading, with a group per open branch
    const treeRoot = view.container.querySelector<HTMLElement>('ul[role="tree"]');
    expect(treeRoot).not.toBeNull();
    const heading = view.container.ownerDocument.getElementById(treeRoot?.getAttribute("aria-labelledby") ?? "");
    expect(heading?.textContent).toBe("Categories");
    expect(view.container.querySelectorAll('ul[role="group"]')).toHaveLength(1);

    // depth, expansion and selection state
    expect(treeItemByName(view.container, "Invoices").getAttribute("aria-level")).toBe("1");
    expect(treeItemByName(view.container, "2025").getAttribute("aria-level")).toBe("2");
    expect(treeItemByName(view.container, "Invoices").getAttribute("aria-expanded")).toBe("true");
    // leaves declare no expansion state at all, pseudo-rows included
    expect(treeItemByName(view.container, "2025").getAttribute("aria-expanded")).toBeNull();
    expect(treeItemByName(view.container, "All media").getAttribute("aria-expanded")).toBeNull();
    expect(treeItemByName(view.container, "All media").getAttribute("aria-selected")).toBe("true");
    expect(treeItemByName(view.container, "Invoices").getAttribute("aria-selected")).toBe("false");

    // the treeitem is named over its own label + count rather than by content,
    // which would drag the nested group into the accessible name
    const labelledBy = (treeItemByName(view.container, "Invoices").getAttribute("aria-labelledby") ?? "").split(" ");
    expect(labelledBy).toHaveLength(2);
    expect(labelledBy.map((id) => view.container.ownerDocument.getElementById(id)?.textContent)).toEqual([
      "Invoices",
      "5"
    ]);
    // a pseudo-row carries no count, so it is named by its label alone
    expect((treeItemByName(view.container, "All media").getAttribute("aria-labelledby") ?? "").split(" ")).toHaveLength(
      1
    );

    // roving tabindex: exactly one tab stop, on the selected row — and no
    // focusable descendant inside a treeitem to compete with it
    const tabbable = [...view.container.querySelectorAll('li[role="treeitem"]')].filter(
      (item) => item.getAttribute("tabindex") === "0"
    );
    expect(tabbable).toHaveLength(1);
    expect(tabbable.at(0)).toBe(treeItemByName(view.container, "All media"));
    expect(view.container.querySelectorAll(".fa-media-tree-pane button")).toHaveLength(0);

    // the focus ring is drawn on the row off the treeitem's :focus-visible, so
    // it does not wrap the whole subtree the <li> contains
    expect(rowByName(view.container, "Invoices").className).toContain("[li:focus-visible>&]:ring-3");

    // pointer toggling collapses a branch without selecting it
    click(toggleByName(view.container, "Invoices"));
    await waitFor(() => expect(view.container.querySelectorAll('ul[role="group"]')).toHaveLength(0));
    expect(treeItemByName(view.container, "Invoices").getAttribute("aria-expanded")).toBe("false");
    expect(treeItemByName(view.container, "Invoices").getAttribute("aria-selected")).toBe("false");
    expect(treeItemByName(view.container, "All media").getAttribute("aria-selected")).toBe("true");

    view.unmount();
  });

  it("navigates the tree pane by keyboard and selects the focused branch", async () => {
    const tree = [
      categoryNode(10, "Invoices", [categoryNode(11, "2025"), categoryNode(12, "2026")]),
      categoryNode(20, "Contracts")
    ];
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.getCategoryTree.mockResolvedValue({ data: tree, count: 4 });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());
    await openTree(view.container);
    // opened by pointer first: the pane's default is every branch shut, and the
    // walk below needs `Invoices` open to have anything to step into
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(4));
    click(toggleByName(view.container, "Invoices"));
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(6));

    const active = () => view.container.ownerDocument.activeElement;
    const all = treeItemByName(view.container, "All media");
    act(() => {
      all.focus();
    });

    // ArrowDown/ArrowUp walk the visible rows, pseudo-rows included
    press(all, "ArrowDown");
    expect(active()).toBe(treeItemByName(view.container, "Uncategorized"));
    press(treeItemByName(view.container, "Uncategorized"), "ArrowDown");
    expect(active()).toBe(treeItemByName(view.container, "Invoices"));
    // the single tab stop rides along with focus
    expect(treeItemByName(view.container, "Invoices").getAttribute("tabindex")).toBe("0");
    expect(treeItemByName(view.container, "All media").getAttribute("tabindex")).toBe("-1");

    // ArrowRight on an open branch steps into it; ArrowLeft on a leaf steps out
    press(treeItemByName(view.container, "Invoices"), "ArrowRight");
    expect(active()).toBe(treeItemByName(view.container, "2025"));
    press(treeItemByName(view.container, "2025"), "ArrowDown");
    expect(active()).toBe(treeItemByName(view.container, "2026"));
    press(treeItemByName(view.container, "2026"), "ArrowUp");
    expect(active()).toBe(treeItemByName(view.container, "2025"));
    press(treeItemByName(view.container, "2025"), "ArrowLeft");
    expect(active()).toBe(treeItemByName(view.container, "Invoices"));

    // ArrowLeft closes the open branch it is on, ArrowRight reopens it
    press(treeItemByName(view.container, "Invoices"), "ArrowLeft");
    await waitFor(() =>
      expect(treeItemByName(view.container, "Invoices").getAttribute("aria-expanded")).toBe("false")
    );
    expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(4);
    press(treeItemByName(view.container, "Invoices"), "ArrowRight");
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(6));

    // End/Home jump to the ends of the visible list; ArrowUp on the first row stays put
    press(treeItemByName(view.container, "Invoices"), "End");
    expect(active()).toBe(treeItemByName(view.container, "Contracts"));
    press(treeItemByName(view.container, "Contracts"), "Home");
    expect(active()).toBe(treeItemByName(view.container, "All media"));
    press(treeItemByName(view.container, "All media"), "ArrowUp");
    expect(active()).toBe(treeItemByName(view.container, "All media"));

    // Enter selects the focused branch and filters the list beside it
    press(treeItemByName(view.container, "Contracts"), "Enter");
    await waitFor(() => expect(lastListCall()).toMatchObject({ category_id: 20, include_descendants: true }));
    expect(treeItemByName(view.container, "Contracts").getAttribute("aria-selected")).toBe("true");
    expect(treeItemByName(view.container, "All media").getAttribute("aria-selected")).toBe("false");

    // Space selects too; an unhandled key is left to the page
    press(treeItemByName(view.container, "2026"), " ");
    await waitFor(() => expect(lastListCall()).toMatchObject({ category_id: 12, include_descendants: true }));
    const callsBefore = apiMocks.listObjects.mock.calls.length;
    press(treeItemByName(view.container, "2026"), "a");
    expect(apiMocks.listObjects.mock.calls).toHaveLength(callsBefore);

    // the pseudo-rows are reachable by keyboard as well, and clear the branch keys
    press(treeItemByName(view.container, "Uncategorized"), "Enter");
    await waitFor(() => expect(lastListCall()).toMatchObject({ uncategorized: true }));
    expect(lastListCall().category_id).toBeUndefined();
    expect(lastListCall().include_descendants).toBeUndefined();

    view.unmount();
  });

  it("Import/Export toggles a panel, starts an export and offers a manifest download", async () => {
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.startExport.mockResolvedValue({
      category_tree: [],
      objects: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          filename: "a.png",
          category: "asset",
          category_paths: [],
          visibility: "private",
          size_bytes: 10,
          sha256: null,
          mime_type: "image/png",
          status: "ready",
          scan_status: "clean",
          created_at: NOW,
          updated_at: NOW
        }
      ]
    });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary initial={{ q: "invoice" }} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());

    // closed by default
    expect(view.container.querySelector('[aria-label="Import and export media"]')).toBeNull();

    const toggle = [...view.container.querySelectorAll("button")].find((b) => b.textContent === "Import / Export");
    click(toggle);
    await waitFor(() => {
      expect(view.container.querySelector('[aria-label="Import and export media"]')).not.toBeNull();
    });
    expect(toggle?.getAttribute("aria-expanded")).toBe("true");

    const startExportButton = [...view.container.querySelectorAll("button")].find(
      (b) => b.textContent === "Start export"
    );
    click(startExportButton);
    await waitFor(() => {
      expect(apiMocks.startExport).toHaveBeenCalledWith("manifest", expect.objectContaining({ q: "invoice" }));
    });

    await waitFor(() => {
      expect(view.container.textContent).toContain("Download manifest (1 objects)");
    });

    // closing and reopening the panel does not re-fetch the list
    const before = apiMocks.listObjects.mock.calls.length;
    click(toggle);
    await waitFor(() => {
      expect(view.container.querySelector('[aria-label="Import and export media"]')).toBeNull();
    });
    expect(apiMocks.listObjects.mock.calls.length).toBe(before);

    view.unmount();
  });

  it("exports the selected tree branch with its category filter", async () => {
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.getCategoryTree.mockResolvedValue({ data: [categoryNode(10, "Invoices")], count: 1 });
    apiMocks.startExport.mockResolvedValue({ category_tree: [], objects: [] });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());
    await openTree(view.container);
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(3));

    click(rowByName(view.container, "Invoices"));
    await waitFor(() => expect(lastListCall()).toMatchObject({ category_id: 10, include_descendants: true }));

    const toggle = [...view.container.querySelectorAll("button")].find((button) => button.textContent === "Import / Export");
    click(toggle);
    await waitFor(() => {
      expect(view.container.textContent).toContain("Export scope: Selected branch (category 10)");
    });

    const startExportButton = [...view.container.querySelectorAll("button")].find(
      (button) => button.textContent === "Start export"
    );
    click(startExportButton);
    await waitFor(() => {
      expect(apiMocks.startExport).toHaveBeenCalledWith(
        "manifest",
        expect.objectContaining({ category_id: 10, include_descendants: true })
      );
    });

    view.unmount();
  });

  it("Import: starts an import from a picked file and renders the per-row report", async () => {
    apiMocks.listObjects.mockResolvedValue(page([makeObject(1)]));
    apiMocks.startImport.mockResolvedValue({
      format: "manifest",
      categories_created: 1,
      categories_reused: 0,
      created: 0,
      linked: 1,
      skipped: 0,
      failed: 1,
      objects: [
        {
          source_id: "33333333-3333-4333-8333-333333333333",
          filename: "linked.png",
          status: "linked",
          reason: null,
          message: null,
          media_object_id: "33333333-3333-4333-8333-333333333333",
          category_paths: ["docs"],
          scan_queued: false
        },
        {
          source_id: "44444444-4444-4444-8444-444444444444",
          filename: "bad.png",
          status: "failed",
          reason: "mime_mismatch",
          message: null,
          media_object_id: null,
          category_paths: [],
          scan_queued: false
        }
      ]
    });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());

    const toggle = [...view.container.querySelectorAll("button")].find((b) => b.textContent === "Import / Export");
    click(toggle);
    await waitFor(() => {
      expect(view.container.querySelector('[aria-label="Import and export media"]')).not.toBeNull();
    });

    const startImportButton = () =>
      [...view.container.querySelectorAll("button")].find((b) => b.textContent === "Start import") as HTMLButtonElement;
    expect(startImportButton().disabled).toBe(true);

    const fileInput = view.container.querySelector<HTMLInputElement>(
      '[aria-label="Import"] input[type="file"]'
    );
    const file = new File(["{}"], "manifest.json", { type: "application/json" });
    await act(async () => {
      Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
      fileInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(startImportButton().disabled).toBe(false);

    click(startImportButton());
    await waitFor(() => {
      expect(apiMocks.startImport).toHaveBeenCalledWith("manifest", file);
    });

    await waitFor(() => {
      expect(view.container.textContent).toContain("0 created, 1 linked, 0 skipped, 1 failed");
    });
    const rows = view.container.querySelectorAll(".fa-media-transfer-table tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("linked.png");
    expect(rows[0]?.textContent).toContain("linked");
    expect(rows[1]?.textContent).toContain("bad.png");
    expect(rows[1]?.textContent).toContain("This file type is not allowed for the selected category.");

    // re-fetches the list and category tree after a successful import
    await waitFor(() => {
      expect(apiMocks.listObjects.mock.calls.length).toBeGreaterThan(1);
    });

    view.unmount();
  });

  it("applies translated labels to the library, tree, transfer panel, import statuses, and upload form", async () => {
    apiMocks.listObjects.mockResolvedValue(page([]));
    apiMocks.getCategoryTree.mockResolvedValue({ data: [], count: 0 });
    apiMocks.startImport.mockResolvedValue({
      format: "manifest",
      categories_created: 0,
      categories_reused: 0,
      created: 1,
      linked: 0,
      skipped: 0,
      failed: 0,
      objects: [{
        source_id: "33333333-3333-4333-8333-333333333333",
        filename: "creado.png",
        status: "created",
        reason: null,
        message: null,
        media_object_id: "33333333-3333-4333-8333-333333333333",
        category_paths: [],
        scan_queued: false
      }]
    });

    const view = render(
      <QueryClientProvider client={createClient()}>
        <MediaLibrary labels={{
          title: "Biblioteca multimedia",
          viewLabel: "Vista de la biblioteca",
          views: { list: "Lista", grid: "Cuadrícula", masonry: "Mosaico", tree: "Árbol" },
          importExport: "Importar / Exportar",
          uploadMedia: "Subir archivo",
          searchPlaceholder: "Buscar por nombre",
          searchLabel: "Buscar medios",
          tree: {
            regionLabel: "Categorías multimedia",
            title: "Categorías",
            empty: "Todavía no hay categorías.",
            allMedia: "Todos los medios",
            uncategorized: "Sin categoría"
          },
          transfer: {
            regionLabel: "Importar y exportar medios",
            exportTitle: "Exportar",
            importTitle: "Importar",
            startExport: "Iniciar exportación",
            startImport: "Iniciar importación",
            chooseFile: "Elegir archivo",
            report: (created, linked, skipped, failed) =>
              `${created} creados, ${linked} vinculados, ${skipped} omitidos, ${failed} fallidos`,
            importStatuses: { created: "Creado", linked: "Vinculado", skipped: "Omitido", failed: "Fallido" }
          },
          upload: { title: "Subir archivo", closeLabel: "Cerrar carga", form: { category: "Categorías de usuario" } }
        }} />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiMocks.listObjects).toHaveBeenCalled());

    expect(view.container.querySelector('input[aria-label="Buscar medios"]')?.getAttribute("placeholder")).toBe(
      "Buscar por nombre"
    );
    expect(view.container.querySelector('[aria-label="Vista de la biblioteca"]')?.textContent).toContain("Árbol");

    click([...view.container.querySelectorAll("button")].find((button) => button.textContent === "Árbol"));
    await waitFor(() => expect(view.container.querySelector('[aria-label="Categorías multimedia"]')).not.toBeNull());
    expect(view.container.textContent).toContain("Todos los medios");

    click([...view.container.querySelectorAll("button")].find((button) => button.textContent === "Importar / Exportar"));
    await waitFor(() => expect(view.container.querySelector('[aria-label="Importar y exportar medios"]')).not.toBeNull());
    expect(view.container.textContent).toContain("Iniciar exportación");
    expect(view.container.textContent).toContain("Elegir archivo");

    const importFile = view.container.querySelector<HTMLInputElement>('[aria-label="Importar"] input[type="file"]');
    const file = new File(["{}"], "manifest.json", { type: "application/json" });
    await act(async () => {
      Object.defineProperty(importFile, "files", { value: [file], configurable: true });
      importFile?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    click([...view.container.querySelectorAll("button")].find((button) => button.textContent === "Iniciar importación"));
    await waitFor(() => expect(view.container.textContent).toContain("1 creados, 0 vinculados, 0 omitidos, 0 fallidos"));
    expect(view.container.querySelector(".fa-media-transfer-table tbody tr")?.textContent).toContain("Creado");

    click([...view.container.querySelectorAll("button")].find((button) => button.textContent === "Subir archivo"));
    await waitFor(() => expect(view.container.querySelector('[role="dialog"]')).not.toBeNull());
    expect(view.container.querySelector('[role="dialog"]')?.textContent).toContain("Subir archivo");
    expect(view.container.querySelector('fieldset[aria-label="Categorías de usuario"]')).not.toBeNull();

    view.unmount();
  });
});

function screenPressed(container: HTMLElement, name: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent === name && button.getAttribute("aria-pressed") === "true",
  ) ?? null;
}

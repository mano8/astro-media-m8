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
  deleteCategory: vi.fn()
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
    await waitFor(() => expect(view.container.querySelectorAll('li[role="treeitem"]')).toHaveLength(6));

    // the pane collapses above the list on narrow viewports and only becomes a
    // second column at `md`, with its own bounded, scrollable height so a deep
    // tree cannot push the results off the bottom of the screen
    const layout = view.container.querySelector<HTMLElement>(".fa-media-tree-layout");
    expect(layout?.className).toContain("flex-col");
    expect(layout?.className).toContain("md:flex-row");
    const pane = view.container.querySelector<HTMLElement>(".fa-media-tree-pane");
    expect(pane?.className).toContain("max-h-[50vh]");
    expect(pane?.className).toContain("overflow-y-auto");
    expect(pane?.className).toContain("md:w-64");

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
});

function screenPressed(container: HTMLElement, name: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent === name && button.getAttribute("aria-pressed") === "true",
  ) ?? null;
}

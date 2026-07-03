// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaObjectPublic, ObjectListResponse } from "../src/runtime/schemas.js";

const apiMocks = vi.hoisted(() => ({
  deleteObject: vi.fn(),
  getDownloadUrl: vi.fn(),
  listObjects: vi.fn(),
  resolveShare: vi.fn()
}));

vi.mock("../src/runtime/api/objects.js", () => ({
  deleteObject: apiMocks.deleteObject,
  getDownloadUrl: apiMocks.getDownloadUrl,
  listObjects: apiMocks.listObjects
}));

vi.mock("../src/runtime/api/shares.js", () => ({
  resolveShare: apiMocks.resolveShare
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
});

function screenPressed(container: HTMLElement, name: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent === name && button.getAttribute("aria-pressed") === "true",
  ) ?? null;
}

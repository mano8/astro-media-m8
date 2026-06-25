// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaObjectPublic, ObjectListResponse } from "../src/runtime/schemas.js";

const listObjectsMock = vi.hoisted(() => vi.fn());

vi.mock("../src/runtime/api/objects.js", () => ({
  listObjects: listObjectsMock
}));

import { useMediaObjects, type UseMediaObjects } from "../src/runtime/hooks/useMediaObjects.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeObject(id: string, filename: string): MediaObjectPublic {
  return {
    id,
    tenant_id: null,
    owner_user_id: "11111111-1111-4111-8111-111111111111",
    category: "asset",
    visibility: "private",
    storage_bucket: "media",
    object_key: `objects/${filename}`,
    original_filename: filename,
    mime_type: "image/png",
    extension: "png",
    size_bytes: 1,
    sha256: null,
    etag: null,
    storage_class: "standard",
    status: "ready",
    scan_status: "clean",
    moderation_status: "approved",
    created_at: "2026-06-25T00:00:00Z",
    updated_at: "2026-06-25T00:00:00Z",
    deleted_at: null
  };
}

function page(items: MediaObjectPublic[], nextCursor: string | null, count: number): ObjectListResponse {
  return { items, next_cursor: nextCursor, count };
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 20; attempt += 1) {
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

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

beforeEach(() => {
  document.body.innerHTML = "";
  listObjectsMock.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useMediaObjects", () => {
  it("loads cursor-backed pages through useInfiniteQuery while preserving compatibility fields", async () => {
    const firstObject = makeObject("11111111-1111-4111-8111-111111111101", "first.png");
    const secondObject = makeObject("11111111-1111-4111-8111-111111111102", "second.png");
    const refreshedObject = makeObject("11111111-1111-4111-8111-111111111103", "refreshed.png");
    let latest: UseMediaObjects | undefined;

    listObjectsMock
      .mockResolvedValueOnce(page([firstObject], "cursor-2", 2))
      .mockResolvedValueOnce(page([secondObject], null, 2))
      .mockResolvedValueOnce(page([refreshedObject], null, 1));

    function Probe() {
      latest = useMediaObjects({ category: "asset", limit: 1, cursor: "ignored-caller-cursor" });
      return null;
    }

    const view = render(
      <QueryClientProvider client={createClient()}>
        <Probe />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(listObjectsMock).toHaveBeenNthCalledWith(1, { category: "asset", limit: 1, cursor: undefined });
      expect(latest?.items).toEqual([firstObject]);
      expect(latest?.count).toBe(2);
      expect(latest?.error).toBeNull();
      expect(latest?.hasMore).toBe(true);
    });

    await act(async () => {
      await latest?.loadMore();
    });
    await waitFor(() => {
      expect(listObjectsMock).toHaveBeenNthCalledWith(2, { category: "asset", limit: 1, cursor: "cursor-2" });
      expect(latest?.items).toEqual([firstObject, secondObject]);
      expect(latest?.count).toBe(2);
      expect(latest?.hasMore).toBe(false);
    });

    await act(async () => {
      await latest?.refresh();
    });
    await waitFor(() => {
      expect(listObjectsMock).toHaveBeenNthCalledWith(3, { category: "asset", limit: 1, cursor: undefined });
      expect(latest?.items).toEqual([refreshedObject]);
      expect(latest?.count).toBe(1);
      expect(latest?.hasMore).toBe(false);
    });
    view.unmount();
  });

  it("exposes rejected requests through the legacy error field", async () => {
    const failure = new Error("list failed");
    let latest: UseMediaObjects | undefined;
    listObjectsMock.mockRejectedValueOnce(failure);

    function Probe() {
      latest = useMediaObjects();
      return null;
    }

    const view = render(
      <QueryClientProvider client={createClient()}>
        <Probe />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(latest?.items).toEqual([]);
      expect(latest?.count).toBe(0);
      expect(latest?.error).toBe(failure);
      expect(latest?.hasMore).toBe(false);
    });
    view.unmount();
  });
});

// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaObjectPublic } from "../src/runtime/schemas.js";
import type { UploadProgress } from "../src/runtime/upload/uploadController.js";

type ProgressListener = (progress: UploadProgress) => void;

const controllerMock = vi.hoisted(() => ({
  abort: vi.fn(),
  listeners: [] as ProgressListener[],
  start: vi.fn()
}));

vi.mock("../src/runtime/upload/uploadController.js", () => ({
  createMediaUploadController: vi.fn(() => ({
    abort: controllerMock.abort,
    on: (_event: "progress", listener: ProgressListener) => {
      controllerMock.listeners.push(listener);
      return () => {
        controllerMock.listeners = controllerMock.listeners.filter((current) => current !== listener);
      };
    },
    start: controllerMock.start
  }))
}));

import { useMediaUpload, type UseMediaUpload } from "../src/runtime/hooks/useMediaUpload.js";
import { mediaKeys } from "../src/runtime/queryKeys.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OBJECT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-06-25T00:00:00Z";

function makeObject(): MediaObjectPublic {
  return {
    id: OBJECT_ID,
    tenant_id: null,
    owner_user_id: "22222222-2222-4222-8222-222222222222",
    category: "asset",
    visibility: "private",
    storage_bucket: "media",
    object_key: "objects/photo.png",
    original_filename: "photo.png",
    mime_type: "image/png",
    extension: "png",
    size_bytes: 4,
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

function makeInput() {
  return {
    file: Object.assign(new Blob(["data"], { type: "image/png" }), { name: "photo.png" }),
    category: "asset" as const,
    visibility: "private" as const
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

beforeEach(() => {
  document.body.innerHTML = "";
  controllerMock.abort.mockReset();
  controllerMock.listeners = [];
  controllerMock.start.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useMediaUpload", () => {
  it("keeps progress local and invalidates object lists only after upload completion", async () => {
    const object = makeObject();
    const client = createClient();
    let latest: UseMediaUpload | undefined;
    let finishUpload: ((value: MediaObjectPublic) => void) | undefined;
    controllerMock.start.mockReturnValue(
      new Promise<MediaObjectPublic>((resolve) => {
        finishUpload = resolve;
      })
    );
    client.setQueryData(mediaKeys.objects({ category: "asset" }), { items: [], next_cursor: null, count: 0 });

    function Probe() {
      latest = useMediaUpload();
      return null;
    }

    const view = render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    );

    let uploadPromise: Promise<MediaObjectPublic> | undefined;
    await act(async () => {
      uploadPromise = latest?.upload(makeInput());
    });
    await waitFor(() => {
      expect(latest?.busy).toBe(true);
      expect(latest?.error).toBeNull();
    });

    act(() => {
      controllerMock.listeners[0]?.({
        state: "uploading",
        loaded: 2,
        total: 4,
        fraction: 0.5
      });
    });
    expect(latest?.progress?.fraction).toBe(0.5);
    expect(client.getQueryState(mediaKeys.objects({ category: "asset" }))?.isInvalidated).toBe(false);

    await act(async () => {
      finishUpload?.(object);
      await uploadPromise;
    });
    await waitFor(() => {
      expect(latest?.busy).toBe(false);
      expect(client.getQueryState(mediaKeys.objects({ category: "asset" }))?.isInvalidated).toBe(true);
    });
    view.unmount();
  });

  it("does not invalidate object lists when upload fails", async () => {
    const client = createClient();
    const failure = new Error("storage failed");
    let latest: UseMediaUpload | undefined;
    controllerMock.start.mockRejectedValueOnce(failure);
    client.setQueryData(mediaKeys.objects({ category: "asset" }), { items: [], next_cursor: null, count: 0 });

    function Probe() {
      latest = useMediaUpload();
      return null;
    }

    const view = render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>
    );

    await act(async () => {
      await expect(latest?.upload(makeInput())).rejects.toBe(failure);
    });
    expect(latest?.error).toBe(failure);
    expect(latest?.busy).toBe(false);
    expect(client.getQueryState(mediaKeys.objects({ category: "asset" }))?.isInvalidated).toBe(false);
    view.unmount();
  });

  it("forwards abort to the active controller", async () => {
    let latest: UseMediaUpload | undefined;
    controllerMock.start.mockReturnValue(new Promise<MediaObjectPublic>(() => {}));

    function Probe() {
      latest = useMediaUpload();
      return null;
    }

    const view = render(
      <QueryClientProvider client={createClient()}>
        <Probe />
      </QueryClientProvider>
    );

    await act(async () => {
      void latest?.upload(makeInput());
    });
    act(() => {
      latest?.abort();
    });
    expect(controllerMock.abort).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});

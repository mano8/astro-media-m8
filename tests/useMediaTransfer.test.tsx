// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  startExport: vi.fn(),
  getExportJob: vi.fn(),
  startImport: vi.fn()
}));

vi.mock("../src/runtime/api/transfer.js", () => ({
  startExport: apiMocks.startExport,
  getExportJob: apiMocks.getExportJob,
  startImport: apiMocks.startImport
}));

import { useMediaTransfer, type UseMediaTransfer } from "../src/runtime/hooks/useMediaTransfer.js";
import type { ExportJobPublic, ExportManifest, ImportReport } from "../src/runtime/schemas.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

async function waitFor(assertion: () => void) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
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

const MANIFEST: ExportManifest = {
  category_tree: [],
  objects: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      filename: "a.png",
      category: "asset",
      category_paths: [],
      visibility: "private",
      size_bytes: 10,
      sha256: null,
      mime_type: "image/png",
      status: "ready",
      scan_status: "clean",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z"
    }
  ]
};

function makeJob(status: ExportJobPublic["status"], overrides: Partial<ExportJobPublic> = {}): ExportJobPublic {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    status,
    object_count: 1,
    total_size_bytes: 10,
    size_bytes: null,
    expires_at: null,
    error: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    download_url: null,
    ...overrides
  };
}

const IMPORT_REPORT: ImportReport = {
  format: "manifest",
  categories_created: 1,
  categories_reused: 0,
  created: 0,
  linked: 1,
  skipped: 0,
  failed: 0,
  objects: [
    {
      source_id: "11111111-1111-4111-8111-111111111111",
      filename: "a.png",
      status: "linked",
      reason: null,
      message: null,
      media_object_id: "11111111-1111-4111-8111-111111111111",
      category_paths: ["docs"],
      scan_queued: false
    }
  ]
};

beforeEach(() => {
  document.body.innerHTML = "";
  for (const mock of Object.values(apiMocks)) mock.mockReset();
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn()
  });
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function Probe({ onReady }: { onReady: (value: UseMediaTransfer) => void }) {
  const value = useMediaTransfer();
  onReady(value);
  return null;
}

function renderHook(client: QueryClient) {
  let latest: UseMediaTransfer | undefined;
  const view = render(
    <QueryClientProvider client={client}>
      <Probe
        onReady={(value) => {
          latest = value;
        }}
      />
    </QueryClientProvider>
  );
  return {
    get: () => latest as UseMediaTransfer,
    unmount: view.unmount
  };
}

describe("useMediaTransfer", () => {
  it("manifest export resolves inline and downloadManifest saves it as a file", async () => {
    apiMocks.startExport.mockResolvedValueOnce(MANIFEST);
    const client = createClient();
    const probe = renderHook(client);

    await act(async () => {
      await probe.get().startExport("manifest", { category: "asset" });
    });

    expect(apiMocks.startExport).toHaveBeenCalledWith("manifest", { category: "asset" });
    await waitFor(() => {
      expect(probe.get().manifest).toEqual(MANIFEST);
      expect(probe.get().exportJob).toBeNull();
      expect(probe.get().exportPending).toBe(false);
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    probe.get().downloadManifest("export.json");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    clickSpy.mockRestore();

    probe.unmount();
  });

  it("archive export polls the job until it leaves queued/processing", async () => {
    vi.useFakeTimers();
    try {
      apiMocks.startExport.mockResolvedValueOnce(makeJob("queued"));
      apiMocks.getExportJob
        .mockResolvedValueOnce(makeJob("processing"))
        .mockResolvedValueOnce(makeJob("completed", { download_url: "https://example.test/archive.zip" }));
      const client = createClient();
      const probe = renderHook(client);

      await act(async () => {
        await probe.get().startExport("archive");
      });
      expect(probe.get().exportJob?.status).toBe("queued");
      expect(probe.get().exportPending).toBe(true);

      // First poll tick: queued -> processing.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(probe.get().exportJob?.status).toBe("processing");
      expect(probe.get().exportPending).toBe(true);

      // Second poll tick: processing -> completed, which stops refetching.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(probe.get().exportJob?.status).toBe("completed");
      expect(probe.get().exportJob?.download_url).toBe("https://example.test/archive.zip");
      expect(probe.get().exportPending).toBe(false);
      expect(apiMocks.getExportJob).toHaveBeenCalledTimes(2);
      expect(apiMocks.getExportJob).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");

      probe.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it("resetExport clears the manifest, job and mutation state", async () => {
    apiMocks.startExport.mockResolvedValueOnce(MANIFEST);
    const client = createClient();
    const probe = renderHook(client);

    await act(async () => {
      await probe.get().startExport("manifest");
    });
    await waitFor(() => {
      expect(probe.get().manifest).toEqual(MANIFEST);
    });

    act(() => {
      probe.get().resetExport();
    });
    await waitFor(() => {
      expect(probe.get().manifest).toBeNull();
      expect(probe.get().exportFormat).toBeNull();
    });

    probe.unmount();
  });

  it("startImport reports per-row results and invalidates object + category caches", async () => {
    apiMocks.startImport.mockResolvedValueOnce(IMPORT_REPORT);
    const client = createClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const probe = renderHook(client);

    const file = new File(["{}"], "manifest.json", { type: "application/json" });
    let report: ImportReport | undefined;
    await act(async () => {
      report = await probe.get().startImport("manifest", file);
    });

    expect(apiMocks.startImport).toHaveBeenCalledWith("manifest", file);
    expect(report).toEqual(IMPORT_REPORT);
    await waitFor(() => {
      expect(probe.get().importReport).toEqual(IMPORT_REPORT);
      expect(probe.get().importPending).toBe(false);
    });
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["media", "objects"] })
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["media", "categories", "tree"], exact: true })
    );

    act(() => {
      probe.get().resetImport();
    });
    await waitFor(() => {
      expect(probe.get().importReport).toBeNull();
    });

    probe.unmount();
  });

  it("surfaces an import failure via importError without throwing out of the hook", async () => {
    const failure = new Error("import failed");
    apiMocks.startImport.mockRejectedValueOnce(failure);
    const client = createClient();
    const probe = renderHook(client);

    const file = new File(["{}"], "manifest.json", { type: "application/json" });
    await act(async () => {
      await expect(probe.get().startImport("manifest", file)).rejects.toBe(failure);
    });

    await waitFor(() => {
      expect(probe.get().importError).toBe(failure);
    });

    probe.unmount();
  });
});

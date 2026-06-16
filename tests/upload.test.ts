import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initiateUpload = vi.hoisted(() => vi.fn());
const completeUpload = vi.hoisted(() => vi.fn());
const abortUpload = vi.hoisted(() => vi.fn());
const getObject = vi.hoisted(() => vi.fn());

vi.mock("../src/runtime/api/uploads.js", () => ({ initiateUpload, completeUpload, abortUpload }));
vi.mock("../src/runtime/api/objects.js", () => ({ getObject }));

import {
  createMediaUploadController,
  putToStorage,
  sha256Hex,
  UploadError
} from "../src/runtime/upload/uploadController.js";
import { ApiError } from "../src/runtime/errors.js";
import { configureMedia, resetMediaConfig } from "../src/runtime/config.js";

const uuid = "11111111-1111-1111-1111-111111111111";
const presigned = {
  session_id: "sess1",
  upload_url: "https://storage.test/bucket",
  upload_fields: { key: "objects/x", policy: "p" },
  expires_at: "2026-06-16T00:00:00Z"
};

function mediaObject(overrides: Record<string, unknown> = {}) {
  return {
    id: uuid,
    status: "ready",
    scan_status: "clean",
    moderation_status: "approved",
    ...overrides
  };
}

// A scriptable fake XMLHttpRequest.
let xhrBehavior: (xhr: FakeXHR) => void;
class FakeXHR {
  upload: { onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
    onprogress: null
  };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  body: unknown;
  open(): void {}
  send(body: unknown): void {
    this.body = body;
    setTimeout(() => xhrBehavior(this), 0);
  }
  abort(): void {
    this.onabort?.();
  }
}

beforeEach(() => {
  resetMediaConfig();
  initiateUpload.mockReset().mockResolvedValue(presigned);
  completeUpload.mockReset().mockResolvedValue({ media_object: mediaObject() });
  abortUpload.mockReset().mockResolvedValue(undefined);
  getObject.mockReset().mockResolvedValue(mediaObject());
  xhrBehavior = (xhr) => {
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 });
    xhr.status = 204;
    xhr.onload?.();
  };
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sha256Hex", () => {
  it("hashes bytes when subtle crypto is available", async () => {
    const hex = await sha256Hex(new Blob(["data"]));
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns null without subtle crypto", async () => {
    vi.stubGlobal("crypto", {});
    expect(await sha256Hex(new Blob(["data"]))).toBeNull();
  });
});

describe("putToStorage", () => {
  it("posts the presigned fields and file via XHR", async () => {
    await putToStorage(presigned, new Blob(["data"]));
    // no throw == success
  });

  it("ignores progress events that are not length-computable", async () => {
    const onProgress = vi.fn();
    xhrBehavior = (xhr) => {
      xhr.upload.onprogress?.({ lengthComputable: false, loaded: 0, total: 0 });
      xhr.status = 200;
      xhr.onload?.();
    };
    await putToStorage(presigned, new Blob(["data"]), { onProgress });
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("rejects on a non-2xx XHR status", async () => {
    xhrBehavior = (xhr) => {
      xhr.status = 403;
      xhr.onload?.();
    };
    await expect(putToStorage(presigned, new Blob(["data"]))).rejects.toMatchObject({ kind: "storage" });
  });

  it("rejects on an XHR network error", async () => {
    xhrBehavior = (xhr) => xhr.onerror?.();
    await expect(putToStorage(presigned, new Blob(["data"]))).rejects.toMatchObject({ kind: "storage" });
  });

  it("aborts immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    xhrBehavior = () => {};
    await expect(putToStorage(presigned, new Blob(["data"]), { signal: controller.signal })).rejects.toMatchObject({
      kind: "abort"
    });
  });

  it("aborts when the signal fires mid-flight", async () => {
    const controller = new AbortController();
    xhrBehavior = () => {};
    const promise = putToStorage(presigned, new Blob(["data"]), { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ kind: "abort" });
  });

  it("falls back to fetch when XHR is unavailable", async () => {
    vi.stubGlobal("XMLHttpRequest", undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await putToStorage(presigned, new Blob(["data"]));
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(FormData);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(putToStorage(presigned, new Blob(["data"]))).rejects.toMatchObject({ kind: "storage" });
  });
});

describe("MediaUploadController", () => {
  const baseInput = () => ({
    file: new Blob(["data"], { type: "image/png" }) as Blob & { name?: string },
    category: "asset" as const,
    visibility: "private" as const,
    filename: "photo.png"
  });

  it("runs initiate -> storage -> complete and emits progress", async () => {
    const controller = createMediaUploadController(baseInput());
    const states: string[] = [];
    const unsubscribe = controller.on("progress", (p) => states.push(p.state));
    const object = await controller.start();
    expect(object.id).toBe(uuid);
    expect(controller.state).toBe("ready");
    expect(states).toContain("initiating");
    expect(states).toContain("uploading");
    expect(states).toContain("ready");
    unsubscribe();
    expect(completeUpload).toHaveBeenCalledWith("sess1", {});
  });

  it("emits a null fraction when the size is unknown", async () => {
    const controller = createMediaUploadController({
      file: new Blob([], { type: "image/png" }) as Blob & { name?: string },
      category: "asset",
      visibility: "private",
      filename: "empty.png"
    });
    const fractions: (number | null)[] = [];
    controller.on("progress", (p) => fractions.push(p.fraction));
    await controller.start();
    expect(fractions).toContain(null);
  });

  it("derives filename and mime from the blob and sends a checksum", async () => {
    const file = Object.assign(new Blob(["data"], { type: "image/jpeg" }), { name: "from-blob.jpg" });
    const controller = createMediaUploadController({ file, category: "asset", visibility: "private", checksum: "sha256" });
    await controller.start();
    expect(initiateUpload).toHaveBeenCalledWith(
      expect.objectContaining({ original_filename: "from-blob.jpg", mime_type: "image/jpeg" })
    );
    expect(completeUpload.mock.calls[0][1].sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("completes without a checksum when subtle crypto is missing", async () => {
    vi.stubGlobal("crypto", {});
    const controller = createMediaUploadController({ ...baseInput(), checksum: "sha256" });
    await controller.start();
    expect(completeUpload).toHaveBeenCalledWith("sess1", {});
  });

  it("requires a filename and a mime type", async () => {
    const noName = createMediaUploadController({
      file: new Blob(["data"], { type: "image/png" }),
      category: "asset",
      visibility: "private"
    });
    await expect(noName.start()).rejects.toMatchObject({ kind: "api", message: /filename/ });

    const noMime = createMediaUploadController({
      file: new Blob(["data"]),
      category: "asset",
      visibility: "private",
      filename: "x.bin"
    });
    await expect(noMime.start()).rejects.toMatchObject({ kind: "api", message: /MIME/ });
  });

  it("fails when initiate fails", async () => {
    initiateUpload.mockRejectedValueOnce(new Error("nope"));
    const controller = createMediaUploadController(baseInput());
    await expect(controller.start()).rejects.toMatchObject({ kind: "api", message: /initiate/ });
    expect(controller.state).toBe("failed");
  });

  it("aborts the session and rethrows on a storage failure", async () => {
    xhrBehavior = (xhr) => {
      xhr.status = 500;
      xhr.onload?.();
    };
    const controller = createMediaUploadController(baseInput());
    await expect(controller.start()).rejects.toMatchObject({ kind: "storage" });
    expect(abortUpload).toHaveBeenCalledWith("sess1");
    expect(controller.state).toBe("failed");
  });

  it("wraps a non-UploadError storage rejection", async () => {
    vi.stubGlobal("XMLHttpRequest", undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const controller = createMediaUploadController(baseInput());
    await expect(controller.start()).rejects.toMatchObject({ kind: "storage", message: /Storage upload failed/ });
  });

  it("reports an aborted upload", async () => {
    xhrBehavior = () => {};
    const controller = createMediaUploadController(baseInput());
    const promise = controller.start();
    controller.abort();
    await expect(promise).rejects.toMatchObject({ kind: "abort" });
    expect(controller.state).toBe("aborted");
  });

  it("swallows an ApiError from the cleanup abort", async () => {
    xhrBehavior = (xhr) => {
      xhr.status = 500;
      xhr.onload?.();
    };
    abortUpload.mockRejectedValueOnce(new ApiError(404, "gone"));
    const controller = createMediaUploadController(baseInput());
    await expect(controller.start()).rejects.toMatchObject({ kind: "storage" });
  });

  it("rethrows a non-ApiError from the cleanup abort", async () => {
    xhrBehavior = (xhr) => {
      xhr.status = 500;
      xhr.onload?.();
    };
    abortUpload.mockRejectedValueOnce(new Error("network down"));
    const controller = createMediaUploadController(baseInput());
    await expect(controller.start()).rejects.toThrow("network down");
  });

  it("fails when complete fails", async () => {
    completeUpload.mockRejectedValueOnce(new Error("bad"));
    const controller = createMediaUploadController(baseInput());
    await expect(controller.start()).rejects.toMatchObject({ kind: "api", message: /complete/ });
  });

  it("polls until the object is scanned and ready", async () => {
    getObject
      .mockResolvedValueOnce(mediaObject({ status: "processing", scan_status: "pending" }))
      .mockResolvedValueOnce(mediaObject({ status: "ready", scan_status: "clean" }));
    configureMedia({ polling: { uploadScanMs: 0 } });
    const controller = createMediaUploadController({ ...baseInput(), waitForScan: true });
    const object = await controller.start();
    expect(object.scan_status).toBe("clean");
    expect(getObject).toHaveBeenCalledTimes(2);
  });

  it("rejects when the scan quarantines the object", async () => {
    getObject.mockResolvedValue(mediaObject({ status: "processing", scan_status: "quarantined" }));
    const controller = createMediaUploadController({ ...baseInput(), waitForScan: true });
    await expect(controller.start()).rejects.toMatchObject({ kind: "scan" });
  });

  it("times out waiting for the scan", async () => {
    getObject.mockResolvedValue(mediaObject({ status: "processing", scan_status: "pending" }));
    const controller = createMediaUploadController({
      ...baseInput(),
      waitForScan: true,
      scanTimeoutMs: 0,
      scanIntervalMs: 5
    });
    await expect(controller.start()).rejects.toMatchObject({ kind: "scan", message: /Timed out/ });
  });

  it("aborts during scan polling", async () => {
    const controller = createMediaUploadController({
      ...baseInput(),
      waitForScan: true,
      scanIntervalMs: 1,
      scanTimeoutMs: 10000
    });
    getObject.mockImplementation(async () => {
      controller.abort();
      return mediaObject({ status: "processing", scan_status: "pending" });
    });
    await expect(controller.start()).rejects.toMatchObject({ kind: "abort" });
  });
});

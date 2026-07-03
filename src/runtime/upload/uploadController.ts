import { abortUpload, completeUpload, initiateUpload } from "../api/uploads.js";
import { getObject } from "../api/objects.js";
import { getMediaConfig } from "../config.js";
import { ApiError } from "../errors.js";
import type {
  MediaCategory,
  MediaObjectPublic,
  MediaVisibility,
  UploadInitiateResponse
} from "../schemas.js";

export type UploadState =
  | "idle"
  | "initiating"
  | "uploading"
  | "completing"
  | "scanning"
  | "ready"
  | "failed"
  | "aborted";

export type UploadErrorKind = "api" | "storage" | "scan" | "abort";

export class UploadError extends Error {
  readonly kind: UploadErrorKind;
  readonly cause?: unknown;

  constructor(kind: UploadErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = "UploadError";
    this.kind = kind;
    this.cause = cause;
  }
}

export type UploadProgress = {
  state: UploadState;
  loaded: number;
  total: number;
  /** 0..1, or null when the total is unknown. */
  fraction: number | null;
  object?: MediaObjectPublic;
};

export type UploadControllerInput = {
  file: Blob & { name?: string; type?: string };
  category: MediaCategory;
  visibility: MediaVisibility;
  /** Overrides `file.name`; required when the blob has no name. */
  filename?: string;
  /** Overrides `file.type`. */
  mimeType?: string;
  /** Compute and send a SHA-256 of the bytes on completion. */
  checksum?: "none" | "sha256";
  /** Poll the object until scan/status leaves the pending/processing states. */
  waitForScan?: boolean;
  scanIntervalMs?: number;
  scanTimeoutMs?: number;
};

type ProgressListener = (progress: UploadProgress) => void;

const PENDING_SCAN_STATES = new Set(["pending"]);
const PENDING_OBJECT_STATES = new Set(["pending_upload", "uploaded", "processing"]);

/**
 * Compute a lowercase hex SHA-256 of a blob using Web Crypto. Returns `null`
 * when the platform has no `crypto.subtle` (e.g. non-secure context).
 */
export async function sha256Hex(blob: Blob): Promise<string | null> {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Upload a blob to MinIO/S3 via a presigned POST policy. The bearer token is
 * never attached here — storage authenticates the signed `upload_fields` only.
 * Uses `XMLHttpRequest` for progress events, falling back to `fetch` when XHR
 * is unavailable (e.g. SSR).
 */
export function putToStorage(
  presigned: UploadInitiateResponse,
  file: Blob,
  options: { signal?: AbortSignal; onProgress?: (loaded: number, total: number) => void } = {}
): Promise<void> {
  const form = new FormData();
  for (const [key, value] of Object.entries(presigned.upload_fields)) {
    form.append(key, value);
  }
  form.append("file", file);

  const Xhr = (globalThis as { XMLHttpRequest?: typeof XMLHttpRequest }).XMLHttpRequest;
  if (!Xhr) {
    return fetch(presigned.upload_url, { method: "POST", body: form }).then((response) => {
      if (!response.ok) {
        throw new UploadError("storage", `Storage upload failed with ${response.status}`);
      }
    });
  }

  return new Promise<void>((resolve, reject) => {
    const xhr = new Xhr();
    xhr.open("POST", presigned.upload_url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new UploadError("storage", `Storage upload failed with ${xhr.status}`));
    };
    xhr.onerror = () => reject(new UploadError("storage", "Storage upload network error"));
    xhr.onabort = () => reject(new UploadError("abort", "Upload aborted"));
    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
      } else {
        options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }
    }
    xhr.send(form);
  });
}

export class MediaUploadController {
  private listeners = new Set<ProgressListener>();
  private readonly controller = new AbortController();
  private loaded = 0;
  private total: number;
  private currentState: UploadState = "idle";
  object?: MediaObjectPublic;
  private sessionId?: string;

  constructor(private readonly input: UploadControllerInput) {
    this.total = input.file.size;
  }

  get state(): UploadState {
    return this.currentState;
  }

  on(_event: "progress", listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  abort(): void {
    this.controller.abort();
  }

  private emit(state: UploadState): void {
    this.currentState = state;
    const progress: UploadProgress = {
      state,
      loaded: this.loaded,
      total: this.total,
      fraction: this.total > 0 ? Math.min(1, this.loaded / this.total) : null,
      object: this.object
    };
    for (const listener of this.listeners) listener(progress);
  }

  async start(): Promise<MediaObjectPublic> {
    const { input } = this;
    const filename = input.filename ?? input.file.name;
    const mimeType = input.mimeType ?? input.file.type;
    if (!filename) throw new UploadError("api", "A filename is required to upload");
    if (!mimeType) throw new UploadError("api", "A MIME type is required to upload");

    let presigned: UploadInitiateResponse;
    try {
      this.emit("initiating");
      presigned = await initiateUpload({
        category: input.category,
        visibility: input.visibility,
        original_filename: filename,
        mime_type: mimeType,
        expected_size_bytes: input.file.size
      });
      this.sessionId = presigned.session_id;
    } catch (error) {
      this.emit("failed");
      throw new UploadError("api", "Failed to initiate upload", error);
    }

    try {
      this.emit("uploading");
      await putToStorage(presigned, input.file, {
        signal: this.controller.signal,
        onProgress: (loaded, total) => {
          this.loaded = loaded;
          this.total = total;
          this.emit("uploading");
        }
      });
    } catch (error) {
      await this.safeAbort();
      if (error instanceof UploadError && error.kind === "abort") {
        this.emit("aborted");
        throw error;
      }
      this.emit("failed");
      throw error instanceof UploadError
        ? error
        : new UploadError("storage", "Storage upload failed", error);
    }

    let sha256: string | null = null;
    if (input.checksum === "sha256") {
      sha256 = await sha256Hex(input.file);
    }

    let object: MediaObjectPublic;
    try {
      this.emit("completing");
      const response = await completeUpload(presigned.session_id, sha256 ? { sha256 } : {});
      object = response.media_object;
      this.object = object;
    } catch (error) {
      this.emit("failed");
      throw new UploadError("api", "Failed to complete upload", error);
    }

    if (input.waitForScan) {
      this.emit("scanning");
      object = await this.pollUntilScanned(object.id);
      this.object = object;
    }

    this.emit("ready");
    return object;
  }

  private async pollUntilScanned(objectId: string): Promise<MediaObjectPublic> {
    const polling = getMediaConfig().polling;
    const intervalMs = this.input.scanIntervalMs ?? polling.uploadScanMs;
    const timeoutMs = this.input.scanTimeoutMs ?? polling.timeoutMs;
    const deadline = Date.now() + timeoutMs;

    for (;;) {
      if (this.controller.signal.aborted) throw new UploadError("abort", "Upload aborted");
      const object = await getObject(objectId);
      if (object.status === "rejected" || object.scan_status === "infected" || object.scan_status === "quarantined") {
        throw new UploadError("scan", `Object rejected by scan (${object.scan_status})`);
      }
      const stillPending =
        PENDING_OBJECT_STATES.has(object.status) || PENDING_SCAN_STATES.has(object.scan_status);
      if (!stillPending) return object;
      if (Date.now() + intervalMs >= deadline) {
        throw new UploadError("scan", "Timed out waiting for scan to finish");
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  private async safeAbort(): Promise<void> {
    // Only ever called after `initiate` has set the session id.
    try {
      await abortUpload(this.sessionId as string);
    } catch (error) {
      // Best-effort cleanup; surface API aborts only via logs, not by masking
      // the original failure.
      if (!(error instanceof ApiError)) throw error;
    }
  }
}

export function createMediaUploadController(input: UploadControllerInput): MediaUploadController {
  return new MediaUploadController(input);
}

import { z } from "zod";

export const ApiErrorBody = z.object({
  detail: z.unknown()
});

/**
 * Derive a human-readable message from a normalized FastAPI error detail.
 * Strings are surfaced as-is; validation arrays ({ msg }) are joined; a flat
 * object detail (`{ code, reason, message }`, e.g. `UploadRejectDetail` /
 * `DownloadNotAvailableDetail` from media-service-m8) surfaces its `message`;
 * anything else yields `undefined` so callers fall back to a generic message.
 */
export function messageFromDetail(detail: unknown): string | undefined {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) =>
        item && typeof item === "object" && "msg" in item && (item as { msg: unknown }).msg
          ? String((item as { msg: unknown }).msg)
          : null
      )
      .filter((part): part is string => part !== null);
    if (parts.length) return parts.join("; ");
    return undefined;
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    const message = (detail as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(message ?? messageFromDetail(detail) ?? "Media API request failed");
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class UnauthenticatedError extends ApiError {
  constructor(message = "Authentication required") {
    super(401, message, message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "You do not have permission to perform this action") {
    super(403, message, message);
    this.name = "ForbiddenError";
  }
}

export function normalizeFastApiError(payload: unknown): unknown {
  const parsed = ApiErrorBody.safeParse(payload);
  return parsed.success ? parsed.data.detail : payload;
}

/**
 * Friendly copy for the stable machine tokens media-service-m8 raises on the
 * upload-reject 422 (`UploadRejectDetail.reason`), the download-guard 409
 * (`DownloadNotAvailableDetail.code`), and a per-row import result
 * (`ImportObjectResult.reason`, `U9`/`U10`) — the first five import reasons
 * are `U1`'s own upload-reject tokens, reused verbatim, so both surfaces
 * resolve through this one map. Keyed by whichever of `reason`/`code` the
 * detail carries.
 */
export const UPLOAD_REJECT_REASON_MESSAGES: ReadonlyMap<string, string> = new Map([
  ["size_exceeded", "This file is larger than the allowed size limit."],
  ["mime_mismatch", "This file type is not allowed for the selected category."],
  ["sha256_mismatch", "The uploaded file did not match its expected checksum."],
  ["quota_bytes_exceeded", "You have reached your storage quota."],
  ["quota_objects_exceeded", "You have reached the maximum number of files allowed."],
  ["scan_not_clean", "This file was rejected because it failed the virus scan."],
  // Import-only outcomes (`ImportRowReason`).
  ["missing_bytes", "This item has no bytes to import (manifest-only, no local copy)."],
  ["already_exists", "This item already exists in your library."],
  ["id_conflict", "This item conflicts with an existing record you do not own."],
  ["unsupported_mime", "This file type is not supported for import."],
  ["invalid_metadata", "This item's metadata could not be read."],
  ["storage_error", "A storage error prevented this file from being imported."]
]);

/**
 * Resolve friendly copy for a normalized FastAPI error `detail`: a known
 * `reason`/`code` token maps to its friendly string; otherwise fall back to
 * `messageFromDetail`, then to the caller-supplied generic `fallback`.
 */
export function friendlyReasonMessage(detail: unknown, fallback: string): string {
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const record = detail as { code?: unknown; reason?: unknown };
    const key =
      typeof record.reason === "string"
        ? record.reason
        : typeof record.code === "string"
          ? record.code
          : undefined;
    const known = key ? UPLOAD_REJECT_REASON_MESSAGES.get(key) : undefined;
    if (known) return known;
  }
  return messageFromDetail(detail) ?? fallback;
}

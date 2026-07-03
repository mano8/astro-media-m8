import { z } from "zod";

export const ApiErrorBody = z.object({
  detail: z.unknown()
});

/**
 * Derive a human-readable message from a normalized FastAPI error detail.
 * Strings are surfaced as-is; validation arrays ({ msg }) are joined; anything
 * else yields `undefined` so callers fall back to a generic message.
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

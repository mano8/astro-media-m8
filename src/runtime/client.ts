import { z } from "zod";
import { getMediaConfig } from "./config.js";
import { getMediaAuthAdapter } from "./authAdapter.js";
import {
  ApiError,
  ForbiddenError,
  messageFromDetail,
  normalizeFastApiError,
  UnauthenticatedError
} from "./errors.js";

export * from "./api/index.js";

export type MediaRequestBase = "v1" | "legacy" | "absolute";

export type MediaRequestOptions<T> = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  base?: MediaRequestBase;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  schema?: z.ZodType<T>;
  auth?: boolean;
  admin?: boolean;
  skipRefresh?: boolean;
};

/**
 * Resolve a request path against the configured bases. Most media routes live
 * under `apiBase + v1Base`; dashboard/category live under `apiBase + legacyBase`.
 * `absolute` is escaped for already-fully-qualified URLs. The protocol is pinned
 * to http(s) so a crafted `path` can never smuggle in `javascript:`/`data:`.
 */
export function mediaUrl(base: MediaRequestBase, path: string): string {
  const config = getMediaConfig();
  const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const full =
    base === "absolute"
      ? path
      : `${config.apiBase}${base === "legacy" ? config.legacyBase : config.v1Base}${path}`;
  const url = new URL(full, origin);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Unsupported media API protocol");
  }
  return url.toString();
}

export async function request<T>(options: MediaRequestOptions<T>): Promise<T> {
  const config = getMediaConfig();
  const adapter = getMediaAuthAdapter();

  // Guard admin calls before they hit the network when the user is known, so a
  // non-superuser never even emits the request.
  if (options.admin && adapter.getUser && adapter.isSuperuser) {
    const user = await adapter.getUser();
    if (user != null && !adapter.isSuperuser(user)) {
      throw new ForbiddenError();
    }
  }

  const url = new URL(mediaUrl(options.base ?? "v1", options.path));
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value != null) url.searchParams.set(key, String(value));
  }

  const headers = new Headers({
    [config.csrfHeader]: "XMLHttpRequest",
    ...options.headers
  });
  if (options.auth) {
    const token = await adapter.getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const execute = () =>
    fetch(url.toString(), { method: options.method, headers, body, credentials: "include" });

  let response = await execute();
  if (response.status === 401 && !options.skipRefresh) {
    const refreshed = adapter.refresh ? await adapter.refresh() : null;
    if (refreshed) {
      headers.set("Authorization", `Bearer ${refreshed}`);
      response = await execute();
    } else {
      adapter.onUnauthenticated?.("refresh-failed");
      throw new UnauthenticatedError("Session expired. Please sign in again.");
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      adapter.onUnauthenticated?.("unauthenticated");
      throw new UnauthenticatedError();
    }
    let detail: unknown;
    try {
      detail = normalizeFastApiError(await response.clone().json());
    } catch {
      detail = await response.text();
    }
    if (response.status === 403 && options.admin) {
      throw new ForbiddenError(messageFromDetail(detail));
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204 || !options.schema) return undefined as T;
  return options.schema.parse(await response.json());
}

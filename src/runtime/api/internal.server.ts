import { request } from "../client.js";
import {
  MediaObjectPublicSchema,
  ScanResultRequestSchema,
  VariantJobPublicSchema,
  VariantPublicSchema,
  type MediaObjectPublic,
  type ScanResultRequest,
  type VariantJobPublic,
  type VariantJobUpdate,
  type VariantPublic,
  type VariantRegisterRequest
} from "../schemas.js";

const DEFAULT_TOKEN_ENV = "MEDIA_INTERNAL_SERVICE_TOKEN";

/**
 * Fail fast if this module is ever pulled into a browser bundle. The internal
 * routes are authenticated with a shared service token that must never leave
 * the server.
 */
function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "@fa-m8/astro-media-m8/internal-server must only be imported on the server"
    );
  }
}

function resolveServiceToken(envVar: string): string {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const token = env?.[envVar];
  if (!token) {
    throw new Error(`Missing service token: set ${envVar} in the server environment`);
  }
  return token;
}

export type InternalClientOptions = {
  /** Env var holding the shared service token. Default MEDIA_INTERNAL_SERVICE_TOKEN. */
  serviceTokenEnv?: string;
  /** Explicit token override (e.g. injected by a secret manager). */
  token?: string;
};

export type InternalMediaClient = {
  applyScanResult(objectId: string, body: ScanResultRequest): Promise<MediaObjectPublic>;
  registerVariant(objectId: string, body: VariantRegisterRequest): Promise<VariantPublic>;
  updateVariantJob(jobId: string, body: VariantJobUpdate): Promise<VariantJobPublic>;
};

/**
 * Build a server-only client for the service-to-service internal callbacks.
 * The shared service token is attached directly (never via the user auth
 * adapter) and refresh is disabled, since there is no user session to renew.
 */
export function createInternalMediaClient(options: InternalClientOptions = {}): InternalMediaClient {
  assertServerOnly();
  const token = options.token ?? resolveServiceToken(options.serviceTokenEnv ?? DEFAULT_TOKEN_ENV);
  const headers = { Authorization: `Bearer ${token}` };

  return {
    applyScanResult(objectId, body) {
      return request({
        method: "POST",
        path: `/internal/objects/${encodeURIComponent(objectId)}/scan-result`,
        body: ScanResultRequestSchema.parse(body),
        schema: MediaObjectPublicSchema,
        headers,
        skipRefresh: true
      });
    },
    registerVariant(objectId, body) {
      return request({
        method: "POST",
        path: `/internal/objects/${encodeURIComponent(objectId)}/variants`,
        body,
        schema: VariantPublicSchema,
        headers,
        skipRefresh: true
      });
    },
    updateVariantJob(jobId, body) {
      return request({
        method: "PATCH",
        path: `/internal/variant-jobs/${encodeURIComponent(jobId)}`,
        body,
        schema: VariantJobPublicSchema,
        headers,
        skipRefresh: true
      });
    }
  };
}

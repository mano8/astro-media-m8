import { request } from "../client.js";
import { getMediaConfig } from "../config.js";
import {
  VariantJobPublicSchema,
  VariantListResponseSchema,
  type VariantGenerateRequest,
  type VariantJobPublic,
  type VariantJobStatus,
  type VariantListResponse
} from "../schemas.js";

export function generateVariants(
  objectId: string,
  body: VariantGenerateRequest
): Promise<VariantJobPublic> {
  return request({
    method: "POST",
    // Action sub-resource: the literal ":generate" suffix is part of the route.
    path: `/objects/${encodeURIComponent(objectId)}/variants:generate`,
    body,
    schema: VariantJobPublicSchema,
    auth: true
  });
}

export function listVariants(objectId: string): Promise<VariantListResponse> {
  return request({
    method: "GET",
    path: `/objects/${encodeURIComponent(objectId)}/variants`,
    schema: VariantListResponseSchema,
    auth: true
  });
}

export function getVariantJob(objectId: string, jobId: string): Promise<VariantJobPublic> {
  return request({
    method: "GET",
    path: `/objects/${encodeURIComponent(objectId)}/variants/jobs/${encodeURIComponent(jobId)}`,
    schema: VariantJobPublicSchema,
    auth: true
  });
}

export function deleteVariant(objectId: string, variantId: string): Promise<void> {
  return request({
    method: "DELETE",
    path: `/objects/${encodeURIComponent(objectId)}/variants/${encodeURIComponent(variantId)}`,
    auth: true
  });
}

const TERMINAL_JOB_STATES: ReadonlySet<VariantJobStatus> = new Set(["completed", "failed"]);

export type WaitForVariantJobOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onUpdate?: (job: VariantJobPublic) => void;
};

/**
 * Poll a variant job until it reaches a terminal state (`completed`/`failed`),
 * the timeout elapses, or the supplied signal aborts. Intervals/timeout default
 * to the runtime polling config.
 */
export async function waitForVariantJob(
  objectId: string,
  jobId: string,
  options: WaitForVariantJobOptions = {}
): Promise<VariantJobPublic> {
  const polling = getMediaConfig().polling;
  const intervalMs = options.intervalMs ?? polling.variantJobMs;
  const timeoutMs = options.timeoutMs ?? polling.timeoutMs;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (options.signal?.aborted) throw new Error("Variant job polling aborted");
    const job = await getVariantJob(objectId, jobId);
    options.onUpdate?.(job);
    if (TERMINAL_JOB_STATES.has(job.status)) return job;
    if (Date.now() + intervalMs >= deadline) {
      throw new Error("Timed out waiting for variant job to finish");
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

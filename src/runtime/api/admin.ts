import { request } from "../client.js";
import {
  HardPurgeResponseSchema,
  OrphanReportSchema,
  PurgeStaleResponseSchema,
  StaleUploadsResponseSchema,
  StorageStatsResponseSchema,
  StorageUsagePublicSchema,
  SubscriptionListResponseSchema,
  SubscriptionPublicSchema,
  type HardPurgeResponse,
  type OrphanReport,
  type PurgeStaleResponse,
  type QuotaUpdateRequest,
  type StaleUploadsResponse,
  type StorageStatsResponse,
  type StorageUsagePublic,
  type SubscriptionCreateRequest,
  type SubscriptionListResponse,
  type SubscriptionPublic
} from "../schemas.js";

/**
 * Superuser-only operations. Every wrapper sets `admin: true` so the client
 * can short-circuit with a `ForbiddenError` before the request when the auth
 * adapter already knows the user is not a superuser.
 */

export function getStorageStats(): Promise<StorageStatsResponse> {
  return request({
    method: "GET",
    path: "/admin/storage/stats",
    schema: StorageStatsResponseSchema,
    auth: true,
    admin: true
  });
}

export function getStaleUploads(): Promise<StaleUploadsResponse> {
  return request({
    method: "GET",
    path: "/admin/uploads/stale",
    schema: StaleUploadsResponseSchema,
    auth: true,
    admin: true
  });
}

export function purgeStaleUploads(): Promise<PurgeStaleResponse> {
  return request({
    method: "POST",
    path: "/admin/uploads/purge-stale",
    schema: PurgeStaleResponseSchema,
    auth: true,
    admin: true
  });
}

export function getQuota(ownerUserId: string, tenantId?: string): Promise<StorageUsagePublic> {
  return request({
    method: "GET",
    path: `/admin/quotas/${encodeURIComponent(ownerUserId)}`,
    query: { tenant_id: tenantId },
    schema: StorageUsagePublicSchema,
    auth: true,
    admin: true
  });
}

export function setQuota(
  ownerUserId: string,
  body: QuotaUpdateRequest,
  tenantId?: string
): Promise<StorageUsagePublic> {
  return request({
    method: "PUT",
    path: `/admin/quotas/${encodeURIComponent(ownerUserId)}`,
    query: { tenant_id: tenantId },
    body,
    schema: StorageUsagePublicSchema,
    auth: true,
    admin: true
  });
}

export function getOrphans(): Promise<OrphanReport> {
  return request({
    method: "GET",
    path: "/admin/maintenance/orphans",
    schema: OrphanReportSchema,
    auth: true,
    admin: true
  });
}

/**
 * Reconcile orphans. Defaults to a dry-run; pass `confirm: true` only behind an
 * explicit operator confirmation — it deletes storage-orphan bytes.
 */
export function repairOrphans(confirm = false): Promise<OrphanReport> {
  return request({
    method: "POST",
    path: "/admin/maintenance/orphans/repair",
    query: { confirm },
    schema: OrphanReportSchema,
    auth: true,
    admin: true
  });
}

export function purgeExpired(): Promise<HardPurgeResponse> {
  return request({
    method: "POST",
    path: "/admin/maintenance/purge-expired",
    schema: HardPurgeResponseSchema,
    auth: true,
    admin: true
  });
}

export function createSubscription(body: SubscriptionCreateRequest): Promise<SubscriptionPublic> {
  return request({
    method: "POST",
    path: "/admin/subscriptions",
    body,
    schema: SubscriptionPublicSchema,
    auth: true,
    admin: true
  });
}

export function listSubscriptions(): Promise<SubscriptionListResponse> {
  return request({
    method: "GET",
    path: "/admin/subscriptions",
    schema: SubscriptionListResponseSchema,
    auth: true,
    admin: true
  });
}

export function deleteSubscription(subscriptionId: string): Promise<void> {
  return request({
    method: "DELETE",
    path: `/admin/subscriptions/${encodeURIComponent(subscriptionId)}`,
    auth: true,
    admin: true
  });
}

import { request } from "../client.js";
import {
  DownloadUrlResponseSchema,
  ShareTokenListResponseSchema,
  ShareTokenPublicSchema,
  type DownloadUrlResponse,
  type ShareTokenCreate,
  type ShareTokenListResponse,
  type ShareTokenPublic
} from "../schemas.js";

export function createShare(
  objectId: string,
  body: ShareTokenCreate = {}
): Promise<ShareTokenPublic> {
  return request({
    method: "POST",
    path: `/objects/${encodeURIComponent(objectId)}/shares`,
    body,
    schema: ShareTokenPublicSchema,
    auth: true
  });
}

export function listShares(objectId: string): Promise<ShareTokenListResponse> {
  return request({
    method: "GET",
    path: `/objects/${encodeURIComponent(objectId)}/shares`,
    schema: ShareTokenListResponseSchema,
    auth: true
  });
}

export function revokeShare(tokenId: string): Promise<void> {
  return request({
    method: "DELETE",
    path: `/shares/${encodeURIComponent(tokenId)}`,
    auth: true
  });
}

/**
 * Resolve a public share token to a presigned download URL. This route is
 * public on the service, so no bearer token is attached.
 */
export function resolveShare(token: string): Promise<DownloadUrlResponse> {
  return request({
    method: "GET",
    path: `/shares/${encodeURIComponent(token)}`,
    schema: DownloadUrlResponseSchema
  });
}

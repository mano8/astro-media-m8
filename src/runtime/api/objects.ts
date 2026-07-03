import { request } from "../client.js";
import { ApiError } from "../errors.js";
import {
  DownloadUrlResponseSchema,
  MediaObjectPublicSchema,
  ObjectListResponseSchema,
  type DownloadUrlResponse,
  type MediaObjectPublic,
  type MediaObjectUpdate,
  type ObjectListParams,
  type ObjectListResponse
} from "../schemas.js";

type SortField = NonNullable<ObjectListParams["sort_by"]>;

const LEGACY_SORT_FALLBACKS: Partial<Record<SortField, SortField>> = {
  original_filename: "created_at",
  category: "created_at",
  status: "created_at"
};

function legacySortFallback(params: ObjectListParams): ObjectListParams["sort_by"] | undefined {
  return params.sort_by === undefined ? undefined : LEGACY_SORT_FALLBACKS[params.sort_by];
}

function shouldRetryLegacySort(error: unknown, fallback: ObjectListParams["sort_by"] | undefined): boolean {
  return error instanceof ApiError && error.status === 422 && fallback !== undefined;
}

export async function listObjects(params: ObjectListParams = {}): Promise<ObjectListResponse> {
  const options = {
    method: "GET",
    path: "/objects",
    query: { ...params },
    schema: ObjectListResponseSchema,
    auth: true
  } as const;

  try {
    return await request(options);
  } catch (error) {
    const fallback = legacySortFallback(params);
    if (!shouldRetryLegacySort(error, fallback)) throw error;
    return request({
      ...options,
      query: {
        ...params,
        sort_by: fallback
      }
    });
  }
}

export function getObject(objectId: string): Promise<MediaObjectPublic> {
  return request({
    method: "GET",
    path: `/objects/${encodeURIComponent(objectId)}`,
    schema: MediaObjectPublicSchema,
    auth: true
  });
}

export function getDownloadUrl(objectId: string): Promise<DownloadUrlResponse> {
  return request({
    method: "GET",
    path: `/objects/${encodeURIComponent(objectId)}/download-url`,
    schema: DownloadUrlResponseSchema,
    auth: true
  });
}

export function updateObject(
  objectId: string,
  body: MediaObjectUpdate
): Promise<MediaObjectPublic> {
  return request({
    method: "PATCH",
    path: `/objects/${encodeURIComponent(objectId)}`,
    body,
    schema: MediaObjectPublicSchema,
    auth: true
  });
}

export function deleteObject(objectId: string): Promise<void> {
  return request({
    method: "DELETE",
    path: `/objects/${encodeURIComponent(objectId)}`,
    auth: true
  });
}

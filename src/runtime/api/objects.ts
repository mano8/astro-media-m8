import { request } from "../client.js";
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

export function listObjects(params: ObjectListParams = {}): Promise<ObjectListResponse> {
  return request({
    method: "GET",
    path: "/objects",
    query: { ...params },
    schema: ObjectListResponseSchema,
    auth: true
  });
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

import { request } from "../client.js";
import {
  CategoriesPublicSchema,
  ResponseMessageSchema,
  ResponseModelBaseSchema,
  ResponseModelOrMessageSchema,
  type CategoriesPublic,
  type CategoryCreate,
  type CategoryUpdate,
  type ResponseMessage,
  type ResponseModelBase,
  type ResponseModelOrMessage
} from "../schemas.js";

/**
 * Legacy category CRUD. These routes live under `legacyBase` (no `/v1`) and use
 * the older `{success, ...}` envelope shape. Kept for completeness; the object
 * API uses enum categories, so this is an auxiliary surface.
 */

export function listCategories(skip = 0, limit = 100): Promise<CategoriesPublic> {
  return request({
    method: "GET",
    base: "legacy",
    path: "/category/",
    query: { skip, limit },
    schema: CategoriesPublicSchema,
    auth: true
  });
}

export function getCategory(itemId: number): Promise<ResponseModelOrMessage> {
  return request({
    method: "GET",
    base: "legacy",
    path: `/category/get/${encodeURIComponent(itemId)}/`,
    schema: ResponseModelOrMessageSchema,
    auth: true
  });
}

export function createCategory(body: CategoryCreate): Promise<ResponseModelBase> {
  return request({
    method: "POST",
    base: "legacy",
    path: "/category/add/",
    body,
    schema: ResponseModelBaseSchema,
    auth: true
  });
}

export function updateCategory(itemId: number, body: CategoryUpdate): Promise<ResponseModelBase> {
  return request({
    method: "PUT",
    base: "legacy",
    path: `/category/edit/${encodeURIComponent(itemId)}/`,
    body,
    schema: ResponseModelBaseSchema,
    auth: true
  });
}

export function deleteCategory(itemId: number): Promise<ResponseMessage> {
  return request({
    method: "DELETE",
    base: "legacy",
    path: `/category/delete/${encodeURIComponent(itemId)}/`,
    schema: ResponseMessageSchema,
    auth: true
  });
}

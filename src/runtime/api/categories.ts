import { request } from "../client.js";
import {
  CategoriesPublicSchema,
  CategoryPublicSchema,
  CategoryTreeSchema,
  type CategoriesPublic,
  type CategoryCreate,
  type CategoryPublic,
  type CategoryTree,
  type CategoryUpdate
} from "../schemas.js";

/**
 * User category CRUD + tree. These routes live under `legacyBase` (no `/v1`).
 *
 * `get`/`add`/`edit`/`delete` answer typed responses, not the older
 * `{success, ...}` envelope — the server controller extraction
 * (media-service-m8 `58bc3f9`) dropped it, so these wrappers are retyped
 * rather than preserved. `list` was already unaffected on the wrapper shape,
 * but its items now carry `parent_id`/`tenant_id` too (`U3`), which
 * `CategoryPublicSchema` reflects.
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

export function getCategoryTree(): Promise<CategoryTree> {
  return request({
    method: "GET",
    base: "legacy",
    path: "/category/tree/",
    schema: CategoryTreeSchema,
    auth: true
  });
}

export function getCategory(itemId: number): Promise<CategoryPublic> {
  return request({
    method: "GET",
    base: "legacy",
    path: `/category/get/${encodeURIComponent(itemId)}/`,
    schema: CategoryPublicSchema,
    auth: true
  });
}

export function createCategory(body: CategoryCreate): Promise<CategoryPublic> {
  return request({
    method: "POST",
    base: "legacy",
    path: "/category/add/",
    body,
    schema: CategoryPublicSchema,
    auth: true
  });
}

export function updateCategory(itemId: number, body: CategoryUpdate): Promise<CategoryPublic> {
  return request({
    method: "PUT",
    base: "legacy",
    path: `/category/edit/${encodeURIComponent(itemId)}/`,
    body,
    schema: CategoryPublicSchema,
    auth: true
  });
}

export function deleteCategory(itemId: number): Promise<void> {
  return request({
    method: "DELETE",
    base: "legacy",
    path: `/category/delete/${encodeURIComponent(itemId)}/`,
    auth: true
  });
}

import { request } from "../client.js";
import { UsersActivitySchema, type UsersActivity } from "../schemas.js";

/** Dashboard activity. These routes live under `legacyBase` (no `/v1`). */

export function getActivityAll(): Promise<UsersActivity> {
  return request({
    method: "GET",
    base: "legacy",
    path: "/dashboard/users/activity/",
    schema: UsersActivitySchema,
    auth: true
  });
}

export function getActivityCurrent(): Promise<UsersActivity> {
  return request({
    method: "GET",
    base: "legacy",
    path: "/dashboard/users/activity/current/",
    schema: UsersActivitySchema,
    auth: true
  });
}

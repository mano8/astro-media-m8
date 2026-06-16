import { request } from "../client.js";
import {
  ImagePresetListSchema,
  ImagePresetPublicSchema,
  type ImagePresetCreate,
  type ImagePresetPublic,
  type ImagePresetUpdate
} from "../schemas.js";

export function listPresets(): Promise<ImagePresetPublic[]> {
  return request({ method: "GET", path: "/presets", schema: ImagePresetListSchema, auth: true });
}

export function createPreset(body: ImagePresetCreate): Promise<ImagePresetPublic> {
  return request({
    method: "POST",
    path: "/presets",
    body,
    schema: ImagePresetPublicSchema,
    auth: true
  });
}

export function updatePreset(
  presetId: string,
  body: ImagePresetUpdate
): Promise<ImagePresetPublic> {
  return request({
    method: "PATCH",
    path: `/presets/${encodeURIComponent(presetId)}`,
    body,
    schema: ImagePresetPublicSchema,
    auth: true
  });
}

export function deletePreset(presetId: string): Promise<void> {
  return request({
    method: "DELETE",
    path: `/presets/${encodeURIComponent(presetId)}`,
    auth: true
  });
}

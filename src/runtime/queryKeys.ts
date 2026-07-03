import type { ObjectListParams } from "./schemas.js";

type QueryKeyParamValue = boolean | number | string | null | undefined;
type QueryKeyParams = Record<string, QueryKeyParamValue>;
const EMPTY_PARAMS = Object.freeze({}) as Readonly<Record<string, never>>;

function normalizeParams<TParams extends QueryKeyParams>(params?: TParams): Readonly<Partial<TParams>> {
  if (!params) return EMPTY_PARAMS as Readonly<Partial<TParams>>;

  const entries = Object.entries(params)
    .filter((entry): entry is [keyof TParams & string, Exclude<TParams[keyof TParams], undefined>] => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.freeze(Object.fromEntries(entries)) as unknown as Readonly<Partial<TParams>>;
}

export const mediaKeys = {
  all: () => ["media"] as const,
  objectLists: () => ["media", "objects"] as const,
  objects: (params: ObjectListParams = {}) => ["media", "objects", normalizeParams(params)] as const,
  object: (objectId: string) => ["media", "object", objectId] as const,
  variants: (objectId: string) => ["media", "variants", objectId] as const,
  presets: () => ["media", "presets"] as const,
  downloadUrl: (objectId: string) => ["media", "download-url", objectId] as const,
  adminStats: () => ["media", "admin", "stats"] as const,
  adminStaleUploads: <TParams extends QueryKeyParams>(params?: TParams) =>
    ["media", "admin", "stale-uploads", normalizeParams(params)] as const,
  adminOrphans: <TParams extends QueryKeyParams>(params?: TParams) =>
    ["media", "admin", "orphans", normalizeParams(params)] as const,
  adminSubscriptions: () => ["media", "admin", "subscriptions"] as const
};

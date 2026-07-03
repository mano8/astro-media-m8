import { z } from "zod";

export const listSortDirections = ["asc", "desc"] as const;

export type ListSortDirection = (typeof listSortDirections)[number];
export type ListParamPrimitive = string | number | boolean | null | undefined;
export type ListParamRecord = Record<string, ListParamPrimitive | readonly ListParamPrimitive[]>;
export type ListParamSource = URLSearchParams | ListParamRecord;

export interface ListParams<TSort extends string> {
  page: number;
  pageSize: number;
  q: string;
  sort: TSort;
  order: ListSortDirection;
}

export interface MakeListSchemaOptions<TSort extends string> {
  allowedSorts: readonly [TSort, ...TSort[]];
  allowedPageSizes: readonly [number, ...number[]];
  defaultSort?: TSort;
  defaultOrder?: ListSortDirection;
  defaultPage?: number;
  defaultPageSize?: number;
}

export type ListParamsSchema<TSort extends string> = z.ZodType<ListParams<TSort>>;

const coerceNumber = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return value;
};

const coerceOrder = (value: unknown) => typeof value === "string" ? value.toLowerCase() : value;

const normalizeSearch = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const firstRecordValue = (value: ListParamRecord[string]) => {
  if (Array.isArray(value)) {
    return value.find((item) => item != null);
  }
  return value;
};

const toPlainParams = (source: ListParamSource): Record<string, unknown> => {
  if (source instanceof URLSearchParams) {
    return Object.fromEntries(source.entries());
  }

  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, firstRecordValue(value)]));
};

export function makeListSchema<TSort extends string>(options: MakeListSchemaOptions<TSort>): ListParamsSchema<TSort> {
  const defaultSort = options.defaultSort ?? options.allowedSorts[0];
  const defaultOrder = options.defaultOrder ?? "desc";
  const defaultPage = options.defaultPage ?? 1;
  const defaultPageSize = options.defaultPageSize ?? options.allowedPageSizes[0];
  const allowedPageSizes = new Set(options.allowedPageSizes);

  if (!options.allowedSorts.includes(defaultSort)) {
    throw new Error("defaultSort must be one of allowedSorts");
  }
  if (!allowedPageSizes.has(defaultPageSize)) {
    throw new Error("defaultPageSize must be one of allowedPageSizes");
  }
  if (!Number.isInteger(defaultPage) || defaultPage < 1) {
    throw new Error("defaultPage must be a positive integer");
  }

  return z.object({
    page: z.preprocess(coerceNumber, z.number().int().min(1).catch(defaultPage)),
    pageSize: z.preprocess(coerceNumber, z.number().int().refine((value) => allowedPageSizes.has(value)).catch(defaultPageSize)),
    q: z.preprocess(normalizeSearch, z.string().catch("")),
    sort: z.enum(options.allowedSorts).catch(defaultSort),
    order: z.preprocess(coerceOrder, z.enum(listSortDirections).catch(defaultOrder))
  }).strip();
}

export function parseListUrlParams<TSort extends string>(schema: ListParamsSchema<TSort>, source: ListParamSource): ListParams<TSort> {
  return schema.parse(toPlainParams(source));
}

export function mergeAndNormalize<TSort extends string>(schema: ListParamsSchema<TSort>, current: ListParamSource, patch: ListParamSource): ListParams<TSort> {
  return schema.parse({ ...toPlainParams(current), ...toPlainParams(patch) });
}

export function stringifyListUrlParams<TSort extends string>(params: ListParams<TSort>): string {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("pageSize", String(params.pageSize));
  if (params.q !== "") {
    query.set("q", params.q);
  }
  query.set("sort", params.sort);
  query.set("order", params.order);
  return query.toString();
}

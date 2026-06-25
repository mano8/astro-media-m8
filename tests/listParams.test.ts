import { describe, expect, it } from "vitest";
import { makeListSchema, mergeAndNormalize, parseListUrlParams, stringifyListUrlParams } from "../src/runtime/listParams.js";

const mediaObjectListSchema = () => makeListSchema({
  allowedSorts: ["created_at", "size_bytes"],
  allowedPageSizes: [12, 24, 48],
  defaultSort: "created_at",
  defaultOrder: "desc",
  defaultPage: 1,
  defaultPageSize: 24
});

describe("list params helpers", () => {
  it("parses URLSearchParams with normalized search, numeric values, sorting, and order", () => {
    const params = new URLSearchParams({
      page: "3",
      pageSize: "48",
      q: "  invoice   preview  ",
      sort: "size_bytes",
      order: "ASC"
    });

    expect(parseListUrlParams(mediaObjectListSchema(), params)).toEqual({
      page: 3,
      pageSize: 48,
      q: "invoice preview",
      sort: "size_bytes",
      order: "asc"
    });
  });

  it("falls back to Zod-backed defaults for invalid URL values", () => {
    const params = new URLSearchParams({
      page: "0",
      pageSize: "99",
      q: "   ",
      sort: "original_filename",
      order: "sideways"
    });

    expect(parseListUrlParams(mediaObjectListSchema(), params)).toEqual({
      page: 1,
      pageSize: 24,
      q: "",
      sort: "created_at",
      order: "desc"
    });
  });

  it("parses plain objects and uses the first non-null array value", () => {
    expect(parseListUrlParams(mediaObjectListSchema(), {
      page: 2,
      pageSize: [null, 12],
      q: ["", "ignored"],
      sort: "size_bytes",
      order: "asc"
    })).toEqual({
      page: 2,
      pageSize: 12,
      q: "",
      sort: "size_bytes",
      order: "asc"
    });
  });

  it("merges URLSearchParams with plain object patches and normalizes the result", () => {
    const current = new URLSearchParams({
      page: "4",
      pageSize: "24",
      q: "invoice",
      sort: "size_bytes",
      order: "desc"
    });

    expect(mergeAndNormalize(mediaObjectListSchema(), current, {
      page: 1,
      q: "  hero   asset ",
      order: "asc"
    })).toEqual({
      page: 1,
      pageSize: 24,
      q: "hero asset",
      sort: "size_bytes",
      order: "asc"
    });
  });

  it("stringifies list params in a stable order and omits an empty search", () => {
    const params = parseListUrlParams(mediaObjectListSchema(), {
      page: 1,
      pageSize: 24,
      q: "",
      sort: "created_at",
      order: "desc"
    });

    expect(stringifyListUrlParams(params)).toBe("page=1&pageSize=24&sort=created_at&order=desc");
    expect(stringifyListUrlParams({ ...params, q: "hero asset" })).toBe("page=1&pageSize=24&q=hero+asset&sort=created_at&order=desc");
  });

  it("supports implicit defaults from the first allowed sort and page size", () => {
    const schema = makeListSchema({
      allowedSorts: ["created_at", "size_bytes"],
      allowedPageSizes: [10, 20]
    });

    expect(parseListUrlParams(schema, {})).toEqual({
      page: 1,
      pageSize: 10,
      q: "",
      sort: "created_at",
      order: "desc"
    });
  });

  it("rejects invalid helper defaults at construction time", () => {
    expect(() => makeListSchema({
      allowedSorts: ["created_at", "size_bytes"],
      allowedPageSizes: [10, 20],
      defaultSort: "mime_type" as "created_at"
    })).toThrow("defaultSort must be one of allowedSorts");

    expect(() => makeListSchema({
      allowedSorts: ["created_at", "size_bytes"],
      allowedPageSizes: [10, 20],
      defaultPageSize: 25
    })).toThrow("defaultPageSize must be one of allowedPageSizes");

    expect(() => makeListSchema({
      allowedSorts: ["created_at", "size_bytes"],
      allowedPageSizes: [10, 20],
      defaultPage: 0
    })).toThrow("defaultPage must be a positive integer");
  });
});

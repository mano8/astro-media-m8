import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { mediaUrl, request } from "../src/runtime/client.js";
import { configureMedia, getMediaConfig, resetMediaConfig } from "../src/runtime/config.js";
import {
  createFaAuthAdapter,
  createInMemoryAuthAdapter,
  defaultIsSuperuser,
  getMediaAuthAdapter,
  resetMediaAuthAdapter,
  setMediaAuthAdapter,
  type MediaAuthAdapter
} from "../src/runtime/authAdapter.js";
import {
  ApiError,
  ForbiddenError,
  messageFromDetail,
  normalizeFastApiError,
  UnauthenticatedError
} from "../src/runtime/errors.js";

const okSchema = z.object({ ok: z.boolean() });

function makeResponse(
  status: number,
  body: unknown,
  opts: { jsonThrows?: boolean; text?: string } = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    clone() {
      return this;
    },
    async json() {
      if (opts.jsonThrows) throw new Error("not json");
      return body;
    },
    async text() {
      return opts.text ?? (typeof body === "string" ? body : JSON.stringify(body));
    }
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  resetMediaConfig();
  resetMediaAuthAdapter();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("config", () => {
  it("merges partial config and nested polling, and resets", () => {
    const updated = configureMedia({ apiBase: "/m", polling: { variantJobMs: 50 } });
    expect(updated.apiBase).toBe("/m");
    expect(updated.polling.variantJobMs).toBe(50);
    expect(updated.polling.uploadScanMs).toBe(2000);
    configureMedia();
    expect(getMediaConfig().apiBase).toBe("/m");
    resetMediaConfig();
    expect(getMediaConfig().apiBase).toBe("/media");
  });
});

describe("errors", () => {
  it("derives messages from details", () => {
    expect(messageFromDetail("boom")).toBe("boom");
    expect(messageFromDetail("   ")).toBeUndefined();
    expect(messageFromDetail([{ msg: "a" }, { msg: "b" }, { nope: 1 }])).toBe("a; b");
    expect(messageFromDetail([{ nope: 1 }])).toBeUndefined();
    expect(messageFromDetail({ x: 1 })).toBeUndefined();
    expect(new ApiError(500, {}).message).toBe("Media API request failed");
    expect(new UnauthenticatedError().message).toBe("Authentication required");
    expect(new ForbiddenError().status).toBe(403);
  });

  it("normalizes FastAPI error bodies", () => {
    expect(normalizeFastApiError({ detail: "x" })).toBe("x");
    expect(normalizeFastApiError("raw")).toBe("raw");
  });
});

describe("auth adapter", () => {
  it("default in-memory adapter holds token in memory", async () => {
    const adapter = createInMemoryAuthAdapter("t0");
    expect(await adapter.getAccessToken()).toBe("t0");
    adapter.setAccessToken("t1");
    expect(await adapter.getAccessToken()).toBe("t1");
    expect(adapter.isSuperuser?.({ is_superuser: true })).toBe(true);
  });

  it("defaultIsSuperuser honours flag, role and roles array", () => {
    expect(defaultIsSuperuser(null)).toBe(false);
    expect(defaultIsSuperuser({ is_superuser: true })).toBe(true);
    expect(defaultIsSuperuser({ role: "admin" }, "admin")).toBe(true);
    expect(defaultIsSuperuser({ roles: ["admin"] }, "admin")).toBe(true);
    expect(defaultIsSuperuser({ role: "user" }, "admin")).toBe(false);
    expect(defaultIsSuperuser({ is_superuser: false })).toBe(false);
  });

  it("fa-auth adapter maps bindings (string and object refresh, fallbacks)", async () => {
    const onUnauthenticated = vi.fn();
    const a = createFaAuthAdapter({
      getToken: () => "tok",
      refreshToken: async () => ({ access_token: "fresh" }),
      getUser: () => ({ is_superuser: true }),
      hasRole: (role) => role === "admin",
      onUnauthenticated
    });
    expect(a.getAccessToken()).toBe("tok");
    expect(await a.refresh?.()).toBe("fresh");
    expect(a.isSuperuser?.({ is_superuser: true })).toBe(true);
    expect(a.hasRole?.("admin")).toBe(true);

    const stringRefresh = createFaAuthAdapter({ getToken: () => null, refreshToken: async () => "plain" });
    expect(await stringRefresh.refresh?.()).toBe("plain");

    const nullRefresh = createFaAuthAdapter({ getToken: () => null, refreshToken: async () => null });
    expect(await nullRefresh.refresh?.()).toBeNull();

    const objNoToken = createFaAuthAdapter({ getToken: () => null, refreshToken: async () => ({}) });
    expect(await objNoToken.refresh?.()).toBeNull();

    const noRefresh = createFaAuthAdapter({ getToken: () => null });
    expect(await noRefresh.refresh?.()).toBeNull();
    expect(noRefresh.isSuperuser?.({ is_superuser: true })).toBe(true);

    // explicit isSuperuser binding is used verbatim
    const withSuper = createFaAuthAdapter({ getToken: () => null, isSuperuser: () => false });
    expect(withSuper.isSuperuser?.({ is_superuser: true })).toBe(false);
  });

  it("get/set/reset the active adapter", () => {
    const custom = createInMemoryAuthAdapter("z");
    expect(setMediaAuthAdapter(custom)).toBe(custom);
    expect(getMediaAuthAdapter()).toBe(custom);
    resetMediaAuthAdapter();
    expect(getMediaAuthAdapter()).not.toBe(custom);
  });
});

describe("mediaUrl", () => {
  it("resolves v1, legacy and absolute bases", () => {
    configureMedia({ apiBase: "/media", v1Base: "/v1", legacyBase: "" });
    expect(mediaUrl("v1", "/objects")).toBe("http://localhost/media/v1/objects");
    expect(mediaUrl("legacy", "/dashboard/users/activity/")).toBe(
      "http://localhost/media/dashboard/users/activity/"
    );
    expect(mediaUrl("absolute", "https://cdn.test/x")).toBe("https://cdn.test/x");
  });

  it("rejects unsupported protocols", () => {
    expect(() => mediaUrl("absolute", "javascript:alert(1)")).toThrow("Unsupported media API protocol");
  });

  it("uses window.location.origin in the browser", () => {
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    expect(mediaUrl("v1", "/objects")).toBe("https://app.test/media/v1/objects");
  });
});

describe("request", () => {
  it("performs an authed GET, attaches bearer and parses the body", async () => {
    setMediaAuthAdapter(createInMemoryAuthAdapter("abc"));
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const result = await request({ method: "GET", path: "/x", schema: okSchema, auth: true });
    expect(result).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer abc");
    expect(init.credentials).toBe("include");
  });

  it("omits the bearer when no token and supports query + custom headers", async () => {
    setMediaAuthAdapter(createInMemoryAuthAdapter(null));
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({
      method: "GET",
      path: "/x",
      schema: okSchema,
      auth: true,
      headers: { "X-Test": "1" },
      query: { a: 1, b: null, c: undefined, d: false }
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("a=1");
    expect(url).toContain("d=false");
    expect(url).not.toContain("b=");
    expect((init.headers as Headers).get("Authorization")).toBeNull();
    expect((init.headers as Headers).get("X-Test")).toBe("1");
  });

  it("sends a JSON body on writes", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({ method: "POST", path: "/x", body: { a: 1 }, schema: okSchema });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("returns undefined for 204 and when no schema is given", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(204, null));
    expect(await request({ method: "DELETE", path: "/x" })).toBeUndefined();
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    expect(await request({ method: "POST", path: "/x" })).toBeUndefined();
  });

  it("guards admin calls before the network for a known non-superuser", async () => {
    setMediaAuthAdapter({
      getAccessToken: () => "t",
      getUser: () => ({ is_superuser: false }),
      isSuperuser: () => false
    });
    await expect(
      request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows admin calls when the user is a superuser or unknown", async () => {
    setMediaAuthAdapter({
      getAccessToken: () => "t",
      getUser: () => ({ is_superuser: true }),
      isSuperuser: () => true
    });
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true });

    setMediaAuthAdapter({ getAccessToken: () => "t", getUser: () => null, isSuperuser: () => false });
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true });

    // adapter without getUser/isSuperuser skips the guard entirely
    setMediaAuthAdapter({ getAccessToken: () => "t" });
    fetchMock.mockResolvedValueOnce(makeResponse(200, { ok: true }));
    await request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes once on 401 then retries with the new token", async () => {
    const refresh = vi.fn().mockResolvedValue("fresh");
    setMediaAuthAdapter({ getAccessToken: () => "stale", refresh });
    fetchMock
      .mockResolvedValueOnce(makeResponse(401, { detail: "expired" }))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const result = await request({ method: "GET", path: "/x", schema: okSchema, auth: true });
    expect(result).toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledOnce();
    const [, retryInit] = fetchMock.mock.calls[1];
    expect((retryInit.headers as Headers).get("Authorization")).toBe("Bearer fresh");
  });

  it("throws UnauthenticatedError when refresh yields nothing (with onUnauthenticated)", async () => {
    const onUnauthenticated = vi.fn();
    setMediaAuthAdapter({ getAccessToken: () => "stale", refresh: async () => null, onUnauthenticated });
    fetchMock.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(request({ method: "GET", path: "/x", schema: okSchema, auth: true })).rejects.toBeInstanceOf(
      UnauthenticatedError
    );
    expect(onUnauthenticated).toHaveBeenCalledWith("refresh-failed");
  });

  it("throws UnauthenticatedError when no refresh is available (no onUnauthenticated)", async () => {
    setMediaAuthAdapter({ getAccessToken: () => null });
    fetchMock.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(request({ method: "GET", path: "/x", schema: okSchema, auth: true })).rejects.toBeInstanceOf(
      UnauthenticatedError
    );
  });

  it("with skipRefresh, surfaces a 401 as UnauthenticatedError", async () => {
    const onUnauthenticated = vi.fn();
    setMediaAuthAdapter({ getAccessToken: () => "t", onUnauthenticated });
    fetchMock.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(
      request({ method: "GET", path: "/x", schema: okSchema, auth: true, skipRefresh: true })
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(onUnauthenticated).toHaveBeenCalledWith("unauthenticated");

    // again without onUnauthenticated to cover the optional-chain false branch
    setMediaAuthAdapter({ getAccessToken: () => "t" });
    fetchMock.mockResolvedValueOnce(makeResponse(401, {}));
    await expect(
      request({ method: "GET", path: "/x", schema: okSchema, auth: true, skipRefresh: true })
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("maps a JSON error body to ApiError", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(500, { detail: "boom" }));
    await expect(request({ method: "GET", path: "/x", schema: okSchema })).rejects.toMatchObject({
      status: 500,
      detail: "boom"
    });
  });

  it("falls back to text when the error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(502, null, { jsonThrows: true, text: "gateway" }));
    await expect(request({ method: "GET", path: "/x", schema: okSchema })).rejects.toMatchObject({
      status: 502,
      detail: "gateway"
    });
  });

  it("maps a 403 on an admin call to ForbiddenError with the server message", async () => {
    setMediaAuthAdapter({ getAccessToken: () => "t" });
    fetchMock.mockResolvedValueOnce(makeResponse(403, { detail: "Not enough permissions" }));
    await expect(
      request({ method: "GET", path: "/admin/x", schema: okSchema, auth: true, admin: true })
    ).rejects.toMatchObject({ name: "ForbiddenError", message: "Not enough permissions" });
  });
});

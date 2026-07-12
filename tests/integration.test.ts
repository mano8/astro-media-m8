import { describe, expect, it, vi } from "vitest";
import faMedia, { buildMediaRoutes } from "../src/integration.js";
import { mediaRedirect, routeForLocale } from "../src/runtime/routes.js";
import { onRequest } from "../src/middleware.js";

type SetupCtx = { config?: { integrations?: { name?: string }[] } };

function runSetup(options: Parameters<typeof faMedia>[0] = {}, ctx: SetupCtx = {}) {
  const integration = faMedia(options);
  const injectRoute = vi.fn();
  const addMiddleware = vi.fn();
  const updateConfig = vi.fn();
  const logger = { warn: vi.fn() };
  const hook = integration.hooks["astro:config:setup"] as (params: unknown) => void;
  hook({ injectRoute, addMiddleware, updateConfig, logger, config: ctx.config });
  return { injectRoute, addMiddleware, updateConfig, logger };
}

describe("buildMediaRoutes", () => {
  it("builds default routes", () => {
    expect(buildMediaRoutes()).toEqual({
      upload: "/media/upload",
      library: "/media",
      object: "/media/object/[id]",
      presets: "/media/presets",
      admin: "/admin/media"
    });
  });

  it("honours a base prefix and disabled routes", () => {
    const routes = buildMediaRoutes({ base: "/[locale]", admin: false, library: "/" });
    expect(routes.upload).toBe("/[locale]/media/upload");
    expect(routes.admin).toBeUndefined();
    expect(routes.library).toBe("/[locale]");
  });

  it("disables every route and collapses a root library", () => {
    expect(buildMediaRoutes({ upload: false, library: false, object: false, presets: false, admin: false })).toEqual({
      upload: undefined,
      library: undefined,
      object: undefined,
      presets: undefined,
      admin: undefined
    });
  });

  it("defaults the base when explicitly undefined", () => {
    expect(buildMediaRoutes({ base: undefined, library: "/" }).library).toBe("/");
  });
});

describe("route helpers", () => {
  it("resolves locale patterns", () => {
    expect(routeForLocale("/[locale]/media", "en")).toBe("/en/media");
    expect(routeForLocale("/:locale/media")).toBe("/media");
  });

  it("redirects to a route or falls back to root", () => {
    const routes = buildMediaRoutes({ base: "/[locale]" });
    expect(mediaRedirect(routes, "upload", "es")).toBe("/es/media/upload");
    expect(mediaRedirect({ admin: undefined }, "admin")).toBe("/");
  });
});

describe("faMedia integration", () => {
  it("is headless by default: defines env, injects nothing", () => {
    const { injectRoute, addMiddleware, updateConfig, logger } = runSetup();
    expect(injectRoute).not.toHaveBeenCalled();
    expect(addMiddleware).not.toHaveBeenCalled();
    const define = updateConfig.mock.calls[0][0].vite.define;
    expect(define["import.meta.env.PUBLIC_FA_MEDIA_API_BASE"]).toBe(JSON.stringify("/media"));
    // fa-auth-astro is the default provider; with no integrations it warns.
    expect(logger.warn).toHaveBeenCalled();
  });

  it("uses explicit base values when supplied", () => {
    const { updateConfig } = runSetup({ apiBase: "/m", v1Base: "/api", legacyBase: "/legacy", auth: { adminRole: "admin" } });
    const define = updateConfig.mock.calls[0][0].vite.define;
    expect(define["import.meta.env.PUBLIC_FA_MEDIA_V1_BASE"]).toBe(JSON.stringify("/api"));
    expect(define["import.meta.env.PUBLIC_FA_MEDIA_LEGACY_BASE"]).toBe(JSON.stringify("/legacy"));
    expect(define["import.meta.env.PUBLIC_FA_MEDIA_ADMIN_ROLE"]).toBe(JSON.stringify("admin"));
  });

  it("injects starter routes and respects integration order", () => {
    const { injectRoute, logger } = runSetup(
      { mode: "starter" },
      { config: { integrations: [{ name: "@mano8/astro-auth-m8" }, { name: "@mano8/astro-media-m8" }] } }
    );
    expect(injectRoute).toHaveBeenCalledTimes(5);
    const patterns = injectRoute.mock.calls.map(([arg]) => (arg as { pattern: string }).pattern);
    expect(patterns).toContain("/media/upload");
    expect(patterns).toContain("/admin/media");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("injects package starter route entrypoints for the shipped views", () => {
    const { injectRoute } = runSetup({ mode: "starter", auth: { provider: "none" } });
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: "/media/upload",
      entrypoint: "@mano8/astro-media-m8/routes/upload.astro"
    });
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: "/media",
      entrypoint: "@mano8/astro-media-m8/routes/library.astro"
    });
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: "/media/object/[id]",
      entrypoint: "@mano8/astro-media-m8/routes/object/[id].astro"
    });
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: "/media/presets",
      entrypoint: "@mano8/astro-media-m8/routes/presets.astro"
    });
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: "/admin/media",
      entrypoint: "@mano8/astro-media-m8/routes/admin/media.astro"
    });
  });

  it("warns when the auth plugin is registered after media", () => {
    const { logger } = runSetup(
      { mode: "starter" },
      { config: { integrations: [{ name: "@mano8/astro-media-m8" }, {}, { name: "@mano8/astro-auth-m8" }] } }
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("should be listed before"));
  });

  it("does not warn about order when media is absent from the list", () => {
    const { logger } = runSetup(
      { mode: "headless" },
      { config: { integrations: [{ name: "@mano8/astro-auth-m8" }] } }
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("warns for a custom provider without an adapter import, but not with one", () => {
    const without = runSetup({ auth: { provider: "custom" } });
    expect(without.logger.warn).toHaveBeenCalledWith(expect.stringContaining("custom"));
    const withImport = runSetup({ auth: { provider: "custom", adapterImport: "./my-adapter.js" } });
    expect(withImport.logger.warn).not.toHaveBeenCalled();
  });

  it("warns when starter routes are enabled with provider none", () => {
    const { injectRoute, logger } = runSetup({ mode: "starter", auth: { provider: "none" } });
    expect(injectRoute).toHaveBeenCalledTimes(5);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("requires fa-auth-m8"));
  });

  it("skips route injection when views.strategy is none", () => {
    const { injectRoute } = runSetup({ mode: "starter", auth: { provider: "none" }, views: { strategy: "none" } });
    expect(injectRoute).not.toHaveBeenCalled();
  });

  it("skips the admin route when admin is disabled and skips disabled fragments", () => {
    const { injectRoute } = runSetup({
      mode: "starter",
      auth: { provider: "none" },
      admin: { enabled: false },
      routes: { upload: false }
    });
    const patterns = injectRoute.mock.calls.map(([arg]) => (arg as { pattern: string }).pattern);
    expect(patterns).not.toContain("/admin/media");
    expect(patterns).not.toContain("/media/upload");
    expect(patterns).toContain("/media");
  });

  it("registers middleware when guards are enabled", () => {
    const { addMiddleware } = runSetup({ guards: { middleware: true } });
    expect(addMiddleware).toHaveBeenCalledWith({ order: "pre", entrypoint: "@mano8/astro-media-m8/middleware" });
  });

  it("injects an empty CSP policy when middleware is not active (headless default)", () => {
    const { updateConfig } = runSetup({ apiBase: "/media" });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    expect(define["import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY"]).toBe(JSON.stringify(""));
  });

  it("injects a non-empty CSP policy when middleware is active", () => {
    const { updateConfig } = runSetup({ guards: { middleware: true } });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(define["import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY"] as string) as string;
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("connect-src 'self'");
  });

  it("includes media origin in CSP connect-src when apiBase is an external URL", () => {
    const { updateConfig } = runSetup({ apiBase: "https://media.example.com/media", guards: { middleware: true } });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(define["import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY"] as string) as string;
    expect(policy).toContain("https://media.example.com");
  });

  it("injects an empty CSP policy when csp.enabled is false even if middleware is active", () => {
    const { updateConfig } = runSetup({ guards: { middleware: true }, csp: { enabled: false } });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    expect(define["import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY"]).toBe(JSON.stringify(""));
  });

  it("forwards csp.connectExtraOrigins into connect-src", () => {
    const { updateConfig } = runSetup({
      guards: { middleware: true },
      csp: { connectExtraOrigins: ["https://auth.example.com"] }
    });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(define["import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY"] as string) as string;
    expect(policy).toContain("https://auth.example.com");
  });

  it("forwards csp.storageOrigin into connect-src for browser-direct uploads", () => {
    const { updateConfig } = runSetup({
      guards: { middleware: true },
      csp: { storageOrigin: "https://minio.example.com:9000" }
    });
    const define = updateConfig.mock.calls[0][0].vite.define as Record<string, string>;
    const policy = JSON.parse(define["import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY"] as string) as string;
    expect(policy).toContain("https://minio.example.com:9000");
  });
});

describe("middleware", () => {
  it("passes through to next when no CSP policy is set", () => {
    const next = vi.fn().mockReturnValue(new Response("ok"));
    // @ts-expect-error import.meta.env is not typed in tests
    import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY = "";
    const result = onRequest({}, next);
    expect(next).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
  });

  it("injects the CSP header on a synchronous response", () => {
    // @ts-expect-error import.meta.env is not typed in tests
    import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY = "default-src 'self'";
    const next = vi.fn().mockReturnValue(new Response("body", { status: 200 }));
    const result = onRequest({}, next) as Response;
    expect(result.headers.get("Content-Security-Policy")).toBe("default-src 'self'");
  });

  it("injects the CSP header on an async response", async () => {
    // @ts-expect-error import.meta.env is not typed in tests
    import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY = "default-src 'self'";
    const next = vi.fn().mockResolvedValue(new Response("body", { status: 200 }));
    const result = await (onRequest({}, next) as Promise<Response>);
    expect(result.headers.get("Content-Security-Policy")).toBe("default-src 'self'");
  });

  it("does not overwrite an existing CSP header", () => {
    // @ts-expect-error import.meta.env is not typed in tests
    import.meta.env.PUBLIC_FA_MEDIA_CSP_POLICY = "default-src 'self'";
    const existing = new Response("body", { headers: { "Content-Security-Policy": "default-src 'none'" } });
    const next = vi.fn().mockReturnValue(existing);
    const result = onRequest({}, next) as Response;
    expect(result.headers.get("Content-Security-Policy")).toBe("default-src 'none'");
  });
});

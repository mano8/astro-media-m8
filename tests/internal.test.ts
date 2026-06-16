import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());
vi.mock("../src/runtime/client.js", () => ({ request: requestMock }));

import { createInternalMediaClient } from "../src/runtime/api/internal.server.js";

const ENV = "MEDIA_INTERNAL_SERVICE_TOKEN";

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({});
  delete process.env[ENV];
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env[ENV];
  delete process.env.CUSTOM_TOKEN;
});

describe("internal server client", () => {
  it("refuses to load in a browser context", () => {
    vi.stubGlobal("window", {});
    expect(() => createInternalMediaClient({ token: "t" })).toThrow(/server/);
  });

  it("requires a service token from the environment", () => {
    expect(() => createInternalMediaClient()).toThrow(/MEDIA_INTERNAL_SERVICE_TOKEN/);
  });

  it("reads the default env var", () => {
    process.env[ENV] = "env-token";
    expect(() => createInternalMediaClient()).not.toThrow();
  });

  it("reads a custom env var", () => {
    process.env.CUSTOM_TOKEN = "custom";
    expect(() => createInternalMediaClient({ serviceTokenEnv: "CUSTOM_TOKEN" })).not.toThrow();
  });

  it("attaches the service token and calls the internal routes", async () => {
    const client = createInternalMediaClient({ token: "svc" });
    await client.applyScanResult("o1", { scan_status: "clean" });
    await client.registerVariant("o1", {
      variant_name: "t",
      storage_bucket: "bkt",
      object_key: "k",
      size_bytes: 1,
      format: "WEBP"
    });
    await client.updateVariantJob("j1", { status: "completed" });

    const paths = requestMock.mock.calls.map(([opts]) => opts.path);
    expect(paths).toEqual([
      "/internal/objects/o1/scan-result",
      "/internal/objects/o1/variants",
      "/internal/variant-jobs/j1"
    ]);
    for (const [opts] of requestMock.mock.calls) {
      expect(opts.headers.Authorization).toBe("Bearer svc");
      expect(opts.skipRefresh).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import { buildMediaConnectSrc, buildMediaCspPolicy, originOf } from "../src/lib/csp.js";

describe("originOf", () => {
  it("extracts the origin from an absolute URL", () => {
    expect(originOf("https://media.example.com/media")).toBe("https://media.example.com");
    expect(originOf("https://media.example.com:8443/media/v1/")).toBe("https://media.example.com:8443");
  });

  it("returns null for a relative path", () => {
    expect(originOf("/media")).toBeNull();
    expect(originOf("media")).toBeNull();
    expect(originOf("")).toBeNull();
  });
});

describe("buildMediaConnectSrc", () => {
  it("returns self-only for a relative apiBase", () => {
    expect(buildMediaConnectSrc("/media")).toBe("'self'");
  });

  it("adds the media service origin when apiBase is an absolute URL", () => {
    expect(buildMediaConnectSrc("https://media.example.com/media")).toBe("'self' https://media.example.com");
  });

  it("includes extra absolute origins", () => {
    const src = buildMediaConnectSrc("/media", ["https://cdn.example.com"]);
    expect(src).toBe("'self' https://cdn.example.com");
  });

  it("deduplicates when an extra origin matches the apiBase origin", () => {
    const src = buildMediaConnectSrc("https://media.example.com/media", ["https://media.example.com"]);
    expect(src).toBe("'self' https://media.example.com");
  });

  it("ignores extra entries that are relative paths (resolve to null)", () => {
    expect(buildMediaConnectSrc("/media", ["/cdn", "relative"])).toBe("'self'");
  });

  it("handles multiple unique extra origins", () => {
    const src = buildMediaConnectSrc("/media", ["https://cdn.example.com", "https://auth.example.com"]);
    expect(src).toContain("'self'");
    expect(src).toContain("https://cdn.example.com");
    expect(src).toContain("https://auth.example.com");
  });
});

describe("buildMediaCspPolicy", () => {
  it("includes all required directives", () => {
    const policy = buildMediaCspPolicy("/media");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("img-src 'self' data: blob: https:");
    expect(policy).toContain("font-src 'self' data:");
    expect(policy).toContain("connect-src 'self'");
  });

  it("restricts script-src to self without unsafe-inline", () => {
    const policy = buildMediaCspPolicy("/media");
    const scriptSrc = policy.split("; ").find(d => d.startsWith("script-src"));
    expect(scriptSrc).toBe("script-src 'self'");
  });

  it("allows style unsafe-inline for React inline styles", () => {
    const policy = buildMediaCspPolicy("/media");
    expect(policy).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("sets connect-src to self-only for a relative apiBase", () => {
    const policy = buildMediaCspPolicy("/media");
    const connectSrc = policy.split("; ").find(d => d.startsWith("connect-src"));
    expect(connectSrc).toBe("connect-src 'self'");
  });

  it("adds media origin to connect-src for an external apiBase", () => {
    const policy = buildMediaCspPolicy("https://media.example.com/media");
    expect(policy).toContain("connect-src 'self' https://media.example.com");
  });

  it("forwards connectExtraOrigins into connect-src", () => {
    const policy = buildMediaCspPolicy("/media", { connectExtraOrigins: ["https://cdn.example.com"] });
    expect(policy).toContain("https://cdn.example.com");
  });

  it("adds storageOrigin to connect-src for browser-direct presigned uploads", () => {
    const policy = buildMediaCspPolicy("/media", { storageOrigin: "https://minio.example.com:9000" });
    expect(policy).toContain("https://minio.example.com:9000");
  });

  it("ignores storageOrigin when empty", () => {
    const policy = buildMediaCspPolicy("/media", { storageOrigin: "" });
    const connectSrc = policy.split("; ").find(d => d.startsWith("connect-src"));
    expect(connectSrc).toBe("connect-src 'self'");
  });

  it("ignores storageOrigin when not a valid absolute URL", () => {
    const policy = buildMediaCspPolicy("/media", { storageOrigin: "not-a-url" });
    const connectSrc = policy.split("; ").find(d => d.startsWith("connect-src"));
    expect(connectSrc).toBe("connect-src 'self'");
  });

  it("deduplicates storageOrigin when it matches an existing origin", () => {
    const policy = buildMediaCspPolicy("https://media.example.com/media", { storageOrigin: "https://media.example.com" });
    const connectSrc = policy.split("; ").find(d => d.startsWith("connect-src")) ?? "";
    expect(connectSrc.split(" ").filter(t => t === "https://media.example.com")).toHaveLength(1);
  });

  it("combines storageOrigin and connectExtraOrigins in connect-src", () => {
    const policy = buildMediaCspPolicy("/media", {
      storageOrigin: "https://minio.example.com:9000",
      connectExtraOrigins: ["https://auth.example.com"],
    });
    expect(policy).toContain("https://minio.example.com:9000");
    expect(policy).toContain("https://auth.example.com");
  });

  it("formats directives separated by semicolons with no trailing separator", () => {
    const policy = buildMediaCspPolicy("/media");
    const parts = policy.split("; ");
    expect(parts.length).toBeGreaterThan(5);
    expect(policy).not.toMatch(/; $/);
    for (const part of parts) {
      expect(part).toMatch(/^[a-z-]+ .+/);
    }
  });
});

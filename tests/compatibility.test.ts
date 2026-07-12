import { describe, expect, it } from "vitest";
import {
  assertMediaServiceM8Compatibility,
  getMediaServiceM8Compatibility,
  isMediaServiceM8ServiceVersionCompatible,
  MEDIA_SERVICE_M8_CONTRACT
} from "../src/runtime/compatibility.js";

describe("media-service-m8 compatibility", () => {
  it("returns unknown without metadata", () => {
    const result = getMediaServiceM8Compatibility();
    expect(result.status).toBe("unknown");
    expect(result.expectedContract).toBe(MEDIA_SERVICE_M8_CONTRACT);
    expect(MEDIA_SERVICE_M8_CONTRACT).toBe("media-service-m8@1.0");
  });

  it("treats matching contract version or full id as compatible", () => {
    expect(getMediaServiceM8Compatibility({ contract_version: "1.0" }).status).toBe("compatible");
    expect(getMediaServiceM8Compatibility({ media_service_m8_contract: MEDIA_SERVICE_M8_CONTRACT }).status).toBe(
      "compatible"
    );
  });

  it("flags a mismatched contract version", () => {
    const result = getMediaServiceM8Compatibility({ media_contract_version: "2.0" });
    expect(result.status).toBe("incompatible");
    expect(result.reason).toContain("2.0");
    expect(getMediaServiceM8Compatibility({ contract_version: "0.0" }).status).toBe("incompatible");
  });

  it("checks the service version range", () => {
    expect(isMediaServiceM8ServiceVersionCompatible("1.0.0")).toBe(true);
    expect(isMediaServiceM8ServiceVersionCompatible("1.5.0")).toBe(true);
    expect(isMediaServiceM8ServiceVersionCompatible("1.0.1")).toBe(true);
    expect(isMediaServiceM8ServiceVersionCompatible("0.9.9")).toBe(false);
    expect(isMediaServiceM8ServiceVersionCompatible("0.0.10")).toBe(false);
    expect(isMediaServiceM8ServiceVersionCompatible("2.0.0")).toBe(false);
    expect(isMediaServiceM8ServiceVersionCompatible("nope")).toBe(false);
    expect(getMediaServiceM8Compatibility({ service_version: "1.0.0" }).status).toBe("compatible");
    expect(getMediaServiceM8Compatibility({ version: "0.9.0" }).status).toBe("incompatible");
  });

  it("reads the GET /meta payload shape (nested contract + version)", () => {
    const meta = {
      service: "M8MediaService",
      version: "1.0.0",
      api_version: "v1",
      contract: { name: "media-service-m8", version: "1.0", range: ">=1.0.0 <2.0.0" }
    };
    const result = getMediaServiceM8Compatibility(meta);
    expect(result.status).toBe("compatible");
    expect(result.contractVersion).toBe("1.0");
    expect(result.serviceVersion).toBe("1.0.0");
    expect(getMediaServiceM8Compatibility({ version: "1.0.0", contract: { version: "2.0" } }).status).toBe(
      "incompatible"
    );
  });

  it("ignores blank metadata strings", () => {
    expect(getMediaServiceM8Compatibility({ contract: "   ", version: "   " }).status).toBe("unknown");
  });

  it("prefers media-specific keys for both fields", () => {
    const result = getMediaServiceM8Compatibility({
      media_service_m8_version: "1.0.0",
      media_contract: "1.0"
    });
    expect(result.serviceVersion).toBe("1.0.0");
    expect(result.contractVersion).toBe("1.0");
  });

  it("asserts compatibility and throws on incompatible/unknown", () => {
    expect(assertMediaServiceM8Compatibility({ contract_version: "1.0" }).status).toBe("compatible");
    expect(() => assertMediaServiceM8Compatibility({ contract_version: "2.0" })).toThrow();
    expect(() => assertMediaServiceM8Compatibility({ contract_version: "0.0" })).toThrow();
    expect(() => assertMediaServiceM8Compatibility({})).toThrow();
    expect(assertMediaServiceM8Compatibility({}, false).status).toBe("unknown");
  });
});

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

  it("admits the live media-service-m8 GET /meta payload verbatim", () => {
    // Verbatim auth-sdk-m8 ServiceMeta as media-service-m8 serves it at
    // {API_PREFIX}/meta: PROJECT_NAME, __version__ and the CONTRACT_* settings
    // measured at the service's HEAD. Hand-written flat fixtures are how the
    // service-version and payload-shape axes drift unnoticed across the fleet.
    const meta = {
      service: "M8MediaService",
      version: "1.0.0",
      api_version: "v1",
      contract: { name: "media-service-m8", version: "1.0", range: ">=1.0.0 <2.0.0" }
    };
    expect(getMediaServiceM8Compatibility(meta)).toMatchObject({
      status: "compatible",
      contractVersion: "1.0",
      serviceVersion: "1.0.0"
    });
    expect(() => assertMediaServiceM8Compatibility(meta)).not.toThrow();

    // Adjacent out-of-range service version on the same payload shape.
    expect(getMediaServiceM8Compatibility({ ...meta, version: "2.0.0" })).toMatchObject({
      status: "incompatible",
      serviceVersion: "2.0.0"
    });
  });

  it("rejects another service's /meta even when its contract version matches", () => {
    // Every M8 service serves this payload shape from the shared auth-sdk-m8
    // `mount_service_meta` helper, so a host pointed at the wrong sibling must be
    // named as a wrong contract, not blessed because the version digits happen to
    // line up. fa-auth-m8 serves contract.version "2.0", but a sibling on "1.0"
    // is the case the version comparison alone cannot catch.
    const wrongService = {
      service: "M8FastApi",
      version: "1.0.0",
      api_version: "v1",
      contract: { name: "reparto-docente-m8", version: "1.0", range: ">=1.0.0 <2.0.0" }
    };
    const result = getMediaServiceM8Compatibility(wrongService);

    expect(result.status).toBe("incompatible");
    expect(result.reason).toContain("reparto-docente-m8");
    expect(result.reason).toContain(MEDIA_SERVICE_M8_CONTRACT);
    expect(() => assertMediaServiceM8Compatibility(wrongService)).toThrow("reparto-docente-m8");
  });

  it("accepts a nested contract that names the expected issuer", () => {
    expect(
      getMediaServiceM8Compatibility({ contract: { name: "media-service-m8", version: "1.0" } })
    ).toMatchObject({ status: "compatible", contractVersion: "1.0" });
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

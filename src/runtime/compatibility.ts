export const MEDIA_SERVICE_M8_CONTRACT_ID = "media-service-m8";
// Pre-1.0 contract: tracks the service package major.minor (0.0.x), not an
// aspirational 1.0 — kept in lockstep with media-service-m8's CONTRACT_VERSION.
export const MEDIA_SERVICE_M8_CONTRACT_VERSION = "0.0";
export const MEDIA_SERVICE_M8_CONTRACT = `${MEDIA_SERVICE_M8_CONTRACT_ID}@${MEDIA_SERVICE_M8_CONTRACT_VERSION}` as const;
// 0.0.10 is the first media-service-m8 release supporting the media library's
// filename/category/status server-side sorting contract.
export const MEDIA_SERVICE_M8_TESTED_SERVICE_VERSION = "0.0.10";
export const MEDIA_SERVICE_M8_MIN_SERVICE_VERSION = "0.0.10";
export const MEDIA_SERVICE_M8_MAX_SERVICE_VERSION_EXCLUSIVE = "0.1.0";
export const MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE = `>=${MEDIA_SERVICE_M8_MIN_SERVICE_VERSION} <${MEDIA_SERVICE_M8_MAX_SERVICE_VERSION_EXCLUSIVE}`;

export type MediaServiceM8CompatibilityStatus = "compatible" | "incompatible" | "unknown";

export type MediaServiceM8VersionMetadata = {
  // ``contract`` accepts a flat string (legacy) or the GET /meta nested object
  // ``{ name, version, range }`` — the shape auth-sdk-m8 ServiceMeta returns.
  contract?: unknown;
  contract_version?: unknown;
  media_contract?: unknown;
  media_contract_version?: unknown;
  media_service_m8_contract?: unknown;
  version?: unknown;
  service_version?: unknown;
  media_service_m8_version?: unknown;
  // Extra GET /meta keys, accepted so the raw payload is assignable as-is.
  service?: unknown;
  api_version?: unknown;
};

export type MediaServiceM8Compatibility = {
  status: MediaServiceM8CompatibilityStatus;
  expectedContract: typeof MEDIA_SERVICE_M8_CONTRACT;
  expectedServiceVersionRange: typeof MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE;
  contractVersion?: string;
  serviceVersion?: string;
  reason?: string;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Read ``contract.version`` from the GET /meta nested contract object.
function contractObjectVersion(value: unknown): string | undefined {
  if (typeof value === "object" && value !== null) {
    return stringValue((value as { version?: unknown }).version);
  }
  return undefined;
}

function parseSemver(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(left: string, right: string): number | undefined {
  const parsedLeft = parseSemver(left);
  const parsedRight = parseSemver(right);
  if (!parsedLeft || !parsedRight) return undefined;
  for (let index = 0; index < parsedLeft.length; index += 1) {
    if (parsedLeft[index] > parsedRight[index]) return 1;
    if (parsedLeft[index] < parsedRight[index]) return -1;
  }
  return 0;
}

export function isMediaServiceM8ServiceVersionCompatible(version: string): boolean {
  const aboveMin = compareSemver(version, MEDIA_SERVICE_M8_MIN_SERVICE_VERSION);
  const belowMax = compareSemver(version, MEDIA_SERVICE_M8_MAX_SERVICE_VERSION_EXCLUSIVE);
  return aboveMin !== undefined && belowMax !== undefined && aboveMin >= 0 && belowMax < 0;
}

export function getMediaServiceM8Compatibility(
  metadata: MediaServiceM8VersionMetadata = {}
): MediaServiceM8Compatibility {
  const contractVersion =
    stringValue(metadata.media_contract_version) ??
    stringValue(metadata.contract_version) ??
    stringValue(metadata.media_service_m8_contract) ??
    stringValue(metadata.media_contract) ??
    contractObjectVersion(metadata.contract) ??
    stringValue(metadata.contract);
  const serviceVersion =
    stringValue(metadata.media_service_m8_version) ??
    stringValue(metadata.service_version) ??
    stringValue(metadata.version);

  if (
    contractVersion &&
    contractVersion !== MEDIA_SERVICE_M8_CONTRACT_VERSION &&
    contractVersion !== MEDIA_SERVICE_M8_CONTRACT
  ) {
    return {
      status: "incompatible",
      expectedContract: MEDIA_SERVICE_M8_CONTRACT,
      expectedServiceVersionRange: MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion,
      reason: `Expected ${MEDIA_SERVICE_M8_CONTRACT}, received ${contractVersion}`
    };
  }

  if (serviceVersion && !isMediaServiceM8ServiceVersionCompatible(serviceVersion)) {
    return {
      status: "incompatible",
      expectedContract: MEDIA_SERVICE_M8_CONTRACT,
      expectedServiceVersionRange: MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion,
      reason: `Expected media-service-m8 service version ${MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE}, received ${serviceVersion}`
    };
  }

  if (contractVersion || serviceVersion) {
    return {
      status: "compatible",
      expectedContract: MEDIA_SERVICE_M8_CONTRACT,
      expectedServiceVersionRange: MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE,
      contractVersion,
      serviceVersion
    };
  }

  return {
    status: "unknown",
    expectedContract: MEDIA_SERVICE_M8_CONTRACT,
    expectedServiceVersionRange: MEDIA_SERVICE_M8_SERVICE_VERSION_RANGE,
    reason: "No media-service-m8 contract or service version metadata was provided"
  };
}

export function assertMediaServiceM8Compatibility(
  metadata: MediaServiceM8VersionMetadata,
  requireKnown = true
): MediaServiceM8Compatibility {
  const compatibility = getMediaServiceM8Compatibility(metadata);
  if (compatibility.status === "incompatible" || (requireKnown && compatibility.status === "unknown")) {
    throw new Error(compatibility.reason);
  }
  return compatibility;
}

export type MediaPollingConfig = {
  /** Interval between variant-job status polls, in milliseconds. */
  variantJobMs: number;
  /** Interval between object scan-status polls, in milliseconds. */
  uploadScanMs: number;
  /** Hard ceiling for any polling helper, in milliseconds. */
  timeoutMs: number;
};

export type MediaRuntimeConfig = {
  /** Service mount, e.g. "/media" — prepended to every request path. */
  apiBase: string;
  /** Sub-prefix for the versioned resource routes (uploads/objects/...). */
  v1Base: string;
  /** Sub-prefix for legacy routes (dashboard/category); usually empty. */
  legacyBase: string;
  /** Header sent on every request so a same-origin stack can pin CSRF. */
  csrfHeader: string;
  /** Role string that grants admin access through the auth adapter. */
  adminRole: string;
  polling: MediaPollingConfig;
};

const DEFAULT_CONFIG: MediaRuntimeConfig = {
  apiBase: "/media",
  v1Base: "/v1",
  legacyBase: "",
  csrfHeader: "X-Requested-With",
  adminRole: "is_superuser",
  polling: {
    variantJobMs: 1500,
    uploadScanMs: 2000,
    timeoutMs: 120000
  }
};

let runtimeConfig: MediaRuntimeConfig = cloneConfig(DEFAULT_CONFIG);

function cloneConfig(config: MediaRuntimeConfig): MediaRuntimeConfig {
  return { ...config, polling: { ...config.polling } };
}

export function configureMedia(config: Partial<Omit<MediaRuntimeConfig, "polling">> & {
  polling?: Partial<MediaPollingConfig>;
} = {}): MediaRuntimeConfig {
  const { polling, ...rest } = config;
  runtimeConfig = {
    ...runtimeConfig,
    ...rest,
    polling: { ...runtimeConfig.polling, ...polling }
  };
  return runtimeConfig;
}

export function getMediaConfig(): MediaRuntimeConfig {
  return runtimeConfig;
}

export function resetMediaConfig(): void {
  runtimeConfig = cloneConfig(DEFAULT_CONFIG);
}

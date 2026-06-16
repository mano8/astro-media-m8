import { useCallback, useState } from "react";
import {
  getOrphans,
  getStaleUploads,
  getStorageStats,
  purgeExpired,
  purgeStaleUploads,
  repairOrphans
} from "../api/admin.js";
import { ForbiddenError } from "../errors.js";
import { useMediaContext } from "../react/MediaProvider.js";
import type {
  HardPurgeResponse,
  OrphanReport,
  PurgeStaleResponse,
  StaleUploadsResponse,
  StorageStatsResponse
} from "../schemas.js";

export type UseMediaAdmin = {
  allowed: boolean;
  stats: StorageStatsResponse | null;
  stale: StaleUploadsResponse | null;
  orphans: OrphanReport | null;
  loading: boolean;
  error: unknown;
  loadStats: () => Promise<void>;
  loadStale: () => Promise<void>;
  purgeStale: () => Promise<PurgeStaleResponse>;
  loadOrphans: () => Promise<void>;
  repair: (confirm: boolean) => Promise<OrphanReport>;
  purgeExpiredObjects: () => Promise<HardPurgeResponse>;
};

/**
 * Admin operations gated client-side: when the auth adapter already reports a
 * non-superuser, every action rejects with `ForbiddenError` before any request.
 */
export function useMediaAdmin(): UseMediaAdmin {
  const { isSuperuser } = useMediaContext();
  const [stats, setStats] = useState<StorageStatsResponse | null>(null);
  const [stale, setStale] = useState<StaleUploadsResponse | null>(null);
  const [orphans, setOrphans] = useState<OrphanReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const guard = useCallback(
    async <T>(task: () => Promise<T>): Promise<T> => {
      if (!isSuperuser) throw new ForbiddenError();
      setLoading(true);
      try {
        const result = await task();
        setError(null);
        return result;
      } catch (err) {
        setError(err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [isSuperuser]
  );

  return {
    allowed: isSuperuser,
    stats,
    stale,
    orphans,
    loading,
    error,
    loadStats: () => guard(getStorageStats).then(setStats),
    loadStale: () => guard(getStaleUploads).then(setStale),
    purgeStale: () => guard(purgeStaleUploads),
    loadOrphans: () => guard(getOrphans).then(setOrphans),
    repair: (confirm: boolean) => guard(() => repairOrphans(confirm)),
    purgeExpiredObjects: () => guard(purgeExpired)
  };
}

import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryObserverResult,
  type UseMutationResult
} from "@tanstack/react-query";
import {
  deleteSubscription,
  getOrphans,
  getStaleUploads,
  getStorageStats,
  listSubscriptions,
  purgeExpired,
  purgeStaleUploads,
  repairOrphans
} from "../api/admin.js";
import { ForbiddenError } from "../errors.js";
import { mediaKeys } from "../queryKeys.js";
import { useMediaContext } from "../react/MediaProvider.js";
import type {
  HardPurgeResponse,
  OrphanReport,
  PurgeStaleResponse,
  StaleUploadsResponse,
  StorageStatsResponse,
  SubscriptionListResponse
} from "../schemas.js";

type PurgeStaleMutation = UseMutationResult<PurgeStaleResponse, unknown, void>;
type RepairMutation = UseMutationResult<OrphanReport, unknown, boolean>;
type PurgeExpiredMutation = UseMutationResult<HardPurgeResponse, unknown, void>;
type RemoveSubscriptionMutation = UseMutationResult<void, unknown, string>;

export type UseMediaAdmin = {
  allowed: boolean;
  stats: StorageStatsResponse | null;
  stale: StaleUploadsResponse | null;
  orphans: OrphanReport | null;
  subscriptions: SubscriptionListResponse | null;
  loading: boolean;
  error: unknown;
  loadStats: () => Promise<void>;
  loadStale: () => Promise<void>;
  purgeStale: () => Promise<PurgeStaleResponse>;
  loadOrphans: () => Promise<void>;
  repair: (confirm: boolean) => Promise<OrphanReport>;
  purgeExpiredObjects: () => Promise<HardPurgeResponse>;
  loadSubscriptions: () => Promise<void>;
  removeSubscription: (id: string) => Promise<void>;
  purgeStaleMutation: PurgeStaleMutation;
  repairMutation: RepairMutation;
  purgeExpiredMutation: PurgeExpiredMutation;
  removeSubscriptionMutation: RemoveSubscriptionMutation;
};

/**
 * Admin operations gated client-side: when the auth adapter already reports a
 * non-superuser, every action rejects with `ForbiddenError` before any request.
 */
async function refetchOrThrow<TData>(
  refetch: () => Promise<QueryObserverResult<TData, unknown>>
): Promise<TData> {
  const result = await refetch();
  if (result.error) throw result.error;
  if (result.data === undefined) throw new Error("No data returned");
  return result.data;
}

export function useMediaAdmin(): UseMediaAdmin {
  const { isSuperuser } = useMediaContext();
  const queryClient = useQueryClient();

  const guard = useCallback(
    <T,>(task: () => Promise<T>): Promise<T> => {
      if (!isSuperuser) return Promise.reject(new ForbiddenError());
      return task();
    },
    [isSuperuser]
  );

  const statsQuery = useQuery<StorageStatsResponse, unknown>({
    queryKey: mediaKeys.adminStats(),
    queryFn: () => guard(getStorageStats),
    enabled: false
  });
  const staleQuery = useQuery<StaleUploadsResponse, unknown>({
    queryKey: mediaKeys.adminStaleUploads(),
    queryFn: () => guard(getStaleUploads),
    enabled: false
  });
  const orphansQuery = useQuery<OrphanReport, unknown>({
    queryKey: mediaKeys.adminOrphans(),
    queryFn: () => guard(getOrphans),
    enabled: false
  });
  const subscriptionsQuery = useQuery<SubscriptionListResponse, unknown>({
    queryKey: mediaKeys.adminSubscriptions(),
    queryFn: () => guard(listSubscriptions),
    enabled: false
  });

  const purgeStaleMutation = useMutation<PurgeStaleResponse, unknown>({
    mutationFn: () => guard(purgeStaleUploads),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: mediaKeys.adminStaleUploads(), exact: true }),
        queryClient.invalidateQueries({ queryKey: mediaKeys.adminStats(), exact: true })
      ]);
    }
  });
  const repairMutation = useMutation<OrphanReport, unknown, boolean>({
    mutationFn: (confirm) => guard(() => repairOrphans(confirm)),
    onSuccess: async (report) => {
      queryClient.setQueryData(mediaKeys.adminOrphans(), report);
      await queryClient.invalidateQueries({ queryKey: mediaKeys.adminStats(), exact: true });
    }
  });
  const purgeExpiredMutation = useMutation<HardPurgeResponse, unknown>({
    mutationFn: () => guard(purgeExpired),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: mediaKeys.adminStats(), exact: true }),
        queryClient.invalidateQueries({ queryKey: mediaKeys.adminOrphans(), exact: true }),
        queryClient.invalidateQueries({ queryKey: mediaKeys.objectLists() })
      ]);
    }
  });
  const removeSubscriptionMutation = useMutation<void, unknown, string>({
    mutationFn: (id) => guard(() => deleteSubscription(id)),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<SubscriptionListResponse>(mediaKeys.adminSubscriptions(), (current) =>
        current
          ? {
              count: Math.max(0, current.count - 1),
              items: current.items.filter((item) => item.id !== id)
            }
          : current
      );
    }
  });

  return {
    allowed: isSuperuser,
    stats: statsQuery.data ?? null,
    stale: staleQuery.data ?? null,
    orphans: orphansQuery.data ?? null,
    subscriptions: subscriptionsQuery.data ?? null,
    loading:
      statsQuery.isFetching ||
      staleQuery.isFetching ||
      orphansQuery.isFetching ||
      subscriptionsQuery.isFetching ||
      purgeStaleMutation.isPending ||
      repairMutation.isPending ||
      purgeExpiredMutation.isPending ||
      removeSubscriptionMutation.isPending,
    error:
      statsQuery.error ??
      staleQuery.error ??
      orphansQuery.error ??
      subscriptionsQuery.error ??
      purgeStaleMutation.error ??
      repairMutation.error ??
      purgeExpiredMutation.error ??
      removeSubscriptionMutation.error ??
      null,
    loadStats: async () => {
      await refetchOrThrow(() => statsQuery.refetch());
    },
    loadStale: async () => {
      await refetchOrThrow(() => staleQuery.refetch());
    },
    purgeStale: () => purgeStaleMutation.mutateAsync(),
    loadOrphans: async () => {
      await refetchOrThrow(() => orphansQuery.refetch());
    },
    repair: (confirm: boolean) => repairMutation.mutateAsync(confirm),
    purgeExpiredObjects: () => purgeExpiredMutation.mutateAsync(),
    loadSubscriptions: async () => {
      await refetchOrThrow(() => subscriptionsQuery.refetch());
    },
    removeSubscription: (id: string) => removeSubscriptionMutation.mutateAsync(id),
    purgeStaleMutation,
    repairMutation,
    purgeExpiredMutation,
    removeSubscriptionMutation
  };
}

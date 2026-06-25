import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import {
  deleteVariant,
  generateVariants,
  listVariants,
  waitForVariantJob
} from "../api/variants.js";
import { mediaKeys } from "../queryKeys.js";
import type { VariantJobPublic, VariantListResponse, VariantPublic } from "../schemas.js";

type GenerateVariantsMutation = UseMutationResult<VariantJobPublic, unknown, string[]>;
type RemoveVariantMutation = UseMutationResult<void, unknown, string>;

export type UseMediaVariants = {
  items: VariantPublic[];
  loading: boolean;
  error: unknown;
  job: VariantJobPublic | null;
  reload: () => Promise<void>;
  generate: (presets: string[]) => Promise<VariantJobPublic>;
  remove: (variantId: string) => Promise<void>;
  generateMutation: GenerateVariantsMutation;
  removeMutation: RemoveVariantMutation;
};

export function useMediaVariants(objectId: string | null): UseMediaVariants {
  const queryClient = useQueryClient();
  const [job, setJob] = useState<VariantJobPublic | null>(null);
  const queryKey = mediaKeys.variants(objectId ?? "");
  const query = useQuery<VariantListResponse, unknown>({
    queryKey,
    queryFn: () => {
      if (!objectId) return { items: [], count: 0 };
      return listVariants(objectId);
    },
    enabled: Boolean(objectId)
  });

  const reload = useCallback(async () => {
    if (!objectId) return;
    await query.refetch();
  }, [objectId, query]);

  const generateMutation = useMutation<VariantJobPublic, unknown, string[]>({
    mutationFn: async (presets) => {
      if (!objectId) throw new Error("No object selected");
      const started = await generateVariants(objectId, { presets });
      setJob(started);
      return waitForVariantJob(objectId, started.id, { onUpdate: setJob });
    },
    onSuccess: async (_finished) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey, exact: true }),
        objectId
          ? queryClient.invalidateQueries({ queryKey: mediaKeys.object(objectId), exact: true, refetchType: "none" })
          : Promise.resolve()
      ]);
    }
  });

  const removeMutation = useMutation<void, unknown, string>({
    mutationFn: async (variantId) => {
      if (!objectId) throw new Error("No object selected");
      await deleteVariant(objectId, variantId);
    },
    onSuccess: async (_result, variantId) => {
      queryClient.setQueryData<VariantListResponse>(queryKey, (current) =>
        current
          ? {
              count: Math.max(0, current.count - 1),
              items: current.items.filter((variant) => variant.id !== variantId)
            }
          : current
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" }),
        objectId
          ? queryClient.invalidateQueries({ queryKey: mediaKeys.object(objectId), exact: true, refetchType: "none" })
          : Promise.resolve()
      ]);
    }
  });

  const generate = useCallback((presets: string[]) => generateMutation.mutateAsync(presets), [generateMutation]);
  const remove = useCallback((variantId: string) => removeMutation.mutateAsync(variantId), [removeMutation]);

  return {
    items: query.data?.items ?? [],
    loading: query.isFetching,
    error: query.error ?? null,
    job,
    reload,
    generate,
    remove,
    generateMutation,
    removeMutation
  };
}

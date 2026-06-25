import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { createPreset, deletePreset, listPresets, updatePreset } from "../api/presets.js";
import { mediaKeys } from "../queryKeys.js";
import type { ImagePresetCreate, ImagePresetPublic, ImagePresetUpdate } from "../schemas.js";

type UpdatePresetVariables = {
  id: string;
  body: ImagePresetUpdate;
};
type CreatePresetMutation = UseMutationResult<ImagePresetPublic, unknown, ImagePresetCreate>;
type UpdatePresetMutation = UseMutationResult<ImagePresetPublic, unknown, UpdatePresetVariables>;
type RemovePresetMutation = UseMutationResult<void, unknown, string>;

export type UseMediaPresets = {
  presets: ImagePresetPublic[];
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
  create: (body: ImagePresetCreate) => Promise<ImagePresetPublic>;
  update: (id: string, body: ImagePresetUpdate) => Promise<ImagePresetPublic>;
  remove: (id: string) => Promise<void>;
  createMutation: CreatePresetMutation;
  updateMutation: UpdatePresetMutation;
  removeMutation: RemovePresetMutation;
};

export function useMediaPresets(): UseMediaPresets {
  const queryClient = useQueryClient();
  const queryKey = mediaKeys.presets();
  const query = useQuery<ImagePresetPublic[], unknown>({
    queryKey,
    queryFn: listPresets
  });

  const reload = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const createMutation = useMutation<ImagePresetPublic, unknown, ImagePresetCreate>({
    mutationFn: createPreset,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey, exact: true });
    }
  });

  const updateMutation = useMutation<ImagePresetPublic, unknown, UpdatePresetVariables>({
    mutationFn: ({ id, body }) => updatePreset(id, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey, exact: true });
    }
  });

  const removeMutation = useMutation<void, unknown, string>({
    mutationFn: async (id) => {
      await deletePreset(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey, exact: true });
    }
  });

  const create = useCallback((body: ImagePresetCreate) => createMutation.mutateAsync(body), [createMutation]);
  const update = useCallback(
    (id: string, body: ImagePresetUpdate) => updateMutation.mutateAsync({ id, body }),
    [updateMutation]
  );
  const remove = useCallback((id: string) => removeMutation.mutateAsync(id), [removeMutation]);

  return {
    presets: query.data ?? [],
    loading: query.isFetching,
    error: query.error ?? null,
    reload,
    create,
    update,
    remove,
    createMutation,
    updateMutation,
    removeMutation
  };
}

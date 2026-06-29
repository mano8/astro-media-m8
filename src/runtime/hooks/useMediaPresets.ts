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
  const { refetch } = query;
  const { mutateAsync: createPresetAsync } = createMutation;
  const { mutateAsync: updatePresetAsync } = updateMutation;
  const { mutateAsync: removePresetAsync } = removeMutation;

  const reload = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const create = useCallback((body: ImagePresetCreate) => createPresetAsync(body), [createPresetAsync]);
  const update = useCallback(
    (id: string, body: ImagePresetUpdate) => updatePresetAsync({ id, body }),
    [updatePresetAsync]
  );
  const remove = useCallback((id: string) => removePresetAsync(id), [removePresetAsync]);

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

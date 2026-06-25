import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { deleteObject, getObject, updateObject } from "../api/objects.js";
import { mediaKeys } from "../queryKeys.js";
import type { MediaObjectPublic, MediaObjectUpdate } from "../schemas.js";

type UpdateObjectMutation = UseMutationResult<MediaObjectPublic, unknown, MediaObjectUpdate>;
type RemoveObjectMutation = UseMutationResult<void, unknown, void>;

export type UseMediaObject = {
  object: MediaObjectPublic | null;
  loading: boolean;
  error: unknown;
  reload: () => Promise<void>;
  update: (patch: MediaObjectUpdate) => Promise<MediaObjectPublic>;
  remove: () => Promise<void>;
  updateMutation: UpdateObjectMutation;
  removeMutation: RemoveObjectMutation;
};

export function useMediaObject(objectId: string | null): UseMediaObject {
  const queryClient = useQueryClient();
  const queryKey = mediaKeys.object(objectId ?? "");
  const query = useQuery<MediaObjectPublic | null, unknown>({
    queryKey,
    queryFn: () => (objectId ? getObject(objectId) : null),
    enabled: Boolean(objectId)
  });

  const reload = useCallback(async () => {
    if (!objectId) return;
    await query.refetch();
  }, [objectId, query]);

  const updateMutation = useMutation<MediaObjectPublic, unknown, MediaObjectUpdate>({
    mutationFn: async (patch) => {
      if (!objectId) throw new Error("No object selected");
      return updateObject(objectId, patch);
    },
    onSuccess: async (next) => {
      queryClient.setQueryData(queryKey, next);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: mediaKeys.objectLists() })
      ]);
    }
  });

  const removeMutation = useMutation<void, unknown, void>({
    mutationFn: async () => {
      if (!objectId) throw new Error("No object selected");
      await deleteObject(objectId);
    },
    onSuccess: async () => {
      queryClient.setQueryData(queryKey, null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey, exact: true, refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: mediaKeys.objectLists() })
      ]);
    }
  });

  const update = useCallback((patch: MediaObjectUpdate) => updateMutation.mutateAsync(patch), [updateMutation]);
  const remove = useCallback(() => removeMutation.mutateAsync(), [removeMutation]);

  return {
    object: query.data ?? null,
    loading: query.isFetching,
    error: query.error ?? null,
    reload,
    update,
    remove,
    updateMutation,
    removeMutation
  };
}

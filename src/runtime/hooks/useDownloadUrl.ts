import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getDownloadUrl } from "../api/objects.js";
import { resolveShare } from "../api/shares.js";
import { mediaKeys } from "../queryKeys.js";
import type { DownloadUrlResponse } from "../schemas.js";

export type UseDownloadUrl = {
  data: DownloadUrlResponse | null;
  loading: boolean;
  error: unknown;
  /** Generate a fresh presigned URL for an owned object. */
  request: () => Promise<DownloadUrlResponse>;
  /** Resolve a public share token to a presigned URL. */
  resolve: (token: string) => Promise<DownloadUrlResponse>;
};

export function useDownloadUrl(objectId: string | null): UseDownloadUrl {
  const queryClient = useQueryClient();
  const requestMutation = useMutation<DownloadUrlResponse, unknown, void>({
    mutationKey: objectId ? mediaKeys.downloadUrl(objectId) : ["media", "download-url", ""],
    mutationFn: async () => {
      if (!objectId) throw new Error("No object selected");
      const result = await getDownloadUrl(objectId);
      queryClient.setQueryData(mediaKeys.downloadUrl(objectId), result);
      return result;
    }
  });
  const resolveMutation = useMutation<DownloadUrlResponse, unknown, string>({
    mutationFn: (token) => resolveShare(token)
  });
  const { mutateAsync: requestDownloadUrlAsync } = requestMutation;
  const { mutateAsync: resolveShareAsync } = resolveMutation;

  const request = useCallback(() => {
    if (!objectId) throw new Error("No object selected");
    return requestDownloadUrlAsync();
  }, [objectId, requestDownloadUrlAsync]);

  const resolve = useCallback((token: string) => resolveShareAsync(token), [resolveShareAsync]);

  const requestIsLatest = requestMutation.submittedAt >= resolveMutation.submittedAt;
  const latestData = requestIsLatest ? requestMutation.data : resolveMutation.data;
  const latestError = requestIsLatest ? requestMutation.error : resolveMutation.error;

  return {
    data: latestData ?? null,
    loading: requestMutation.isPending || resolveMutation.isPending,
    error: latestError ?? null,
    request,
    resolve
  };
}

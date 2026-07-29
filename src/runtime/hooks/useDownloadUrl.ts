import { useCallback, useRef, useState } from "react";
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

type LatestDownloadState = Pick<UseDownloadUrl, "data" | "loading" | "error">;

const INITIAL_DOWNLOAD_STATE: LatestDownloadState = {
  data: null,
  loading: false,
  error: null
};

export function useDownloadUrl(objectId: string | null): UseDownloadUrl {
  const queryClient = useQueryClient();
  const operationId = useRef(0);
  const [latest, setLatest] = useState<LatestDownloadState>(INITIAL_DOWNLOAD_STATE);
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

  const runLatest = useCallback(async (operation: () => Promise<DownloadUrlResponse>) => {
    const id = operationId.current + 1;
    operationId.current = id;
    setLatest({ data: null, loading: true, error: null });

    try {
      const result = await operation();
      if (operationId.current === id) {
        setLatest({ data: result, loading: false, error: null });
      }
      return result;
    } catch (error) {
      if (operationId.current === id) {
        setLatest({ data: null, loading: false, error });
      }
      throw error;
    }
  }, []);

  const request = useCallback(() => {
    if (!objectId) throw new Error("No object selected");
    return runLatest(requestDownloadUrlAsync);
  }, [objectId, requestDownloadUrlAsync, runLatest]);

  const resolve = useCallback((token: string) => runLatest(() => resolveShareAsync(token)), [resolveShareAsync, runLatest]);

  return {
    ...latest,
    request,
    resolve
  };
}

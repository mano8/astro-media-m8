import { useCallback, useState } from "react";
import { getDownloadUrl } from "../api/objects.js";
import { resolveShare } from "../api/shares.js";
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
  const [data, setData] = useState<DownloadUrlResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const run = useCallback(async (task: () => Promise<DownloadUrlResponse>) => {
    setLoading(true);
    try {
      const result = await task();
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const request = useCallback(() => {
    if (!objectId) throw new Error("No object selected");
    return run(() => getDownloadUrl(objectId));
  }, [objectId, run]);

  const resolve = useCallback((token: string) => run(() => resolveShare(token)), [run]);

  return { data, loading, error, request, resolve };
}

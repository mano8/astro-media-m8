import { useCallback, useEffect, useState } from "react";
import { listObjects } from "../api/objects.js";
import type { MediaObjectPublic, ObjectListParams } from "../schemas.js";

export type UseMediaObjects = {
  items: MediaObjectPublic[];
  count: number;
  loading: boolean;
  error: unknown;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
};

export function useMediaObjects(params: ObjectListParams = {}): UseMediaObjects {
  const [items, setItems] = useState<MediaObjectPublic[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const key = JSON.stringify(params);

  const load = useCallback(
    async (append: boolean, next: string | null) => {
      setLoading(true);
      try {
        const parsed = JSON.parse(key) as ObjectListParams;
        const response = await listObjects({ ...parsed, cursor: next ?? undefined });
        setItems((prev) => (append ? [...prev, ...response.items] : response.items));
        setCursor(response.next_cursor);
        setCount(response.count);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [key]
  );

  useEffect(() => {
    void load(false, null);
  }, [load]);

  return {
    items,
    count,
    loading,
    error,
    hasMore: cursor != null,
    refresh: () => load(false, null),
    loadMore: () => (cursor != null ? load(true, cursor) : Promise.resolve())
  };
}

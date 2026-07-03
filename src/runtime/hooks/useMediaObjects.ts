import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import { listObjects } from "../api/objects.js";
import { mediaKeys } from "../queryKeys.js";
import type { MediaObjectPublic, ObjectListParams, ObjectListResponse } from "../schemas.js";

export type UseMediaObjects = {
  items: MediaObjectPublic[];
  count: number;
  loading: boolean;
  error: unknown;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
};

type ObjectListPageParam = string | null;

function listParamsWithoutCursor(params: ObjectListParams): ObjectListParams {
  const next = { ...params };
  delete next.cursor;
  return next;
}

function flattenPages(data: InfiniteData<ObjectListResponse, ObjectListPageParam> | undefined): MediaObjectPublic[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

function latestCount(data: InfiniteData<ObjectListResponse, ObjectListPageParam> | undefined): number {
  return data?.pages.at(-1)?.count ?? 0;
}

export function useMediaObjects(params: ObjectListParams = {}): UseMediaObjects {
  const queryClient = useQueryClient();
  const {
    category,
    visibility,
    status,
    mime_prefix,
    created_from,
    created_to,
    q,
    sort_by,
    order,
    limit,
    owner_user_id,
    include_deleted
  } = params;
  const listParams = useMemo(
    () => listParamsWithoutCursor({
      category,
      visibility,
      status,
      mime_prefix,
      created_from,
      created_to,
      q,
      sort_by,
      order,
      limit,
      owner_user_id,
      include_deleted
    }),
    [
      category,
      created_from,
      created_to,
      include_deleted,
      limit,
      mime_prefix,
      order,
      owner_user_id,
      q,
      sort_by,
      status,
      visibility
    ]
  );
  const queryKey = useMemo(() => mediaKeys.objects(listParams), [listParams]);
  const query = useInfiniteQuery<
    ObjectListResponse,
    unknown,
    InfiniteData<ObjectListResponse, ObjectListPageParam>,
    typeof queryKey,
    ObjectListPageParam
  >({
    queryKey,
    initialPageParam: null,
    queryFn: ({ pageParam }) => listObjects({ ...listParams, cursor: pageParam ?? undefined }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined
  });
  const { fetchNextPage } = query;
  const hasNextPageRef = useRef(query.hasNextPage);
  const isFetchingNextPageRef = useRef(query.isFetchingNextPage);
  hasNextPageRef.current = query.hasNextPage;
  isFetchingNextPageRef.current = query.isFetchingNextPage;

  const refresh = useCallback(
    async () => {
      await queryClient.resetQueries({ queryKey, exact: true });
    },
    [queryClient, queryKey]
  );
  const loadMore = useCallback(async () => {
    if (!hasNextPageRef.current || isFetchingNextPageRef.current) return;
    await fetchNextPage();
  }, [fetchNextPage]);

  return {
    items: flattenPages(query.data),
    count: latestCount(query.data),
    loading: query.isFetching,
    error: query.error ?? null,
    hasMore: query.hasNextPage,
    refresh,
    loadMore
  };
}

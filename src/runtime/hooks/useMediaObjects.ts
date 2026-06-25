import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
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
  const listParams = listParamsWithoutCursor(params);
  const queryKey = mediaKeys.objects(listParams);
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

  return {
    items: flattenPages(query.data),
    count: latestCount(query.data),
    loading: query.isFetching,
    error: query.error ?? null,
    hasMore: query.hasNextPage,
    refresh: () => queryClient.resetQueries({ queryKey, exact: true }),
    loadMore: async () => {
      if (!query.hasNextPage || query.isFetchingNextPage) return;
      await query.fetchNextPage();
    }
  };
}

"use client";

// Documents-view tree pane: pairs `media-category-tree` (left, the shared
// `astro-ui-m8` `tree-view`) with the shadcn `data-table` (right), driven by
// this package's live `useMediaObjects` hook scoped to the selected branch.
// Reimplements no fetching and no tree mechanics — this file is only the
// shadcn/Tailwind composition; edit freely per app. Copied into the consumer
// via the @fa-m8-media registry (`U8`).
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/m8-ui/data-table";
import { StateError } from "@/components/m8-ui/state-error";

import { useMediaObjects } from "@mano8/astro-media-m8/hooks";
import type { MediaObjectPublic } from "@mano8/astro-media-m8/schemas";

import {
  MediaCategoryTree,
  categorySelectionToListParams,
  type MediaCategorySelection,
} from "./media-category-tree";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

// `scan_status` is a field separate from `status` (per `U2`'s own
// `MediaLibrary` badge); only the two scan-rejection states get a distinct
// destructive badge here, everything else renders as plain text.
const SCAN_BADGE_VARIANT: Partial<Record<MediaObjectPublic["scan_status"], "destructive">> = {
  infected: "destructive",
  quarantined: "destructive",
};

export interface MediaLibraryTreeLabels {
  paneAriaLabel: string;
  columnName: string;
  columnCategory: string;
  columnStatus: string;
  columnScan: string;
  columnSize: string;
  columnCreated: string;
  loading: string;
  empty: string;
  loadMore: string;
  error: string;
  errorRetry: string;
}

const DEFAULT_LABELS: MediaLibraryTreeLabels = {
  paneAriaLabel: "Media categories",
  columnName: "Name",
  columnCategory: "Category",
  columnStatus: "Status",
  columnScan: "Scan",
  columnSize: "Size",
  columnCreated: "Created",
  loading: "Loading...",
  empty: "No media in this branch.",
  loadMore: "Load more",
  error: "Could not load media.",
  errorRetry: "Try again",
};

export interface MediaLibraryTreeProps {
  labels?: Partial<MediaLibraryTreeLabels>;
  /** Page size handed to `useMediaObjects`'s cursor-paginated request. */
  pageSize?: number;
  className?: string;
}

export function MediaLibraryTree({ labels, pageSize = 20, className }: MediaLibraryTreeProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const [selection, setSelection] = React.useState<MediaCategorySelection>({ kind: "all" });
  const branchParams = React.useMemo(() => categorySelectionToListParams(selection), [selection]);
  const { items, count, loading, error, hasMore, loadMore, refresh } = useMediaObjects({
    ...branchParams,
    limit: pageSize,
  });

  const columns = React.useMemo<ColumnDef<MediaObjectPublic>[]>(
    () => [
      {
        accessorKey: "original_filename",
        header: t.columnName,
        cell: ({ row }) => row.original.original_filename ?? row.original.object_key,
      },
      { accessorKey: "category", header: t.columnCategory },
      { accessorKey: "status", header: t.columnStatus },
      {
        accessorKey: "scan_status",
        header: t.columnScan,
        cell: ({ row }) => {
          const status = row.original.scan_status;
          const variant = SCAN_BADGE_VARIANT[status];
          return variant ? <Badge variant={variant}>{status}</Badge> : status;
        },
      },
      {
        accessorKey: "size_bytes",
        header: t.columnSize,
        cell: ({ row }) => formatBytes(row.original.size_bytes),
      },
      {
        accessorKey: "created_at",
        header: t.columnCreated,
        cell: ({ row }) => formatDate(row.original.created_at),
      },
    ],
    [t],
  );

  // `useMediaObjects` is cursor-paginated (`loadMore`/`hasMore`), not the
  // page-numbered model `DataTable` was built for — rather than forking a
  // second results table, the table's page is pinned to the single page of
  // rows already loaded and "Load more" is handed to it as the `addButton`
  // slot, so paging further is one more cursor fetch, not a page jump.
  const loadMoreButton = hasMore ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void loadMore()}
      disabled={loading}
    >
      {t.loadMore}
    </Button>
  ) : undefined;

  return (
    <div className={cn("flex flex-col gap-6 md:flex-row", className)}>
      <aside className="md:w-64 md:shrink-0" aria-label={t.paneAriaLabel}>
        <MediaCategoryTree selection={selection} onSelectionChange={setSelection} />
      </aside>
      <div className="min-w-0 flex-1">
        {error && items.length === 0 ? (
          <StateError
            title={t.error}
            description={error instanceof Error && error.message ? error.message : t.error}
            retryLabel={t.errorRetry}
            onRetry={() => void refresh()}
          />
        ) : (
          <DataTable
            columns={columns}
            data={items}
            loading={loading && items.length === 0}
            rowCount={count}
            page={1}
            pageSize={Math.max(items.length, 1)}
            onPageChange={() => {}}
            onPageSizeChange={() => {}}
            addButton={loadMoreButton}
            labels={{ loading: t.loading, empty: t.empty }}
            getRowId={(row) => row.id}
          />
        )}
      </div>
    </div>
  );
}

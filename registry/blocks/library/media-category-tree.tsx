"use client";

// Media category tree pane: shadcn skin over `astro-ui-m8`'s generic
// `tree-view` (`U6`), driven by this package's live `useCategoryTree` hook.
// No fetching and no tree mechanics are reimplemented here — this file is
// only the shadcn/Tailwind composition; edit freely per app. Copied into the
// consumer via the @fa-m8-media registry (`U8`).
import * as React from "react";

import { cn } from "@/lib/utils";
import { TreeView, type TreeViewNode } from "@/components/m8-ui/tree-view";
import { StateEmpty } from "@/components/m8-ui/state-empty";
import { StateError } from "@/components/m8-ui/state-error";
import { StateLoading } from "@/components/m8-ui/state-loading";

import { useCategoryTree } from "@mano8/astro-media-m8/hooks";
import type { CategoryNode, ObjectListParams } from "@mano8/astro-media-m8/schemas";

/**
 * A branch selection over the user category tree, mirroring the runtime
 * `MediaLibrary` tree view's own union (`U7`) — a category is mutually
 * exclusive with the "all"/"uncategorized" pseudo-nodes, so this stays one
 * discriminated union rather than three independent booleans.
 */
export type MediaCategorySelection =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; id: number };

const ALL_NODE_ID = "all";
const UNCATEGORIZED_NODE_ID = "uncategorized";
const CATEGORY_NODE_PREFIX = "category-";

function categoryNodeId(id: number): string {
  return `${CATEGORY_NODE_PREFIX}${id}`;
}

function nodeIdFromSelection(selection: MediaCategorySelection): string {
  switch (selection.kind) {
    case "all":
      return ALL_NODE_ID;
    case "uncategorized":
      return UNCATEGORIZED_NODE_ID;
    case "category":
      return categoryNodeId(selection.id);
  }
}

function selectionFromNodeId(nodeId: string): MediaCategorySelection {
  if (nodeId === ALL_NODE_ID) return { kind: "all" };
  if (nodeId === UNCATEGORIZED_NODE_ID) return { kind: "uncategorized" };
  return { kind: "category", id: Number(nodeId.slice(CATEGORY_NODE_PREFIX.length)) };
}

/**
 * Translate a branch selection into the `ObjectListParams` slice the
 * `U4` list endpoint understands, writing every key on every selection
 * (`undefined` where it does not apply) so switching branches clears the
 * previous branch's params instead of leaving a stale one behind — the same
 * discipline `MediaLibrary`'s own `branchListParams` uses.
 */
export function categorySelectionToListParams(
  selection: MediaCategorySelection,
): Pick<ObjectListParams, "category_id" | "include_descendants" | "uncategorized"> {
  if (selection.kind === "category") {
    return { category_id: selection.id, include_descendants: true, uncategorized: undefined };
  }
  if (selection.kind === "uncategorized") {
    return { category_id: undefined, include_descendants: undefined, uncategorized: true };
  }
  return { category_id: undefined, include_descendants: undefined, uncategorized: undefined };
}

// The pseudo-nodes carry no count badge: server `CategoryNode` counts are
// per-category, and a synthesized "all"/"uncategorized" total would be a
// second, unverifiable source for a number the tree already owns.
function categoryNodeToTreeViewNode(node: CategoryNode): TreeViewNode {
  return {
    id: categoryNodeId(node.id),
    label: node.name,
    count: node.total_object_count,
    children: node.children.length > 0 ? node.children.map(categoryNodeToTreeViewNode) : undefined,
  };
}

function collectExpandableIds(nodes: TreeViewNode[]): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      ids.push(node.id, ...collectExpandableIds(node.children));
    }
  }
  return ids;
}

export interface MediaCategoryTreeLabels {
  ariaLabel: string;
  all: string;
  uncategorized: string;
  loadingTitle: string;
  loadingDescription: string;
  errorTitle: string;
  errorRetry: string;
  emptyTitle: string;
  emptyDescription: string;
}

const DEFAULT_LABELS: MediaCategoryTreeLabels = {
  ariaLabel: "Media categories",
  all: "All media",
  uncategorized: "Uncategorized",
  loadingTitle: "Loading categories",
  loadingDescription: "Fetching the category tree.",
  errorTitle: "Could not load categories",
  errorRetry: "Try again",
  emptyTitle: "No categories yet",
  emptyDescription: "Create a category to start organizing media.",
};

export interface MediaCategoryTreeProps {
  /** Controlled selection. Omit to let the pane track its own selection. */
  selection?: MediaCategorySelection;
  onSelectionChange?: (selection: MediaCategorySelection) => void;
  labels?: Partial<MediaCategoryTreeLabels>;
  className?: string;
}

export function MediaCategoryTree({
  selection: controlledSelection,
  onSelectionChange,
  labels,
  className,
}: MediaCategoryTreeProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const { tree, loading, error, reload } = useCategoryTree();
  const [internalSelection, setInternalSelection] = React.useState<MediaCategorySelection>({
    kind: "all",
  });
  const selection = controlledSelection ?? internalSelection;

  const nodes = React.useMemo<TreeViewNode[]>(
    () => [
      { id: ALL_NODE_ID, label: t.all },
      { id: UNCATEGORIZED_NODE_ID, label: t.uncategorized },
      ...tree.map(categoryNodeToTreeViewNode),
    ],
    [tree, t.all, t.uncategorized],
  );
  const defaultExpandedIds = React.useMemo(() => collectExpandableIds(nodes), [nodes]);

  const handleSelect = React.useCallback(
    (node: TreeViewNode) => {
      const next = selectionFromNodeId(node.id);
      if (controlledSelection === undefined) {
        setInternalSelection(next);
      }
      onSelectionChange?.(next);
    },
    [controlledSelection, onSelectionChange],
  );

  const describeError = (fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  // The pseudo-nodes stay navigable even while the tree is loading, erroring,
  // or genuinely empty of user categories — this pane must never degenerate
  // to an empty box, matching the runtime tree view's own decision (`U7`).
  if (loading && tree.length === 0 && !error) {
    return <StateLoading title={t.loadingTitle} description={t.loadingDescription} rows={4} />;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {error ? (
        <StateError
          title={t.errorTitle}
          description={describeError(t.errorTitle)}
          retryLabel={t.errorRetry}
          onRetry={() => void reload()}
        />
      ) : null}
      <TreeView
        nodes={nodes}
        selectedId={nodeIdFromSelection(selection)}
        onSelect={handleSelect}
        defaultExpandedIds={defaultExpandedIds}
        aria-label={t.ariaLabel}
      />
      {!loading && !error && tree.length === 0 ? (
        <StateEmpty title={t.emptyTitle} description={t.emptyDescription} />
      ) : null}
    </div>
  );
}

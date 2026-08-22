import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import { deleteObject } from "../api/objects.js";
import { useDownloadUrl } from "../hooks/useDownloadUrl.js";
import { useCategoryTree } from "../hooks/useMediaCategories.js";
import { useMediaObjects } from "../hooks/useMediaObjects.js";
import type {
  CategoryNode,
  MediaCategory,
  MediaObjectPublic,
  MediaObjectStatus,
  ObjectListParams
} from "../schemas.js";

type MediaLibraryView = "list" | "grid" | "masonry" | "tree";

/**
 * What the browse pane has selected. The two pseudo-nodes are part of the
 * selection rather than a separate toggle because they are mutually exclusive
 * with a branch: "all" clears `category_id`/`include_descendants`/
 * `uncategorized`, "uncategorized" sets only `uncategorized`, and a category
 * sets `category_id` + `include_descendants`. Modelling them as three
 * independent booleans would let the UI reach states the API rejects.
 */
type CategoryBranchSelection =
  | { kind: "all" }
  | { kind: "uncategorized" }
  | { kind: "category"; id: number };

type PreviewLoading = {
  loading: "eager" | "lazy";
  fetchPriority: "high" | "low";
};

const STATUS_OPTIONS: ReadonlyArray<{ value: MediaObjectStatus; label: string }> = [
  { value: "pending_upload", label: "Pending" },
  { value: "uploaded", label: "Uploaded" },
  { value: "processing", label: "Processing" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
  { value: "deleted", label: "Deleted" },
  { value: "rejected", label: "Rejected" }
];
const inputClassName =
  "fa-media-control h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

const VIEW_OPTIONS: ReadonlyArray<{ value: MediaLibraryView; label: string }> = [
  { value: "list", label: "List" },
  { value: "grid", label: "Grid" },
  { value: "masonry", label: "Masonry" },
  { value: "tree", label: "Tree" }
];
const titleRowClassName = "fa-media-title-row flex w-full flex-wrap items-center justify-between gap-3";
const filterRowClassName = "fa-media-filter-row flex w-full flex-col gap-3 md:flex-row md:items-center";
const viewSwitcherClassName =
  "fa-media-view-switcher inline-flex shrink-0 rounded-lg border border-input bg-transparent p-0.5";
const viewButtonClassName =
  "fa-media-view-button min-h-7 rounded-md border-0 bg-transparent px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background";
const previewClassName =
  "fa-media-preview block aspect-square h-14 w-14 rounded-md border border-border bg-muted object-cover text-xs font-medium text-muted-foreground";
const previewPlaceholderClassName = `${previewClassName} grid place-items-center px-1 text-center`;
const gridClassName = "fa-media-cards fa-media-cards--grid grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
const masonryClassName = "fa-media-cards fa-media-cards--masonry columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4";
const cardClassName =
  "fa-media-card mb-4 break-inside-avoid overflow-hidden rounded-lg border border-border bg-card text-card-foreground";
const cardPreviewClassName = "h-auto w-full rounded-none border-0";
const cardBodyClassName = "fa-media-card-body grid gap-2 p-3";
const cardTitleClassName = "m-0 truncate text-sm font-medium leading-5";
const cardMetaClassName = "fa-media-card-meta flex flex-wrap items-center gap-2 text-xs text-muted-foreground";
const itemActionsClassName = "fa-media-item-actions flex flex-wrap items-center gap-2";
const actionLinkClassName = "fa-media-action-link inline-flex min-h-8 items-center rounded-lg border px-3 py-1 text-sm font-medium";
const listPreviewStyle: CSSProperties = {
  aspectRatio: "1 / 1",
  borderRadius: "0.375rem",
  height: "clamp(4rem, 12vw, 8rem)",
  maxHeight: "8rem",
  maxWidth: "8rem",
  objectFit: "cover",
  width: "clamp(4rem, 12vw, 8rem)"
};
const treeLayoutClassName = "fa-media-tree-layout flex w-full flex-col items-stretch gap-4 md:flex-row md:items-start";
// The layout is one column on narrow viewports (`flex-col`) and only becomes
// two panes at `md`, so the categories collapse above the list rather than
// beside it; the pane's own height is bounded and scrollable at every width so
// a deep tree can never push the results off the bottom of a phone screen.
const treePaneClassName =
  "fa-media-tree-pane max-h-[50vh] w-full shrink-0 overflow-y-auto rounded-lg border border-border bg-card p-3 text-card-foreground md:max-h-[70vh] md:w-64";
const treeResultsClassName = "fa-media-tree-results min-w-0 flex-1";
// The row is not focusable any more — its `<li role="treeitem">` parent holds
// the tab stop — so the focus ring is drawn here off the parent's
// `:focus-visible`, keeping it around the row instead of around the whole
// subtree the `<li>` wraps.
const treeNodeRowClassName =
  "fa-media-tree-select flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm font-normal text-foreground transition-colors hover:bg-muted [li:focus-visible>&]:ring-3 [li:focus-visible>&]:ring-ring/50";
const treeToggleClassName =
  "fa-media-tree-toggle inline-flex w-5 shrink-0 cursor-pointer items-center justify-center text-xs leading-none text-muted-foreground";
const treeToggleSpacerClassName = "fa-media-tree-toggle-spacer inline-block w-5 shrink-0";
const activeViewButtonStyle: CSSProperties = {
  background: "var(--fa-media-active-bg, var(--foreground, CanvasText))",
  borderColor: "var(--fa-media-active-bg, var(--foreground, CanvasText))",
  color: "var(--fa-media-active-fg, var(--background, Canvas))"
};
const selectedTreeNodeStyle: CSSProperties = {
  background: "var(--fa-media-tree-selected-bg, var(--muted, Highlight))",
  color: "var(--fa-media-tree-selected-fg, var(--foreground, HighlightText))",
  fontWeight: 600
};

function isImage(object: MediaObjectPublic): boolean {
  return object.mime_type.toLowerCase().startsWith("image/");
}

/**
 * The one place a selection becomes list params. Every key is written on every
 * selection — `undefined` where it does not apply — so switching branches
 * clears the previous branch's params instead of leaving a stale
 * `category_id` next to a fresh `uncategorized`.
 *
 * A branch selection is always descendant-inclusive: the node badge shows
 * `total_object_count`, so a branch that lists fewer objects than its own badge
 * promises would read as a bug.
 */
function branchListParams(selection: CategoryBranchSelection): Pick<
  ObjectListParams,
  "category_id" | "include_descendants" | "uncategorized"
> {
  return {
    category_id: selection.kind === "category" ? selection.id : undefined,
    include_descendants: selection.kind === "category" ? true : undefined,
    uncategorized: selection.kind === "uncategorized" ? true : undefined
  };
}

/** Keep the pane in step with a caller-supplied `initial` branch filter. */
function initialBranchSelection(params: ObjectListParams): CategoryBranchSelection {
  if (params.category_id != null) return { kind: "category", id: params.category_id };
  if (params.uncategorized) return { kind: "uncategorized" };
  return { kind: "all" };
}

/**
 * `tree` renders the **same** table body as `list` in its right pane, so every
 * "is this the list layout?" branch (preview sizing, `<img>` classes) has to
 * answer yes for it too. Forking a second table — and a second set of preview
 * rules — is exactly what this predicate exists to prevent.
 */
function isListLayout(view: MediaLibraryView): boolean {
  return view === "list" || view === "tree";
}

/**
 * `tree`'s right pane renders the same table as `list` (`isListLayout`), so it
 * gets the same lazy/low preview loading — spelled out explicitly rather than
 * left to the trailing fallback, so a future view added to the fallthrough
 * cannot silently inherit `tree`'s eager-loading exemption by accident.
 */
function previewLoadingFor(view: MediaLibraryView, index: number): PreviewLoading {
  if (view === "list" || view === "tree") return { loading: "lazy", fetchPriority: "low" };
  if (view === "grid" && index < 6) return { loading: "eager", fetchPriority: "high" };
  if (view === "masonry" && index < 4) return { loading: "eager", fetchPriority: "high" };
  return { loading: "lazy", fetchPriority: "low" };
}

function objectLabel(object: MediaObjectPublic): string {
  return object.original_filename ?? object.id;
}

function humanizeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units.at(unitIndex) ?? "TB"}`;
}

function statusLabel(status: MediaObjectStatus): string {
  return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

const FAILED_SCAN_STATUSES = new Set(["infected", "quarantined"]);

/**
 * `scan_status` is a field distinct from `status` (an object can be
 * `status: "ready"` yet `scan_status: "infected"` before the guard catches
 * up), so this is a second badge beside the existing status one, not an edit
 * to `STATUS_OPTIONS`/`statusLabel`.
 */
function ScanStatusBadge({ object }: { object: MediaObjectPublic }) {
  if (!FAILED_SCAN_STATUSES.has(object.scan_status)) return null;
  return (
    <span
      className="fa-media-badge fa-media-badge--scan-failed"
      title={`Failed virus scan (${object.scan_status})`}
    >
      Failed virus scan
    </span>
  );
}

function MediaObjectPreview({
  object,
  view,
  index
}: {
  object: MediaObjectPublic;
  view: MediaLibraryView;
  index: number;
}) {
  const { data, loading, error, request } = useDownloadUrl(isImage(object) ? object.id : null);
  const loadingMode = previewLoadingFor(view, index);

  useEffect(() => {
    if (!isImage(object) || data || loading || error) return;
    void request();
  }, [data, error, loading, object, request]);

  if (!isImage(object)) {
    return (
      <span
        className={`${previewPlaceholderClassName} fa-media-preview--file`}
        style={isListLayout(view) ? listPreviewStyle : undefined}
        aria-hidden="true"
      >
        {object.extension ?? "file"}
      </span>
    );
  }

  if (!data) {
    return (
      <span
        className={`${previewPlaceholderClassName} fa-media-preview--loading`}
        style={isListLayout(view) ? listPreviewStyle : undefined}
        aria-label={`${objectLabel(object)} preview loading`}
      >
        {loading ? "Loading" : "Preview"}
      </span>
    );
  }

  return (
    <img
      className={isListLayout(view) ? previewClassName : `${previewClassName} ${cardPreviewClassName}`}
      src={data.url}
      alt={objectLabel(object)}
      style={isListLayout(view) ? listPreviewStyle : undefined}
      width={isListLayout(view) ? 128 : undefined}
      height={isListLayout(view) ? 128 : undefined}
      loading={loadingMode.loading}
      decoding="async"
      fetchPriority={loadingMode.fetchPriority}
    />
  );
}

function MediaObjectName({ object, objectHref }: { object: MediaObjectPublic; objectHref?: (id: string) => string }) {
  const label = objectLabel(object);
  return objectHref ? <a href={objectHref(object.id)}>{label}</a> : label;
}

function MediaObjectMeta({ object }: { object: MediaObjectPublic }) {
  return (
    <>
      <span>{object.category}</span>
      <span className={`fa-media-badge fa-media-badge--${object.status}`}>{statusLabel(object.status)}</span>
      <ScanStatusBadge object={object} />
      <span>{humanizeBytes(object.size_bytes)}</span>
    </>
  );
}

function MediaObjectActions({
  object,
  objectHref,
  deletingId,
  onDelete
}: {
  object: MediaObjectPublic;
  objectHref?: (id: string) => string;
  deletingId: string | null;
  onDelete: (object: MediaObjectPublic) => Promise<void>;
}) {
  const label = objectLabel(object);
  const href = objectHref?.(object.id);

  return (
    <div className={itemActionsClassName}>
      {href ? (
        <a className={actionLinkClassName} href={href} aria-label={`View ${label}`}>
          View
        </a>
      ) : null}
      <button type="button" className="fa-media-danger" disabled={deletingId === object.id} onClick={() => void onDelete(object)}>
        Delete
      </button>
    </div>
  );
}

/**
 * The list body, extracted verbatim so `view === "tree"` can render **this**
 * table in its right pane instead of forking a second one. `view` still rides
 * along untouched because `MediaObjectPreview` keys its sizing off it.
 */
function MediaObjectTable({
  items,
  view,
  objectHref,
  deletingId,
  onDelete
}: {
  items: readonly MediaObjectPublic[];
  view: MediaLibraryView;
  objectHref?: (id: string) => string;
  deletingId: string | null;
  onDelete: (object: MediaObjectPublic) => Promise<void>;
}) {
  return (
    <table className="fa-media-table">
      <thead>
        <tr>
          <th>Preview</th>
          <th>Filename</th>
          <th>Actions</th>
          <th>Category</th>
          <th>Status</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        {items.map((object, index) => (
          <tr key={object.id}>
            <td>
              <MediaObjectPreview object={object} view={view} index={index} />
            </td>
            <td>
              <MediaObjectName object={object} objectHref={objectHref} />
            </td>
            <td>
              <MediaObjectActions object={object} objectHref={objectHref} deletingId={deletingId} onDelete={onDelete} />
            </td>
            <td>{object.category}</td>
            <td>
              <span className={`fa-media-badge fa-media-badge--${object.status}`}>{statusLabel(object.status)}</span>
              <ScanStatusBadge object={object} />
            </td>
            <td>{humanizeBytes(object.size_bytes)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Stable pane key for a selection. It addresses the rows for keyboard
 * navigation and seeds each row's generated `aria` ids, so it is derived from
 * the selection rather than taken from the server node.
 */
function branchKey(selection: CategoryBranchSelection): string {
  return selection.kind === "category" ? `category-${selection.id}` : selection.kind;
}

/**
 * "All media" / "Uncategorized": the two rows in the pane that are not a
 * server category. They are plain level-1 treeitems with no count badge — the
 * server node counts are per-category, and inventing a total here would be a
 * second, unverifiable source for a number the tree already owns.
 */
const PSEUDO_ROWS: ReadonlyArray<{ selection: CategoryBranchSelection; label: string }> = [
  { selection: { kind: "all" }, label: "All media" },
  { selection: { kind: "uncategorized" }, label: "Uncategorized" }
];

/**
 * One entry of the pane's depth-first list of *visible* rows, in the order the
 * arrow keys walk them: the two pseudo-rows first, then the server tree with a
 * collapsed branch's children omitted. Keyboard navigation reads this flat
 * list while the markup stays nested — the same split `astro-ui-m8`'s
 * `tree-view` block uses.
 */
interface TreePaneRow {
  key: string;
  selection: CategoryBranchSelection;
  level: number;
  parentKey: string | null;
  hasChildren: boolean;
  expanded: boolean;
}

function collectBranchRows(
  nodes: readonly CategoryNode[],
  collapsed: ReadonlySet<number>,
  level: number,
  parentKey: string | null,
  out: TreePaneRow[]
): void {
  for (const node of nodes) {
    const key = `category-${node.id}`;
    const hasChildren = node.children.length > 0;
    const expanded = hasChildren && !collapsed.has(node.id);
    out.push({
      key,
      selection: { kind: "category", id: node.id },
      level,
      parentKey,
      hasChildren,
      expanded
    });
    if (expanded) collectBranchRows(node.children, collapsed, level + 1, key, out);
  }
}

function flattenPaneRows(tree: readonly CategoryNode[], collapsed: ReadonlySet<number>): TreePaneRow[] {
  const rows: TreePaneRow[] = PSEUDO_ROWS.map(({ selection }) => ({
    key: branchKey(selection),
    selection,
    level: 1,
    parentKey: null,
    hasChildren: false,
    expanded: false
  }));
  collectBranchRows(tree, collapsed, 1, null, rows);
  return rows;
}

/**
 * Everything a row needs from the pane, passed as one object so the
 * `role`/`aria-*`/roving-tabindex wiring lives in exactly one component
 * (`MediaCategoryTreeItem`) and the recursive branch renderer only forwards it.
 */
interface TreePaneController {
  baseId: string;
  selection: CategoryBranchSelection;
  activeKey: string | null;
  collapsed: ReadonlySet<number>;
  registerItem: (key: string, element: HTMLLIElement | null) => void;
  select: (selection: CategoryBranchSelection) => void;
  toggle: (id: number) => void;
  onItemKeyDown: (event: ReactKeyboardEvent<HTMLLIElement>, key: string) => void;
  onItemFocus: (event: ReactFocusEvent<HTMLLIElement>, key: string) => void;
  onItemPointerDown: (key: string) => void;
}

/**
 * One `role="treeitem"` row — a pseudo-row or a category — plus, when it is an
 * expanded branch, the `role="group"` holding its children.
 *
 * The `<li>` carries the tab stop, not the row inside it: a treeitem must not
 * hold its own focusable descendants, so the row that used to be a `<button>`
 * is a non-focusable `<span>` and the pane's keyboard contract covers what the
 * button did. The focus ring is drawn on that row rather than on the `<li>` so
 * it does not wrap the whole subtree.
 */
function MediaCategoryTreeItem({
  controller,
  selection,
  label,
  level,
  count,
  countTitle,
  hasChildren,
  expanded,
  children
}: {
  controller: TreePaneController;
  selection: CategoryBranchSelection;
  label: string;
  level: number;
  count?: number;
  countTitle?: string;
  hasChildren: boolean;
  expanded: boolean;
  children?: ReactNode;
}) {
  const key = branchKey(selection);
  const isSelected = branchKey(controller.selection) === key;
  const labelId = `${controller.baseId}-${key}-label`;
  const countId = `${controller.baseId}-${key}-count`;
  const modifier = selection.kind === "category" ? "" : ` fa-media-tree-node--${selection.kind}`;
  // Read out of the union once, into a `const`, so the toggle handler keeps a
  // narrowing that a closure over the parameter itself would lose.
  const categoryId = selection.kind === "category" ? selection.id : null;

  return (
    <li
      ref={(element) => {
        controller.registerItem(key, element);
      }}
      className={`fa-media-tree-node${modifier} rounded-md outline-none`}
      role="treeitem"
      tabIndex={controller.activeKey === key ? 0 : -1}
      aria-level={level}
      aria-selected={isSelected}
      aria-expanded={hasChildren ? expanded : undefined}
      // Named explicitly over the label (+ count) so a nested `role="group"`
      // never leaks into name-from-content.
      aria-labelledby={count === undefined ? labelId : `${labelId} ${countId}`}
      onKeyDown={(event) => controller.onItemKeyDown(event, key)}
      onFocus={(event) => controller.onItemFocus(event, key)}
    >
      <span
        className={treeNodeRowClassName}
        style={isSelected ? selectedTreeNodeStyle : undefined}
        onPointerDown={() => controller.onItemPointerDown(key)}
        onClick={() => controller.select(selection)}
      >
        {hasChildren && categoryId !== null ? (
          <span
            className={treeToggleClassName}
            aria-hidden="true"
            title={`${expanded ? "Collapse" : "Expand"} ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              controller.toggle(categoryId);
            }}
          >
            {expanded ? "▾" : "▸"}
          </span>
        ) : (
          <span className={treeToggleSpacerClassName} aria-hidden="true" />
        )}
        <span id={labelId} className="fa-media-tree-name truncate">
          {label}
        </span>
        {count === undefined ? null : (
          <span id={countId} className="fa-media-badge fa-media-category-count ml-auto shrink-0" title={countTitle}>
            {count}
          </span>
        )}
      </span>
      {hasChildren && expanded ? (
        <ul role="group" className="fa-media-tree-children">
          {children}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * One category row plus its subtree in the browse pane.
 *
 * Counts come straight from the server node: the badge shows
 * `total_object_count` (this branch including everything under it) and names
 * both numbers in its `title`, since a parent whose own `object_count` is 0
 * still browses to a non-empty branch.
 */
function MediaCategoryBranch({
  node,
  depth,
  controller
}: {
  node: CategoryNode;
  depth: number;
  controller: TreePaneController;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && !controller.collapsed.has(node.id);

  return (
    <MediaCategoryTreeItem
      controller={controller}
      selection={{ kind: "category", id: node.id }}
      label={node.name}
      level={depth}
      count={node.total_object_count}
      countTitle={`${node.object_count} directly in ${node.name}, ${node.total_object_count} including sub-categories`}
      hasChildren={hasChildren}
      expanded={expanded}
    >
      {expanded
        ? node.children.map((child) => (
            <MediaCategoryBranch key={child.id} node={child} depth={depth + 1} controller={controller} />
          ))
        : null}
    </MediaCategoryTreeItem>
  );
}

/**
 * The left pane of the tree view: the caller's nested user categories with
 * their counts.
 *
 * `useCategoryTree()` lives **here** rather than in `MediaLibrary` so the
 * category request is only issued once the user actually opens the tree view —
 * the list/grid/masonry views must not pay for a fetch they never render.
 *
 * The a11y contract matches `astro-ui-m8`'s `tree-view` registry block so the
 * runtime pane and the registry skin do not diverge: `role="tree"` /
 * `role="group"` / `role="treeitem"`, `aria-level`, `aria-selected`,
 * `aria-expanded` on parents, a roving tabindex holding exactly one tab stop,
 * and ArrowUp/ArrowDown/Home/End/ArrowRight/ArrowLeft/Enter/Space.
 */
function MediaCategoryTreePane({
  selection,
  onSelect
}: {
  selection: CategoryBranchSelection;
  onSelect: (selection: CategoryBranchSelection) => void;
}) {
  const { tree, loading, error } = useCategoryTree();
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  // Collapsed ids, not expanded ones: the pane opens with the whole tree
  // visible — the behaviour it had before arrow keys existed — and the set
  // only grows as the user closes a branch. An `expandedIds` set would have to
  // be seeded from ids the first render does not have yet.
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const itemsRef = useRef(new Map<string, HTMLLIElement>());
  const rows = useMemo(() => flattenPaneRows(tree, collapsed), [tree, collapsed]);

  // Roving tabindex: exactly one treeitem is tabbable — the last focused row
  // while it stays visible, else the selected row, else the first row.
  const selectedKey = branchKey(selection);
  const isVisible = (key: string | null): key is string =>
    key !== null && rows.some((row) => row.key === key);
  let activeKey: string | null = rows[0]?.key ?? null;
  if (isVisible(focusedKey)) activeKey = focusedKey;
  else if (isVisible(selectedKey)) activeKey = selectedKey;

  function registerItem(key: string, element: HTMLLIElement | null) {
    if (element === null) itemsRef.current.delete(key);
    else itemsRef.current.set(key, element);
  }

  function focusItem(key: string) {
    setFocusedKey(key);
    itemsRef.current.get(key)?.focus();
  }

  // `.at()` rather than an index read, and a negative guard because `.at(-1)`
  // wraps to the end of the list — ArrowUp on the first row must stay put, not
  // jump to the last one.
  function focusAt(index: number) {
    if (index < 0) return;
    const row = rows.at(index);
    if (row !== undefined) focusItem(row.key);
  }

  function setExpansion(id: number, expand: boolean) {
    setCollapsed((previous) => {
      if (previous.has(id) === !expand) return previous;
      const next = new Set(previous);
      if (expand) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ArrowRight opens a closed branch, then steps into it; a leaf is a no-op.
  function expandOrEnter(row: TreePaneRow, index: number): boolean {
    if (!row.hasChildren || row.selection.kind !== "category") return false;
    if (row.expanded) focusAt(index + 1);
    else setExpansion(row.selection.id, true);
    return true;
  }

  // ArrowLeft closes an open branch, else steps out to the parent.
  function collapseOrLeave(row: TreePaneRow): boolean {
    if (row.hasChildren && row.expanded && row.selection.kind === "category") {
      setExpansion(row.selection.id, false);
      return true;
    }
    if (row.parentKey === null) return false;
    focusItem(row.parentKey);
    return true;
  }

  function applyKey(key: string, row: TreePaneRow, index: number): boolean {
    switch (key) {
      case "ArrowDown":
        focusAt(index + 1);
        return true;
      case "ArrowUp":
        focusAt(index - 1);
        return true;
      case "Home":
        focusAt(0);
        return true;
      case "End":
        focusAt(rows.length - 1);
        return true;
      case "ArrowRight":
        return expandOrEnter(row, index);
      case "ArrowLeft":
        return collapseOrLeave(row);
      case "Enter":
      case " ":
        onSelect(row.selection);
        return true;
      default:
        return false;
    }
  }

  const controller: TreePaneController = {
    baseId,
    selection,
    activeKey,
    collapsed,
    registerItem,
    select: onSelect,
    toggle: (id) => setExpansion(id, collapsed.has(id)),
    onItemKeyDown: (event, key) => {
      // Only the treeitem that actually holds focus reacts; the event bubbles
      // through every ancestor treeitem on its way out.
      if (event.target !== event.currentTarget) return;
      const index = rows.findIndex((row) => row.key === key);
      const row = rows.at(index);
      if (index === -1 || row === undefined) return;
      if (applyKey(event.key, row, index)) event.preventDefault();
    },
    onItemFocus: (event, key) => {
      if (event.target === event.currentTarget) setFocusedKey(key);
    },
    // A pointer press moves the roving tabindex with it, so a later Tab leaves
    // the pane from the row the user last touched.
    onItemPointerDown: (key) => focusItem(key)
  };

  return (
    <aside className={treePaneClassName} aria-label="Media categories">
      <h3 id={headingId}>Categories</h3>
      {error ? <p role="alert">Failed to load categories</p> : null}
      {loading && tree.length === 0 ? <p>Loading...</p> : null}
      {!loading && !error && tree.length === 0 ? (
        <p className="fa-media-category-hint">
          No user categories yet. Create one from the Categories panel to browse media by branch.
        </p>
      ) : null}
      <ul role="tree" aria-labelledby={headingId} className="fa-media-tree-nodes">
        {PSEUDO_ROWS.map((row) => (
          <MediaCategoryTreeItem
            key={branchKey(row.selection)}
            controller={controller}
            selection={row.selection}
            label={row.label}
            level={1}
            hasChildren={false}
            expanded={false}
          />
        ))}
        {tree.map((node) => (
          <MediaCategoryBranch key={node.id} node={node} depth={1} controller={controller} />
        ))}
      </ul>
    </aside>
  );
}

export function MediaLibrary({
  objectHref,
  initial = {}
}: {
  objectHref?: (id: string) => string;
  initial?: ObjectListParams;
}) {
  const [query, setQuery] = useState<ObjectListParams>(initial);
  const [view, setView] = useState<MediaLibraryView>("list");
  // Which branch the tree pane has selected. It is kept beside `query` rather
  // than derived from it because "all" and an absent branch filter are the same
  // params but not the same pane state.
  const [branchSelection, setBranchSelection] = useState<CategoryBranchSelection>(() =>
    initialBranchSelection(initial)
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { items, count, loading, error, hasMore, refresh, loadMore } = useMediaObjects(query);

  /**
   * Patches the branch params onto `query` rather than replacing it, so the
   * toolbar's search / enum category / status filters stay live and compose
   * with the selected branch.
   */
  function handleBranchSelect(selection: CategoryBranchSelection) {
    setBranchSelection(selection);
    setQuery((prev) => ({ ...prev, ...branchListParams(selection) }));
  }

  async function handleDelete(object: MediaObjectPublic) {
    setActionError(null);
    setDeletingId(object.id);
    try {
      await deleteObject(object.id);
      await refresh();
    } catch {
      setActionError("Failed to delete media");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="not-content fa-media-panel">
      <header className="fa-media-toolbar">
        <div className={titleRowClassName}>
          <h2>Media library ({count})</h2>
          <div className={viewSwitcherClassName} aria-label="Media library view">
            {VIEW_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                className={viewButtonClassName}
                style={view === value ? activeViewButtonStyle : undefined}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={filterRowClassName}>
          <input
            className={inputClassName}
            type="search"
            placeholder="Search filename"
            onChange={(event) => {
              const q = event.currentTarget.value || undefined;
              setQuery((prev) => ({ ...prev, q }));
            }}
          />
          <select
            className={inputClassName}
            onChange={(event) => {
              const category = (event.currentTarget.value || undefined) as MediaCategory | undefined;
              setQuery((prev) => ({ ...prev, category }));
            }}
          >
            <option value="">All categories</option>
            {(["avatar", "document", "asset", "chat_attachment", "export", "receipt"] as MediaCategory[]).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className={inputClassName}
            onChange={(event) => {
              const status = (event.currentTarget.value || undefined) as MediaObjectStatus | undefined;
              setQuery((prev) => ({ ...prev, status }));
            }}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>
      {error ? <p role="alert">Failed to load media</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      {view === "tree" ? (
        <div className={treeLayoutClassName}>
          <MediaCategoryTreePane selection={branchSelection} onSelect={handleBranchSelect} />
          <div className={treeResultsClassName}>
            <MediaObjectTable
              items={items}
              view={view}
              objectHref={objectHref}
              deletingId={deletingId}
              onDelete={handleDelete}
            />
          </div>
        </div>
      ) : view === "list" ? (
        <MediaObjectTable
          items={items}
          view={view}
          objectHref={objectHref}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
      ) : (
        <div className={view === "grid" ? gridClassName : masonryClassName}>
          {items.map((object, index) => (
            <article className={cardClassName} key={object.id}>
              <MediaObjectPreview object={object} view={view} index={index} />
              <div className={cardBodyClassName}>
                <h3 className={cardTitleClassName}>
                  <MediaObjectName object={object} objectHref={objectHref} />
                </h3>
                <div className={cardMetaClassName}>
                  <MediaObjectMeta object={object} />
                </div>
                <MediaObjectActions object={object} objectHref={objectHref} deletingId={deletingId} onDelete={handleDelete} />
              </div>
            </article>
          ))}
        </div>
      )}
      {loading ? <p>Loading...</p> : null}
      {hasMore ? (
        <button type="button" disabled={loading} onClick={() => void loadMore()}>
          Load more
        </button>
      ) : null}
    </section>
  );
}

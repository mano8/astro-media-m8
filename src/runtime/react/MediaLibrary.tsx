import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import { deleteObject } from "../api/objects.js";
import { useDownloadUrl } from "../hooks/useDownloadUrl.js";
import { useCategoryTree } from "../hooks/useMediaCategories.js";
import { useMediaObjects } from "../hooks/useMediaObjects.js";
import { useMediaTransfer } from "../hooks/useMediaTransfer.js";
import { friendlyReasonMessage } from "../errors.js";
import { MediaUploadDropzone, type MediaUploadDropzoneLabels } from "./MediaUploadDropzone.js";
import type {
  CategoryNode,
  ExportFormat,
  ImportFormat,
  ImportObjectResult,
  MediaCategory,
  MediaObjectPublic,
  MediaObjectStatus,
  ObjectListParams
} from "../schemas.js";

type MediaLibraryView = "list" | "grid" | "masonry" | "tree";

export interface MediaLibraryLabels {
  title: string;
  viewLabel: string;
  views: Record<MediaLibraryView, string>;
  importExport: string;
  uploadMedia: string;
  searchPlaceholder: string;
  searchLabel: string;
  preview: string;
  filename: string;
  actions: string;
  category: string;
  status: string;
  size: string;
  view: string;
  delete: string;
  deleteError: string;
  allCategories: string;
  categories: Record<MediaCategory, string>;
  allStatuses: string;
  statuses: Record<MediaObjectStatus, string>;
  loadError: string;
  loading: string;
  loadMore: string;
  previewLoading: string;
  previewPlaceholder: string;
  failedScan: string;
  failedScanTitle: (status: string) => string;
  tree: {
    regionLabel: string;
    title: string;
    loadError: string;
    loading: string;
    empty: string;
    allMedia: string;
    uncategorized: string;
    allMediaScope: string;
    uncategorizedScope: string;
    selectedScope: (id: number) => string;
    expand: (name: string) => string;
    collapse: (name: string) => string;
    countTitle: (direct: number, total: number, name: string) => string;
  };
  transfer: {
    regionLabel: string;
    exportTitle: string;
    importTitle: string;
    scope: string;
    format: string;
    manifest: string;
    archive: string;
    manifestHint: string;
    archiveHint: string;
    startExport: string;
    exporting: string;
    exportError: string;
    downloadManifest: (count: number) => string;
    downloadArchive: (count: number) => string;
    exportFailed: (error?: string | null) => string;
    exportStatus: (status: string) => string;
    chooseFile: string;
    dropFile: string;
    startImport: string;
    importing: string;
    importError: string;
    report: (created: number, linked: number, skipped: number, failed: number) => string;
    categoriesCreated: (count: number) => string;
    file: string;
    status: string;
    reason: string;
    importStatuses: Record<ImportObjectResult["status"], string>;
  };
  upload: {
    title: string;
    close: string;
    closeLabel: string;
    form: Partial<MediaUploadDropzoneLabels>;
  };
}

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

const STATUS_OPTIONS: readonly MediaObjectStatus[] = [
  "pending_upload",
  "uploaded",
  "processing",
  "ready",
  "failed",
  "deleted",
  "rejected"
];
const inputClassName =
  "fa-media-control h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

const VIEW_OPTIONS: readonly MediaLibraryView[] = ["list", "grid", "masonry", "tree"];
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
// One column on narrow viewports, two panes from `lg` up — not `md`. At `md`
// (48rem) a category pane and a six-column table shared 768px and both were
// cramped; the split now waits for 64rem, so the stacked layout carries the
// tablet range where it reads better.
//
// `items-stretch` at both widths, where the row used to be `md:items-start`.
// That is what makes the pane share the results column's height instead of
// hugging its own content and leaving a short box beside a long table.
const treeLayoutClassName =
  "fa-media-tree-layout flex w-full flex-col items-stretch gap-4 lg:flex-row lg:items-stretch";
// Width is `clamp(16rem, 24vw, 26rem)` rather than a flat `w-64`: 16rem was the
// same pane on a 13" laptop and a 27" monitor, and it was too narrow for a
// nested tree on both. It now scales with the viewport between a readable floor
// and a cap that keeps the results column dominant.
//
// Height is bounded but no longer tight. Stretched by the row, it takes the
// results column's height; the `max-h` only bites when the tree itself is the
// taller of the two, and then the pane scrolls at the cap instead of growing
// the page. `min-h-0` is required for that scroll to work at all — without it
// a stretched flex item refuses to shrink below its content.
//
// `overflow-auto`, not `overflow-y-auto`: a nested branch is wider than the
// pane, so a deep tree used to be clipped with no way to reach the rest of it.
// The horizontal bar is `auto`, so it appears only when the widest row actually
// exceeds the pane. It only has anything to scroll because the list sizes to
// `min-w-max` and the row labels no longer truncate.
const treePaneClassName =
  "fa-media-tree-pane max-h-[45vh] min-h-0 w-full shrink-0 overflow-auto rounded-lg border border-border bg-card p-3 text-card-foreground lg:max-h-[calc(100vh-13rem)] lg:w-[clamp(16rem,24vw,26rem)]";
const treeResultsClassName = "fa-media-tree-results min-h-0 min-w-0 flex-1";
// The import dropzone used to borrow `treePaneClassName` outright for its card
// look, which quietly handed it the tree pane's width and scroll behaviour too
// — so sizing the pane for a category tree would have sized a file dropzone
// with it. It carries the shared card styling on its own class instead.
const transferDropzoneClassName =
  "fa-media-transfer-dropzone w-full rounded-lg border border-border bg-card p-3 text-card-foreground";
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
const buttonClassName =
  "fa-media-button inline-flex min-h-8 items-center rounded-lg border border-input px-3 py-1 text-sm font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50";
const toolbarActionsClassName = "fa-media-toolbar-actions flex flex-wrap items-center justify-end gap-2";
const labelInlineClassName = "fa-media-label-inline flex items-center gap-2 text-sm";
const transferPanelClassName =
  "fa-media-transfer-panel grid gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground md:grid-cols-2";
const transferSectionClassName = "fa-media-transfer-section grid gap-2 content-start";
const transferTableWrapClassName = "fa-media-transfer-table-wrap max-h-64 overflow-y-auto rounded-md border border-border";
const transferTableClassName = "fa-media-transfer-table w-full border-collapse text-xs";
const EXPORT_FORMAT_OPTIONS: readonly ExportFormat[] = ["manifest", "archive"];
const IMPORT_FORMAT_OPTIONS: readonly ImportFormat[] = ["manifest", "archive"];

const DEFAULT_LABELS: MediaLibraryLabels = {
  title: "Media library",
  viewLabel: "Media library view",
  views: { list: "List", grid: "Grid", masonry: "Masonry", tree: "Tree" },
  importExport: "Import / Export",
  uploadMedia: "Upload media",
  searchPlaceholder: "Search filename",
  searchLabel: "Search media",
  preview: "Preview",
  filename: "Filename",
  actions: "Actions",
  category: "Category",
  status: "Status",
  size: "Size",
  view: "View",
  delete: "Delete",
  deleteError: "Failed to delete media",
  allCategories: "All categories",
  categories: {
    avatar: "Avatar",
    document: "Document",
    asset: "Asset",
    chat_attachment: "Chat attachment",
    export: "Export",
    receipt: "Receipt"
  },
  allStatuses: "All statuses",
  statuses: {
    pending_upload: "Pending",
    uploaded: "Uploaded",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
    deleted: "Deleted",
    rejected: "Rejected"
  },
  loadError: "Failed to load media",
  loading: "Loading...",
  loadMore: "Load more",
  previewLoading: "Loading",
  previewPlaceholder: "Preview",
  failedScan: "Failed virus scan",
  failedScanTitle: (status) => `Failed virus scan (${status})`,
  tree: {
    regionLabel: "Media categories",
    title: "Categories",
    loadError: "Failed to load categories",
    loading: "Loading categories…",
    empty: "No user categories yet. Create one from the Categories panel to browse media by branch.",
    allMedia: "All media",
    uncategorized: "Uncategorized",
    allMediaScope: "All media",
    uncategorizedScope: "Uncategorized media",
    selectedScope: (id) => `Selected branch (category ${id})`,
    expand: (name) => `Expand ${name}`,
    collapse: (name) => `Collapse ${name}`,
    countTitle: (direct, total, name) => `${direct} directly in ${name}, ${total} including sub-categories`
  },
  transfer: {
    regionLabel: "Import and export media",
    exportTitle: "Export",
    importTitle: "Import",
    scope: "Export scope",
    format: "Format",
    manifest: "Manifest",
    archive: "Archive",
    manifestHint: "Metadata only — filenames, categories, no bytes.",
    archiveHint: "Full zip with bytes; assembled asynchronously.",
    startExport: "Start export",
    exporting: "Exporting…",
    exportError: "Export failed",
    downloadManifest: (count) => `Download manifest (${count} objects)`,
    downloadArchive: (count) => `Download archive (${count} objects)`,
    exportFailed: (error) => `Export failed${error ? `: ${error}` : "."}`,
    exportStatus: (status) => `Export ${status}…`,
    chooseFile: "Choose file",
    dropFile: "Drop a file here, or choose one above.",
    startImport: "Start import",
    importing: "Importing…",
    importError: "Import failed",
    report: (created, linked, skipped, failed) => `${created} created, ${linked} linked, ${skipped} skipped, ${failed} failed`,
    categoriesCreated: (count) => `${count} categories created`,
    file: "File",
    status: "Status",
    reason: "Reason",
    importStatuses: {
      created: "Created",
      linked: "Linked",
      skipped: "Skipped",
      failed: "Failed"
    }
  },
  upload: {
    title: "Upload media",
    close: "Close",
    closeLabel: "Close upload dialog",
    form: {}
  }
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

/** A concise, visible description of the branch whose filters will be exported. */
function exportBranchLabel(selection: CategoryBranchSelection, labels: MediaLibraryLabels["tree"]): string {
  switch (selection.kind) {
    case "all":
      return labels.allMediaScope;
    case "uncategorized":
      return labels.uncategorizedScope;
    case "category":
      return labels.selectedScope(selection.id);
  }
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

function statusLabel(status: MediaObjectStatus, labels: MediaLibraryLabels): string {
  return labels.statuses[status] ?? status;
}

const FAILED_SCAN_STATUSES = new Set(["infected", "quarantined"]);

/**
 * `scan_status` is a field distinct from `status` (an object can be
 * `status: "ready"` yet `scan_status: "infected"` before the guard catches
 * up), so this is a second badge beside the existing status one, not an edit
 * to `STATUS_OPTIONS`/`statusLabel`.
 */
function ScanStatusBadge({ object, labels }: { object: MediaObjectPublic; labels: MediaLibraryLabels }) {
  if (!FAILED_SCAN_STATUSES.has(object.scan_status)) return null;
  return (
    <span
      className="fa-media-badge fa-media-badge--scan-failed"
      title={labels.failedScanTitle(object.scan_status)}
    >
      {labels.failedScan}
    </span>
  );
}

function MediaObjectPreview({
  object,
  view,
  index,
  labels
}: {
  object: MediaObjectPublic;
  view: MediaLibraryView;
  index: number;
  labels: MediaLibraryLabels;
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
        aria-label={`${objectLabel(object)} ${labels.previewLoading}`}
      >
        {loading ? labels.previewLoading : labels.previewPlaceholder}
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

function MediaObjectMeta({ object, labels }: { object: MediaObjectPublic; labels: MediaLibraryLabels }) {
  return (
    <>
      <span>{labels.categories[object.category]}</span>
      <span className={`fa-media-badge fa-media-badge--${object.status}`}>{statusLabel(object.status, labels)}</span>
      <ScanStatusBadge object={object} labels={labels} />
      <span>{humanizeBytes(object.size_bytes)}</span>
    </>
  );
}

function MediaObjectActions({
  object,
  objectHref,
  deletingId,
  onDelete,
  labels
}: {
  object: MediaObjectPublic;
  objectHref?: (id: string) => string;
  deletingId: string | null;
  onDelete: (object: MediaObjectPublic) => Promise<void>;
  labels: MediaLibraryLabels;
}) {
  const label = objectLabel(object);
  const href = objectHref?.(object.id);

  return (
    <div className={itemActionsClassName}>
      {href ? (
        <a className={actionLinkClassName} href={href} aria-label={`${labels.view} ${label}`}>
          {labels.view}
        </a>
      ) : null}
      <button type="button" className="fa-media-danger" disabled={deletingId === object.id} onClick={() => void onDelete(object)}>
        {labels.delete}
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
  onDelete,
  labels
}: {
  items: readonly MediaObjectPublic[];
  view: MediaLibraryView;
  objectHref?: (id: string) => string;
  deletingId: string | null;
  onDelete: (object: MediaObjectPublic) => Promise<void>;
  labels: MediaLibraryLabels;
}) {
  return (
    // A six-column table has no readable narrow form, so it scrolls inside its
    // own box rather than squashing its cells or forcing the whole page
    // sideways. `min-w-[34rem]` is what gives the bar something to reveal: the
    // table is `width: 100%`, which on its own can never exceed the wrapper.
    <div className="fa-media-table-scroll w-full overflow-x-auto">
      <table className="fa-media-table min-w-[34rem]">
        <thead>
          <tr>
            <th>{labels.preview}</th>
            <th>{labels.filename}</th>
            <th>{labels.actions}</th>
            <th>{labels.category}</th>
            <th>{labels.status}</th>
            <th>{labels.size}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((object, index) => (
            <tr key={object.id}>
              <td>
                <MediaObjectPreview object={object} view={view} index={index} labels={labels} />
              </td>
              <td>
                <MediaObjectName object={object} objectHref={objectHref} />
              </td>
              <td>
                <MediaObjectActions object={object} objectHref={objectHref} deletingId={deletingId} onDelete={onDelete} labels={labels} />
              </td>
              <td>{labels.categories[object.category]}</td>
              <td>
                <span className={`fa-media-badge fa-media-badge--${object.status}`}>{statusLabel(object.status, labels)}</span>
                <ScanStatusBadge object={object} labels={labels} />
              </td>
              <td>{humanizeBytes(object.size_bytes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
const PSEUDO_ROWS: ReadonlyArray<{ selection: CategoryBranchSelection }> = [
  { selection: { kind: "all" } },
  { selection: { kind: "uncategorized" } }
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
  expandedIds: ReadonlySet<number>,
  level: number,
  parentKey: string | null,
  out: TreePaneRow[]
): void {
  for (const node of nodes) {
    const key = `category-${node.id}`;
    const hasChildren = node.children.length > 0;
    const expanded = hasChildren && expandedIds.has(node.id);
    out.push({
      key,
      selection: { kind: "category", id: node.id },
      level,
      parentKey,
      hasChildren,
      expanded
    });
    if (expanded) collectBranchRows(node.children, expandedIds, level + 1, key, out);
  }
}

function flattenPaneRows(tree: readonly CategoryNode[], expandedIds: ReadonlySet<number>): TreePaneRow[] {
  const rows: TreePaneRow[] = PSEUDO_ROWS.map(({ selection }) => ({
    key: branchKey(selection),
    selection,
    level: 1,
    parentKey: null,
    hasChildren: false,
    expanded: false
  }));
  collectBranchRows(tree, expandedIds, 1, null, rows);
  return rows;
}

/**
 * Everything a row needs from the pane, passed as one object so the
 * `role`/`aria-*`/roving-tabindex wiring lives in exactly one component
 * (`MediaCategoryTreeItem`) and the recursive branch renderer only forwards it.
 */
interface TreePaneController {
  baseId: string;
  labels: MediaLibraryLabels["tree"];
  selection: CategoryBranchSelection;
  activeKey: string | null;
  expandedIds: ReadonlySet<number>;
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
            title={expanded ? controller.labels.collapse(label) : controller.labels.expand(label)}
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
        <span id={labelId} className="fa-media-tree-name whitespace-nowrap">
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
  const expanded = hasChildren && controller.expandedIds.has(node.id);

  return (
    <MediaCategoryTreeItem
      controller={controller}
      selection={{ kind: "category", id: node.id }}
      label={node.name}
      level={depth}
      count={node.total_object_count}
      countTitle={controller.labels.countTitle(node.object_count, node.total_object_count, node.name)}
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
  onSelect,
  labels
}: {
  selection: CategoryBranchSelection;
  onSelect: (selection: CategoryBranchSelection) => void;
  labels: MediaLibraryLabels["tree"];
}) {
  const { tree, loading, error } = useCategoryTree();
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  // Expanded ids, not collapsed ones: the pane opens with every branch shut,
  // so a deep tree presents its roots rather than its whole depth at once and
  // the pane starts at the width it can actually show. An empty set is the
  // honest seed for that — the inverted `collapsed` set this replaced could
  // only mean "all open" on first render, because the ids it would have to
  // hold are not known until the tree resolves.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(() => new Set<number>());
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const itemsRef = useRef(new Map<string, HTMLLIElement>());
  const rows = useMemo(() => flattenPaneRows(tree, expandedIds), [tree, expandedIds]);

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
    setExpandedIds((previous) => {
      if (previous.has(id) === expand) return previous;
      const next = new Set(previous);
      if (expand) next.add(id);
      else next.delete(id);
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
    labels,
    selection,
    activeKey,
    expandedIds,
    registerItem,
    select: onSelect,
    toggle: (id) => setExpansion(id, !expandedIds.has(id)),
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
    <aside className={treePaneClassName} aria-label={labels.regionLabel}>
      <h3 id={headingId}>{labels.title}</h3>
      {error ? (
        <p role="alert" className="fa-media-tree-error">
          {labels.loadError}
        </p>
      ) : null}
      {loading && tree.length === 0 ? <p className="fa-media-category-hint">{labels.loading}</p> : null}
      {!loading && !error && tree.length === 0 ? (
        <p className="fa-media-category-hint">
          {labels.empty}
        </p>
      ) : null}
      <ul role="tree" aria-labelledby={headingId} className="fa-media-tree-nodes min-w-max">
        {PSEUDO_ROWS.map((row) => (
          <MediaCategoryTreeItem
            key={branchKey(row.selection)}
            controller={controller}
            selection={row.selection}
            label={row.selection.kind === "all" ? labels.allMedia : labels.uncategorized}
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

/** One row of the per-import result table. */
function ImportResultRow({
  result,
  labels
}: {
  result: ImportObjectResult;
  labels: MediaLibraryLabels["transfer"];
}) {
  const message = result.reason ? friendlyReasonMessage({ reason: result.reason }, result.message ?? result.reason) : result.message;
  return (
    <tr>
      <td>{result.filename ?? result.source_id}</td>
      <td>{labels.importStatuses[result.status]}</td>
      <td>{message ?? "—"}</td>
    </tr>
  );
}

/**
 * Import/export control (`U10`). A single toggled panel rather than a modal
 * dialog — this package hand-rolls Tailwind token classes in `src/runtime`
 * rather than importing `astro-ui-m8` components here (`D11`; the
 * `dialog-form`/`data-table` composition is a separate registry skin, not
 * this runtime component). Export reuses the caller's live `filters`
 * (`ObjectListParams`) so exporting the selected tree branch (`U10`'s branch
 * bullet) falls out of passing the library's own `query` through unchanged.
 */
function MediaTransferPanel({
  filters,
  exportScopeLabel,
  labels
}: {
  filters: ObjectListParams;
  exportScopeLabel?: string;
  labels: MediaLibraryLabels["transfer"];
}) {
  const transfer = useMediaTransfer();
  const [exportFormat, setExportFormat] = useState<ExportFormat>("manifest");
  const [importFormat, setImportFormat] = useState<ImportFormat>("manifest");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleStartExport() {
    transfer.resetExport();
    try {
      await transfer.startExport(exportFormat, filters);
    } catch {
      // surfaced via `transfer.exportError`
    }
  }

  async function handleStartImport() {
    if (!importFile) return;
    try {
      await transfer.startImport(importFormat, importFile);
    } catch {
      // surfaced via `transfer.importError`
    } finally {
      setImportFile(null);
    }
  }

  function onDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) setImportFile(file);
  }

  const report = transfer.importReport;

  return (
    <div className={transferPanelClassName} role="region" aria-label={labels.regionLabel}>
      <section className={transferSectionClassName} aria-label={labels.exportTitle}>
        <h3>{labels.exportTitle}</h3>
        {exportScopeLabel ? <p className="fa-media-transfer-hint">{labels.scope}: {exportScopeLabel}</p> : null}
        <fieldset>
          <legend>{labels.format}</legend>
          {EXPORT_FORMAT_OPTIONS.map((value) => (
            <label key={value} className={labelInlineClassName}>
              <input
                type="radio"
                name="fa-media-export-format"
                value={value}
                checked={exportFormat === value}
                onChange={() => setExportFormat(value)}
              />
              {value === "manifest" ? labels.manifest : labels.archive}
              <span className="fa-media-transfer-hint">{value === "manifest" ? labels.manifestHint : labels.archiveHint}</span>
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className={buttonClassName}
          disabled={transfer.exportPending}
          onClick={() => void handleStartExport()}
        >
          {transfer.exportPending ? labels.exporting : labels.startExport}
        </button>
        {transfer.exportError ? (
          <p role="alert">
            {transfer.exportError instanceof Error ? transfer.exportError.message : labels.exportError}
          </p>
        ) : null}
        {transfer.exportFormat === "manifest" && transfer.manifest ? (
          <button type="button" className={buttonClassName} onClick={() => transfer.downloadManifest()}>
            {labels.downloadManifest(transfer.manifest.objects.length)}
          </button>
        ) : null}
        {transfer.exportFormat === "archive" && transfer.exportJob ? (
          <p role="status">
            {transfer.exportJob.status === "completed" && transfer.exportJob.download_url ? (
              <a className={actionLinkClassName} href={transfer.exportJob.download_url} download>
                {labels.downloadArchive(transfer.exportJob.object_count)}
              </a>
            ) : transfer.exportJob.status === "failed" ? (
              labels.exportFailed(transfer.exportJob.error)
            ) : (
              labels.exportStatus(transfer.exportJob.status)
            )}
          </p>
        ) : null}
      </section>
      <section className={transferSectionClassName} aria-label={labels.importTitle}>
        <h3>{labels.importTitle}</h3>
        <fieldset>
          <legend>{labels.format}</legend>
          {IMPORT_FORMAT_OPTIONS.map((value) => (
            <label key={value} className={labelInlineClassName}>
              <input
                type="radio"
                name="fa-media-import-format"
                value={value}
                checked={importFormat === value}
                onChange={() => setImportFormat(value)}
              />
              {value === "manifest" ? labels.manifest : labels.archive}
            </label>
          ))}
        </fieldset>
        <div
          className={dragActive ? `${transferDropzoneClassName} fa-media-transfer-dropzone--active` : transferDropzoneClassName}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
        >
          <label className={buttonClassName} htmlFor="fa-media-import-file">{labels.chooseFile}</label>
          <input
            id="fa-media-import-file"
            className="sr-only"
            type="file"
            accept={importFormat === "archive" ? ".zip" : ".json"}
            onChange={(event) => setImportFile(event.currentTarget.files?.[0] ?? null)}
          />
          {importFile ? <p>{importFile.name}</p> : <p>{labels.dropFile}</p>}
        </div>
        <button
          type="button"
          className={buttonClassName}
          disabled={!importFile || transfer.importPending}
          onClick={() => void handleStartImport()}
        >
          {transfer.importPending ? labels.importing : labels.startImport}
        </button>
        {transfer.importError ? (
          <p role="alert">
            {transfer.importError instanceof Error ? transfer.importError.message : labels.importError}
          </p>
        ) : null}
        {report ? (
          <div>
            <p role="status">
              {labels.report(report.created, report.linked, report.skipped, report.failed)}
              {report.categories_created ? `; ${labels.categoriesCreated(report.categories_created)}` : ""}
            </p>
            <div className={transferTableWrapClassName}>
              <table className={transferTableClassName}>
                <thead>
                  <tr>
                    <th>{labels.file}</th>
                    <th>{labels.status}</th>
                    <th>{labels.reason}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.objects.map((result) => (
                    <ImportResultRow key={result.source_id} result={result} labels={labels} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function MediaLibrary({
  objectHref,
  initial = {},
  initialUploadOpen = false,
  labels: labelOverrides
}: {
  objectHref?: (id: string) => string;
  initial?: ObjectListParams;
  /** Open the library's upload dialog on first render (legacy upload routes). */
  initialUploadOpen?: boolean;
  labels?: Partial<Omit<MediaLibraryLabels, "views" | "categories" | "statuses" | "tree" | "transfer" | "upload">> & {
    views?: Partial<MediaLibraryLabels["views"]>;
    categories?: Partial<MediaLibraryLabels["categories"]>;
    statuses?: Partial<MediaLibraryLabels["statuses"]>;
    tree?: Partial<MediaLibraryLabels["tree"]>;
    transfer?: Partial<MediaLibraryLabels["transfer"]>;
    upload?: Partial<Omit<MediaLibraryLabels["upload"], "form">> & {
      form?: Partial<MediaUploadDropzoneLabels>;
    };
  };
}) {
  const labels: MediaLibraryLabels = useMemo(
    () => ({
      ...DEFAULT_LABELS,
      ...labelOverrides,
      views: { ...DEFAULT_LABELS.views, ...labelOverrides?.views },
      categories: { ...DEFAULT_LABELS.categories, ...labelOverrides?.categories },
      statuses: { ...DEFAULT_LABELS.statuses, ...labelOverrides?.statuses },
      tree: { ...DEFAULT_LABELS.tree, ...labelOverrides?.tree },
      transfer: { ...DEFAULT_LABELS.transfer, ...labelOverrides?.transfer },
      upload: {
        ...DEFAULT_LABELS.upload,
        ...labelOverrides?.upload,
        form: { ...DEFAULT_LABELS.upload.form, ...labelOverrides?.upload?.form }
      }
    }),
    [labelOverrides]
  );
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
  const [transferOpen, setTransferOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(initialUploadOpen);
  const uploadCloseRef = useRef<HTMLButtonElement>(null);
  const { items, count, loading, error, hasMore, refresh, loadMore } = useMediaObjects(query);

  useEffect(() => {
    if (!uploadOpen) return;

    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    uploadCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setUploadOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      previousActive?.focus();
    };
  }, [uploadOpen]);

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
      setActionError(labels.deleteError);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="not-content fa-media-panel">
      <header className="fa-media-toolbar">
        <div className={titleRowClassName}>
          <h2>{labels.title} ({count})</h2>
          <div className={toolbarActionsClassName}>
            <div className={viewSwitcherClassName} aria-label={labels.viewLabel}>
              {VIEW_OPTIONS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  className={viewButtonClassName}
                  style={view === value ? activeViewButtonStyle : undefined}
                  onClick={() => setView(value)}
                >
                  {labels.views[value]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={buttonClassName}
              aria-pressed={transferOpen}
              aria-expanded={transferOpen}
              aria-controls="fa-media-transfer-panel"
              onClick={() => setTransferOpen((open) => !open)}
            >
              {labels.importExport}
            </button>
            <button type="button" className={buttonClassName} onClick={() => setUploadOpen(true)}>
              {labels.uploadMedia}
            </button>
          </div>
        </div>
        <div className={filterRowClassName}>
          <input
            className={inputClassName}
            type="search"
            aria-label={labels.searchLabel}
            placeholder={labels.searchPlaceholder}
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
            <option value="">{labels.allCategories}</option>
            {(["avatar", "document", "asset", "chat_attachment", "export", "receipt"] as MediaCategory[]).map((value) => (
              <option key={value} value={value}>
                {labels.categories[value]}
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
            <option value="">{labels.allStatuses}</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {labels.statuses[value]}
              </option>
            ))}
          </select>
        </div>
      </header>
      {transferOpen ? (
        <div id="fa-media-transfer-panel">
          <MediaTransferPanel
            filters={query}
            exportScopeLabel={view === "tree" ? exportBranchLabel(branchSelection, labels.tree) : undefined}
            labels={labels.transfer}
          />
        </div>
      ) : null}
      {uploadOpen ? (
        <div
          className="fa-media-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setUploadOpen(false);
          }}
        >
          <div
            className="fa-media-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fa-media-upload-dialog-title"
          >
            <header className="fa-media-dialog-header">
              <h2 id="fa-media-upload-dialog-title">{labels.upload.title}</h2>
              <button ref={uploadCloseRef} type="button" aria-label={labels.upload.closeLabel} onClick={() => setUploadOpen(false)}>
                {labels.upload.close}
              </button>
            </header>
            <MediaUploadDropzone
              heading={false}
              labels={labels.upload.form}
              onUploaded={() => {
                setUploadOpen(false);
                void refresh();
              }}
            />
          </div>
        </div>
      ) : null}
      {error ? <p role="alert">{labels.loadError}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      {view === "tree" ? (
        <div className={treeLayoutClassName}>
          <MediaCategoryTreePane selection={branchSelection} onSelect={handleBranchSelect} labels={labels.tree} />
          <div className={treeResultsClassName}>
            <MediaObjectTable
              items={items}
              view={view}
              objectHref={objectHref}
              deletingId={deletingId}
              onDelete={handleDelete}
              labels={labels}
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
          labels={labels}
        />
      ) : (
        <div className={view === "grid" ? gridClassName : masonryClassName}>
          {items.map((object, index) => (
            <article className={cardClassName} key={object.id}>
              <MediaObjectPreview object={object} view={view} index={index} labels={labels} />
              <div className={cardBodyClassName}>
                <h3 className={cardTitleClassName}>
                  <MediaObjectName object={object} objectHref={objectHref} />
                </h3>
                <div className={cardMetaClassName}>
                  <MediaObjectMeta object={object} labels={labels} />
                </div>
                <MediaObjectActions object={object} objectHref={objectHref} deletingId={deletingId} onDelete={handleDelete} labels={labels} />
              </div>
            </article>
          ))}
        </div>
      )}
      {loading ? <p>{labels.loading}</p> : null}
      {hasMore ? (
        <button type="button" disabled={loading} onClick={() => void loadMore()}>
          {labels.loadMore}
        </button>
      ) : null}
    </section>
  );
}

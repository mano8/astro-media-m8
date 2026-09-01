import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { deleteObject } from "../api/objects.js";
import { useDownloadUrl } from "../hooks/useDownloadUrl.js";
import { useMediaObjects } from "../hooks/useMediaObjects.js";
import { MediaUploadDropzone, type MediaUploadDropzoneLabels } from "./MediaUploadDropzone.js";
import { MediaCategoryTreePane } from "./MediaCategoryTreePane.js";
import { MediaTransferPanel } from "./MediaTransferPanel.js";
import {
  branchListParams,
  exportBranchLabel,
  initialBranchSelection,
  type CategoryBranchSelection
} from "./categoryBranch.js";
import { DEFAULT_LABELS, type MediaLibraryLabels, type MediaLibraryView } from "./mediaLibraryLabels.js";
import {
  actionLinkClassName,
  activeViewButtonStyle,
  buttonClassName,
  cardBodyClassName,
  cardClassName,
  cardMetaClassName,
  cardPreviewClassName,
  cardTitleClassName,
  filterRowClassName,
  gridClassName,
  inputClassName,
  itemActionsClassName,
  listPreviewStyle,
  masonryClassName,
  previewClassName,
  previewPlaceholderClassName,
  titleRowClassName,
  toolbarActionsClassName,
  treeLayoutClassName,
  treeResultsClassName,
  viewButtonClassName,
  viewSwitcherClassName
} from "./mediaLibraryStyles.js";
import type { MediaCategory, MediaObjectPublic, MediaObjectStatus, ObjectListParams } from "../schemas.js";

export type { MediaLibraryLabels };

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
const VIEW_OPTIONS: readonly MediaLibraryView[] = ["list", "grid", "masonry", "tree"];


function isImage(object: MediaObjectPublic): boolean {
  return object.mime_type.toLowerCase().startsWith("image/");
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

/**
 * The square that stands in for the object while (or instead of) an image:
 * the extension for a non-image, the loading/placeholder copy for an image
 * whose signed URL has not arrived.
 */
function PreviewPlaceholder({
  view,
  modifier,
  ariaLabel,
  children
}: {
  view: MediaLibraryView;
  modifier: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`${previewPlaceholderClassName} ${modifier}`}
      style={isListLayout(view) ? listPreviewStyle : undefined}
      aria-hidden={ariaLabel === undefined ? true : undefined}
      aria-label={ariaLabel}
    >
      {children}
    </span>
  );
}

/**
 * The object's signed download URL, requested once and only for an image. A
 * non-image never asks for one: its preview is the extension, and a request
 * per row would be a signature the UI throws away.
 */
function usePreviewUrl(object: MediaObjectPublic, isImageObject: boolean) {
  const { data, loading, error, request } = useDownloadUrl(isImageObject ? object.id : null);

  useEffect(() => {
    if (!isImageObject || data || loading || error) return;
    void request();
  }, [data, error, isImageObject, loading, request]);

  return { data, loading };
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
  const isImageObject = isImage(object);
  const { data, loading } = usePreviewUrl(object, isImageObject);
  const loadingMode = previewLoadingFor(view, index);
  const listLayout = isListLayout(view);

  if (!isImageObject) {
    return (
      <PreviewPlaceholder view={view} modifier="fa-media-preview--file">
        {object.extension ?? "file"}
      </PreviewPlaceholder>
    );
  }

  if (!data) {
    return (
      <PreviewPlaceholder
        view={view}
        modifier="fa-media-preview--loading"
        ariaLabel={`${objectLabel(object)} ${labels.previewLoading}`}
      >
        {loading ? labels.previewLoading : labels.previewPlaceholder}
      </PreviewPlaceholder>
    );
  }

  return (
    <img
      className={listLayout ? previewClassName : `${previewClassName} ${cardPreviewClassName}`}
      src={data.url}
      alt={objectLabel(object)}
      style={listLayout ? listPreviewStyle : undefined}
      width={listLayout ? 128 : undefined}
      height={listLayout ? 128 : undefined}
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

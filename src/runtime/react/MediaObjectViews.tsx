/**
 * How one media object is drawn: its preview, name, metadata, row actions, and
 * the results table the list and tree views share.
 *
 * Split out of `MediaLibrary` so the library module is the view state, the
 * filters and the toolbar — not also every cell of the table it renders.
 */
import { useEffect, type ReactNode } from "react";
import { useDownloadUrl } from "../hooks/useDownloadUrl.js";
import {
  actionLinkClassName,
  cardPreviewClassName,
  itemActionsClassName,
  listPreviewStyle,
  previewClassName,
  previewPlaceholderClassName
} from "./mediaLibraryStyles.js";
import type { MediaLibraryLabels, MediaLibraryView } from "./mediaLibraryLabels.js";
import type { MediaObjectPublic, MediaObjectStatus } from "../schemas.js";

type PreviewLoading = {
  loading: "eager" | "lazy";
  fetchPriority: "high" | "low";
};

function isImage(object: MediaObjectPublic): boolean {
  return object.mime_type.toLowerCase().startsWith("image/");
}


/**
 * `tree` renders the **same** table body as `list` in its right pane, so every
 * "is this the list layout?" branch (preview sizing, `<img>` classes) has to
 * answer yes for it too. Forking a second table — and a second set of preview
 * rules — is exactly what this predicate exists to prevent.
 */
export function isListLayout(view: MediaLibraryView): boolean {
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

export function objectLabel(object: MediaObjectPublic): string {
  return object.original_filename ?? object.id;
}

export function humanizeBytes(bytes: number): string {
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

export function statusLabel(status: MediaObjectStatus, labels: MediaLibraryLabels): string {
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

export function MediaObjectPreview({
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

export function MediaObjectName({ object, objectHref }: { object: MediaObjectPublic; objectHref?: (id: string) => string }) {
  const label = objectLabel(object);
  return objectHref ? <a href={objectHref(object.id)}>{label}</a> : label;
}

export function MediaObjectMeta({ object, labels }: { object: MediaObjectPublic; labels: MediaLibraryLabels }) {
  return (
    <>
      <span>{labels.categories[object.category]}</span>
      <span className={`fa-media-badge fa-media-badge--${object.status}`}>{statusLabel(object.status, labels)}</span>
      <ScanStatusBadge object={object} labels={labels} />
      <span>{humanizeBytes(object.size_bytes)}</span>
    </>
  );
}

export function MediaObjectActions({
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
export function MediaObjectTable({
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

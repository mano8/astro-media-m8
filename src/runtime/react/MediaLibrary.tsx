import { useEffect, useState, type CSSProperties } from "react";
import { useDownloadUrl } from "../hooks/useDownloadUrl.js";
import { useMediaObjects } from "../hooks/useMediaObjects.js";
import type { MediaCategory, MediaObjectPublic, MediaObjectStatus, ObjectListParams } from "../schemas.js";

type MediaLibraryView = "list" | "grid" | "masonry";

type PreviewLoading = {
  loading: "eager" | "lazy";
  fetchPriority: "high" | "low";
};

const STATUS_BADGE: Record<MediaObjectStatus, string> = {
  pending_upload: "Pending",
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
  deleted: "Deleted",
  rejected: "Rejected"
};
const inputClassName =
  "fa-media-control h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

const VIEW_LABELS: Record<MediaLibraryView, string> = {
  list: "List",
  grid: "Grid",
  masonry: "Masonry"
};
const titleRowClassName = "fa-media-title-row flex w-full flex-wrap items-center justify-between gap-3";
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
const listPreviewStyle: CSSProperties = {
  aspectRatio: "1 / 1",
  borderRadius: "0.375rem",
  height: "clamp(4rem, 12vw, 8rem)",
  maxHeight: "8rem",
  maxWidth: "8rem",
  objectFit: "cover",
  width: "clamp(4rem, 12vw, 8rem)"
};
const activeViewButtonStyle: CSSProperties = {
  background: "var(--fa-media-active-bg, var(--foreground, CanvasText))",
  borderColor: "var(--fa-media-active-bg, var(--foreground, CanvasText))",
  color: "var(--fa-media-active-fg, var(--background, Canvas))"
};

function isImage(object: MediaObjectPublic): boolean {
  return object.mime_type.toLowerCase().startsWith("image/");
}

function previewLoadingFor(view: MediaLibraryView, index: number): PreviewLoading {
  if (view === "list") return { loading: "lazy", fetchPriority: "low" };
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

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
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
        style={view === "list" ? listPreviewStyle : undefined}
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
        style={view === "list" ? listPreviewStyle : undefined}
        aria-label={`${objectLabel(object)} preview loading`}
      >
        {loading ? "Loading" : "Preview"}
      </span>
    );
  }

  return (
    <img
      className={view === "list" ? previewClassName : `${previewClassName} ${cardPreviewClassName}`}
      src={data.url}
      alt={objectLabel(object)}
      style={view === "list" ? listPreviewStyle : undefined}
      width={view === "list" ? 128 : undefined}
      height={view === "list" ? 128 : undefined}
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
      <span className={`fa-media-badge fa-media-badge--${object.status}`}>{STATUS_BADGE[object.status]}</span>
      <span>{humanizeBytes(object.size_bytes)}</span>
    </>
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
  const { items, count, loading, error, hasMore, loadMore } = useMediaObjects(query);

  return (
    <section className="not-content fa-media-panel">
      <header className="fa-media-toolbar">
        <div className={titleRowClassName}>
          <h2>Media library ({count})</h2>
          <div className={viewSwitcherClassName} aria-label="Media library view">
            {(Object.keys(VIEW_LABELS) as MediaLibraryView[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                className={viewButtonClassName}
                style={view === value ? activeViewButtonStyle : undefined}
                onClick={() => setView(value)}
              >
                {VIEW_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
        <input
          className={inputClassName}
          type="search"
          placeholder="Search filename"
          onChange={(event) => setQuery((prev) => ({ ...prev, q: event.currentTarget.value || undefined }))}
        />
        <select
          className={inputClassName}
          onChange={(event) =>
            setQuery((prev) => ({ ...prev, category: (event.currentTarget.value || undefined) as MediaCategory | undefined }))
          }
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
          onChange={(event) =>
            setQuery((prev) => ({
              ...prev,
              status: (event.currentTarget.value || undefined) as MediaObjectStatus | undefined
            }))
          }
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_BADGE) as MediaObjectStatus[]).map((value) => (
            <option key={value} value={value}>
              {STATUS_BADGE[value]}
            </option>
          ))}
        </select>
      </header>
      {error ? <p role="alert">Failed to load media</p> : null}
      {view === "list" ? (
        <table className="fa-media-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Filename</th>
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
                <td>{object.category}</td>
                <td>
                  <span className={`fa-media-badge fa-media-badge--${object.status}`}>{STATUS_BADGE[object.status]}</span>
                </td>
                <td>{humanizeBytes(object.size_bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { deleteObject } from "../api/objects.js";
import { useMediaObjects } from "../hooks/useMediaObjects.js";
import { MediaUploadDropzone, type MediaUploadDropzoneLabels } from "./MediaUploadDropzone.js";
import { MediaCategoryTreePane } from "./MediaCategoryTreePane.js";
import {
  MediaObjectActions,
  MediaObjectMeta,
  MediaObjectName,
  MediaObjectPreview,
  MediaObjectTable
} from "./MediaObjectViews.js";
import { MediaTransferPanel } from "./MediaTransferPanel.js";
import {
  branchListParams,
  exportBranchLabel,
  initialBranchSelection,
  type CategoryBranchSelection
} from "./categoryBranch.js";
import { DEFAULT_LABELS, type MediaLibraryLabels, type MediaLibraryView } from "./mediaLibraryLabels.js";
import {
  activeViewButtonStyle,
  buttonClassName,
  cardBodyClassName,
  cardClassName,
  cardMetaClassName,
  cardTitleClassName,
  filterRowClassName,
  gridClassName,
  inputClassName,
  masonryClassName,
  titleRowClassName,
  toolbarActionsClassName,
  treeLayoutClassName,
  treeResultsClassName,
  viewButtonClassName,
  viewSwitcherClassName
} from "./mediaLibraryStyles.js";
import type { MediaCategory, MediaObjectPublic, MediaObjectStatus, ObjectListParams } from "../schemas.js";

export type { MediaLibraryLabels };

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

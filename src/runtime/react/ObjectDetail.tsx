import { useState } from "react";
import { useDownloadUrl } from "../hooks/useDownloadUrl.js";
import { useMediaObject } from "../hooks/useMediaObject.js";
import { ApiError, messageFromDetail } from "../errors.js";
import { CategoryMultiSelect, isSameCategorySelection } from "./CategoryMultiSelect.js";
import { VariantPicker } from "./VariantPicker.js";
import type { MediaCategory, MediaObjectCategoryRef, MediaVisibility } from "../schemas.js";

const inputClassName =
  "fa-media-control h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";
const labelClassName =
  "fa-media-label flex items-center gap-2 pb-2 text-sm leading-none font-medium select-none";

/**
 * Copy for the refusals the object PATCH can answer once it carries
 * `category_ids` (`U4`): an unknown id, a foreign one, or more than the
 * server's `MAX_CATEGORY_ASSIGNMENTS`. Each is a recoverable user error, so it
 * is surfaced as its own sentence rather than a generic "save failed".
 */
function describeFilingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return "One of the selected categories no longer exists. Refresh and try again.";
    if (error.status === 403) return "One of the selected categories is not yours to use.";
    if (error.status === 422) {
      return messageFromDetail(error.detail) ?? "Too many categories selected for one object.";
    }
    return messageFromDetail(error.detail) ?? error.message;
  }
  return error instanceof Error ? error.message : "Failed to save the categories";
}

function labelsFor(categories: readonly MediaObjectCategoryRef[]): ReadonlyMap<number, string> {
  return new Map(categories.map((category) => [category.id, category.path]));
}

export function ObjectDetail({ objectId, onDeleted }: { objectId: string; onDeleted?: () => void }) {
  const { object, loading, error, update, remove } = useMediaObject(objectId);
  const { data: download, request: requestDownload } = useDownloadUrl(objectId);
  const [saving, setSaving] = useState(false);
  // `null` means "not edited yet" — the picker mirrors the served filing until
  // the user touches it, so a background refetch is not fighting a local draft.
  const [draftCategoryIds, setDraftCategoryIds] = useState<number[] | null>(null);
  const [filingError, setFilingError] = useState<unknown>(null);

  if (loading && !object) return <p>Loading…</p>;
  if (error) return <p role="alert">Failed to load object</p>;
  if (!object) return <p>Not found</p>;

  async function patch(field: "visibility" | "category", value: string) {
    setSaving(true);
    try {
      await update(
        field === "visibility"
          ? { visibility: value as MediaVisibility }
          : { category: value as MediaCategory }
      );
    } finally {
      setSaving(false);
    }
  }

  const assignedIds = object.categories.map((category) => category.id);
  const selectedIds = draftCategoryIds ?? assignedIds;
  const filingDirty = draftCategoryIds !== null && !isSameCategorySelection(draftCategoryIds, assignedIds);

  async function saveFiling(next: readonly number[]) {
    setSaving(true);
    setFilingError(null);
    try {
      // Set semantics (`U4`): the whole filing is replaced by this array, and
      // `[]` unfiles the object.
      await update({ category_ids: [...next] });
      setDraftCategoryIds(null);
    } catch (saveError) {
      setFilingError(saveError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="not-content fa-media-panel">
      <h2>{object.original_filename ?? object.id}</h2>
      <dl className="fa-media-meta">
        <dt>Status</dt>
        <dd>{object.status}</dd>
        <dt>Scan</dt>
        <dd>{object.scan_status}</dd>
        <dt>MIME</dt>
        <dd>{object.mime_type}</dd>
        <dt>Size</dt>
        <dd>{object.size_bytes} bytes</dd>
      </dl>

      <div className="fa-media-field-control">
        <label className={labelClassName} htmlFor="fa-media-object-visibility">Visibility</label>
        <select id="fa-media-object-visibility" className={inputClassName} disabled={saving} value={object.visibility} onChange={(event) => void patch("visibility", event.currentTarget.value)}>
          {(["private", "public", "tenant", "sensitive"] as MediaVisibility[]).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <CategoryMultiSelect
        value={selectedIds}
        onChange={setDraftCategoryIds}
        disabled={saving}
        idPrefix="fa-media-object-categories"
        legend="User categories"
        emptyHint="No user categories yet. Create one from the category manager to re-file this object."
        fallbackLabels={labelsFor(object.categories)}
      />
      <div className="fa-media-actions fa-media-category-actions">
        <button type="button" disabled={!filingDirty || saving} onClick={() => void saveFiling(selectedIds)}>
          {saving ? "Saving…" : "Save categories"}
        </button>
        <button
          type="button"
          disabled={draftCategoryIds === null || saving}
          onClick={() => {
            setDraftCategoryIds(null);
            setFilingError(null);
          }}
        >
          Reset
        </button>
      </div>
      {filingError ? <p role="alert">{describeFilingError(filingError)}</p> : null}

      <div className="fa-media-actions">
        <button type="button" onClick={() => void requestDownload()}>
          Get download URL
        </button>
        {download ? (
          <a href={download.url} rel="noreferrer">
            Download (expires {download.expires_at})
          </a>
        ) : null}
        <button
          type="button"
          className="fa-media-danger"
          onClick={async () => {
            await remove();
            onDeleted?.();
          }}
        >
          Delete
        </button>
      </div>

      <VariantPicker objectId={object.id} />
    </section>
  );
}

import { useState, type ChangeEvent } from "react";
import { useMediaUpload } from "../hooks/useMediaUpload.js";
import { ApiError, friendlyReasonMessage } from "../errors.js";
import { UploadError } from "../upload/uploadController.js";
import { CategoryMultiSelect, type CategoryMultiSelectLabels } from "./CategoryMultiSelect.js";
import type { MediaCategory, MediaObjectPublic, MediaVisibility } from "../schemas.js";

const CATEGORIES: MediaCategory[] = [
  "avatar",
  "document",
  "asset",
  "chat_attachment",
  "export",
  "receipt"
];
const VISIBILITIES: MediaVisibility[] = ["private", "public", "tenant", "sensitive"];
const inputClassName =
  "fa-media-control h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";
const labelClassName =
  "fa-media-label flex items-center gap-2 pb-2 text-sm leading-none font-medium select-none";

/**
 * Reduce an upload failure to a rendering variant and a friendly message.
 * `scan` rejections (virus-scan verdict) get their own copy and styling,
 * distinct from an `api`/validation rejection (size/MIME/checksum/quota),
 * which is mapped through `friendlyReasonMessage` against the server detail.
 */
export interface MediaUploadDropzoneLabels {
  heading: string;
  category: string;
  visibility: string;
  categories: Record<MediaCategory, string>;
  visibilities: Record<MediaVisibility, string>;
  emptyCategories: string;
  chooseFile: string;
  cancel: string;
  uploadFailed: string;
  scanRejected: string;
  categoryPicker: Partial<CategoryMultiSelectLabels>;
}

const DEFAULT_LABELS: MediaUploadDropzoneLabels = {
  heading: "Upload media",
  category: "Category",
  visibility: "Visibility",
  categories: {
    avatar: "Avatar",
    document: "Document",
    asset: "Asset",
    chat_attachment: "Chat attachment",
    export: "Export",
    receipt: "Receipt"
  },
  visibilities: {
    private: "Private",
    public: "Public",
    tenant: "Tenant",
    sensitive: "Sensitive"
  },
  emptyCategories: "No user categories yet. This upload will still work — the category above is the one the service requires.",
  chooseFile: "Choose file",
  cancel: "Cancel",
  uploadFailed: "Upload failed",
  scanRejected: "Rejected by virus scan: ",
  categoryPicker: {}
};

function describeUploadError(
  error: unknown,
  fallback: string
): { variant: "scan" | "validation"; message: string } {
  if (error instanceof UploadError) {
    if (error.kind === "scan") return { variant: "scan", message: error.message };
    const detail = error.cause instanceof ApiError ? error.cause.detail : undefined;
    return { variant: "validation", message: friendlyReasonMessage(detail, error.message) };
  }
  return { variant: "validation", message: error instanceof Error ? error.message : fallback };
}

export function MediaUploadDropzone({
  defaultCategory = "asset",
  defaultVisibility = "private",
  defaultCategoryIds,
  showUserCategories = true,
  checksum = "sha256",
  heading,
  labels: labelOverrides,
  onUploaded
}: {
  defaultCategory?: MediaCategory;
  defaultVisibility?: MediaVisibility;
  /** Pre-selected user categories for the optional nested picker. */
  defaultCategoryIds?: number[];
  /**
   * Render the optional user-category picker beside the required functional
   * category. Off gives a consumer whose deployment does not use user
   * categories the previous two-field form back.
   */
  showUserCategories?: boolean;
  checksum?: "none" | "sha256";
  /** Visible section heading. Pass false when a surrounding dialog labels the form. */
  heading?: string | false;
  labels?: Partial<Omit<MediaUploadDropzoneLabels, "categories" | "visibilities" | "categoryPicker">> & {
    categories?: Partial<Record<MediaCategory, string>>;
    visibilities?: Partial<Record<MediaVisibility, string>>;
    categoryPicker?: Partial<CategoryMultiSelectLabels>;
  };
  onUploaded?: (object: MediaObjectPublic) => void;
}) {
  const labels: MediaUploadDropzoneLabels = {
    ...DEFAULT_LABELS,
    ...labelOverrides,
    categories: { ...DEFAULT_LABELS.categories, ...labelOverrides?.categories },
    visibilities: { ...DEFAULT_LABELS.visibilities, ...labelOverrides?.visibilities },
    categoryPicker: { ...DEFAULT_LABELS.categoryPicker, ...labelOverrides?.categoryPicker }
  };
  const resolvedHeading = heading === undefined ? labels.heading : heading;
  const { upload, abort, progress, error, busy } = useMediaUpload();
  const [category, setCategory] = useState<MediaCategory>(defaultCategory);
  const [visibility, setVisibility] = useState<MediaVisibility>(defaultVisibility);
  const [categoryIds, setCategoryIds] = useState<number[]>(() => defaultCategoryIds ?? []);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const object = await upload({
        file,
        category,
        visibility,
        // An empty selection is omitted rather than sent as `[]`, so an older
        // service that does not know the field is unaffected.
        categoryIds: categoryIds.length ? categoryIds : undefined,
        checksum,
        waitForScan: true
      });
      onUploaded?.(object);
    } catch {
      // surfaced via `error`
    }
  }

  const pct = progress?.fraction != null ? Math.round(progress.fraction * 100) : null;

  return (
    <section className="not-content fa-media-panel">
      {resolvedHeading ? <h2>{resolvedHeading}</h2> : null}
      <div className="fa-media-field">
        <div className="fa-media-field-control">
          <label className={labelClassName} htmlFor="fa-media-upload-category">{labels.category}</label>
          <select id="fa-media-upload-category" className={inputClassName} value={category} onChange={(event) => setCategory(event.currentTarget.value as MediaCategory)}>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {labels.categories[value]}
              </option>
            ))}
          </select>
        </div>
        <div className="fa-media-field-control">
          <label className={labelClassName} htmlFor="fa-media-upload-visibility">{labels.visibility}</label>
          <select id="fa-media-upload-visibility" className={inputClassName} value={visibility} onChange={(event) => setVisibility(event.currentTarget.value as MediaVisibility)}>
            {VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {labels.visibilities[value]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {showUserCategories ? (
        <CategoryMultiSelect
          value={categoryIds}
          onChange={setCategoryIds}
          disabled={busy}
          idPrefix="fa-media-upload-categories"
          emptyHint={labels.emptyCategories}
          labels={labels.categoryPicker}
        />
      ) : null}
      <label className="fa-media-button inline-flex min-h-8 cursor-pointer items-center rounded-lg border border-input px-3 py-1 text-sm font-medium transition-colors hover:bg-muted">
        {labels.chooseFile}
        <input className="sr-only" type="file" disabled={busy} onChange={onPick} />
      </label>
      {progress ? (
        <div className="fa-media-progress" role="status">
          <span>{progress.state}</span>
          {pct != null ? <progress max={100} value={pct} /> : null}
        </div>
      ) : null}
      {busy ? (
        <button type="button" onClick={abort}>
          {labels.cancel}
        </button>
      ) : null}
      {error
        ? (() => {
            const { variant, message } = describeUploadError(error, labels.uploadFailed);
            return (
              <p role="alert" className={`fa-media-upload-error fa-media-upload-error--${variant}`}>
                {variant === "scan" ? labels.scanRejected : null}
                {message}
              </p>
            );
          })()
        : null}
    </section>
  );
}

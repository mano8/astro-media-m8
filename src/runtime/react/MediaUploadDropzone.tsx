import { useState, type ChangeEvent } from "react";
import { useMediaUpload } from "../hooks/useMediaUpload.js";
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

export function MediaUploadDropzone({
  defaultCategory = "asset",
  defaultVisibility = "private",
  checksum = "sha256",
  onUploaded
}: {
  defaultCategory?: MediaCategory;
  defaultVisibility?: MediaVisibility;
  checksum?: "none" | "sha256";
  onUploaded?: (object: MediaObjectPublic) => void;
}) {
  const { upload, abort, progress, error, busy } = useMediaUpload();
  const [category, setCategory] = useState<MediaCategory>(defaultCategory);
  const [visibility, setVisibility] = useState<MediaVisibility>(defaultVisibility);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const object = await upload({ file, category, visibility, checksum, waitForScan: true });
      onUploaded?.(object);
    } catch {
      // surfaced via `error`
    }
  }

  const pct = progress?.fraction != null ? Math.round(progress.fraction * 100) : null;

  return (
    <section className="not-content fa-media-panel">
      <h2>Upload media</h2>
      <div className="fa-media-field">
        <div className="fa-media-field-control">
          <label className={labelClassName} htmlFor="fa-media-upload-category">Category</label>
          <select id="fa-media-upload-category" className={inputClassName} value={category} onChange={(event) => setCategory(event.currentTarget.value as MediaCategory)}>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="fa-media-field-control">
          <label className={labelClassName} htmlFor="fa-media-upload-visibility">Visibility</label>
          <select id="fa-media-upload-visibility" className={inputClassName} value={visibility} onChange={(event) => setVisibility(event.currentTarget.value as MediaVisibility)}>
            {VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>
      <input className={inputClassName} type="file" disabled={busy} onChange={onPick} />
      {progress ? (
        <div className="fa-media-progress" role="status">
          <span>{progress.state}</span>
          {pct != null ? <progress max={100} value={pct} /> : null}
        </div>
      ) : null}
      {busy ? (
        <button type="button" onClick={abort}>
          Cancel
        </button>
      ) : null}
      {error ? <p role="alert">{error instanceof Error ? error.message : "Upload failed"}</p> : null}
    </section>
  );
}

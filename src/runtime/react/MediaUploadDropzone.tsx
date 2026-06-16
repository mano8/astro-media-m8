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
    <section className="fa-media-panel">
      <h2>Upload media</h2>
      <div className="fa-media-field">
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.currentTarget.value as MediaCategory)}>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Visibility
          <select value={visibility} onChange={(event) => setVisibility(event.currentTarget.value as MediaVisibility)}>
            {VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input type="file" disabled={busy} onChange={onPick} />
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

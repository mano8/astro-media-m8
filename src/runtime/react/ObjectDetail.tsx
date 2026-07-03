import { useState } from "react";
import { useDownloadUrl } from "../hooks/useDownloadUrl.js";
import { useMediaObject } from "../hooks/useMediaObject.js";
import { VariantPicker } from "./VariantPicker.js";
import type { MediaCategory, MediaVisibility } from "../schemas.js";

const inputClassName =
  "fa-media-control h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";
const labelClassName =
  "fa-media-label flex items-center gap-2 pb-2 text-sm leading-none font-medium select-none";

export function ObjectDetail({ objectId, onDeleted }: { objectId: string; onDeleted?: () => void }) {
  const { object, loading, error, update, remove } = useMediaObject(objectId);
  const { data: download, request: requestDownload } = useDownloadUrl(objectId);
  const [saving, setSaving] = useState(false);

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

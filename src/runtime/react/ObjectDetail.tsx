import { useState } from "react";
import { useDownloadUrl } from "../hooks/useDownloadUrl.js";
import { useMediaObject } from "../hooks/useMediaObject.js";
import { VariantPicker } from "./VariantPicker.js";
import type { MediaCategory, MediaVisibility } from "../schemas.js";

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
    <section className="fa-media-panel">
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

      <label>
        Visibility
        <select disabled={saving} value={object.visibility} onChange={(event) => void patch("visibility", event.currentTarget.value)}>
          {(["private", "public", "tenant", "sensitive"] as MediaVisibility[]).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

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

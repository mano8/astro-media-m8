import { useState } from "react";
import { useMediaObjects } from "../hooks/useMediaObjects.js";
import type { MediaCategory, MediaObjectStatus, ObjectListParams } from "../schemas.js";

const STATUS_BADGE: Record<MediaObjectStatus, string> = {
  pending_upload: "Pending",
  uploaded: "Uploaded",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
  deleted: "Deleted",
  rejected: "Rejected"
};

export function MediaLibrary({
  objectHref,
  initial = {}
}: {
  objectHref?: (id: string) => string;
  initial?: ObjectListParams;
}) {
  const [query, setQuery] = useState<ObjectListParams>(initial);
  const { items, count, loading, error, hasMore, loadMore } = useMediaObjects(query);

  return (
    <section className="fa-media-panel">
      <header className="fa-media-toolbar">
        <h2>Media library ({count})</h2>
        <input
          type="search"
          placeholder="Search filename"
          onChange={(event) => setQuery((prev) => ({ ...prev, q: event.currentTarget.value || undefined }))}
        />
        <select
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
      </header>
      {error ? <p role="alert">Failed to load media</p> : null}
      <table className="fa-media-table">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Category</th>
            <th>Status</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {items.map((object) => (
            <tr key={object.id}>
              <td>
                {objectHref ? <a href={objectHref(object.id)}>{object.original_filename ?? object.id}</a> : object.original_filename ?? object.id}
              </td>
              <td>{object.category}</td>
              <td>
                <span className={`fa-media-badge fa-media-badge--${object.status}`}>{STATUS_BADGE[object.status]}</span>
              </td>
              <td>{object.size_bytes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {loading ? <p>Loading…</p> : null}
      {hasMore ? (
        <button type="button" disabled={loading} onClick={() => void loadMore()}>
          Load more
        </button>
      ) : null}
    </section>
  );
}

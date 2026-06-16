import { useState } from "react";
import { useMediaAdmin } from "../hooks/useMediaAdmin.js";
import { RequireSuperuser } from "./RequireSuperuser.js";

function AdminMediaPanelInner() {
  const admin = useMediaAdmin();
  const [confirmRepair, setConfirmRepair] = useState(false);

  return (
    <section className="fa-media-panel">
      <h2>Storage administration</h2>
      {admin.error ? <p role="alert">{admin.error instanceof Error ? admin.error.message : "Admin request failed"}</p> : null}

      <div className="fa-media-actions">
        <button type="button" disabled={admin.loading} onClick={() => void admin.loadStats()}>
          Load storage stats
        </button>
        <button type="button" disabled={admin.loading} onClick={() => void admin.loadStale()}>
          Load stale uploads
        </button>
        <button type="button" disabled={admin.loading} onClick={() => void admin.loadOrphans()}>
          Report orphans (dry-run)
        </button>
      </div>

      {admin.stats ? (
        <p>
          {admin.stats.total_objects} objects · {admin.stats.total_bytes} bytes · {admin.stats.deleted_objects} deleted
        </p>
      ) : null}
      {admin.stale ? <p>{admin.stale.count} stale upload sessions</p> : null}
      {admin.orphans ? (
        <p>
          DB orphans: {admin.orphans.db_orphan_count} · storage orphans: {admin.orphans.storage_orphan_count} · repaired:{" "}
          {admin.orphans.repaired}
        </p>
      ) : null}

      <fieldset className="fa-media-danger-zone">
        <legend>Destructive operations</legend>
        <button type="button" disabled={admin.loading} onClick={() => void admin.purgeStale()}>
          Purge stale uploads
        </button>
        <label>
          <input type="checkbox" checked={confirmRepair} onChange={(event) => setConfirmRepair(event.currentTarget.checked)} />
          I understand repairing deletes storage-orphan bytes
        </label>
        <button type="button" disabled={admin.loading || !confirmRepair} onClick={() => void admin.repair(true)}>
          Repair orphans
        </button>
        <button type="button" disabled={admin.loading} onClick={() => void admin.purgeExpiredObjects()}>
          Purge expired (retention)
        </button>
      </fieldset>
    </section>
  );
}

export function AdminMediaPanel() {
  return (
    <RequireSuperuser fallback={<p>You need administrator access to view this page.</p>}>
      <AdminMediaPanelInner />
    </RequireSuperuser>
  );
}

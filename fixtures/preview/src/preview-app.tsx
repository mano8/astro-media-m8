import * as React from "react";

import {
  AdminMediaView,
  LibraryView,
  ObjectDetailView,
  PresetsView,
  UploadView
} from "../../../src/runtime/react/default-ui/index.js";
import { MediaErrorBoundary } from "../../../src/runtime/react/MediaErrorBoundary.js";

const CONFIG = {
  apiBase: "/media-api",
  apiPrefix: ""
} as const;

const SAMPLE_OBJECT_ID = "11111111-1111-4111-8111-000000000001";

type PanelId = "library" | "object" | "upload" | "presets" | "admin" | "boundary";

const PANELS: { id: PanelId; label: string; description: string }[] = [
  {
    id: "library",
    label: "Library",
    description:
      "The island `library.astro` mounts. Category, visibility and status filters reach the stub service, which answers them."
  },
  {
    id: "object",
    label: "Object detail",
    description: "The island `object/[id].astro` mounts, for one stubbed object."
  },
  {
    id: "upload",
    label: "Upload",
    description: "The island `upload.astro` mounts. The dropzone renders without a live bucket."
  },
  {
    id: "presets",
    label: "Presets",
    description: "The island `presets.astro` mounts over the stubbed preset list."
  },
  {
    id: "admin",
    label: "Admin panel",
    description:
      "The island `admin/media.astro` mounts. The stub reports a non-superuser, so this is the fail-closed surface."
  },
  {
    id: "boundary",
    label: "Error boundary",
    description:
      "A render throw inside an island would otherwise blank the whole island. `A-C3`'s boundary degrades it to the plugin's error surface."
  }
];

/** Throws on demand so the boundary panel has something real to catch. */
function BoundaryProbe({ failing }: { failing: boolean }) {
  if (failing) throw new Error("The preview probe threw during render.");
  return <p className="preview-copy">The probe is rendering normally. Break it to see the catch.</p>;
}

function BoundaryPanel() {
  const [failing, setFailing] = React.useState(false);
  const [caught, setCaught] = React.useState<string | null>(null);

  return (
    <div className="preview-stack">
      <div className="preview-actions">
        <button type="button" onClick={() => setFailing((current) => !current)}>
          {failing ? "Repair the probe" : "Break the probe"}
        </button>
        {caught ? <span className="preview-note">onError saw: {caught}</span> : null}
      </div>
      <MediaErrorBoundary resetKeys={[failing]} onError={(error) => setCaught(error.message)}>
        <BoundaryProbe failing={failing} />
      </MediaErrorBoundary>
    </div>
  );
}

export function PreviewApp() {
  const [panel, setPanel] = React.useState<PanelId>("library");
  const active = PANELS.find((entry) => entry.id === panel) ?? PANELS[0];

  return (
    <main className="preview-shell">
      <header className="preview-hero">
        <p className="preview-kicker">dev-only fixture</p>
        <h1>astro-media-m8 /_preview</h1>
        <p className="preview-copy">
          Every panel below mounts a real island root against an in-memory stand-in for
          media-service-m8. No backend, no auth, and no mocked hooks: the views, hooks, api
          wrappers and Zod schemas are the shipped ones, and only <code>fetch</code> is replaced.
        </p>
        <nav className="preview-tabs">
          {PANELS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={entry.id === panel ? "is-active" : undefined}
              onClick={() => setPanel(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      <section className="preview-card">
        <div className="preview-card__header">
          <h2>{active.label}</h2>
          <p>{active.description}</p>
        </div>
        {/*
          Keyed on the panel id so switching tabs remounts the island rather
          than re-using a mounted one. That is what a route change does, and it
          is the state a gallery should be showing.
        */}
        <div className="preview-stage" key={panel}>
          {panel === "library" ? <LibraryView config={CONFIG} /> : null}
          {panel === "object" ? (
            <ObjectDetailView config={CONFIG} objectId={SAMPLE_OBJECT_ID} />
          ) : null}
          {panel === "upload" ? <UploadView config={CONFIG} /> : null}
          {panel === "presets" ? <PresetsView config={CONFIG} /> : null}
          {panel === "admin" ? <AdminMediaView config={CONFIG} /> : null}
          {panel === "boundary" ? <BoundaryPanel /> : null}
        </div>
      </section>
    </main>
  );
}

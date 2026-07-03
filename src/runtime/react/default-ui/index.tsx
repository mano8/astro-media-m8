import type { ReactNode } from "react";
import { MediaProvider } from "../MediaProvider.js";
import { MediaQueryProvider } from "../MediaQueryProvider.js";
import { AdminMediaPanel } from "../AdminMediaPanel.js";
import { MediaLibrary } from "../MediaLibrary.js";
import { MediaUploadDropzone } from "../MediaUploadDropzone.js";
import { ObjectDetail } from "../ObjectDetail.js";
import { PresetEditor } from "../PresetEditor.js";
import type { MediaRuntimeConfig } from "../../config.js";

type ViewConfig = Partial<Omit<MediaRuntimeConfig, "polling">> & {
  polling?: Partial<MediaRuntimeConfig["polling"]>;
};

function Shell({ config, children }: { config?: ViewConfig; children: ReactNode }) {
  return (
    <MediaQueryProvider>
      <MediaProvider config={config}>{children}</MediaProvider>
    </MediaQueryProvider>
  );
}

export function UploadView({ config, libraryHref }: { config?: ViewConfig; libraryHref?: string }) {
  return (
    <Shell config={config}>
      <MediaUploadDropzone
        onUploaded={() => {
          if (libraryHref) window.location.assign(libraryHref);
        }}
      />
    </Shell>
  );
}

export function LibraryView({ config, objectHref }: { config?: ViewConfig; objectHref?: (id: string) => string }) {
  return (
    <Shell config={config}>
      <MediaLibrary objectHref={objectHref} />
    </Shell>
  );
}

export function ObjectDetailView({
  config,
  objectId,
  libraryHref
}: {
  config?: ViewConfig;
  objectId: string;
  libraryHref?: string;
}) {
  return (
    <Shell config={config}>
      <ObjectDetail
        objectId={objectId}
        onDeleted={() => {
          if (libraryHref) window.location.assign(libraryHref);
        }}
      />
    </Shell>
  );
}

export function PresetsView({ config }: { config?: ViewConfig }) {
  return (
    <Shell config={config}>
      <PresetEditor />
    </Shell>
  );
}

export function AdminMediaView({ config }: { config?: ViewConfig }) {
  return (
    <Shell config={config}>
      <AdminMediaPanel />
    </Shell>
  );
}

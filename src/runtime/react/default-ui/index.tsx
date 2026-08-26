import type { ReactNode } from "react";
import { MediaProvider } from "../MediaProvider.js";
import { MediaQueryProvider } from "../MediaQueryProvider.js";
import { MediaErrorBoundary } from "../MediaErrorBoundary.js";
import { AdminMediaPanel } from "../AdminMediaPanel.js";
import { CategoryManager } from "../CategoryManager.js";
import { MediaLibrary } from "../MediaLibrary.js";
import { ObjectDetail } from "../ObjectDetail.js";
import { PresetEditor } from "../PresetEditor.js";
import type { MediaRuntimeConfig } from "../../config.js";

type ViewConfig = Partial<Omit<MediaRuntimeConfig, "polling">> & {
  polling?: Partial<MediaRuntimeConfig["polling"]>;
};

// The boundary is the outermost wrapper on purpose (`A-C3`). Inside the
// providers it would be unmounted by a throw in a provider's own render, which
// is exactly the case that leaves an island blank; outside them it survives
// anything either provider does.
function Shell({ config, children }: { config?: ViewConfig; children: ReactNode }) {
  return (
    <MediaErrorBoundary>
      <MediaQueryProvider>
        <MediaProvider config={config}>{children}</MediaProvider>
      </MediaQueryProvider>
    </MediaErrorBoundary>
  );
}

export function UploadView({ config }: { config?: ViewConfig; libraryHref?: string }) {
  return (
    <Shell config={config}>
      <MediaLibrary initialUploadOpen />
    </Shell>
  );
}

export function LibraryView({
  config,
  objectHref,
  initialUploadOpen = false
}: {
  config?: ViewConfig;
  objectHref?: (id: string) => string;
  initialUploadOpen?: boolean;
}) {
  return (
    <Shell config={config}>
      <MediaLibrary objectHref={objectHref} initialUploadOpen={initialUploadOpen} />
    </Shell>
  );
}

export function CategoriesView({ config }: { config?: ViewConfig }) {
  return (
    <Shell config={config}>
      <CategoryManager />
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

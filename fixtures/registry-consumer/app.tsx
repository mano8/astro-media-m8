// Resolves every installed skin the way a consumer would.
//
// The skin files themselves are copied in by `scripts/verify-registry-consumer.mjs`
// from the generated `registry/r/*.json`, at the same `target` paths a shadcn
// install would use, and `tsconfig.json`'s `include` typechecks each of them.
// This file adds the check `include` cannot make on its own: that every export a
// skin publishes is reachable through the *installed* path its siblings and a
// host import it by.
import * as React from "react";

import AdminMediaDashboard from "./components/fa-media/admin-media-dashboard";
import {
  MediaCategoryTree,
  categorySelectionToListParams,
} from "./components/fa-media/media-category-tree";
import { MediaDashboardOverview } from "./components/fa-media/media-dashboard-overview";
import { MediaLibraryTree } from "./components/fa-media/media-library-tree";
import {
  MediaMaintenancePanel,
  MediaToastHost,
  mediaToast,
} from "./components/fa-media/media-maintenance-panel";
import {
  MediaStorageChart,
  humanizeBytes,
} from "./components/fa-media/media-storage-chart";
import { MediaTransferDialog } from "./components/fa-media/media-transfer-dialog";

export const installedSkins = {
  AdminMediaDashboard,
  MediaCategoryTree,
  MediaDashboardOverview,
  MediaLibraryTree,
  MediaMaintenancePanel,
  MediaStorageChart,
  MediaToastHost,
  MediaTransferDialog,
  categorySelectionToListParams,
  humanizeBytes,
  mediaToast,
};

export function RegistryConsumerFixture(): React.JSX.Element {
  return (
    <main>
      <AdminMediaDashboard />
      <MediaDashboardOverview />
      <MediaMaintenancePanel />
      <MediaLibraryTree />
      <MediaCategoryTree />
      <MediaStorageChart data={[]} />
      <MediaTransferDialog />
      <MediaToastHost />
    </main>
  );
}

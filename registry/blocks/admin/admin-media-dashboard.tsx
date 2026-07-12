"use client";

// Media admin view whose FIRST/landing tab is the storage dashboard; the
// destructive operations are demoted to a guarded "Maintenance" tab. Headless
// state comes from the package (@mano8/astro-media-m8/react + /hooks); this file
// is only the shadcn skin, copied into the consumer via the @fa-m8-media
// registry. Because media-service only accepts fa-auth-m8 tokens, the auth
// package must also be present (pass its adapter via `adapter`). Edit per app.
import * as React from "react";
import { LayoutDashboard, Wrench } from "lucide-react";
import {
  MediaProvider,
  RequireSuperuser,
  type MediaContextValue,
} from "@mano8/astro-media-m8/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MediaDashboardOverview,
  type MediaDashboardOverviewLabels,
} from "@/components/fa-media/media-dashboard-overview";
import {
  MediaMaintenancePanel,
  type MediaMaintenanceLabels,
} from "@/components/fa-media/media-maintenance-panel";
import { StateUnauthorized } from "@/components/m8-ui/state-unauthorized";

export interface AdminMediaDashboardLabels {
  dashboardTab: string;
  maintenanceTab: string;
  forbidden: string;
  overview: Partial<MediaDashboardOverviewLabels>;
  maintenance: Partial<MediaMaintenanceLabels>;
}

const DEFAULT_LABELS: AdminMediaDashboardLabels = {
  dashboardTab: "Dashboard",
  maintenanceTab: "Maintenance",
  forbidden: "You need administrator access to view this page.",
  overview: {},
  maintenance: {},
};

export interface AdminMediaDashboardProps {
  /** Media runtime config (apiBase/v1Base/legacyBase/adminRole). */
  config?: React.ComponentProps<typeof MediaProvider>["config"];
  /** fa-auth-backed media auth adapter (media only accepts fa-auth-m8 tokens). */
  adapter?: MediaContextValue["adapter"];
  labels?: Partial<AdminMediaDashboardLabels>;
}

function AdminMediaShell({ labels }: { labels: AdminMediaDashboardLabels }) {
  return (
    <RequireSuperuser
      fallback={
        <div className="not-content mx-auto w-full max-w-md py-10">
          <StateUnauthorized
            title="Administrator access required"
            description={labels.forbidden}
          />
        </div>
      }
    >
      <Tabs defaultValue="dashboard" className="not-content mx-auto w-full max-w-6xl space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="size-4" />
            {labels.dashboardTab}
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2">
            <Wrench className="size-4" />
            {labels.maintenanceTab}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <MediaDashboardOverview labels={labels.overview} />
        </TabsContent>
        <TabsContent value="maintenance">
          <MediaMaintenancePanel labels={labels.maintenance} />
        </TabsContent>
      </Tabs>
    </RequireSuperuser>
  );
}

export default function AdminMediaDashboard({
  config,
  adapter,
  labels,
}: AdminMediaDashboardProps) {
  const resolved: AdminMediaDashboardLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    overview: { ...DEFAULT_LABELS.overview, ...labels?.overview },
    maintenance: { ...DEFAULT_LABELS.maintenance, ...labels?.maintenance },
  };
  return (
    <MediaProvider config={config} adapter={adapter}>
      <AdminMediaShell labels={resolved} />
    </MediaProvider>
  );
}

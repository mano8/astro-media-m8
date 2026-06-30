"use client";

// Media admin landing view: a storage dashboard built from the package's
// headless `useMediaAdmin` hook. Logic stays a live dependency
// (@mano8/astro-media-m8/hooks); this file is only the shadcn skin and is copied
// into the consumer via the @fa-m8-media registry — edit freely per app.
import * as React from "react";
import {
  Boxes,
  HardDrive,
  Trash2,
  Clock,
  Database,
  CloudOff,
} from "lucide-react";
import { useMediaAdmin } from "@mano8/astro-media-m8/hooks";
import type { SubscriptionPublic } from "@mano8/astro-media-m8/schemas";
import type { ColumnDef } from "@tanstack/react-table";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MediaStorageChart,
  humanizeBytes,
} from "@/components/fa-media/media-storage-chart";
import { DataTable } from "@/components/fa-media/data-table";

export interface MediaDashboardOverviewLabels {
  title: string;
  subtitle: string;
  totalObjects: string;
  totalBytes: string;
  deletedObjects: string;
  staleSessions: string;
  dbOrphans: string;
  storageOrphans: string;
  storageByCategory: string;
  storageEmpty: string;
  subscriptionsTitle: string;
  subUrl: string;
  subEvents: string;
  subStatus: string;
  subActive: string;
  subInactive: string;
  subActions: string;
  subDelete: string;
  subEmpty: string;
  error: string;
}

const DEFAULT_LABELS: MediaDashboardOverviewLabels = {
  title: "Overview",
  subtitle: "Storage and processing at a glance.",
  totalObjects: "Objects",
  totalBytes: "Storage used",
  deletedObjects: "Deleted",
  staleSessions: "Stale uploads",
  dbOrphans: "DB orphans",
  storageOrphans: "Storage orphans",
  storageByCategory: "Storage by category",
  storageEmpty: "No stored objects yet.",
  subscriptionsTitle: "Webhook subscriptions",
  subUrl: "Endpoint",
  subEvents: "Events",
  subStatus: "Status",
  subActive: "Active",
  subInactive: "Inactive",
  subActions: "Actions",
  subDelete: "Delete",
  subEmpty: "No webhook subscriptions.",
  error: "Could not load admin data.",
};

export interface MediaDashboardOverviewProps {
  labels?: Partial<MediaDashboardOverviewLabels>;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export function MediaDashboardOverview({
  labels,
}: MediaDashboardOverviewProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const {
    stats,
    stale,
    orphans,
    subscriptions,
    error,
    loadStats,
    loadStale,
    loadOrphans,
    loadSubscriptions,
    removeSubscription,
  } = useMediaAdmin();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      loadStats(),
      loadStale(),
      loadOrphans(),
      loadSubscriptions(),
    ]).finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
    // The hook callbacks are stable for a given superuser identity; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storageData = (stats?.by_category ?? []).map((row) => ({
    category: row.category,
    bytes: row.total_bytes,
    count: row.count,
  }));

  const columns = React.useMemo<ColumnDef<SubscriptionPublic>[]>(
    () => [
      { accessorKey: "url", header: t.subUrl },
      {
        accessorKey: "event_types",
        header: t.subEvents,
        cell: ({ row }) => row.original.event_types.join(", ") || "*",
      },
      {
        accessorKey: "active",
        header: t.subStatus,
        cell: ({ row }) => (row.original.active ? t.subActive : t.subInactive),
      },
      {
        id: "actions",
        header: t.subActions,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => void removeSubscription(row.original.id)}
          >
            {t.subDelete}
          </Button>
        ),
      },
    ],
    [t, removeSubscription],
  );

  if (!ready) {
    return (
      <div className="not-content space-y-4" aria-busy="true">
        <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <Card role="alert" className="border-destructive/50">
        <CardContent className="py-6 text-sm text-destructive">
          {t.error}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="not-content space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t.totalObjects}
          value={(stats?.total_objects ?? 0).toLocaleString()}
          icon={Boxes}
        />
        <StatCard
          label={t.totalBytes}
          value={humanizeBytes(stats?.total_bytes ?? 0)}
          icon={HardDrive}
        />
        <StatCard
          label={t.deletedObjects}
          value={(stats?.deleted_objects ?? 0).toLocaleString()}
          icon={Trash2}
        />
        <StatCard
          label={t.staleSessions}
          value={(stale?.count ?? 0).toLocaleString()}
          icon={Clock}
        />
        <StatCard
          label={t.dbOrphans}
          value={(orphans?.db_orphan_count ?? 0).toLocaleString()}
          icon={Database}
        />
        <StatCard
          label={t.storageOrphans}
          value={(orphans?.storage_orphan_count ?? 0).toLocaleString()}
          icon={CloudOff}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.storageByCategory}</CardTitle>
        </CardHeader>
        <CardContent>
          {storageData.length ? (
            <MediaStorageChart
              data={storageData}
              bytesLabel={t.totalBytes}
              className="aspect-auto h-64 w-full"
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t.storageEmpty}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.subscriptionsTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={subscriptions?.items ?? []}
            filterColumn="url"
            filterPlaceholder={t.subUrl}
            emptyMessage={t.subEmpty}
          />
        </CardContent>
      </Card>
    </div>
  );
}

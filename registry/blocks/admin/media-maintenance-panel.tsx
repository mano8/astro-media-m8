"use client";

// Media admin "Maintenance / Danger zone": the destructive storage operations,
// each behind a shadcn `alert-dialog` confirmation. Logic stays a live
// dependency (@mano8/astro-media-m8/hooks); this file is only the shadcn skin,
// copied into the consumer via the @fa-m8-media registry — edit freely per app.
import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useMediaAdmin } from "@mano8/astro-media-m8/hooks";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export interface MediaMaintenanceLabels {
  title: string;
  subtitle: string;
  confirmTitle: string;
  cancel: string;
  confirm: string;
  running: string;
  done: string;
  error: string;
  purgeStaleTitle: string;
  purgeStaleDescription: string;
  repairTitle: string;
  repairDescription: string;
  purgeExpiredTitle: string;
  purgeExpiredDescription: string;
}

const DEFAULT_LABELS: MediaMaintenanceLabels = {
  title: "Maintenance",
  subtitle: "Destructive storage operations. Each action is irreversible.",
  confirmTitle: "Are you sure?",
  cancel: "Cancel",
  confirm: "Run",
  running: "Running…",
  done: "Done.",
  error: "Operation failed.",
  purgeStaleTitle: "Purge stale uploads",
  purgeStaleDescription:
    "Delete upload sessions that expired before completing. Frees reserved storage keys.",
  repairTitle: "Repair orphans",
  repairDescription:
    "Reconcile DB and storage, deleting storage-orphan bytes that have no matching object record.",
  purgeExpiredTitle: "Purge expired (retention)",
  purgeExpiredDescription:
    "Hard-delete soft-deleted objects past their retention window. Cannot be undone.",
};

export interface MediaMaintenancePanelProps {
  labels?: Partial<MediaMaintenanceLabels>;
}

type OpState = { status: "idle" | "running" | "done" | "error"; message?: string };

function DangerAction({
  title,
  description,
  labels,
  run,
}: {
  title: string;
  description: string;
  labels: MediaMaintenanceLabels;
  run: () => Promise<unknown>;
}) {
  const [state, setState] = React.useState<OpState>({ status: "idle" });

  const onConfirm = async () => {
    setState({ status: "running" });
    try {
      await run();
      setState({ status: "done", message: labels.done });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : labels.error,
      });
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {state.status === "done" ? (
          <p className="text-sm text-emerald-600">{state.message}</p>
        ) : null}
        {state.status === "error" ? (
          <p className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={state.status === "running"}>
            {state.status === "running" ? labels.running : labels.confirm}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onConfirm()}>
              {labels.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function MediaMaintenancePanel({ labels }: MediaMaintenancePanelProps) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const { purgeStale, repair, purgeExpiredObjects } = useMediaAdmin();

  return (
    <Card className="not-content border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-4" />
          {t.title}
        </CardTitle>
        <CardDescription>{t.subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <DangerAction
          title={t.purgeStaleTitle}
          description={t.purgeStaleDescription}
          labels={t}
          run={() => purgeStale()}
        />
        <DangerAction
          title={t.repairTitle}
          description={t.repairDescription}
          labels={t}
          run={() => repair(true)}
        />
        <DangerAction
          title={t.purgeExpiredTitle}
          description={t.purgeExpiredDescription}
          labels={t}
          run={() => purgeExpiredObjects()}
        />
      </CardContent>
    </Card>
  );
}

"use client";

// Import/export registry skin for consumers that use shadcn. The package's
// runtime MediaLibrary keeps its framework-neutral panel; this copied skin
// deliberately composes the canonical dialog-form and data-table recipes.
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/m8-ui/data-table";
import { DialogForm, useZodDialogForm } from "@/components/m8-ui/dialog-form";

import { useMediaTransfer } from "@mano8/astro-media-m8/hooks";
import type { ImportObjectResult, ObjectListParams } from "@mano8/astro-media-m8/schemas";

const transferFormSchema = z.object({
  operation: z.enum(["export", "import"]),
  exportFormat: z.enum(["manifest", "archive"]),
  importFormat: z.enum(["manifest", "archive"]),
});

type TransferFormValues = z.infer<typeof transferFormSchema>;

const reportColumns: ColumnDef<ImportObjectResult>[] = [
  {
    accessorKey: "filename",
    header: "File",
    cell: ({ row }) => row.original.filename ?? row.original.source_id,
  },
  { accessorKey: "status", header: "Status" },
  {
    id: "reason",
    header: "Reason",
    cell: ({ row }) => row.original.message ?? row.original.reason ?? "—",
  },
];

export interface MediaTransferDialogProps {
  /** The active library filters, including a selected tree branch when present. */
  filters?: ObjectListParams;
  /** Human-readable branch context shown before the export is started. */
  exportScopeLabel?: string;
  triggerLabel?: string;
  title?: string;
}

export function MediaTransferDialog({
  filters,
  exportScopeLabel,
  triggerLabel = "Import / Export",
  title = "Import or export media",
}: MediaTransferDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const form = useZodDialogForm<TransferFormValues>({
    schema: transferFormSchema,
    defaultValues: { operation: "export", exportFormat: "manifest", importFormat: "manifest" },
  });
  const operation = form.watch("operation");
  const transfer = useMediaTransfer();

  const submit = async (values: TransferFormValues) => {
    if (values.operation === "export") {
      transfer.resetExport();
      await transfer.startExport(values.exportFormat, filters);
      return;
    }
    if (!importFile) return;
    await transfer.startImport(values.importFormat, importFile);
    setImportFile(null);
  };

  const submitting = operation === "export" ? transfer.exportPending : transfer.importPending;
  const report = transfer.importReport;

  return (
    <DialogForm
      form={form}
      open={open}
      onOpenChange={setOpen}
      onSubmit={(values) => void submit(values)}
      title={title}
      description="Export the active media filters, or import a manifest or archive."
      trigger={<Button type="button">{triggerLabel}</Button>}
      submitLabel={operation === "export" ? "Start export" : "Start import"}
      submitting={submitting}
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Action</legend>
        <label className="flex items-center gap-2">
          <input type="radio" value="export" {...form.register("operation")} /> Export
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" value="import" {...form.register("operation")} /> Import
        </label>
      </fieldset>

      {operation === "export" ? (
        <section className="grid gap-3" aria-label="Export options">
          {exportScopeLabel ? <p className="text-sm text-muted-foreground">Scope: {exportScopeLabel}</p> : null}
          <label className="grid gap-1 text-sm font-medium">
            Format
            <select className="rounded-md border border-input bg-background px-3 py-2" {...form.register("exportFormat")}>
              <option value="manifest">Manifest (JSON)</option>
              <option value="archive">Archive (ZIP)</option>
            </select>
          </label>
          {transfer.exportError ? <p role="alert">Export failed.</p> : null}
          {transfer.manifest ? (
            <Button type="button" variant="outline" onClick={() => transfer.downloadManifest()}>
              Download manifest ({transfer.manifest.objects.length} objects)
            </Button>
          ) : null}
          {transfer.exportJob ? (
            <p role="status">
              {transfer.exportJob.status === "completed" && transfer.exportJob.download_url ? (
                <a href={transfer.exportJob.download_url} download>Download archive ({transfer.exportJob.object_count} objects)</a>
              ) : transfer.exportJob.status === "failed" ? "Export failed." : `Export ${transfer.exportJob.status}…`}
            </p>
          ) : null}
        </section>
      ) : (
        <section className="grid gap-3" aria-label="Import options">
          <label className="grid gap-1 text-sm font-medium">
            Format
            <select className="rounded-md border border-input bg-background px-3 py-2" {...form.register("importFormat")}>
              <option value="manifest">Manifest (JSON)</option>
              <option value="archive">Archive (ZIP)</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            File
            <input type="file" accept={form.watch("importFormat") === "archive" ? ".zip" : ".json"} onChange={(event) => setImportFile(event.currentTarget.files?.[0] ?? null)} />
          </label>
          {transfer.importError ? <p role="alert">Import failed.</p> : null}
          {report ? (
            <div className="grid gap-2">
              <p role="status">{report.created} created, {report.linked} linked, {report.skipped} skipped, {report.failed} failed.</p>
              <DataTable
                columns={reportColumns}
                data={report.objects}
                rowCount={report.objects.length}
                page={1}
                pageSize={Math.max(report.objects.length, 1)}
                onPageChange={() => {}}
                onPageSizeChange={() => {}}
                getRowId={(row) => row.source_id}
                labels={{ empty: "No imported rows." }}
              />
            </div>
          ) : null}
        </section>
      )}
    </DialogForm>
  );
}

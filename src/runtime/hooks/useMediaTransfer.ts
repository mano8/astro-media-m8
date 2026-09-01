import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { getExportJob, startExport, startImport } from "../api/transfer.js";
import { mediaKeys } from "../queryKeys.js";
import type {
  ExportFormat,
  ExportJobPublic,
  ExportManifest,
  ImportFormat,
  ImportReport,
  ObjectListParams
} from "../schemas.js";

/** A caller may hold only one in-flight archive export, so this needs no polling. */
const ACTIVE_EXPORT_STATUSES: ReadonlySet<ExportJobPublic["status"]> = new Set(["queued", "processing"]);

type StartExportVariables = {
  format: ExportFormat;
  filters?: ObjectListParams;
};
type ExportMutation = UseMutationResult<ExportManifest | ExportJobPublic, unknown, StartExportVariables>;

type StartImportVariables = {
  format: ImportFormat;
  file: File | Blob;
};
type ImportMutation = UseMutationResult<ImportReport, unknown, StartImportVariables>;

/**
 * Trigger a same-origin download of a JSON document without a server round
 * trip — the manifest was already fetched and parsed, so this hands the
 * browser a `Blob` URL rather than re-requesting the bytes.
 */
function downloadJson(document_: unknown, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([JSON.stringify(document_, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type UseMediaTransfer = {
  /** `null` before an export starts; the manifest, once a `manifest` export resolves. */
  manifest: ExportManifest | null;
  /** The archive job, refreshed by polling while `queued`/`processing`. */
  exportJob: ExportJobPublic | null;
  exportFormat: ExportFormat | null;
  /** True while starting an export, or while an archive job is still active. */
  exportPending: boolean;
  exportError: unknown;
  startExport: (format: ExportFormat, filters?: ObjectListParams) => Promise<void>;
  /** Saves the fetched manifest as a local `.json` file. No-op before one exists. */
  downloadManifest: (filename?: string) => void;
  resetExport: () => void;
  exportMutation: ExportMutation;

  importReport: ImportReport | null;
  importPending: boolean;
  importError: unknown;
  startImport: (format: ImportFormat, file: File | Blob) => Promise<ImportReport>;
  resetImport: () => void;
  importMutation: ImportMutation;
};

/**
 * Data layer for the library's Import/Export control (`U10`). `manifest`
 * export resolves inline; `archive` export is polled via `getExportJob`
 * until it leaves `queued`/`processing`. A successful import invalidates the
 * object list and the category tree, since it can create both.
 */
export function useMediaTransfer(): UseMediaTransfer {
  const queryClient = useQueryClient();
  const [manifest, setManifest] = useState<ExportManifest | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const exportMutation = useMutation<ExportManifest | ExportJobPublic, unknown, StartExportVariables>({
    mutationFn: ({ format, filters }) =>
      format === "archive" ? startExport("archive", filters) : startExport("manifest", filters),
    onSuccess: (result, variables) => {
      setExportFormat(variables.format);
      if (variables.format === "archive") {
        const job = result as ExportJobPublic;
        setManifest(null);
        // Seed the poll query with the 202 response's own job row (`queued`)
        // so `exportJob` reflects it immediately, rather than reading
        // `undefined` until the first poll tick lands.
        queryClient.setQueryData(mediaKeys.exportJob(job.id), job);
        setJobId(job.id);
      } else {
        setJobId(null);
        setManifest(result as ExportManifest);
      }
    }
  });

  const jobQueryKey = mediaKeys.exportJob(jobId ?? "");
  const jobQuery = useQuery({
    queryKey: jobQueryKey,
    queryFn: () => getExportJob(jobId as string),
    enabled: jobId != null,
    refetchInterval: (query) => {
      const currentStatus = query.state.data?.status;
      return currentStatus && ACTIVE_EXPORT_STATUSES.has(currentStatus) ? 2000 : false;
    }
  });

  const runStartExport = useCallback(
    async (format: ExportFormat, filters?: ObjectListParams) => {
      await exportMutation.mutateAsync({ format, filters });
    },
    [exportMutation]
  );

  const downloadManifest = useCallback(
    (filename = "media-export-manifest.json") => {
      if (manifest) downloadJson(manifest, filename);
    },
    [manifest]
  );

  const resetExport = useCallback(() => {
    setManifest(null);
    setJobId(null);
    setExportFormat(null);
    exportMutation.reset();
  }, [exportMutation]);

  const importMutation = useMutation<ImportReport, unknown, StartImportVariables>({
    mutationFn: ({ format, file }) => startImport(format, file),
    onSuccess: () => {
      // An import can create both objects and categories, so both caches
      // that read them need to be dropped rather than surviving stale.
      void queryClient.invalidateQueries({ queryKey: mediaKeys.objectLists() });
      void queryClient.invalidateQueries({ queryKey: mediaKeys.categoryTree(), exact: true });
    }
  });

  const runStartImport = useCallback(
    (format: ImportFormat, file: File | Blob) => importMutation.mutateAsync({ format, file }),
    [importMutation]
  );

  const resetImport = useCallback(() => importMutation.reset(), [importMutation]);

  const exportJob = exportFormat === "archive" ? jobQuery.data ?? null : null;

  return {
    manifest,
    exportJob,
    exportFormat,
    exportPending: exportMutation.isPending || (exportJob != null && ACTIVE_EXPORT_STATUSES.has(exportJob.status)),
    exportError: exportMutation.error ?? (exportFormat === "archive" ? jobQuery.error : null) ?? null,
    startExport: runStartExport,
    downloadManifest,
    resetExport,
    exportMutation,

    importReport: importMutation.data ?? null,
    importPending: importMutation.isPending,
    importError: importMutation.error ?? null,
    startImport: runStartImport,
    resetImport,
    importMutation
  };
}

import { request } from "../client.js";
import {
  ExportJobPublicSchema,
  ExportManifestSchema,
  ImportReportSchema,
  type ExportFormat,
  type ExportJobPublic,
  type ExportManifest,
  type ImportFormat,
  type ImportReport,
  type ObjectListParams
} from "../schemas.js";

/**
 * Export/import wrappers (`U9`/`U10`). `manifest` is answered inline —
 * metadata only, no bytes; `archive` is accepted (202) as a job collected
 * from {@link getExportJob}. Both formats share the same request shape, so
 * one overloaded `startExport` narrows its return type by the `format`
 * literal instead of the caller having to cast.
 */
export function startExport(format: "manifest", filters?: ObjectListParams): Promise<ExportManifest>;
export function startExport(format: "archive", filters?: ObjectListParams): Promise<ExportJobPublic>;
export function startExport(
  format: ExportFormat,
  filters?: ObjectListParams
): Promise<ExportManifest | ExportJobPublic> {
  if (format === "archive") {
    return request({
      method: "POST",
      path: "/export",
      body: { format, filters },
      schema: ExportJobPublicSchema,
      auth: true
    });
  }
  return request({
    method: "POST",
    path: "/export",
    body: { format, filters },
    schema: ExportManifestSchema,
    auth: true
  });
}

/** Progress (and, once `completed`, a presigned download) for an archive export job. */
export function getExportJob(jobId: string): Promise<ExportJobPublic> {
  return request({
    method: "GET",
    path: `/export/${encodeURIComponent(jobId)}`,
    schema: ExportJobPublicSchema,
    auth: true
  });
}

/**
 * Multipart, for both formats — an export hands the caller a document to
 * keep (the streamed manifest or the assembled archive) and an import takes
 * that same document back, so one path reads one shape either way.
 */
export function startImport(format: ImportFormat, file: File | Blob): Promise<ImportReport> {
  const form = new FormData();
  form.set("format", format);
  const filename = typeof File !== "undefined" && file instanceof File ? file.name : "import";
  form.set("file", file, filename);
  return request({
    method: "POST",
    path: "/import",
    body: form,
    schema: ImportReportSchema,
    auth: true
  });
}

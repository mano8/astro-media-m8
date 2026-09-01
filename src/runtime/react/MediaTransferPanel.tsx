/**
 * The library's import/export control (`U10`).
 */
import { useState, type DragEvent as ReactDragEvent } from "react";
import { useMediaTransfer } from "../hooks/useMediaTransfer.js";
import { friendlyReasonMessage } from "../errors.js";
import {
  actionLinkClassName,
  buttonClassName,
  labelInlineClassName,
  transferDropzoneClassName,
  transferPanelClassName,
  transferSectionClassName,
  transferTableClassName,
  transferTableWrapClassName
} from "./mediaLibraryStyles.js";
import type { MediaLibraryLabels } from "./mediaLibraryLabels.js";
import type { ExportFormat, ImportFormat, ImportObjectResult, ObjectListParams } from "../schemas.js";

const EXPORT_FORMAT_OPTIONS: readonly ExportFormat[] = ["manifest", "archive"];
const IMPORT_FORMAT_OPTIONS: readonly ImportFormat[] = ["manifest", "archive"];

/** One row of the per-import result table. */
function ImportResultRow({
  result,
  labels
}: {
  result: ImportObjectResult;
  labels: MediaLibraryLabels["transfer"];
}) {
  const message = result.reason ? friendlyReasonMessage({ reason: result.reason }, result.message ?? result.reason) : result.message;
  return (
    <tr>
      <td>{result.filename ?? result.source_id}</td>
      <td>{labels.importStatuses[result.status]}</td>
      <td>{message ?? "—"}</td>
    </tr>
  );
}

/**
 * The export half: format choice, the start action, and whatever the job has
 * produced so far — a manifest to download, an archive link, or its status.
 */
function ExportSection({
  transfer,
  filters,
  exportScopeLabel,
  labels
}: {
  transfer: ReturnType<typeof useMediaTransfer>;
  filters: ObjectListParams;
  exportScopeLabel?: string;
  labels: MediaLibraryLabels["transfer"];
}) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>("manifest");

  async function handleStartExport() {
    transfer.resetExport();
    try {
      await transfer.startExport(exportFormat, filters);
    } catch {
      // surfaced via `transfer.exportError`
    }
  }

  return (
      <section className={transferSectionClassName} aria-label={labels.exportTitle}>
        <h3>{labels.exportTitle}</h3>
        {exportScopeLabel ? <p className="fa-media-transfer-hint">{labels.scope}: {exportScopeLabel}</p> : null}
        <fieldset>
          <legend>{labels.format}</legend>
          {EXPORT_FORMAT_OPTIONS.map((value) => (
            <label key={value} className={labelInlineClassName}>
              <input
                type="radio"
                name="fa-media-export-format"
                value={value}
                checked={exportFormat === value}
                onChange={() => setExportFormat(value)}
              />
              {value === "manifest" ? labels.manifest : labels.archive}
              <span className="fa-media-transfer-hint">{value === "manifest" ? labels.manifestHint : labels.archiveHint}</span>
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          className={buttonClassName}
          disabled={transfer.exportPending}
          onClick={() => void handleStartExport()}
        >
          {transfer.exportPending ? labels.exporting : labels.startExport}
        </button>
        {transfer.exportError ? (
          <p role="alert">
            {transfer.exportError instanceof Error ? transfer.exportError.message : labels.exportError}
          </p>
        ) : null}
        {transfer.exportFormat === "manifest" && transfer.manifest ? (
          <button type="button" className={buttonClassName} onClick={() => transfer.downloadManifest()}>
            {labels.downloadManifest(transfer.manifest.objects.length)}
          </button>
        ) : null}
        {transfer.exportFormat === "archive" && transfer.exportJob ? (
          <p role="status">
            {transfer.exportJob.status === "completed" && transfer.exportJob.download_url ? (
              <a className={actionLinkClassName} href={transfer.exportJob.download_url} download>
                {labels.downloadArchive(transfer.exportJob.object_count)}
              </a>
            ) : transfer.exportJob.status === "failed" ? (
              labels.exportFailed(transfer.exportJob.error)
            ) : (
              labels.exportStatus(transfer.exportJob.status)
            )}
          </p>
        ) : null}
      </section>
  );
}

/**
 * The file target: a drop zone wrapped around the file input, so dragging a
 * file in and choosing one from the picker are the same control.
 */
function ImportDropzone({
  importFormat,
  importFile,
  onFile,
  labels
}: {
  importFormat: ImportFormat;
  importFile: File | null;
  onFile: (file: File | null) => void;
  labels: MediaLibraryLabels["transfer"];
}) {
  const [dragActive, setDragActive] = useState(false);

  function onDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={dragActive ? `${transferDropzoneClassName} fa-media-transfer-dropzone--active` : transferDropzoneClassName}
      onDragOver={(event) => {
        event.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
    >
      <label className={buttonClassName} htmlFor="fa-media-import-file">{labels.chooseFile}</label>
      <input
        id="fa-media-import-file"
        className="sr-only"
        type="file"
        accept={importFormat === "archive" ? ".zip" : ".json"}
        onChange={(event) => onFile(event.currentTarget.files?.[0] ?? null)}
      />
      {importFile ? <p>{importFile.name}</p> : <p>{labels.dropFile}</p>}
    </div>
  );
}

/** The import's summary line and its per-object result table. */
function ImportReport({
  report,
  labels
}: {
  report: ReturnType<typeof useMediaTransfer>["importReport"];
  labels: MediaLibraryLabels["transfer"];
}) {
  if (!report) return null;
  return (
    <div>
      <p role="status">
        {labels.report(report.created, report.linked, report.skipped, report.failed)}
        {report.categories_created ? `; ${labels.categoriesCreated(report.categories_created)}` : ""}
      </p>
      <div className={transferTableWrapClassName}>
        <table className={transferTableClassName}>
          <thead>
            <tr>
              <th>{labels.file}</th>
              <th>{labels.status}</th>
              <th>{labels.reason}</th>
            </tr>
          </thead>
          <tbody>
            {report.objects.map((result) => (
              <ImportResultRow key={result.source_id} result={result} labels={labels} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The import half: format choice, the drop target that also hosts the file
 * input, and the per-object result table once the server has answered.
 */
function ImportSection({
  transfer,
  labels
}: {
  transfer: ReturnType<typeof useMediaTransfer>;
  labels: MediaLibraryLabels["transfer"];
}) {
  const [importFormat, setImportFormat] = useState<ImportFormat>("manifest");
  const [importFile, setImportFile] = useState<File | null>(null);
  const report = transfer.importReport;

  async function handleStartImport() {
    if (!importFile) return;
    try {
      await transfer.startImport(importFormat, importFile);
    } catch {
      // surfaced via `transfer.importError`
    } finally {
      setImportFile(null);
    }
  }

  return (
      <section className={transferSectionClassName} aria-label={labels.importTitle}>
        <h3>{labels.importTitle}</h3>
        <fieldset>
          <legend>{labels.format}</legend>
          {IMPORT_FORMAT_OPTIONS.map((value) => (
            <label key={value} className={labelInlineClassName}>
              <input
                type="radio"
                name="fa-media-import-format"
                value={value}
                checked={importFormat === value}
                onChange={() => setImportFormat(value)}
              />
              {value === "manifest" ? labels.manifest : labels.archive}
            </label>
          ))}
        </fieldset>
        <ImportDropzone
          importFormat={importFormat}
          importFile={importFile}
          onFile={setImportFile}
          labels={labels}
        />
        <button
          type="button"
          className={buttonClassName}
          disabled={!importFile || transfer.importPending}
          onClick={() => void handleStartImport()}
        >
          {transfer.importPending ? labels.importing : labels.startImport}
        </button>
        {transfer.importError ? (
          <p role="alert">
            {transfer.importError instanceof Error ? transfer.importError.message : labels.importError}
          </p>
        ) : null}
        <ImportReport report={report} labels={labels} />
      </section>
  );
}

/**
 * Import/export control (`U10`). A single toggled panel rather than a modal
 * dialog — this package hand-rolls Tailwind token classes in `src/runtime`
 * rather than importing `astro-ui-m8` components here (`D11`; the
 * `dialog-form`/`data-table` composition is a separate registry skin, not
 * this runtime component). Export reuses the caller's live `filters`
 * (`ObjectListParams`) so exporting the selected tree branch (`U10`'s branch
 * bullet) falls out of passing the library's own `query` through unchanged.
 */
export function MediaTransferPanel({
  filters,
  exportScopeLabel,
  labels
}: {
  filters: ObjectListParams;
  exportScopeLabel?: string;
  labels: MediaLibraryLabels["transfer"];
}) {
  const transfer = useMediaTransfer();

  return (
    <div className={transferPanelClassName} role="region" aria-label={labels.regionLabel}>
      <ExportSection
        transfer={transfer}
        filters={filters}
        exportScopeLabel={exportScopeLabel}
        labels={labels}
      />
      <ImportSection transfer={transfer} labels={labels} />
    </div>
  );
}


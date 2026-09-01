/**
 * The `MediaLibrary` copy contract and its English defaults.
 *
 * Every string the library renders is overridable, so a consumer localizes the
 * views without forking them (`I18N`). Kept in its own module because the
 * library, its tree pane and its transfer panel all read the same shape — and
 * because the defaults alone are a hundred lines of copy that say nothing about
 * how the library behaves.
 */
import type { MediaUploadDropzoneLabels } from "./MediaUploadDropzone.js";
import type { ImportObjectResult, MediaCategory, MediaObjectStatus } from "../schemas.js";


export type MediaLibraryView = "list" | "grid" | "masonry" | "tree";

export interface MediaLibraryLabels {
  title: string;
  viewLabel: string;
  views: Record<MediaLibraryView, string>;
  importExport: string;
  uploadMedia: string;
  searchPlaceholder: string;
  searchLabel: string;
  preview: string;
  filename: string;
  actions: string;
  category: string;
  status: string;
  size: string;
  view: string;
  delete: string;
  deleteError: string;
  allCategories: string;
  categories: Record<MediaCategory, string>;
  allStatuses: string;
  statuses: Record<MediaObjectStatus, string>;
  loadError: string;
  loading: string;
  loadMore: string;
  previewLoading: string;
  previewPlaceholder: string;
  failedScan: string;
  failedScanTitle: (status: string) => string;
  tree: {
    regionLabel: string;
    title: string;
    loadError: string;
    loading: string;
    empty: string;
    allMedia: string;
    uncategorized: string;
    allMediaScope: string;
    uncategorizedScope: string;
    selectedScope: (id: number) => string;
    expand: (name: string) => string;
    collapse: (name: string) => string;
    countTitle: (direct: number, total: number, name: string) => string;
  };
  transfer: {
    regionLabel: string;
    exportTitle: string;
    importTitle: string;
    scope: string;
    format: string;
    manifest: string;
    archive: string;
    manifestHint: string;
    archiveHint: string;
    startExport: string;
    exporting: string;
    exportError: string;
    downloadManifest: (count: number) => string;
    downloadArchive: (count: number) => string;
    exportFailed: (error?: string | null) => string;
    exportStatus: (status: string) => string;
    chooseFile: string;
    dropFile: string;
    startImport: string;
    importing: string;
    importError: string;
    report: (created: number, linked: number, skipped: number, failed: number) => string;
    categoriesCreated: (count: number) => string;
    file: string;
    status: string;
    reason: string;
    importStatuses: Record<ImportObjectResult["status"], string>;
  };
  upload: {
    title: string;
    close: string;
    closeLabel: string;
    form: Partial<MediaUploadDropzoneLabels>;
  };
}

export const DEFAULT_LABELS: MediaLibraryLabels = {
  title: "Media library",
  viewLabel: "Media library view",
  views: { list: "List", grid: "Grid", masonry: "Masonry", tree: "Tree" },
  importExport: "Import / Export",
  uploadMedia: "Upload media",
  searchPlaceholder: "Search filename",
  searchLabel: "Search media",
  preview: "Preview",
  filename: "Filename",
  actions: "Actions",
  category: "Category",
  status: "Status",
  size: "Size",
  view: "View",
  delete: "Delete",
  deleteError: "Failed to delete media",
  allCategories: "All categories",
  categories: {
    avatar: "Avatar",
    document: "Document",
    asset: "Asset",
    chat_attachment: "Chat attachment",
    export: "Export",
    receipt: "Receipt"
  },
  allStatuses: "All statuses",
  statuses: {
    pending_upload: "Pending",
    uploaded: "Uploaded",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
    deleted: "Deleted",
    rejected: "Rejected"
  },
  loadError: "Failed to load media",
  loading: "Loading...",
  loadMore: "Load more",
  previewLoading: "Loading",
  previewPlaceholder: "Preview",
  failedScan: "Failed virus scan",
  failedScanTitle: (status) => `Failed virus scan (${status})`,
  tree: {
    regionLabel: "Media categories",
    title: "Categories",
    loadError: "Failed to load categories",
    loading: "Loading categories…",
    empty: "No user categories yet. Create one from the Categories panel to browse media by branch.",
    allMedia: "All media",
    uncategorized: "Uncategorized",
    allMediaScope: "All media",
    uncategorizedScope: "Uncategorized media",
    selectedScope: (id) => `Selected branch (category ${id})`,
    expand: (name) => `Expand ${name}`,
    collapse: (name) => `Collapse ${name}`,
    countTitle: (direct, total, name) => `${direct} directly in ${name}, ${total} including sub-categories`
  },
  transfer: {
    regionLabel: "Import and export media",
    exportTitle: "Export",
    importTitle: "Import",
    scope: "Export scope",
    format: "Format",
    manifest: "Manifest",
    archive: "Archive",
    manifestHint: "Metadata only — filenames, categories, no bytes.",
    archiveHint: "Full zip with bytes; assembled asynchronously.",
    startExport: "Start export",
    exporting: "Exporting…",
    exportError: "Export failed",
    downloadManifest: (count) => `Download manifest (${count} objects)`,
    downloadArchive: (count) => `Download archive (${count} objects)`,
    exportFailed: (error) => `Export failed${error ? `: ${error}` : "."}`,
    exportStatus: (status) => `Export ${status}…`,
    chooseFile: "Choose file",
    dropFile: "Drop a file here, or choose one above.",
    startImport: "Start import",
    importing: "Importing…",
    importError: "Import failed",
    report: (created, linked, skipped, failed) => `${created} created, ${linked} linked, ${skipped} skipped, ${failed} failed`,
    categoriesCreated: (count) => `${count} categories created`,
    file: "File",
    status: "Status",
    reason: "Reason",
    importStatuses: {
      created: "Created",
      linked: "Linked",
      skipped: "Skipped",
      failed: "Failed"
    }
  },
  upload: {
    title: "Upload media",
    close: "Close",
    closeLabel: "Close upload dialog",
    form: {}
  }
};


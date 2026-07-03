import * as uploadsApi from "./uploads.js";
import * as objectsApi from "./objects.js";
import * as variantsApi from "./variants.js";
import * as presetsApi from "./presets.js";
import * as sharesApi from "./shares.js";
import * as categoriesApi from "./categories.js";
import * as dashboardApi from "./dashboard.js";
import * as adminApi from "./admin.js";

// Flat named exports (tree-shakeable direct imports).
export * from "./uploads.js";
export * from "./objects.js";
export * from "./variants.js";
export * from "./presets.js";
export * from "./shares.js";
export * from "./categories.js";
export * from "./dashboard.js";
export * from "./admin.js";

// Grouped namespaces (`uploads.initiate`, `objects.list`, ...).
export const uploads = {
  initiate: uploadsApi.initiateUpload,
  complete: uploadsApi.completeUpload,
  abort: uploadsApi.abortUpload
} as const;

export const objects = {
  list: objectsApi.listObjects,
  get: objectsApi.getObject,
  downloadUrl: objectsApi.getDownloadUrl,
  update: objectsApi.updateObject,
  delete: objectsApi.deleteObject
} as const;

export const variants = {
  generate: variantsApi.generateVariants,
  list: variantsApi.listVariants,
  getJob: variantsApi.getVariantJob,
  delete: variantsApi.deleteVariant,
  waitForJob: variantsApi.waitForVariantJob
} as const;

export const presets = {
  list: presetsApi.listPresets,
  create: presetsApi.createPreset,
  update: presetsApi.updatePreset,
  delete: presetsApi.deletePreset
} as const;

export const shares = {
  create: sharesApi.createShare,
  list: sharesApi.listShares,
  revoke: sharesApi.revokeShare,
  resolve: sharesApi.resolveShare
} as const;

export const categories = {
  list: categoriesApi.listCategories,
  get: categoriesApi.getCategory,
  create: categoriesApi.createCategory,
  update: categoriesApi.updateCategory,
  delete: categoriesApi.deleteCategory
} as const;

export const dashboard = {
  activityAll: dashboardApi.getActivityAll,
  activityCurrent: dashboardApi.getActivityCurrent
} as const;

export const admin = {
  storageStats: adminApi.getStorageStats,
  staleUploads: adminApi.getStaleUploads,
  purgeStaleUploads: adminApi.purgeStaleUploads,
  getQuota: adminApi.getQuota,
  setQuota: adminApi.setQuota,
  orphans: adminApi.getOrphans,
  repairOrphans: adminApi.repairOrphans,
  purgeExpired: adminApi.purgeExpired,
  createSubscription: adminApi.createSubscription,
  listSubscriptions: adminApi.listSubscriptions,
  deleteSubscription: adminApi.deleteSubscription
} as const;

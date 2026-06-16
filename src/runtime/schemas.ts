import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums — mirror media_service/db_models/{media_objects,variant_jobs}.py
// ---------------------------------------------------------------------------

export const MediaCategorySchema = z.enum([
  "avatar",
  "document",
  "asset",
  "chat_attachment",
  "export",
  "receipt"
]);
export type MediaCategory = z.infer<typeof MediaCategorySchema>;

export const MediaVisibilitySchema = z.enum(["public", "private", "tenant", "sensitive"]);
export type MediaVisibility = z.infer<typeof MediaVisibilitySchema>;

export const MediaObjectStatusSchema = z.enum([
  "pending_upload",
  "uploaded",
  "processing",
  "ready",
  "failed",
  "deleted",
  "rejected"
]);
export type MediaObjectStatus = z.infer<typeof MediaObjectStatusSchema>;

export const ScanStatusSchema = z.enum(["pending", "clean", "infected", "quarantined", "skipped"]);
export type ScanStatus = z.infer<typeof ScanStatusSchema>;

export const ModerationStatusSchema = z.enum(["pending", "approved", "rejected", "skipped"]);
export type ModerationStatus = z.infer<typeof ModerationStatusSchema>;

export const ImageFormatSchema = z.enum(["WEBP", "JPEG", "PNG", "GIF", "AVIF"]);
export type ImageFormat = z.infer<typeof ImageFormatSchema>;

export const VariantJobStatusSchema = z.enum(["queued", "processing", "completed", "failed"]);
export type VariantJobStatus = z.infer<typeof VariantJobStatusSchema>;

export const SortFieldSchema = z.enum(["created_at", "size_bytes"]);
export type SortField = z.infer<typeof SortFieldSchema>;

export const SortOrderSchema = z.enum(["asc", "desc"]);
export type SortOrder = z.infer<typeof SortOrderSchema>;

const uuid = z.string().uuid();
const isoDate = z.string();
const nullableIsoDate = isoDate.nullable();

// ---------------------------------------------------------------------------
// Media objects
// ---------------------------------------------------------------------------

export const MediaObjectPublicSchema = z
  .object({
    id: uuid,
    tenant_id: uuid.nullable().default(null),
    owner_user_id: uuid,
    category: MediaCategorySchema,
    visibility: MediaVisibilitySchema,
    storage_bucket: z.string(),
    object_key: z.string(),
    original_filename: z.string().max(255).nullable().default(null),
    mime_type: z.string(),
    extension: z.string().max(32).nullable().default(null),
    size_bytes: z.number().int().nonnegative(),
    sha256: z.string().length(64).nullable().default(null),
    etag: z.string().max(255).nullable().default(null),
    storage_class: z.string().default("standard"),
    status: MediaObjectStatusSchema,
    scan_status: ScanStatusSchema,
    moderation_status: ModerationStatusSchema,
    created_at: isoDate,
    updated_at: isoDate,
    deleted_at: nullableIsoDate.default(null)
  })
  .strict();
export type MediaObjectPublic = z.infer<typeof MediaObjectPublicSchema>;

export const MediaObjectUpdateSchema = z
  .object({
    visibility: MediaVisibilitySchema.optional(),
    original_filename: z.string().nullable().optional(),
    category: MediaCategorySchema.optional()
  })
  .strict();
export type MediaObjectUpdate = z.infer<typeof MediaObjectUpdateSchema>;

export const ObjectListResponseSchema = z
  .object({
    items: z.array(MediaObjectPublicSchema),
    next_cursor: z.string().nullable().default(null),
    count: z.number().int().nonnegative()
  })
  .strict();
export type ObjectListResponse = z.infer<typeof ObjectListResponseSchema>;

export const DownloadUrlResponseSchema = z
  .object({
    url: z.string(),
    expires_at: isoDate
  })
  .strict();
export type DownloadUrlResponse = z.infer<typeof DownloadUrlResponseSchema>;

export type ObjectListParams = {
  category?: MediaCategory;
  visibility?: MediaVisibility;
  status?: MediaObjectStatus;
  mime_prefix?: string;
  created_from?: string;
  created_to?: string;
  q?: string;
  sort_by?: SortField;
  order?: SortOrder;
  limit?: number;
  cursor?: string;
  owner_user_id?: string;
  include_deleted?: boolean;
};

export const ScanResultRequestSchema = z
  .object({
    scan_status: ScanStatusSchema
  })
  .strict();
export type ScanResultRequest = z.infer<typeof ScanResultRequestSchema>;

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export const UploadInitiateRequestSchema = z
  .object({
    category: MediaCategorySchema,
    visibility: MediaVisibilitySchema,
    original_filename: z.string(),
    mime_type: z.string(),
    expected_size_bytes: z.number().int().nonnegative()
  })
  .strict();
export type UploadInitiateRequest = z.infer<typeof UploadInitiateRequestSchema>;

export const UploadInitiateResponseSchema = z
  .object({
    session_id: uuid,
    upload_url: z.string(),
    upload_fields: z.record(z.string(), z.string()),
    expires_at: isoDate
  })
  .strict();
export type UploadInitiateResponse = z.infer<typeof UploadInitiateResponseSchema>;

export const UploadCompleteRequestSchema = z
  .object({
    sha256: z.string().nullable().optional()
  })
  .strict();
export type UploadCompleteRequest = z.infer<typeof UploadCompleteRequestSchema>;

export const UploadCompleteResponseSchema = z
  .object({
    media_object: MediaObjectPublicSchema
  })
  .strict();
export type UploadCompleteResponse = z.infer<typeof UploadCompleteResponseSchema>;

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

export const VariantGenerateRequestSchema = z
  .object({
    presets: z.array(z.string()).min(1)
  })
  .strict();
export type VariantGenerateRequest = z.infer<typeof VariantGenerateRequestSchema>;

export const VariantPublicSchema = z
  .object({
    id: uuid,
    media_object_id: uuid,
    variant_name: z.string(),
    storage_bucket: z.string(),
    object_key: z.string(),
    width: z.number().int().nullable().default(null),
    height: z.number().int().nullable().default(null),
    size_bytes: z.number().int().nonnegative(),
    format: z.string(),
    created_at: isoDate
  })
  .strict();
export type VariantPublic = z.infer<typeof VariantPublicSchema>;

export const VariantListResponseSchema = z
  .object({
    items: z.array(VariantPublicSchema),
    count: z.number().int().nonnegative()
  })
  .strict();
export type VariantListResponse = z.infer<typeof VariantListResponseSchema>;

export const VariantJobPublicSchema = z
  .object({
    id: uuid,
    media_object_id: uuid,
    owner_user_id: uuid,
    status: VariantJobStatusSchema,
    requested_presets: z.array(z.string()),
    variants_expected: z.number().int().nonnegative(),
    variants_created: z.number().int().nonnegative(),
    error: z.string().nullable().default(null),
    created_at: isoDate,
    updated_at: isoDate
  })
  .strict();
export type VariantJobPublic = z.infer<typeof VariantJobPublicSchema>;

export const VariantRegisterRequestSchema = z
  .object({
    variant_name: z.string().min(1).max(64),
    storage_bucket: z.string().min(3).max(63),
    object_key: z.string().min(1).max(1024),
    width: z.number().int().min(1).nullable().optional(),
    height: z.number().int().min(1).nullable().optional(),
    size_bytes: z.number().int().nonnegative(),
    format: z.string().min(1).max(32)
  })
  .strict();
export type VariantRegisterRequest = z.infer<typeof VariantRegisterRequestSchema>;

export const VariantJobUpdateSchema = z
  .object({
    status: VariantJobStatusSchema,
    variants_created: z.number().int().nonnegative().nullable().optional(),
    error: z.string().max(1024).nullable().optional()
  })
  .strict();
export type VariantJobUpdate = z.infer<typeof VariantJobUpdateSchema>;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

export const FormatSpecSchema = z
  .object({
    ext: ImageFormatSchema,
    quality: z.number().int().min(1).max(100)
  })
  .strict();
export type FormatSpec = z.infer<typeof FormatSpecSchema>;

export const ImageSizeSpecSchema = z
  .object({
    fixed_width: z.number().int().min(1).nullable().default(null),
    fixed_height: z.number().int().min(1).nullable().default(null),
    fixed_size: z.number().int().min(1).nullable().default(null)
  })
  .strict();
export type ImageSizeSpec = z.infer<typeof ImageSizeSpecSchema>;

export const PresetSpecSchema = z
  .object({
    image_size: ImageSizeSpecSchema,
    formats: z.array(FormatSpecSchema).min(1),
    allow_upscale: z.boolean().default(false),
    max_byte_size: z.number().int().min(1).nullable().default(null)
  })
  .strict();
export type PresetSpec = z.infer<typeof PresetSpecSchema>;

export const ImagePresetCreateSchema = z
  .object({
    name: z.string().min(1).max(64),
    spec: PresetSpecSchema
  })
  .strict();
export type ImagePresetCreate = z.infer<typeof ImagePresetCreateSchema>;

export const ImagePresetUpdateSchema = z
  .object({
    spec: PresetSpecSchema
  })
  .strict();
export type ImagePresetUpdate = z.infer<typeof ImagePresetUpdateSchema>;

export const ImagePresetPublicSchema = z
  .object({
    id: uuid.nullable().default(null),
    name: z.string(),
    spec: PresetSpecSchema,
    builtin: z.boolean(),
    created_at: nullableIsoDate.default(null),
    updated_at: nullableIsoDate.default(null)
  })
  .strict();
export type ImagePresetPublic = z.infer<typeof ImagePresetPublicSchema>;

export const ImagePresetListSchema = z.array(ImagePresetPublicSchema);

// ---------------------------------------------------------------------------
// Shares
// ---------------------------------------------------------------------------

export const ShareTokenCreateSchema = z
  .object({
    expires_in: z.number().int().min(1).nullable().optional(),
    max_uses: z.number().int().min(1).nullable().optional()
  })
  .strict();
export type ShareTokenCreate = z.infer<typeof ShareTokenCreateSchema>;

export const ShareTokenPublicSchema = z
  .object({
    id: uuid,
    media_object_id: uuid,
    token: z.string(),
    expires_at: isoDate,
    max_uses: z.number().int().nullable().default(null),
    uses: z.number().int().nonnegative(),
    revoked: z.boolean(),
    created_at: isoDate
  })
  .strict();
export type ShareTokenPublic = z.infer<typeof ShareTokenPublicSchema>;

export const ShareTokenListResponseSchema = z
  .object({
    items: z.array(ShareTokenPublicSchema),
    count: z.number().int().nonnegative()
  })
  .strict();
export type ShareTokenListResponse = z.infer<typeof ShareTokenListResponseSchema>;

// ---------------------------------------------------------------------------
// Admin & maintenance
// ---------------------------------------------------------------------------

export const StorageStatsByStatusSchema = z
  .object({
    status: MediaObjectStatusSchema,
    count: z.number().int().nonnegative(),
    total_bytes: z.number().int().nonnegative()
  })
  .strict();

export const StorageStatsByCategorySchema = z
  .object({
    category: MediaCategorySchema,
    count: z.number().int().nonnegative(),
    total_bytes: z.number().int().nonnegative()
  })
  .strict();

export const StorageUsagePublicSchema = z
  .object({
    owner_user_id: uuid,
    tenant_id: uuid.nullable().default(null),
    total_bytes: z.number().int().nonnegative(),
    object_count: z.number().int().nonnegative(),
    quota_bytes: z.number().int().nullable().default(null),
    quota_objects: z.number().int().nullable().default(null),
    effective_quota_bytes: z.number().int().nullable().default(null),
    effective_quota_objects: z.number().int().nullable().default(null)
  })
  .strict();
export type StorageUsagePublic = z.infer<typeof StorageUsagePublicSchema>;

export const StorageStatsResponseSchema = z
  .object({
    by_status: z.array(StorageStatsByStatusSchema),
    by_category: z.array(StorageStatsByCategorySchema),
    total_objects: z.number().int().nonnegative(),
    total_bytes: z.number().int().nonnegative(),
    deleted_objects: z.number().int().nonnegative(),
    usage: z.array(StorageUsagePublicSchema)
  })
  .strict();
export type StorageStatsResponse = z.infer<typeof StorageStatsResponseSchema>;

export const QuotaUpdateRequestSchema = z
  .object({
    quota_bytes: z.number().int().nullable().optional(),
    quota_objects: z.number().int().nullable().optional()
  })
  .strict();
export type QuotaUpdateRequest = z.infer<typeof QuotaUpdateRequestSchema>;

export const StaleUploadSessionSchema = z
  .object({
    id: uuid,
    owner_user_id: uuid,
    category: MediaCategorySchema,
    visibility: MediaVisibilitySchema,
    storage_bucket: z.string(),
    object_key: z.string(),
    expires_at: isoDate,
    created_at: isoDate
  })
  .strict();

export const StaleUploadsResponseSchema = z
  .object({
    count: z.number().int().nonnegative(),
    sessions: z.array(StaleUploadSessionSchema)
  })
  .strict();
export type StaleUploadsResponse = z.infer<typeof StaleUploadsResponseSchema>;

export const PurgeStaleResponseSchema = z
  .object({
    purged: z.number().int().nonnegative()
  })
  .strict();
export type PurgeStaleResponse = z.infer<typeof PurgeStaleResponseSchema>;

export const OrphanRecordSchema = z
  .object({
    bucket: z.string(),
    object_key: z.string(),
    object_id: uuid.nullable().default(null),
    owner_user_id: uuid.nullable().default(null)
  })
  .strict();

export const OrphanReportSchema = z
  .object({
    db_orphans: z.array(OrphanRecordSchema),
    storage_orphans: z.array(OrphanRecordSchema),
    db_orphan_count: z.number().int().nonnegative(),
    storage_orphan_count: z.number().int().nonnegative(),
    repaired: z.number().int().nonnegative()
  })
  .strict();
export type OrphanReport = z.infer<typeof OrphanReportSchema>;

export const HardPurgeResponseSchema = z
  .object({
    purged: z.number().int().nonnegative()
  })
  .strict();
export type HardPurgeResponse = z.infer<typeof HardPurgeResponseSchema>;

export const SubscriptionCreateRequestSchema = z
  .object({
    url: z.string().min(1).max(2048),
    secret: z.string().min(16).max(255),
    event_types: z.array(z.string()).default([])
  })
  .strict();
export type SubscriptionCreateRequest = z.infer<typeof SubscriptionCreateRequestSchema>;

export const SubscriptionPublicSchema = z
  .object({
    id: uuid,
    url: z.string(),
    event_types: z.array(z.string()),
    active: z.boolean(),
    created_at: isoDate
  })
  .strict();
export type SubscriptionPublic = z.infer<typeof SubscriptionPublicSchema>;

export const SubscriptionListResponseSchema = z
  .object({
    count: z.number().int().nonnegative(),
    items: z.array(SubscriptionPublicSchema)
  })
  .strict();
export type SubscriptionListResponse = z.infer<typeof SubscriptionListResponseSchema>;

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const ActivityCounterSchema = z
  .object({
    model: z.string(),
    updated: z.number().int(),
    added: z.number().int()
  })
  .strict();

export const ActivityStatsSchema = z
  .object({
    min: z.number().int(),
    max: z.number().int(),
    activity: z.array(ActivityCounterSchema)
  })
  .strict();

export const UsersActivitySchema = z
  .object({
    nb_users: z.number().int().nonnegative(),
    activity: ActivityStatsSchema
  })
  .strict();
export type UsersActivity = z.infer<typeof UsersActivitySchema>;

// ---------------------------------------------------------------------------
// Legacy categories
// ---------------------------------------------------------------------------

export const CategoryPublicSchema = z
  .object({
    id: z.number().int(),
    owner_id: uuid,
    name: z.string().min(1).max(50),
    slug: z.string().min(1).max(50)
  })
  .strict();
export type CategoryPublic = z.infer<typeof CategoryPublicSchema>;

export const CategoriesPublicSchema = z
  .object({
    data: z.array(CategoryPublicSchema),
    count: z.number().int().nonnegative()
  })
  .strict();
export type CategoriesPublic = z.infer<typeof CategoriesPublicSchema>;

export const CategoryCreateSchema = z
  .object({
    name: z.string().min(1).max(50)
  })
  .strict();
export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;

export const CategoryUpdateSchema = CategoryCreateSchema;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;

export const ResponseMessageSchema = z
  .object({
    success: z.boolean(),
    msg: z.string()
  })
  .strict();
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;

export const ResponseModelBaseSchema = z
  .object({
    success: z.boolean(),
    data: z.unknown()
  })
  .strict();
export type ResponseModelBase = z.infer<typeof ResponseModelBaseSchema>;

export const ResponseModelOrMessageSchema = z.union([
  ResponseModelBaseSchema,
  ResponseMessageSchema
]);
export type ResponseModelOrMessage = z.infer<typeof ResponseModelOrMessageSchema>;

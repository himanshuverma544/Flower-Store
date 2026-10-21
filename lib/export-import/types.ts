/**
 * Flora Flowers — Export / Import Types & Schemas
 *
 * Defines versioned schemas, transfer manifests, and import options
 * for Payload CMS and Prisma business tables.
 */

export const EXPORT_FORMAT_VERSION = 'floralux-export-v1';
export const EXPORT_SCHEMA_VERSION = '1.0.0';

export interface ExportManifest {
  format: string; // 'floralux-export-v1'
  version: string; // '1.0.0'
  timestamp: string; // ISO 8601
  sourceEnvironment: string; // e.g. 'development (ep-wild-dream-***)'
  generator: string; // 'Flora Flowers Export/Import Tool v1.0'
  collections: {
    media: number;
    categories: number;
    addons: number;
    coupons: number;
    orders: number;
    products: number;
    siteSettings: number;
  };
  totalRecords: number;
}

export interface MediaExportItem {
  sourceId: number;
  filename: string;
  alt: string;
  caption?: string | null;
  mimeType?: string | null;
  filesize?: number | null;
  width?: number | null;
  height?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  url?: string | null;
  thumbnailUrl?: string | null;
  prefix?: string | null;
  sizes?: {
    thumbnail?: { filename?: string; width?: number; height?: number; filesize?: number; mimeType?: string; url?: string };
    card?: { filename?: string; width?: number; height?: number; filesize?: number; mimeType?: string; url?: string };
    full?: { filename?: string; width?: number; height?: number; filesize?: number; mimeType?: string; url?: string };
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryExportItem {
  sourceId: number;
  name: string;
  slug: string; // stable identifier
  icon?: string | null;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
  sourceImageId?: number | null;
  imageFilename?: string | null; // stable reference to Media
  createdAt?: string;
  updatedAt?: string;
}

export interface AddonExportItem {
  sourceId: number;
  name: string;
  slug: string; // stable identifier
  category: string;
  icon?: string | null;
  price: number;
  stockQuantity: number;
  stockStatus: string;
  isActive: boolean;
  material?: string | null;
  dimensions?: string | null;
  description?: string | null;
  sortOrder: number;
  sourceImageId?: number | null;
  imageFilename?: string | null; // stable reference to Media
  createdAt?: string;
  updatedAt?: string;
}

export interface CouponExportItem {
  sourceId: number;
  code: string; // stable identifier
  description?: string | null;
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping';
  discountValue: number;
  minSpend?: number | null;
  maxDiscount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  usageLimitTotal?: number | null;
  usageLimitPerCustomer?: number | null;
  isActive: boolean;
  usageCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderExportItem {
  sourceId: number;
  orderId: string;
  status: string;
  currentStep?: number | null;
  date?: string | null;
  total: number;
  subtotal?: number | null;
  deliveryFee?: number | null;
  discount?: number | null;
  senderName: string;
  senderEmail: string;
  senderPhone?: string | null;
  keepSecret?: boolean | null;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientApt?: string | null;
  recipientCity?: string | null;
  recipientState?: string | null;
  recipientZip?: string | null;
  cardMessage?: string | null;
  recipientNotes?: string | null;
  deliveryDate?: string | null;
  deliverySlot?: string | null;
  estimatedDelivery?: string | null;
  slot?: string | null;
  items: any;
  itemsJson?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  trackingToken?: string | null;
  idempotencyKey?: string | null;
  razorpaySignature?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductSizeItem {
  id?: string;
  name: string;
  price: number;
  multiplier?: number;
  order?: number;
}

export interface ProductCareTipItem {
  id?: string;
  tip: string;
  order?: number;
}

export interface ProductGalleryItem {
  sourceMediaId: number;
  filename: string; // stable reference
  order?: number;
}

export interface ProductAdditionalCategoryItem {
  sourceCategoryId: number;
  slug: string; // stable reference
  order?: number;
}

export interface ProductExportItem {
  sourceId: number;
  name: string;
  slug: string; // stable identifier
  sku?: string | null;
  tagline: string;
  shortDescription?: string | null;
  description: string;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  stockStatus: string;
  flowerType: string;
  stemCount: number;
  symbolism?: string | null;
  isFeatured: boolean;
  isBestseller: boolean;
  isNew: boolean;
  status: string;
  rating?: number | null;
  reviewCount?: number | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  
  // Relationships
  sourceCategoryId: number;
  categorySlug: string; // stable reference to Category
  sourceFeaturedImageId?: number | null;
  featuredImageFilename?: string | null; // stable reference to Media
  
  // Sub-items & child arrays
  sizes: ProductSizeItem[];
  careTips: ProductCareTipItem[];
  occasions: string[];
  tags: string[];
  gallery: ProductGalleryItem[];
  additionalCategories: ProductAdditionalCategoryItem[];

  createdAt?: string;
  updatedAt?: string;
}

export interface SiteSettingsExportItem {
  storeName: string;
  tagline: string;
  currency: string;
  currencySymbol: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  freeShippingThreshold: number;
  standardShippingFee: number;
  expressDeliveryFee: number;
  announcementBar_enabled: boolean;
  announcementBar_text: string;
  announcementBar_link: string;
  instagram?: string | null;
  whatsapp?: string | null;
  facebook?: string | null;
  pinterest?: string | null;
  defaultMetaTitle?: string | null;
  defaultMetaDescription?: string | null;
  sourceDefaultShareImageId?: number | null;
  defaultShareImageFilename?: string | null; // stable reference to Media
}

export interface ExportPackage {
  manifest: ExportManifest;
  data: {
    media: MediaExportItem[];
    categories: CategoryExportItem[];
    addons: AddonExportItem[];
    coupons: CouponExportItem[];
    orders: OrderExportItem[];
    products: ProductExportItem[];
    siteSettings: SiteSettingsExportItem | null;
  };
}

export type ImportMode = 'dry_run' | 'create_only' | 'update_existing';

export interface ImportOptions {
  mode: ImportMode;
  collections: {
    media: boolean;
    categories: boolean;
    addons: boolean;
    coupons: boolean;
    orders: boolean;
    products: boolean;
    siteSettings: boolean;
  };
  verifyR2Media?: boolean;
  targetConfirmation?: string;
}

export interface PreviewItemDetail {
  collection: string;
  identifier: string; // slug, filename, code
  title: string;
  sourceId?: number | string;
  destinationId?: number | string | null;
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'CONFLICT';
  reason: string;
  diff?: {
    field: string;
    existingValue: any;
    incomingValue: any;
  }[];
}

export interface PreviewSummary {
  destinationEnvironment: {
    name: string;
    isProduction: boolean;
    maskedHost: string;
    r2Bucket: string;
  };
  totalRecordsInPackage: number;
  counts: {
    toCreate: number;
    toUpdate: number;
    toSkip: number;
    conflicts: number;
  };
  byCollection: Record<string, {
    total: number;
    toCreate: number;
    toUpdate: number;
    toSkip: number;
    conflicts: number;
  }>;
  items: PreviewItemDetail[];
  r2Verification: {
    checked: boolean;
    total: number;
    verified: number;
    missing: string[];
    bucket: string;
  };
  warnings: string[];
  errors: string[];
  isSafeToProceed: boolean;
}

export interface ImportResult {
  success: boolean;
  mode: ImportMode;
  destinationEnvironment: {
    name: string;
    isProduction: boolean;
    maskedHost: string;
  };
  timestamp: string;
  counts: {
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
  byCollection: Record<string, {
    created: number;
    updated: number;
    skipped: number;
  }>;
  remappingStats: {
    mediaRemapped: number;
    categoriesRemapped: number;
    productsRemapped: number;
    addonsRemapped: number;
    couponsRemapped: number;
    ordersRemapped?: number;
  };
  sequencesUpdated: string[];
  logs: string[];
  errors: string[];
}

/**
 * Catalog Export Engine
 *
 * Extracts and sanitizes catalog content from the database using Prisma ORM.
 * Preserves relationships, slugs, variant data, and stable object keys.
 */

import { prisma } from '@/lib/db';
import { getDestinationDbInfo } from './db';
import {
  EXPORT_FORMAT_VERSION,
  EXPORT_SCHEMA_VERSION,
  ExportPackage,
  ExportManifest,
  MediaExportItem,
  CategoryExportItem,
  AddonExportItem,
  CouponExportItem,
  OrderExportItem,
  ProductExportItem,
  SiteSettingsExportItem,
} from './types';

const ORDER_STATUS_REVERSE_MAP: Record<string, string> = {
  Payment_Pending: 'Payment Pending',
  Order_Received___Verified: 'Order Received & Verified',
  Order_Received: 'Order Received',
  Crafting_Floral_Arrangement: 'Crafting Floral Arrangement',
  Out_for_Delivery: 'Out for Delivery',
  Delivered: 'Delivered',
  Payment_Failed: 'Payment Failed',
  Payment_Expired: 'Payment Expired',
  Cancelled: 'Cancelled',
};

const ADDON_CATEGORY_REVERSE_MAP: Record<string, string> = {
  gift_set: 'gift-set',
};

const OCCASION_REVERSE_MAP: Record<string, string> = {
  Thank_You: 'Thank You',
  Just_Because: 'Just Because',
};

const TAG_REVERSE_MAP: Record<string, string> = {
  long_lasting: 'long-lasting',
  same_day: 'same-day',
  limited_edition: 'limited-edition',
  pet_friendly: 'pet-friendly',
};

export interface ExportOptions {
  collections?: {
    media?: boolean;
    categories?: boolean;
    addons?: boolean;
    coupons?: boolean;
    orders?: boolean;
    products?: boolean;
    siteSettings?: boolean;
  };
}

export async function exportCatalog(options?: ExportOptions): Promise<ExportPackage> {
  const selected = {
    media: options?.collections?.media ?? true,
    categories: options?.collections?.categories ?? true,
    addons: options?.collections?.addons ?? true,
    coupons: options?.collections?.coupons ?? true,
    orders: options?.collections?.orders ?? true,
    products: options?.collections?.products ?? true,
    siteSettings: options?.collections?.siteSettings ?? true,
  };

  // 1. Export Media
  const mediaItems: MediaExportItem[] = [];
  if (selected.media) {
    const records = await prisma.cms_media.findMany({
      orderBy: { id: 'asc' },
    });

    for (const row of records) {
      if (!row.filename) continue;
      mediaItems.push({
        sourceId: row.id,
        filename: row.filename,
        alt: row.alt || row.filename,
        caption: row.caption || null,
        mimeType: row.mime_type || null,
        filesize: row.filesize ? Number(row.filesize) : null,
        width: row.width ? Number(row.width) : null,
        height: row.height ? Number(row.height) : null,
        focalX: row.focal_x ? Number(row.focal_x) : null,
        focalY: row.focal_y ? Number(row.focal_y) : null,
        url: row.url || null,
        thumbnailUrl: row.thumbnail_u_r_l || null,
        prefix: row.prefix || null,
        sizes: {
          thumbnail: row.sizes_thumbnail_filename
            ? {
                filename: row.sizes_thumbnail_filename,
                width: Number(row.sizes_thumbnail_width),
                height: Number(row.sizes_thumbnail_height),
                filesize: Number(row.sizes_thumbnail_filesize),
                mimeType: row.sizes_thumbnail_mime_type || undefined,
                url: row.sizes_thumbnail_url || undefined,
              }
            : undefined,
          card: row.sizes_card_filename
            ? {
                filename: row.sizes_card_filename,
                width: Number(row.sizes_card_width),
                height: Number(row.sizes_card_height),
                filesize: Number(row.sizes_card_filesize),
                mimeType: row.sizes_card_mime_type || undefined,
                url: row.sizes_card_url || undefined,
              }
            : undefined,
          full: row.sizes_full_filename
            ? {
                filename: row.sizes_full_filename,
                width: Number(row.sizes_full_width),
                height: Number(row.sizes_full_height),
                filesize: Number(row.sizes_full_filesize),
                mimeType: row.sizes_full_mime_type || undefined,
                url: row.sizes_full_url || undefined,
              }
            : undefined,
        },
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      });
    }
  }

  // 2. Export Categories
  const categoryItems: CategoryExportItem[] = [];
  if (selected.categories) {
    const records = await prisma.cms_categories.findMany({
      include: { cms_media: true },
      orderBy: { id: 'asc' },
    });

    for (const row of records) {
      categoryItems.push({
        sourceId: row.id,
        name: row.name,
        slug: row.slug,
        icon: row.icon || null,
        description: row.description || null,
        isActive: Boolean(row.is_active),
        sortOrder: row.sort_order ? Number(row.sort_order) : 0,
        sourceImageId: row.image_id || null,
        imageFilename: row.cms_media?.filename || null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      });
    }
  }

  // 3. Export Addons
  const addonItems: AddonExportItem[] = [];
  if (selected.addons) {
    const records = await prisma.cms_addons.findMany({
      include: { cms_media: true },
      orderBy: { id: 'asc' },
    });

    for (const row of records) {
      addonItems.push({
        sourceId: row.id,
        name: row.name,
        slug: row.slug,
        category: ADDON_CATEGORY_REVERSE_MAP[row.category] || row.category,
        icon: row.icon || null,
        price: Number(row.price),
        stockQuantity: Number(row.stock_quantity || 100),
        stockStatus: row.stock_status || 'in_stock',
        isActive: Boolean(row.is_active),
        material: row.material || null,
        dimensions: row.dimensions || null,
        description: row.description || null,
        sortOrder: row.sort_order ? Number(row.sort_order) : 0,
        sourceImageId: row.image_id || null,
        imageFilename: row.cms_media?.filename || null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      });
    }
  }

  // 4. Export Coupons
  const couponItems: CouponExportItem[] = [];
  if (selected.coupons) {
    const records = await prisma.cms_coupons.findMany({
      orderBy: { id: 'asc' },
    });

    for (const row of records) {
      couponItems.push({
        sourceId: row.id,
        code: row.code,
        description: row.description || null,
        discountType: row.discount_type,
        discountValue: Number(row.discount_value),
        minSpend: row.min_spend !== null ? Number(row.min_spend) : null,
        maxDiscount: row.max_discount !== null ? Number(row.max_discount) : null,
        startDate: row.start_date ? new Date(row.start_date).toISOString() : null,
        endDate: row.end_date ? new Date(row.end_date).toISOString() : null,
        usageLimitTotal: row.usage_limit_total !== null ? Number(row.usage_limit_total) : null,
        usageLimitPerCustomer: row.usage_limit_per_customer !== null ? Number(row.usage_limit_per_customer) : null,
        isActive: Boolean(row.is_active),
        usageCount: Number(row.usage_count || 0),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      });
    }
  }

  // 5. Export Orders
  const orderItems: OrderExportItem[] = [];
  if (selected.orders) {
    const records = await prisma.cms_orders.findMany({
      orderBy: { id: 'asc' },
    });

    for (const row of records) {
      orderItems.push({
        sourceId: row.id,
        orderId: row.order_id,
        status: ORDER_STATUS_REVERSE_MAP[row.status] || row.status,
        currentStep: row.current_step !== null ? Number(row.current_step) : null,
        date: row.date || null,
        total: Number(row.total),
        subtotal: row.subtotal !== null ? Number(row.subtotal) : null,
        deliveryFee: row.delivery_fee !== null ? Number(row.delivery_fee) : null,
        discount: row.discount !== null ? Number(row.discount) : null,
        senderName: row.sender_name,
        senderEmail: row.sender_email,
        senderPhone: row.sender_phone || null,
        keepSecret: Boolean(row.keep_secret),
        recipientName: row.recipient_name,
        recipientPhone: row.recipient_phone,
        recipientAddress: row.recipient_address,
        recipientApt: row.recipient_apt || null,
        recipientCity: row.recipient_city || null,
        recipientState: row.recipient_state || null,
        recipientZip: row.recipient_zip || null,
        cardMessage: row.card_message || null,
        recipientNotes: row.recipient_notes || null,
        deliveryDate: row.delivery_date || null,
        deliverySlot: row.delivery_slot || null,
        estimatedDelivery: row.estimated_delivery || null,
        slot: row.slot || null,
        items: row.items,
        itemsJson: row.items_json || null,
        paymentMethod: row.payment_method || null,
        paymentStatus: row.payment_status || null,
        razorpayOrderId: row.razorpay_order_id || null,
        razorpayPaymentId: row.razorpay_payment_id || null,
        trackingToken: row.tracking_token || null,
        idempotencyKey: row.idempotency_key || null,
        razorpaySignature: row.razorpay_signature || null,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      });
    }
  }

  // 6. Export Products (with all child relations in a single Prisma query)
  const productItems: ProductExportItem[] = [];
  if (selected.products) {
    const records = await prisma.cms_products.findMany({
      include: {
        cms_categories: true,
        cms_media: true,
        cms_products_sizes: { orderBy: { order: 'asc' } },
        cms_products_care_tips: { orderBy: { order: 'asc' } },
        cms_products_occasions: { orderBy: { order: 'asc' } },
        cms_products_tags: { orderBy: { order: 'asc' } },
        cms_products_rels: {
          include: { cms_media: true, cms_categories: true },
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });

    for (const row of records) {
      const gallery = row.cms_products_rels
        .filter((r) => r.path === 'gallery' && r.cms_media?.filename)
        .map((r) => ({
          sourceMediaId: r.cms_media_id!,
          filename: r.cms_media!.filename as string,
          order: r.order ?? undefined,
        }));

      const additionalCategories = row.cms_products_rels
        .filter((r) => r.path === 'categories' && r.cms_categories?.slug)
        .map((r) => ({
          sourceCategoryId: r.cms_categories_id!,
          slug: r.cms_categories!.slug,
          order: r.order ?? undefined,
        }));

      productItems.push({
        sourceId: row.id,
        name: row.name,
        slug: row.slug,
        sku: row.sku || null,
        tagline: row.tagline,
        shortDescription: row.short_description || null,
        description: row.description,
        price: Number(row.price),
        compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : null,
        stockQuantity: Number(row.stock_quantity || 100),
        stockStatus: row.stock_status || 'in_stock',
        flowerType: row.flower_type,
        stemCount: Number(row.stem_count || 12),
        symbolism: row.symbolism || null,
        isFeatured: Boolean(row.is_featured),
        isBestseller: Boolean(row.is_bestseller),
        isNew: Boolean(row.is_new),
        status: row.status || 'published',
        rating: row.rating ? Number(row.rating) : null,
        reviewCount: row.review_count ? Number(row.review_count) : null,
        metaTitle: row.meta_title || null,
        metaDescription: row.meta_description || null,

        sourceCategoryId: row.category_id,
        categorySlug: row.cms_categories?.slug || '',
        sourceFeaturedImageId: row.featured_image_id || null,
        featuredImageFilename: row.cms_media?.filename || null,

        sizes: row.cms_products_sizes.map((s) => ({
          id: s.id,
          name: s.name,
          price: Number(s.price),
          multiplier: s.multiplier ? Number(s.multiplier) : 1,
          order: s.order,
        })),
        careTips: row.cms_products_care_tips.map((t) => ({
          id: t.id,
          tip: t.tip,
          order: t.order,
        })),
        occasions: row.cms_products_occasions
          .map((o) => (o.value ? OCCASION_REVERSE_MAP[o.value] || o.value : null))
          .filter(Boolean) as string[],
        tags: row.cms_products_tags
          .map((t) => (t.value ? TAG_REVERSE_MAP[t.value] || t.value : null))
          .filter(Boolean) as string[],
        gallery,
        additionalCategories,

        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
      });
    }
  }

  // 7. Export Site Settings
  let siteSettingsItem: SiteSettingsExportItem | null = null;
  if (selected.siteSettings) {
    const row = await prisma.cms_site_settings.findFirst({
      include: { cms_media: true },
      where: { id: 1 },
    });

    if (row) {
      siteSettingsItem = {
        storeName: row.store_name,
        tagline: row.tagline || '',
        currency: row.currency || 'INR',
        currencySymbol: row.currency_symbol || '₹',
        contactEmail: row.contact_email || '',
        contactPhone: row.contact_phone || '',
        address: row.address || '',
        freeShippingThreshold: Number(row.free_shipping_threshold || 2999),
        standardShippingFee: Number(row.standard_shipping_fee || 149),
        expressDeliveryFee: Number(row.express_delivery_fee || 299),
        announcementBar_enabled: Boolean(row.announcement_bar_enabled),
        announcementBar_text: row.announcement_bar_text || '',
        announcementBar_link: row.announcement_bar_link || '',
        instagram: row.instagram || null,
        whatsapp: row.whatsapp || null,
        facebook: row.facebook || null,
        pinterest: row.pinterest || null,
        defaultMetaTitle: row.default_meta_title || null,
        defaultMetaDescription: row.default_meta_description || null,
        sourceDefaultShareImageId: row.default_share_image_id || null,
        defaultShareImageFilename: row.cms_media?.filename || null,
      };
    }
  }

  const dbInfo = getDestinationDbInfo();
  const totalRecords =
    mediaItems.length +
    categoryItems.length +
    addonItems.length +
    couponItems.length +
    orderItems.length +
    productItems.length +
    (siteSettingsItem ? 1 : 0);

  const manifest: ExportManifest = {
    format: EXPORT_FORMAT_VERSION,
    version: EXPORT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    sourceEnvironment: dbInfo.environmentLabel,
    generator: 'Catalog Export/Import Tool v1.0',
    collections: {
      media: mediaItems.length,
      categories: categoryItems.length,
      addons: addonItems.length,
      coupons: couponItems.length,
      orders: orderItems.length,
      products: productItems.length,
      siteSettings: siteSettingsItem ? 1 : 0,
    },
    totalRecords,
  };

  return {
    manifest,
    data: {
      media: mediaItems,
      categories: categoryItems,
      addons: addonItems,
      coupons: couponItems,
      orders: orderItems,
      products: productItems,
      siteSettings: siteSettingsItem,
    },
  };
}
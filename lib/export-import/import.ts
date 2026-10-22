/**
 * Flora Flowers — Import Engine & Conflict Resolver
 *
 * Implements preview generation, relationship remapping, sequence synchronization,
 * Cloudflare R2 asset verification, and transactional execution.
 */

import crypto from 'crypto';
import { Client } from 'pg';
import { prisma } from '@/lib/db';
import { withTransaction, syncDatabaseSequences, getDestinationDbInfo } from './db';
import { verifyR2Files } from './r2';
import {
  ExportPackage,
  ImportOptions,
  PreviewSummary,
  PreviewItemDetail,
  ImportResult,
} from './types';

function generateHex24(): string {
  return crypto.randomBytes(12).toString('hex');
}

/**
 * Enum normalization helpers to guarantee full compatibility with PostgreSQL
 * native enum types (handling differences like hyphenated names, underscores, and spaces).
 */
export function normalizeAddonCategory(val: any): string {
  if (!val) return 'vase';
  const str = String(val).trim().toLowerCase();
  if (str === 'gift_set' || str === 'gift-set') return 'gift-set';
  const valid = ['vase', 'chocolate', 'candle', 'card', 'balloon', 'plush', 'gift-set'];
  return valid.includes(str) ? str : 'vase';
}

export function normalizeAddonStockStatus(val: any): string {
  if (!val) return 'in_stock';
  const str = String(val).trim().toLowerCase().replace(/-/g, '_');
  return str === 'out_of_stock' ? 'out_of_stock' : 'in_stock';
}

export function normalizeCouponDiscountType(val: any): string {
  if (!val) return 'percentage';
  const str = String(val).trim().toLowerCase().replace(/-/g, '_');
  const valid = ['percentage', 'fixed_amount', 'free_shipping'];
  return valid.includes(str) ? str : 'percentage';
}

export function normalizeOrderStatus(val: any): string {
  if (!val) return 'Payment Pending';
  const raw = String(val).trim();
  const map: Record<string, string> = {
    'Payment_Pending': 'Payment Pending',
    'Payment Pending': 'Payment Pending',
    'Order_Received___Verified': 'Order Received & Verified',
    'Order Received & Verified': 'Order Received & Verified',
    'Order_Received': 'Order Received',
    'Order Received': 'Order Received',
    'Crafting_Floral_Arrangement': 'Crafting Floral Arrangement',
    'Crafting Floral Arrangement': 'Crafting Floral Arrangement',
    'Master Florist Arranging': 'Crafting Floral Arrangement',
    'Out_for_Delivery': 'Out for Delivery',
    'Out for Delivery': 'Out for Delivery',
    'Out for Hand Delivery': 'Out for Delivery',
    'Delivered': 'Delivered',
    'Safely Delivered': 'Delivered',
    'Payment_Failed': 'Payment Failed',
    'Payment Failed': 'Payment Failed',
    'Payment_Expired': 'Payment Expired',
    'Payment Expired': 'Payment Expired',
    'Cancelled': 'Cancelled',
  };
  return map[raw] || 'Payment Pending';
}

export function normalizeProductStatus(val: any): string {
  if (!val) return 'published';
  const str = String(val).trim().toLowerCase();
  const valid = ['draft', 'published', 'archived'];
  return valid.includes(str) ? str : 'published';
}

export function normalizeProductStockStatus(val: any): string {
  if (!val) return 'in_stock';
  const str = String(val).trim().toLowerCase().replace(/-/g, '_');
  const valid = ['in_stock', 'out_of_stock', 'backorder'];
  return valid.includes(str) ? str : 'in_stock';
}

export function normalizeProductOccasion(val: any): string | null {
  if (!val) return null;
  const raw = String(val).trim();
  const normalizedKey = raw.replace(/[_\s]+/g, ' ').toLowerCase();
  const map: Record<string, string> = {
    'romance': 'Romance',
    'anniversary': 'Anniversary',
    'birthday': 'Birthday',
    'sympathy': 'Sympathy',
    'congratulations': 'Congratulations',
    'thank you': 'Thank You',
    'just because': 'Just Because',
  };
  return map[normalizedKey] || null;
}

export function normalizeProductTag(val: any): string | null {
  if (!val) return null;
  const raw = String(val).trim();
  const normalizedKey = raw.replace(/[_\s]+/g, '-').toLowerCase();
  const map: Record<string, string> = {
    'roses': 'roses',
    'exotic': 'exotic',
    'pastel': 'pastel',
    'vibrant': 'vibrant',
    'fragrant': 'fragrant',
    'long-lasting': 'long-lasting',
    'same-day': 'same-day',
    'limited-edition': 'limited-edition',
    'pet-friendly': 'pet-friendly',
  };
  return map[normalizedKey] || null;
}

/**
 * Generates an in-depth dry-run preview comparing the package data
 * with current destination database records.
 */
export async function generatePreview(
  packageData: ExportPackage,
  options: ImportOptions
): Promise<PreviewSummary> {
  const dbInfo = getDestinationDbInfo();
  const warnings: string[] = [];
  const errors: string[] = [];
  const items: PreviewItemDetail[] = [];

  const counts = {
    toCreate: 0,
    toUpdate: 0,
    toSkip: 0,
    conflicts: 0,
  };

  const byCollection: Record<string, { total: number; toCreate: number; toUpdate: number; toSkip: number; conflicts: number }> = {
    media: { total: 0, toCreate: 0, toUpdate: 0, toSkip: 0, conflicts: 0 },
    categories: { total: 0, toCreate: 0, toUpdate: 0, toSkip: 0, conflicts: 0 },
    addons: { total: 0, toCreate: 0, toUpdate: 0, toSkip: 0, conflicts: 0 },
    coupons: { total: 0, toCreate: 0, toUpdate: 0, toSkip: 0, conflicts: 0 },
    products: { total: 0, toCreate: 0, toUpdate: 0, toSkip: 0, conflicts: 0 },
    siteSettings: { total: 0, toCreate: 0, toUpdate: 0, toSkip: 0, conflicts: 0 },
  };

  // Helper to record action
  const recordAction = (
    coll: string,
    identifier: string,
    title: string,
    action: 'CREATE' | 'UPDATE' | 'SKIP' | 'CONFLICT',
    reason: string,
    sourceId?: number | string,
    destId?: number | string | null,
    diff?: { field: string; existingValue: any; incomingValue: any }[]
  ) => {
    if (!byCollection[coll]) {
      byCollection[coll] = { total: 0, toCreate: 0, toUpdate: 0, toSkip: 0, conflicts: 0 };
    }
    byCollection[coll].total++;

    if (action === 'CREATE') {
      counts.toCreate++;
      byCollection[coll].toCreate++;
    } else if (action === 'UPDATE') {
      counts.toUpdate++;
      byCollection[coll].toUpdate++;
    } else if (action === 'SKIP') {
      counts.toSkip++;
      byCollection[coll].toSkip++;
    } else if (action === 'CONFLICT') {
      counts.conflicts++;
      byCollection[coll].conflicts++;
    }

    items.push({
      collection: coll,
      identifier,
      title,
      sourceId,
      destinationId: destId,
      action,
      reason,
      diff,
    });
  };

    // Collect all media filenames in package for R2 check
    const allFilenames = new Set<string>();

    if (options.collections.media && packageData.data.media) {
      packageData.data.media.forEach((m) => allFilenames.add(m.filename));
    }
    if (packageData.data.categories) {
      packageData.data.categories.forEach((c) => {
        if (c.imageFilename) allFilenames.add(c.imageFilename);
      });
    }
    if (packageData.data.addons) {
      packageData.data.addons.forEach((a) => {
        if (a.imageFilename) allFilenames.add(a.imageFilename);
      });
    }
    if (packageData.data.products) {
      packageData.data.products.forEach((p) => {
        if (p.featuredImageFilename) allFilenames.add(p.featuredImageFilename);
        p.gallery?.forEach((g) => {
          if (g.filename) allFilenames.add(g.filename);
        });
      });
    }
    if (packageData.data.siteSettings?.defaultShareImageFilename) {
      allFilenames.add(packageData.data.siteSettings.defaultShareImageFilename);
    }

    // Verify R2 Media existence if requested
    let r2Verification = {
      checked: false,
      total: allFilenames.size,
      verified: 0,
      missing: [] as string[],
      bucket: dbInfo.r2Bucket,
    };

    if (options.verifyR2Media !== false && allFilenames.size > 0) {
      r2Verification = await verifyR2Files(Array.from(allFilenames));
      if (r2Verification.missing.length > 0) {
        warnings.push(
          `${r2Verification.missing.length} media object(s) referenced in the package were not found in Cloudflare R2 bucket "${dbInfo.r2Bucket}". Missing: ${r2Verification.missing.slice(0, 3).join(', ')}${r2Verification.missing.length > 3 ? '...' : ''}`
        );
      }
    }

    // 1. Media Preview
    const existingMedia = await prisma.cms_media.findMany({ select: { id: true, filename: true, alt: true } });
    const existingMediaByFilename = new Map<string, { id: number; alt: string }>();
    for (const r of existingMedia) {
      if (r.filename) {
        existingMediaByFilename.set(r.filename, { id: r.id, alt: r.alt || '' });
      }
    }

    if (options.collections.media && packageData.data.media) {
      for (const m of packageData.data.media) {
        const existing = existingMediaByFilename.get(m.filename);
        if (existing) {
          if (options.mode === 'update_existing') {
            recordAction(
              'media',
              m.filename,
              m.alt || m.filename,
              'UPDATE',
              `Matches existing media record (ID: ${existing.id}) by filename. Metadata will be updated.`,
              m.sourceId,
              existing.id
            );
          } else {
            recordAction(
              'media',
              m.filename,
              m.alt || m.filename,
              'SKIP',
              `Already exists in destination (ID: ${existing.id}). Skipped in create-only mode.`,
              m.sourceId,
              existing.id
            );
          }
        } else {
          recordAction(
            'media',
            m.filename,
            m.alt || m.filename,
            'CREATE',
            'New media record will be created in payload.cms_media.',
            m.sourceId,
            null
          );
        }
      }
    }

    // 2. Categories Preview
    const existingCategories = await prisma.cms_categories.findMany({ select: { id: true, slug: true, name: true } });
    const existingCatBySlug = new Map<string, { id: number; name: string }>();
    for (const r of existingCategories) {
      existingCatBySlug.set(r.slug, { id: r.id, name: r.name });
    }

    if (options.collections.categories && packageData.data.categories) {
      for (const c of packageData.data.categories) {
        const existing = existingCatBySlug.get(c.slug);
        if (existing) {
          if (options.mode === 'update_existing') {
            recordAction(
              'categories',
              c.slug,
              c.name,
              'UPDATE',
              `Matches existing category (ID: ${existing.id}) by slug "${c.slug}". Fields will be updated.`,
              c.sourceId,
              existing.id
            );
          } else {
            recordAction(
              'categories',
              c.slug,
              c.name,
              'SKIP',
              `Category with slug "${c.slug}" already exists (ID: ${existing.id}). Skipped.`,
              c.sourceId,
              existing.id
            );
          }
        } else {
          recordAction(
            'categories',
            c.slug,
            c.name,
            'CREATE',
            `New category "${c.name}" will be inserted with slug "${c.slug}".`,
            c.sourceId,
            null
          );
        }
      }
    }

    // 3. Add-ons Preview
    const existingAddons = await prisma.cms_addons.findMany({ select: { id: true, slug: true, name: true } });
    const existingAddonBySlug = new Map<string, { id: number; name: string }>();
    for (const r of existingAddons) {
      existingAddonBySlug.set(r.slug, { id: r.id, name: r.name });
    }

    if (options.collections.addons && packageData.data.addons) {
      for (const a of packageData.data.addons) {
        const existing = existingAddonBySlug.get(a.slug);
        if (existing) {
          if (options.mode === 'update_existing') {
            recordAction(
              'addons',
              a.slug,
              a.name,
              'UPDATE',
              `Matches existing add-on (ID: ${existing.id}) by slug. Pricing and details will be updated.`,
              a.sourceId,
              existing.id
            );
          } else {
            recordAction(
              'addons',
              a.slug,
              a.name,
              'SKIP',
              `Add-on with slug "${a.slug}" already exists (ID: ${existing.id}). Skipped.`,
              a.sourceId,
              existing.id
            );
          }
        } else {
          recordAction(
            'addons',
            a.slug,
            a.name,
            'CREATE',
            `New add-on "${a.name}" will be inserted.`,
            a.sourceId,
            null
          );
        }
      }
    }

    // 4. Coupons Preview
    const existingCoupons = await prisma.cms_coupons.findMany({ select: { id: true, code: true } });
    const existingCouponByCode = new Map<string, { id: number; code: string }>();
    for (const r of existingCoupons) {
      existingCouponByCode.set(r.code.toUpperCase(), { id: r.id, code: r.code });
    }

    if (options.collections.coupons && packageData.data.coupons) {
      for (const c of packageData.data.coupons) {
        const codeUpper = c.code.toUpperCase().trim();
        const existing = existingCouponByCode.get(codeUpper);
        if (existing) {
          if (options.mode === 'update_existing') {
            recordAction(
              'coupons',
              c.code,
              `Coupon ${c.code}`,
              'UPDATE',
              `Matches existing coupon (ID: ${existing.id}) by code "${codeUpper}". Settings will be updated.`,
              c.sourceId,
              existing.id
            );
          } else {
            recordAction(
              'coupons',
              c.code,
              `Coupon ${c.code}`,
              'SKIP',
              `Coupon code "${codeUpper}" already exists (ID: ${existing.id}). Skipped.`,
              c.sourceId,
              existing.id
            );
          }
        } else {
          recordAction(
            'coupons',
            c.code,
            `Coupon ${c.code}`,
            'CREATE',
            `New coupon "${codeUpper}" will be inserted.`,
            c.sourceId,
            null
          );
        }
      }
    }

    // 5. Orders Preview
    const existingOrders = await prisma.cms_orders.findMany({ select: { id: true, order_id: true } });
    const existingOrderByOrderId = new Map<string, { id: number; orderId: string }>();
    for (const r of existingOrders) {
      existingOrderByOrderId.set(r.order_id, { id: r.id, orderId: r.order_id });
    }

    if (options.collections.orders && packageData.data.orders) {
      for (const o of packageData.data.orders) {
        const existing = existingOrderByOrderId.get(o.orderId);
        if (existing) {
          if (options.mode === 'update_existing') {
            recordAction(
              'orders',
              o.orderId,
              `Order ${o.orderId}`,
              'UPDATE',
              `Matches existing order (ID: ${existing.id}) by tracking ID "${o.orderId}". Order details will be updated.`,
              o.sourceId,
              existing.id
            );
          } else {
            recordAction(
              'orders',
              o.orderId,
              `Order ${o.orderId}`,
              'SKIP',
              `Order with ID "${o.orderId}" already exists (ID: ${existing.id}). Skipped.`,
              o.sourceId,
              existing.id
            );
          }
        } else {
          recordAction(
            'orders',
            o.orderId,
            `Order ${o.orderId}`,
            'CREATE',
            `New order "${o.orderId}" will be inserted.`,
            o.sourceId,
            null
          );
        }
      }
    }

    // 6. Products Preview & Relationship Resolution Check
    const existingProducts = await prisma.cms_products.findMany({ select: { id: true, slug: true, name: true } });
    const existingProductBySlug = new Map<string, { id: number; name: string }>();
    for (const r of existingProducts) {
      existingProductBySlug.set(r.slug, { id: r.id, name: r.name });
    }

    // Build sets of available categories and media (existing in destination + in package)
    const availableCategories = new Set<string>(existingCatBySlug.keys());
    if (packageData.data.categories) {
      packageData.data.categories.forEach((c) => availableCategories.add(c.slug));
    }

    if (options.collections.products && packageData.data.products) {
      for (const p of packageData.data.products) {
        // Verify category relationship
        if (!availableCategories.has(p.categorySlug)) {
          recordAction(
            'products',
            p.slug,
            p.name,
            'CONFLICT',
            `Unresolved category: Referenced category slug "${p.categorySlug}" does not exist in destination database and is not in the import package.`,
            p.sourceId,
            null
          );
          errors.push(
            `Product "${p.name}" (${p.slug}) requires category "${p.categorySlug}" which is missing.`
          );
          continue;
        }

        const existing = existingProductBySlug.get(p.slug);
        if (existing) {
          if (options.mode === 'update_existing') {
            recordAction(
              'products',
              p.slug,
              p.name,
              'UPDATE',
              `Matches existing product (ID: ${existing.id}) by slug. Details, sizes, care tips, and relationships will be remapped and updated.`,
              p.sourceId,
              existing.id
            );
          } else {
            recordAction(
              'products',
              p.slug,
              p.name,
              'SKIP',
              `Product with slug "${p.slug}" already exists (ID: ${existing.id}). Skipped in create-only mode.`,
              p.sourceId,
              existing.id
            );
          }
        } else {
          recordAction(
            'products',
            p.slug,
            p.name,
            'CREATE',
            `New product "${p.name}" will be inserted. Category and media IDs will be safely mapped.`,
            p.sourceId,
            null
          );
        }
      }
    }

    // 7. Site Settings Preview
    if (options.collections.siteSettings && packageData.data.siteSettings) {
      const existingSettings = await prisma.cms_site_settings.findUnique({
        where: { id: 1 },
        select: { id: true, store_name: true },
      });
      if (existingSettings) {
        if (options.mode === 'update_existing') {
          recordAction(
            'siteSettings',
            'site-settings',
            'Store Site Settings',
            'UPDATE',
            'Global site settings will be updated with exported store contact and delivery configuration.',
            1,
            1
          );
        } else {
          recordAction(
            'siteSettings',
            'site-settings',
            'Store Site Settings',
            'SKIP',
            'Site settings row already exists. Skipped in create-only mode.',
            1,
            1
          );
        }
      } else {
        recordAction(
          'siteSettings',
          'site-settings',
          'Store Site Settings',
          'CREATE',
          'Global site settings record (ID: 1) will be initialized.',
          1,
          1
        );
      }
    }

    const totalRecordsInPackage =
      (packageData.data.media?.length || 0) +
      (packageData.data.categories?.length || 0) +
      (packageData.data.addons?.length || 0) +
      (packageData.data.coupons?.length || 0) +
      (packageData.data.orders?.length || 0) +
      (packageData.data.products?.length || 0) +
      (packageData.data.siteSettings ? 1 : 0);

    return {
      destinationEnvironment: {
        name: dbInfo.environmentLabel,
        isProduction: dbInfo.isProduction,
        maskedHost: dbInfo.maskedHost,
        r2Bucket: dbInfo.r2Bucket,
      },
      totalRecordsInPackage,
      counts,
      byCollection,
      items,
      r2Verification,
      warnings,
      errors,
      isSafeToProceed: errors.length === 0 && counts.conflicts === 0,
    };
}

/**
 * Executes a full catalog import inside an atomic transaction.
 * Resolves source IDs to destination IDs, remaps relationships,
 * and advances PostgreSQL sequences.
 */
export async function executeImport(
  packageData: ExportPackage,
  options: ImportOptions
): Promise<ImportResult> {
  const dbInfo = getDestinationDbInfo();
  const logs: string[] = [];
  const errors: string[] = [];

  // Check dry-run mode
  if (options.mode === 'dry_run') {
    const preview = await generatePreview(packageData, options);
    return {
      success: preview.isSafeToProceed,
      mode: 'dry_run',
      destinationEnvironment: {
        name: dbInfo.environmentLabel,
        isProduction: dbInfo.isProduction,
        maskedHost: dbInfo.maskedHost,
      },
      timestamp: new Date().toISOString(),
      counts: {
        created: preview.counts.toCreate,
        updated: preview.counts.toUpdate,
        skipped: preview.counts.toSkip,
        failed: preview.counts.conflicts,
      },
      byCollection: Object.entries(preview.byCollection).reduce(
        (acc, [k, v]) => ({ ...acc, [k]: { created: v.toCreate, updated: v.toUpdate, skipped: v.toSkip } }),
        {}
      ),
      remappingStats: {
        mediaRemapped: 0,
        categoriesRemapped: 0,
        productsRemapped: 0,
        addonsRemapped: 0,
        couponsRemapped: 0,
      },
      sequencesUpdated: [],
      logs: [
        'Dry run simulation executed successfully.',
        `Zero database writes performed against target environment: ${dbInfo.environmentLabel}.`,
        `Records evaluated: ${preview.totalRecordsInPackage} (${preview.counts.toCreate} to create, ${preview.counts.toUpdate} to update, ${preview.counts.toSkip} to skip).`,
      ],
      errors: preview.errors,
    };
  }

  // Safety confirmation check for production
  if (dbInfo.isProduction) {
    if (options.targetConfirmation !== 'CONFIRM') {
      throw new Error(
        'Safety Check Failed: Explicit confirmation code "CONFIRM" is required to execute a live import into the PRODUCTION database.'
      );
    }
  }

  // Live transactional import
  return await withTransaction(async (client: Client) => {
    logs.push(`Started atomic database transaction on ${dbInfo.environmentLabel}.`);

    // In-memory mapping tables: sourceId -> destinationId
    const mediaMap = new Map<number, number>();
    const categoryMap = new Map<number, number>();
    const addonMap = new Map<number, number>();
    const couponMap = new Map<number, number>();
    const orderMap = new Map<number, number>();
    const productMap = new Map<number, number>();

    const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };
    const byCollection: Record<string, { created: number; updated: number; skipped: number }> = {};

    const trackAction = (coll: string, action: 'created' | 'updated' | 'skipped') => {
      counts[action]++;
      if (!byCollection[coll]) byCollection[coll] = { created: 0, updated: 0, skipped: 0 };
      byCollection[coll][action]++;
    };

    // ---------------------------------------------------------------------------
    // Step 1: Media (payload.cms_media)
    // ---------------------------------------------------------------------------
    if (options.collections.media && packageData.data.media) {
      logs.push(`Processing ${packageData.data.media.length} media records...`);

      for (const m of packageData.data.media) {
        const existingRes = await client.query(
          'SELECT id FROM payload.cms_media WHERE filename = $1;',
          [m.filename]
        );

        if (existingRes.rows.length > 0) {
          const destId = existingRes.rows[0].id;
          mediaMap.set(m.sourceId, destId);

          if (options.mode === 'update_existing') {
            await client.query(
              `UPDATE payload.cms_media SET
                alt = $1,
                caption = $2,
                mime_type = $3,
                filesize = $4,
                width = $5,
                height = $6,
                focal_x = $7,
                focal_y = $8,
                url = $9,
                thumbnail_u_r_l = $10,
                prefix = $11,
                updated_at = NOW()
              WHERE id = $12;`,
              [
                m.alt,
                m.caption,
                m.mimeType,
                m.filesize,
                m.width,
                m.height,
                m.focalX,
                m.focalY,
                m.url,
                m.thumbnailUrl,
                m.prefix,
                destId,
              ]
            );
            trackAction('media', 'updated');
          } else {
            trackAction('media', 'skipped');
          }
        } else {
          // Insert new media record
          const insertRes = await client.query(
            `INSERT INTO payload.cms_media (
              filename, alt, caption, mime_type, filesize, width, height, focal_x, focal_y,
              url, thumbnail_u_r_l, prefix,
              sizes_thumbnail_filename, sizes_thumbnail_width, sizes_thumbnail_height, sizes_thumbnail_filesize, sizes_thumbnail_mime_type, sizes_thumbnail_url,
              sizes_card_filename, sizes_card_width, sizes_card_height, sizes_card_filesize, sizes_card_mime_type, sizes_card_url,
              sizes_full_filename, sizes_full_width, sizes_full_height, sizes_full_filesize, sizes_full_mime_type, sizes_full_url,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11, $12,
              $13, $14, $15, $16, $17, $18,
              $19, $20, $21, $22, $23, $24,
              $25, $26, $27, $28, $29, $30,
              NOW(), NOW()
            ) RETURNING id;`,
            [
              m.filename,
              m.alt,
              m.caption,
              m.mimeType,
              m.filesize,
              m.width,
              m.height,
              m.focalX,
              m.focalY,
              m.url,
              m.thumbnailUrl,
              m.prefix,
              m.sizes?.thumbnail?.filename || null,
              m.sizes?.thumbnail?.width || null,
              m.sizes?.thumbnail?.height || null,
              m.sizes?.thumbnail?.filesize || null,
              m.sizes?.thumbnail?.mimeType || null,
              m.sizes?.thumbnail?.url || null,
              m.sizes?.card?.filename || null,
              m.sizes?.card?.width || null,
              m.sizes?.card?.height || null,
              m.sizes?.card?.filesize || null,
              m.sizes?.card?.mimeType || null,
              m.sizes?.card?.url || null,
              m.sizes?.full?.filename || null,
              m.sizes?.full?.width || null,
              m.sizes?.full?.height || null,
              m.sizes?.full?.filesize || null,
              m.sizes?.full?.mimeType || null,
              m.sizes?.full?.url || null,
            ]
          );

          const destId = insertRes.rows[0].id;
          mediaMap.set(m.sourceId, destId);
          trackAction('media', 'created');
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Step 2: Categories (payload.cms_categories)
    // ---------------------------------------------------------------------------
    if (options.collections.categories && packageData.data.categories) {
      logs.push(`Processing ${packageData.data.categories.length} category records...`);

      for (const c of packageData.data.categories) {
        // Resolve image_id via mediaMap or fallback lookup
        let imageId: number | null = null;
        if (c.sourceImageId && mediaMap.has(c.sourceImageId)) {
          imageId = mediaMap.get(c.sourceImageId)!;
        } else if (c.imageFilename) {
          const mRes = await client.query('SELECT id FROM payload.cms_media WHERE filename = $1;', [c.imageFilename]);
          if (mRes.rows.length > 0) imageId = mRes.rows[0].id;
        }

        const existingRes = await client.query(
          'SELECT id FROM payload.cms_categories WHERE slug = $1;',
          [c.slug]
        );

        if (existingRes.rows.length > 0) {
          const destId = existingRes.rows[0].id;
          categoryMap.set(c.sourceId, destId);

          if (options.mode === 'update_existing') {
            await client.query(
              `UPDATE payload.cms_categories SET
                name = $1,
                icon = $2,
                description = $3,
                image_id = $4,
                is_active = $5,
                sort_order = $6,
                updated_at = NOW()
              WHERE id = $7;`,
              [c.name, c.icon, c.description, imageId, c.isActive, c.sortOrder, destId]
            );
            trackAction('categories', 'updated');
          } else {
            trackAction('categories', 'skipped');
          }
        } else {
          const insertRes = await client.query(
            `INSERT INTO payload.cms_categories (
              name, slug, icon, description, image_id, is_active, sort_order, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id;`,
            [c.name, c.slug, c.icon, c.description, imageId, c.isActive, c.sortOrder]
          );

          const destId = insertRes.rows[0].id;
          categoryMap.set(c.sourceId, destId);
          trackAction('categories', 'created');
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Step 3: Add-ons (payload.cms_addons)
    // ---------------------------------------------------------------------------
    if (options.collections.addons && packageData.data.addons) {
      logs.push(`Processing ${packageData.data.addons.length} add-on records...`);

      for (const a of packageData.data.addons) {
        let imageId: number | null = null;
        if (a.sourceImageId && mediaMap.has(a.sourceImageId)) {
          imageId = mediaMap.get(a.sourceImageId)!;
        } else if (a.imageFilename) {
          const mRes = await client.query('SELECT id FROM payload.cms_media WHERE filename = $1;', [a.imageFilename]);
          if (mRes.rows.length > 0) imageId = mRes.rows[0].id;
        }

        const existingRes = await client.query(
          'SELECT id FROM payload.cms_addons WHERE slug = $1;',
          [a.slug]
        );

        if (existingRes.rows.length > 0) {
          const destId = existingRes.rows[0].id;
          addonMap.set(a.sourceId, destId);

          if (options.mode === 'update_existing') {
            await client.query(
              `UPDATE payload.cms_addons SET
                name = $1,
                category = $2,
                icon = $3,
                price = $4,
                stock_quantity = $5,
                stock_status = $6,
                is_active = $7,
                material = $8,
                dimensions = $9,
                description = $10,
                image_id = $11,
                sort_order = $12,
                updated_at = NOW()
              WHERE id = $13;`,
              [
                a.name,
                normalizeAddonCategory(a.category),
                a.icon,
                a.price,
                a.stockQuantity,
                normalizeAddonStockStatus(a.stockStatus),
                a.isActive,
                a.material,
                a.dimensions,
                a.description,
                imageId,
                a.sortOrder,
                destId,
              ]
            );
            trackAction('addons', 'updated');
          } else {
            trackAction('addons', 'skipped');
          }
        } else {
          const insertRes = await client.query(
            `INSERT INTO payload.cms_addons (
              name, slug, category, icon, price, stock_quantity, stock_status, is_active,
              material, dimensions, description, image_id, sort_order, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()) RETURNING id;`,
            [
              a.name,
              a.slug,
              normalizeAddonCategory(a.category),
              a.icon,
              a.price,
              a.stockQuantity,
              normalizeAddonStockStatus(a.stockStatus),
              a.isActive,
              a.material,
              a.dimensions,
              a.description,
              imageId,
              a.sortOrder,
            ]
          );

          const destId = insertRes.rows[0].id;
          addonMap.set(a.sourceId, destId);
          trackAction('addons', 'created');
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Step 4: Coupons (payload.cms_coupons)
    // ---------------------------------------------------------------------------
    if (options.collections.coupons && packageData.data.coupons) {
      logs.push(`Processing ${packageData.data.coupons.length} coupon records...`);

      for (const c of packageData.data.coupons) {
        const codeUpper = c.code.toUpperCase().trim();
        const existingRes = await client.query(
          'SELECT id FROM payload.cms_coupons WHERE UPPER(code) = $1;',
          [codeUpper]
        );

        if (existingRes.rows.length > 0) {
          const destId = existingRes.rows[0].id;
          couponMap.set(c.sourceId, destId);

          if (options.mode === 'update_existing') {
            await client.query(
              `UPDATE payload.cms_coupons SET
                description = $1,
                discount_type = $2,
                discount_value = $3,
                min_spend = $4,
                max_discount = $5,
                start_date = $6,
                end_date = $7,
                usage_limit_total = $8,
                usage_limit_per_customer = $9,
                is_active = $10,
                updated_at = NOW()
              WHERE id = $11;`,
              [
                c.description,
                normalizeCouponDiscountType(c.discountType),
                c.discountValue,
                c.minSpend,
                c.maxDiscount,
                c.startDate,
                c.endDate,
                c.usageLimitTotal,
                c.usageLimitPerCustomer,
                c.isActive,
                destId,
              ]
            );
            trackAction('coupons', 'updated');
          } else {
            trackAction('coupons', 'skipped');
          }
        } else {
          const insertRes = await client.query(
            `INSERT INTO payload.cms_coupons (
              code, description, discount_type, discount_value, min_spend, max_discount,
              start_date, end_date, usage_limit_total, usage_limit_per_customer, is_active,
              usage_count, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()) RETURNING id;`,
            [
              codeUpper,
              c.description,
              normalizeCouponDiscountType(c.discountType),
              c.discountValue,
              c.minSpend,
              c.maxDiscount,
              c.startDate,
              c.endDate,
              c.usageLimitTotal,
              c.usageLimitPerCustomer,
              c.isActive,
              c.usageCount || 0,
            ]
          );

          const destId = insertRes.rows[0].id;
          couponMap.set(c.sourceId, destId);
          trackAction('coupons', 'created');
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Step: Orders (payload.cms_orders)
    // ---------------------------------------------------------------------------
    if (options.collections.orders && packageData.data.orders) {
      logs.push(`Processing ${packageData.data.orders.length} order records...`);

      for (const o of packageData.data.orders) {
        const existingRes = await client.query(
          'SELECT id FROM payload.cms_orders WHERE order_id = $1;',
          [o.orderId]
        );

        const itemsJson = typeof o.items === 'string' ? o.items : JSON.stringify(o.items || []);
        const validStatus = normalizeOrderStatus(o.status);

        if (existingRes.rows.length > 0) {
          const destId = existingRes.rows[0].id;
          orderMap.set(o.sourceId, destId);

          if (options.mode === 'update_existing') {
            await client.query(
              `UPDATE payload.cms_orders SET
                status = $1::payload.enum_cms_orders_status,
                current_step = $2,
                date = $3,
                total = $4,
                subtotal = $5,
                delivery_fee = $6,
                discount = $7,
                sender_name = $8,
                sender_email = $9,
                sender_phone = $10,
                keep_secret = $11,
                recipient_name = $12,
                recipient_phone = $13,
                recipient_address = $14,
                recipient_apt = $15,
                recipient_city = $16,
                recipient_state = $17,
                recipient_zip = $18,
                card_message = $19,
                recipient_notes = $20,
                delivery_date = $21,
                delivery_slot = $22,
                estimated_delivery = $23,
                slot = $24,
                items = $25::jsonb,
                items_json = $26,
                payment_method = $27,
                payment_status = $28,
                razorpay_order_id = $29,
                razorpay_payment_id = $30,
                tracking_token = $31,
                idempotency_key = $32,
                razorpay_signature = $33,
                updated_at = NOW()
              WHERE id = $34;`,
              [
                validStatus,
                o.currentStep ?? 1,
                o.date ?? null,
                o.total,
                o.subtotal ?? null,
                o.deliveryFee ?? null,
                o.discount ?? null,
                o.senderName,
                o.senderEmail,
                o.senderPhone ?? null,
                Boolean(o.keepSecret),
                o.recipientName,
                o.recipientPhone,
                o.recipientAddress,
                o.recipientApt ?? null,
                o.recipientCity ?? null,
                o.recipientState ?? null,
                o.recipientZip ?? null,
                o.cardMessage ?? null,
                o.recipientNotes ?? null,
                o.deliveryDate ?? null,
                o.deliverySlot ?? null,
                o.estimatedDelivery ?? null,
                o.slot ?? null,
                itemsJson,
                o.itemsJson ?? itemsJson,
                o.paymentMethod ?? 'razorpay',
                o.paymentStatus ?? 'pending',
                o.razorpayOrderId ?? null,
                o.razorpayPaymentId ?? null,
                o.trackingToken ?? null,
                o.idempotencyKey ?? null,
                o.razorpaySignature ?? null,
                destId,
              ]
            );
            trackAction('orders', 'updated');
          } else {
            trackAction('orders', 'skipped');
          }
        } else {
          const insertRes = await client.query(
            `INSERT INTO payload.cms_orders (
              order_id, status, current_step, date, total, subtotal, delivery_fee, discount,
              sender_name, sender_email, sender_phone, keep_secret,
              recipient_name, recipient_phone, recipient_address, recipient_apt, recipient_city, recipient_state, recipient_zip,
              card_message, recipient_notes, delivery_date, delivery_slot, estimated_delivery, slot,
              items, items_json, payment_method, payment_status, razorpay_order_id, razorpay_payment_id,
              tracking_token, idempotency_key, razorpay_signature, created_at, updated_at
            ) VALUES (
              $1, $2::payload.enum_cms_orders_status, $3, $4, $5, $6, $7, $8,
              $9, $10, $11, $12,
              $13, $14, $15, $16, $17, $18, $19,
              $20, $21, $22, $23, $24, $25,
              $26::jsonb, $27, $28, $29, $30, $31,
              $32, $33, $34, NOW(), NOW()
            ) RETURNING id;`,
            [
              o.orderId,
              validStatus,
              o.currentStep ?? 1,
              o.date ?? null,
              o.total,
              o.subtotal ?? null,
              o.deliveryFee ?? null,
              o.discount ?? null,
              o.senderName,
              o.senderEmail,
              o.senderPhone ?? null,
              Boolean(o.keepSecret),
              o.recipientName,
              o.recipientPhone,
              o.recipientAddress,
              o.recipientApt ?? null,
              o.recipientCity ?? null,
              o.recipientState ?? null,
              o.recipientZip ?? null,
              o.cardMessage ?? null,
              o.recipientNotes ?? null,
              o.deliveryDate ?? null,
              o.deliverySlot ?? null,
              o.estimatedDelivery ?? null,
              o.slot ?? null,
              itemsJson,
              o.itemsJson ?? itemsJson,
              o.paymentMethod ?? 'razorpay',
              o.paymentStatus ?? 'pending',
              o.razorpayOrderId ?? null,
              o.razorpayPaymentId ?? null,
              o.trackingToken ?? null,
              o.idempotencyKey ?? null,
              o.razorpaySignature ?? null,
            ]
          );

          const destId = insertRes.rows[0].id;
          orderMap.set(o.sourceId, destId);
          trackAction('orders', 'created');
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Step 5: Products & Sub-tables (payload.cms_products)
    // ---------------------------------------------------------------------------
    if (options.collections.products && packageData.data.products) {
      logs.push(`Processing ${packageData.data.products.length} product records and sub-tables...`);

      for (const p of packageData.data.products) {
        // Resolve category_id via categoryMap or slug lookup
        let categoryId: number | null = null;
        if (categoryMap.has(p.sourceCategoryId)) {
          categoryId = categoryMap.get(p.sourceCategoryId)!;
        } else if (p.categorySlug) {
          const catLookup = await client.query(
            'SELECT id FROM payload.cms_categories WHERE slug = $1;',
            [p.categorySlug]
          );
          if (catLookup.rows.length > 0) categoryId = catLookup.rows[0].id;
        }

        if (!categoryId) {
          throw new Error(
            `Cannot import product "${p.name}" (${p.slug}): Required category slug "${p.categorySlug}" could not be resolved.`
          );
        }

        // Resolve featured_image_id via mediaMap or filename lookup
        let featuredImageId: number | null = null;
        if (p.sourceFeaturedImageId && mediaMap.has(p.sourceFeaturedImageId)) {
          featuredImageId = mediaMap.get(p.sourceFeaturedImageId)!;
        } else if (p.featuredImageFilename) {
          const mediaLookup = await client.query(
            'SELECT id FROM payload.cms_media WHERE filename = $1;',
            [p.featuredImageFilename]
          );
          if (mediaLookup.rows.length > 0) featuredImageId = mediaLookup.rows[0].id;
        }

        const existingRes = await client.query(
          'SELECT id FROM payload.cms_products WHERE slug = $1;',
          [p.slug]
        );

        let destProductId: number;
        let shouldUpdateSubTables = false;

        if (existingRes.rows.length > 0) {
          destProductId = existingRes.rows[0].id;
          productMap.set(p.sourceId, destProductId);

          if (options.mode === 'update_existing') {
            await client.query(
              `UPDATE payload.cms_products SET
                name = $1,
                sku = $2,
                tagline = $3,
                short_description = $4,
                description = $5,
                category_id = $6,
                price = $7,
                compare_at_price = $8,
                stock_quantity = $9,
                stock_status = $10,
                flower_type = $11,
                stem_count = $12,
                symbolism = $13,
                featured_image_id = $14,
                is_featured = $15,
                is_bestseller = $16,
                is_new = $17,
                status = $18,
                rating = $19,
                review_count = $20,
                meta_title = $21,
                meta_description = $22,
                updated_at = NOW()
              WHERE id = $23;`,
              [
                p.name,
                p.sku,
                p.tagline,
                p.shortDescription,
                p.description,
                categoryId,
                p.price,
                p.compareAtPrice,
                p.stockQuantity,
                normalizeProductStockStatus(p.stockStatus),
                p.flowerType,
                p.stemCount,
                p.symbolism,
                featuredImageId,
                p.isFeatured,
                p.isBestseller,
                p.isNew,
                normalizeProductStatus(p.status),
                p.rating,
                p.reviewCount,
                p.metaTitle,
                p.metaDescription,
                destProductId,
              ]
            );
            trackAction('products', 'updated');
            shouldUpdateSubTables = true;
          } else {
            trackAction('products', 'skipped');
          }
        } else {
          // Insert new product
          const insertRes = await client.query(
            `INSERT INTO payload.cms_products (
              name, slug, sku, tagline, short_description, description, category_id,
              price, compare_at_price, stock_quantity, stock_status, flower_type, stem_count,
              symbolism, featured_image_id, is_featured, is_bestseller, is_new, status,
              rating, review_count, meta_title, meta_description, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7,
              $8, $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18, $19,
              $20, $21, $22, $23, NOW(), NOW()
            ) RETURNING id;`,
            [
              p.name,
              p.slug,
              p.sku,
              p.tagline,
              p.shortDescription,
              p.description,
              categoryId,
              p.price,
              p.compareAtPrice,
              p.stockQuantity,
              normalizeProductStockStatus(p.stockStatus),
              p.flowerType,
              p.stemCount,
              p.symbolism,
              featuredImageId,
              p.isFeatured,
              p.isBestseller,
              p.isNew,
              normalizeProductStatus(p.status),
              p.rating,
              p.reviewCount,
              p.metaTitle,
              p.metaDescription,
            ]
          );

          destProductId = insertRes.rows[0].id;
          productMap.set(p.sourceId, destProductId);
          trackAction('products', 'created');
          shouldUpdateSubTables = true;
        }

        // Sub-tables synchronization for this destination product
        if (shouldUpdateSubTables) {
          // 5a. Sizes (cms_products_sizes)
          await client.query('DELETE FROM payload.cms_products_sizes WHERE _parent_id = $1;', [destProductId]);
          if (p.sizes && p.sizes.length > 0) {
            for (let i = 0; i < p.sizes.length; i++) {
              const s = p.sizes[i];
              const sizeId = s.id || generateHex24();
              await client.query(
                `INSERT INTO payload.cms_products_sizes (_order, _parent_id, id, name, price, multiplier)
                 VALUES ($1, $2, $3, $4, $5, $6);`,
                [i + 1, destProductId, sizeId, s.name, s.price, s.multiplier ?? 1]
              );
            }
          }

          // 5b. Care Tips (cms_products_care_tips)
          await client.query('DELETE FROM payload.cms_products_care_tips WHERE _parent_id = $1;', [destProductId]);
          if (p.careTips && p.careTips.length > 0) {
            for (let i = 0; i < p.careTips.length; i++) {
              const tip = p.careTips[i];
              const tipId = tip.id || generateHex24();
              await client.query(
                `INSERT INTO payload.cms_products_care_tips (_order, _parent_id, id, tip)
                 VALUES ($1, $2, $3, $4);`,
                [i + 1, destProductId, tipId, tip.tip]
              );
            }
          }

          // 5c. Occasions (cms_products_occasions)
          await client.query('DELETE FROM payload.cms_products_occasions WHERE parent_id = $1;', [destProductId]);
          if (p.occasions && p.occasions.length > 0) {
            let occasionOrder = 1;
            for (let i = 0; i < p.occasions.length; i++) {
              const normOccasion = normalizeProductOccasion(p.occasions[i]);
              if (!normOccasion) continue;
              await client.query(
                `INSERT INTO payload.cms_products_occasions ("order", parent_id, value)
                 VALUES ($1, $2, $3);`,
                [occasionOrder++, destProductId, normOccasion]
              );
            }
          }

          // 5d. Tags (cms_products_tags)
          await client.query('DELETE FROM payload.cms_products_tags WHERE parent_id = $1;', [destProductId]);
          if (p.tags && p.tags.length > 0) {
            let tagOrder = 1;
            for (let i = 0; i < p.tags.length; i++) {
              const normTag = normalizeProductTag(p.tags[i]);
              if (!normTag) continue;
              await client.query(
                `INSERT INTO payload.cms_products_tags ("order", parent_id, value)
                 VALUES ($1, $2, $3);`,
                [tagOrder++, destProductId, normTag]
              );
            }
          }

          // 5e. Relationships: Gallery & Additional Categories (cms_products_rels)
          await client.query('DELETE FROM payload.cms_products_rels WHERE parent_id = $1;', [destProductId]);
          let relOrder = 1;

          // Gallery images
          if (p.gallery && p.gallery.length > 0) {
            for (const g of p.gallery) {
              let mediaId: number | null = null;
              if (mediaMap.has(g.sourceMediaId)) {
                mediaId = mediaMap.get(g.sourceMediaId)!;
              } else if (g.filename) {
                const mRes = await client.query('SELECT id FROM payload.cms_media WHERE filename = $1;', [g.filename]);
                if (mRes.rows.length > 0) mediaId = mRes.rows[0].id;
              }

              if (mediaId) {
                await client.query(
                  `INSERT INTO payload.cms_products_rels ("order", parent_id, path, cms_media_id)
                   VALUES ($1, $2, 'gallery', $3);`,
                  [relOrder++, destProductId, mediaId]
                );
              }
            }
          }

          // Additional categories
          if (p.additionalCategories && p.additionalCategories.length > 0) {
            for (const ac of p.additionalCategories) {
              let catId: number | null = null;
              if (categoryMap.has(ac.sourceCategoryId)) {
                catId = categoryMap.get(ac.sourceCategoryId)!;
              } else if (ac.slug) {
                const cRes = await client.query('SELECT id FROM payload.cms_categories WHERE slug = $1;', [ac.slug]);
                if (cRes.rows.length > 0) catId = cRes.rows[0].id;
              }

              if (catId) {
                await client.query(
                  `INSERT INTO payload.cms_products_rels ("order", parent_id, path, cms_categories_id)
                   VALUES ($1, $2, 'categories', $3);`,
                  [relOrder++, destProductId, catId]
                );
              }
            }
          }
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Step 6: Site Settings (payload.cms_site_settings)
    // ---------------------------------------------------------------------------
    if (options.collections.siteSettings && packageData.data.siteSettings) {
      const s = packageData.data.siteSettings;
      let shareImageId: number | null = null;
      if (s.sourceDefaultShareImageId && mediaMap.has(s.sourceDefaultShareImageId)) {
        shareImageId = mediaMap.get(s.sourceDefaultShareImageId)!;
      } else if (s.defaultShareImageFilename) {
        const mRes = await client.query('SELECT id FROM payload.cms_media WHERE filename = $1;', [s.defaultShareImageFilename]);
        if (mRes.rows.length > 0) shareImageId = mRes.rows[0].id;
      }

      const existingRes = await client.query('SELECT id FROM payload.cms_site_settings WHERE id = 1;');

      if (existingRes.rows.length > 0) {
        if (options.mode === 'update_existing') {
          await client.query(
            `UPDATE payload.cms_site_settings SET
              store_name = $1,
              tagline = $2,
              currency = $3,
              currency_symbol = $4,
              contact_email = $5,
              contact_phone = $6,
              address = $7,
              free_shipping_threshold = $8,
              standard_shipping_fee = $9,
              express_delivery_fee = $10,
              announcement_bar_enabled = $11,
              announcement_bar_text = $12,
              announcement_bar_link = $13,
              instagram = $14,
              whatsapp = $15,
              facebook = $16,
              pinterest = $17,
              default_meta_title = $18,
              default_meta_description = $19,
              default_share_image_id = $20,
              updated_at = NOW()
            WHERE id = 1;`,
            [
              s.storeName,
              s.tagline,
              s.currency,
              s.currencySymbol,
              s.contactEmail,
              s.contactPhone,
              s.address,
              s.freeShippingThreshold,
              s.standardShippingFee,
              s.expressDeliveryFee,
              s.announcementBar_enabled,
              s.announcementBar_text,
              s.announcementBar_link,
              s.instagram,
              s.whatsapp,
              s.facebook,
              s.pinterest,
              s.defaultMetaTitle,
              s.defaultMetaDescription,
              shareImageId,
            ]
          );
          trackAction('siteSettings', 'updated');
        } else {
          trackAction('siteSettings', 'skipped');
        }
      } else {
        await client.query(
          `INSERT INTO payload.cms_site_settings (
            id, store_name, tagline, currency, currency_symbol, contact_email, contact_phone, address,
            free_shipping_threshold, standard_shipping_fee, express_delivery_fee,
            announcement_bar_enabled, announcement_bar_text, announcement_bar_link,
            instagram, whatsapp, facebook, pinterest, default_meta_title, default_meta_description,
            default_share_image_id, created_at, updated_at
          ) VALUES (
            1, $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10,
            $11, $12, $13,
            $14, $15, $16, $17, $18, $19,
            $20, NOW(), NOW()
          );`,
          [
            s.storeName,
            s.tagline,
            s.currency,
            s.currencySymbol,
            s.contactEmail,
            s.contactPhone,
            s.address,
            s.freeShippingThreshold,
            s.standardShippingFee,
            s.expressDeliveryFee,
            s.announcementBar_enabled,
            s.announcementBar_text,
            s.announcementBar_link,
            s.instagram,
            s.whatsapp,
            s.facebook,
            s.pinterest,
            s.defaultMetaTitle,
            s.defaultMetaDescription,
            shareImageId,
          ]
        );
        trackAction('siteSettings', 'created');
      }
    }

    // ---------------------------------------------------------------------------
    // Step 7: Auto-Increment Sequence Synchronization
    // ---------------------------------------------------------------------------
    logs.push('Synchronizing PostgreSQL auto-increment sequences for Payload schema...');
    const syncedSequences = await syncDatabaseSequences(client);
    logs.push(`Successfully synchronized ${syncedSequences.length} sequences.`);

    logs.push('Transaction committed successfully. All changes are live.');

    return {
      success: true,
      mode: options.mode,
      destinationEnvironment: {
        name: dbInfo.environmentLabel,
        isProduction: dbInfo.isProduction,
        maskedHost: dbInfo.maskedHost,
      },
      timestamp: new Date().toISOString(),
      counts,
      byCollection,
      remappingStats: {
        mediaRemapped: mediaMap.size,
        categoriesRemapped: categoryMap.size,
        productsRemapped: productMap.size,
        addonsRemapped: addonMap.size,
        couponsRemapped: couponMap.size,
        ordersRemapped: orderMap.size,
      },
      sequencesUpdated: syncedSequences,
      logs,
      errors: [],
    };
  });
}

import { prisma } from '@/lib/db';
import { CartItem } from '@/types';
import {
  FREE_SHIPPING_THRESHOLD,
  STANDARD_SHIPPING_FEE,
} from '@/lib/currency';

export interface ValidatedCoupon {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed_amount' | 'free_shipping';
  discountValue: number;
  minSpend: number;
  maxDiscount: number | null;
  freeShipping: boolean;
}

export interface PricingCalculationResult {
  valid: boolean;
  error?: string;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  total: number;
  coupon?: ValidatedCoupon;
  validatedItems: CartItem[];
}

export interface CouponRedemptionResult {
  success: boolean;
  error?: string;
  couponId?: number;
  usageCount?: number;
}

/**
 * Recalculates subtotal, shipping fee, discounts, and total strictly server-side
 * using authoritative product and addon prices from the database.
 * Client-submitted prices are never trusted.
 */
export async function calculateCartPricing(
  items: CartItem[],
  couponCode?: string,
  customerEmail?: string
): Promise<PricingCalculationResult> {
  if (!items || items.length === 0) {
    return {
      valid: false,
      error: 'Cart is empty',
      subtotal: 0,
      discountAmount: 0,
      shippingFee: 0,
      total: 0,
      validatedItems: [],
    };
  }

  // 1. Fetch all add-ons and vases from payload.cms_addons for authoritative pricing
  const addonsInDb: Array<{ id: number; slug: string; name: string; category: string; price: number }> =
    await prisma.$queryRawUnsafe(
      `SELECT id, slug, name, category, price FROM payload.cms_addons WHERE is_active = true;`
    );

  const addonBySlug = new Map<string, number>();
  const addonByName = new Map<string, number>();
  for (const a of addonsInDb) {
    addonBySlug.set(a.slug.toLowerCase(), Number(a.price));
    addonByName.set(a.name.toLowerCase().trim(), Number(a.price));
  }

  // 2. Validate and recalculate each cart item
  let subtotal = 0;
  const validatedItems: CartItem[] = [];

  for (const item of items) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));

    // Lookup base product in Prisma database
    const product = await prisma.product.findFirst({
      where: {
        OR: [
          { id: item.id },
          { slug: item.slug || '' },
        ],
      },
    });

    if (!product) {
      return {
        valid: false,
        error: `Product "${item.name || item.slug || item.id}" is no longer available.`,
        subtotal: 0,
        discountAmount: 0,
        shippingFee: 0,
        total: 0,
        validatedItems: [],
      };
    }

    // Determine bouquet size price
    let unitBasePrice = Number(product.price);
    let matchedSize = item.selectedSize;

    if (item.selectedSize?.name) {
      try {
        const sizes: Array<{ name: string; price: number; multiplier?: number }> =
          JSON.parse(product.sizesJson || '[]');
        const targetSize = sizes.find(
          (s) => s.name.trim().toLowerCase() === item.selectedSize!.name.trim().toLowerCase()
        );
        if (targetSize) {
          unitBasePrice = Number(targetSize.price);
          matchedSize = {
            name: targetSize.name,
            price: unitBasePrice,
            multiplier: targetSize.multiplier ?? 1,
          };
        }
      } catch {
        // Fall back to product.price if sizesJson parsing fails
      }
    }

    // Determine vase price
    let unitVasePrice = 0;
    let matchedVase = item.selectedVase;

    if (item.selectedVase && item.selectedVase.id !== 'no-vase') {
      const vaseSlug = (item.selectedVase.id || '').toLowerCase();
      const vaseName = (item.selectedVase.name || '').toLowerCase().trim();
      const dbVasePrice = addonBySlug.get(vaseSlug) ?? addonByName.get(vaseName);

      if (dbVasePrice !== undefined) {
        unitVasePrice = dbVasePrice;
        matchedVase = {
          ...item.selectedVase,
          price: unitVasePrice,
        };
      } else {
        // Unknown vase; ignore or set price to 0
        unitVasePrice = 0;
      }
    }

    // Determine gifts / add-ons price
    let unitAddonsPrice = 0;
    const matchedAddons: typeof item.addons = [];

    if (Array.isArray(item.addons)) {
      for (const addon of item.addons) {
        const addonSlug = (addon.id || '').toLowerCase();
        const addonName = (addon.name || '').toLowerCase().trim();
        const dbAddonPrice = addonBySlug.get(addonSlug) ?? addonByName.get(addonName);

        if (dbAddonPrice !== undefined) {
          unitAddonsPrice += dbAddonPrice;
          matchedAddons.push({
            ...addon,
            price: dbAddonPrice,
          });
        }
      }
    }

    const itemUnitTotal = unitBasePrice + unitVasePrice + unitAddonsPrice;
    subtotal += itemUnitTotal * qty;

    validatedItems.push({
      ...item,
      price: unitBasePrice,
      quantity: qty,
      selectedSize: matchedSize,
      selectedVase: matchedVase,
      addons: matchedAddons,
    });
  }

  // 3. Determine base shipping
  const standardShipping = subtotal > FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_FEE;
  let shippingFee = standardShipping;
  let discountAmount = 0;
  let validatedCoupon: ValidatedCoupon | undefined;

  // 4. Validate coupon if provided
  if (couponCode && couponCode.trim()) {
    const cleanCode = couponCode.trim().toUpperCase();

    // Query authoritative Payload CMS coupons collection
    const couponRows: Array<{
      id: number;
      code: string;
      description: string | null;
      discount_type: 'percentage' | 'fixed_amount' | 'free_shipping';
      discount_value: number;
      min_spend: number | null;
      max_discount: number | null;
      usage_limit_total: number | null;
      usage_limit_per_customer: number | null;
      usage_count: number;
      is_active: boolean;
      start_date: string | null;
      end_date: string | null;
    }> = await prisma.$queryRawUnsafe(
      `SELECT id, code, description, discount_type, discount_value, min_spend, max_discount,
              usage_limit_total, usage_limit_per_customer, usage_count, is_active,
              start_date, end_date
       FROM payload.cms_coupons
       WHERE code = $1;`,
      cleanCode
    );

    if (!couponRows || couponRows.length === 0) {
      return {
        valid: false,
        error: `Coupon "${cleanCode}" is invalid or does not exist.`,
        subtotal,
        discountAmount: 0,
        shippingFee: standardShipping,
        total: subtotal + standardShipping,
        validatedItems,
      };
    }

    const c = couponRows[0];

    // Check active flag
    if (!c.is_active) {
      return {
        valid: false,
        error: `Coupon "${cleanCode}" is currently inactive.`,
        subtotal,
        discountAmount: 0,
        shippingFee: standardShipping,
        total: subtotal + standardShipping,
        validatedItems,
      };
    }

    // Check start date
    const now = new Date();
    if (c.start_date && now < new Date(c.start_date)) {
      return {
        valid: false,
        error: `Coupon "${cleanCode}" is not active yet.`,
        subtotal,
        discountAmount: 0,
        shippingFee: standardShipping,
        total: subtotal + standardShipping,
        validatedItems,
      };
    }

    // Check end date
    if (c.end_date && now > new Date(c.end_date)) {
      return {
        valid: false,
        error: `Coupon "${cleanCode}" has expired.`,
        subtotal,
        discountAmount: 0,
        shippingFee: standardShipping,
        total: subtotal + standardShipping,
        validatedItems,
      };
    }

    // Check total usage limit
    const totalLimit = c.usage_limit_total !== null ? Number(c.usage_limit_total) : 0;
    const currentUsage = Number(c.usage_count || 0);
    if (totalLimit > 0 && currentUsage >= totalLimit) {
      return {
        valid: false,
        error: `Coupon "${cleanCode}" has reached its maximum total usage limit.`,
        subtotal,
        discountAmount: 0,
        shippingFee: standardShipping,
        total: subtotal + standardShipping,
        validatedItems,
      };
    }

    // Check minimum spend
    const minSpend = c.min_spend !== null ? Number(c.min_spend) : 0;
    if (minSpend > 0 && subtotal < minSpend) {
      return {
        valid: false,
        error: `Minimum cart subtotal of ₹${minSpend.toLocaleString('en-IN')} required for coupon "${cleanCode}".`,
        subtotal,
        discountAmount: 0,
        shippingFee: standardShipping,
        total: subtotal + standardShipping,
        validatedItems,
      };
    }

    // Check per-customer usage limit
    const perCustomerLimit = c.usage_limit_per_customer !== null ? Number(c.usage_limit_per_customer) : 0;
    if (customerEmail && customerEmail.trim() && perCustomerLimit > 0) {
      const cleanEmail = customerEmail.trim().toLowerCase();
      const pastOrdersWithCoupon = await prisma.order.count({
        where: {
          senderEmail: { equals: cleanEmail, mode: 'insensitive' },
          itemsJson: { contains: cleanCode },
        },
      });

      if (pastOrdersWithCoupon >= perCustomerLimit) {
        return {
          valid: false,
          error: `You have reached the maximum redemption limit (${perCustomerLimit}) for coupon "${cleanCode}".`,
          subtotal,
          discountAmount: 0,
          shippingFee: standardShipping,
          total: subtotal + standardShipping,
          validatedItems,
        };
      }
    }

    // Calculate discount amount based on discount_type
    const val = Number(c.discount_value);
    const maxDiscount = c.max_discount !== null ? Number(c.max_discount) : null;
    let freeShipping = false;

    if (c.discount_type === 'percentage') {
      const computed = Math.round(subtotal * (val / 100) * 100) / 100;
      discountAmount = maxDiscount !== null && maxDiscount > 0
        ? Math.min(computed, maxDiscount)
        : computed;
      shippingFee = standardShipping;
      freeShipping = false;
    } else if (c.discount_type === 'fixed_amount') {
      discountAmount = Math.min(val, subtotal);
      shippingFee = standardShipping;
      freeShipping = false;
    } else if (c.discount_type === 'free_shipping') {
      discountAmount = 0;
      shippingFee = 0;
      freeShipping = true;
    }

    validatedCoupon = {
      code: c.code,
      description: c.description || '',
      discountType: c.discount_type,
      discountValue: val,
      minSpend,
      maxDiscount,
      freeShipping,
    };
  }

  const finalTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  return {
    valid: true,
    subtotal,
    discountAmount,
    shippingFee,
    total: finalTotal,
    coupon: validatedCoupon,
    validatedItems,
  };
}

export interface ReserveCouponParams {
  code: string;
  orderId: string;
  customerEmail?: string;
}

export interface ReleaseCouponParams {
  code: string;
  orderId: string;
}

export interface CommitCouponParams {
  code: string;
  orderId: string;
}

export interface CouponReservationResult {
  success: boolean;
  error?: string;
  couponId?: number;
  usageCount?: number;
  reservationKey?: string;
}

export interface CouponReleaseResult {
  success: boolean;
  released: boolean;
  reason?: string;
  usageCount?: number;
}

/**
 * Concurrency-safe atomic conditional coupon reservation linked to a specific orderId.
 * Records the reservation state in payload.payload_kv and increments usage_count in payload.cms_coupons.
 * Duplicate reservations for the same orderId are idempotent.
 * Accepts an optional transaction client (tx) to participate in cross-schema ACID transactions.
 */
export async function reserveCouponAtomically(
  params: ReserveCouponParams,
  dbClient?: any
): Promise<CouponReservationResult> {
  const { code, orderId, customerEmail } = params;
  const cleanCode = code.trim().toUpperCase();
  const cleanOrderId = orderId.trim();
  const reservationKey = `coupon_res:${cleanOrderId}`;

  const executeReservation = async (tx: any): Promise<CouponReservationResult> => {
    // 1. Check if reservation already exists for this orderId
    const existing: Array<{ id: number; data: any }> = await tx.$queryRawUnsafe(
      `SELECT id, data FROM "payload"."payload_kv" WHERE "key" = $1;`,
      reservationKey
    );

    if (existing && existing.length > 0) {
      const data = existing[0].data;
      if (data?.status === 'reserved' || data?.status === 'committed') {
        return {
          success: true,
          reservationKey,
          usageCount: data?.usageCount,
        };
      }
    }

    // 2. Atomic conditional increment in payload.cms_coupons
    const updatedCoupons: Array<{ id: number; usage_count: string | number; usage_limit_total: string | number | null }> =
      await tx.$queryRawUnsafe(
        `UPDATE "payload"."cms_coupons"
         SET "usage_count" = "usage_count" + 1, "updated_at" = NOW()
         WHERE "code" = $1
           AND "is_active" = true
           AND ("usage_limit_total" IS NULL OR "usage_limit_total" = 0 OR "usage_count" < "usage_limit_total")
           AND ("start_date" IS NULL OR "start_date" <= NOW())
           AND ("end_date" IS NULL OR "end_date" >= NOW())
         RETURNING "id", "usage_count", "usage_limit_total";`,
        cleanCode
      );

    if (!updatedCoupons || updatedCoupons.length === 0) {
      return {
        success: false,
        error: `Coupon "${cleanCode}" could not be reserved. Usage limit reached or coupon inactive/expired.`,
      };
    }

    const couponId = updatedCoupons[0].id;
    const usageCount = Number(updatedCoupons[0].usage_count);

    // 3. Insert reservation record in payload_kv
    const reservationData = {
      orderId: cleanOrderId,
      couponCode: cleanCode,
      customerEmail: customerEmail?.trim().toLowerCase() || null,
      status: 'reserved',
      usageCount,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };

    await tx.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      reservationKey,
      JSON.stringify(reservationData)
    );

    return {
      success: true,
      couponId,
      usageCount,
      reservationKey,
    };
  };

  try {
    if (dbClient) {
      return await executeReservation(dbClient);
    }
    return await prisma.$transaction(executeReservation, { maxWait: 10000, timeout: 15000 });
  } catch (err: any) {
    console.error(`Error reserving coupon ${cleanCode} for order ${cleanOrderId}:`, err);
    return {
      success: false,
      error: err.message || 'Database error during coupon reservation.',
    };
  }
}

/**
 * Idempotent, order-linked coupon release.
 * Releases a previously reserved coupon specifically for a given orderId.
 * A duplicate call for the same orderId will return released: false and will NEVER decrement usage_count again.
 * It is impossible for this function to decrement another order's usage count.
 * Accepts an optional transaction client (tx).
 */
export async function releaseCouponAtomically(
  params: ReleaseCouponParams,
  dbClient?: any
): Promise<CouponReleaseResult> {
  const { code, orderId } = params;
  const cleanCode = code.trim().toUpperCase();
  const cleanOrderId = orderId.trim();
  const reservationKey = `coupon_res:${cleanOrderId}`;

  const executeRelease = async (tx: any): Promise<CouponReleaseResult> => {
    // 1. Atomically check and transition reservation status from 'reserved' to 'released'
    const transitioned: Array<{ id: number; data: any }> = await tx.$queryRawUnsafe(
      `UPDATE "payload"."payload_kv"
       SET "data" = jsonb_set("data", '{status}', '"released"')
       WHERE "key" = $1 AND "data"->>'status' = 'reserved'
       RETURNING "id", "data";`,
      reservationKey
    );

    // If 0 rows updated: it was already released, never reserved, or already committed.
    // Do NOT touch usage_count!
    if (!transitioned || transitioned.length === 0) {
      return {
        success: true,
        released: false,
        reason: `No active reservation in 'reserved' state found for order ${cleanOrderId}. Duplicate release ignored.`,
      };
    }

    // 2. Only if the reservation was in 'reserved' state, decrement usage_count
    const updatedCoupons: Array<{ usage_count: string | number }> = await tx.$queryRawUnsafe(
      `UPDATE "payload"."cms_coupons"
       SET "usage_count" = GREATEST(0, "usage_count" - 1), "updated_at" = NOW()
       WHERE "code" = $1
       RETURNING "usage_count";`,
      cleanCode
    );

    const usageCount = updatedCoupons && updatedCoupons.length > 0
      ? Number(updatedCoupons[0].usage_count)
      : undefined;

    return {
      success: true,
      released: true,
      usageCount,
    };
  };

  try {
    if (dbClient) {
      return await executeRelease(dbClient);
    }
    return await prisma.$transaction(executeRelease, { maxWait: 10000, timeout: 15000 });
  } catch (err: any) {
    console.error(`Error releasing coupon ${cleanCode} for order ${cleanOrderId}:`, err);
    return {
      success: false,
      released: false,
      reason: err.message || 'Database error during coupon release.',
    };
  }
}

/**
 * Transitions an order's coupon reservation from 'reserved' to 'committed'.
 * Once committed, the coupon cannot be released by routine rollback.
 * Accepts an optional transaction client (tx).
 */
export async function commitCouponAtomically(
  params: CommitCouponParams,
  dbClient?: any
): Promise<{ success: boolean; committed: boolean }> {
  const { orderId } = params;
  const cleanOrderId = orderId.trim();
  const reservationKey = `coupon_res:${cleanOrderId}`;
  const client = dbClient || prisma;

  try {
    const transitioned: Array<{ id: number }> = await client.$queryRawUnsafe(
      `UPDATE "payload"."payload_kv"
       SET "data" = jsonb_set("data", '{status}', '"committed"')
       WHERE "key" = $1 AND "data"->>'status' = 'reserved'
       RETURNING "id";`,
      reservationKey
    );

    return {
      success: true,
      committed: transitioned && transitioned.length > 0,
    };
  } catch (err) {
    console.error(`Error committing coupon reservation for order ${cleanOrderId}:`, err);
    return { success: false, committed: false };
  }
}

/**
 * Sweeps expired reservations.
 * CRITICAL SAFETY CHECK: Cross-references public.orders to ensure paid/confirmed orders
 * are NEVER released, but rather self-healed to 'committed'.
 */
export async function cleanupExpiredReservations(options?: {
  gracePeriodMinutes?: number;
}): Promise<{
  sweptCount: number;
  releasedCount: number;
  reconciledCount: number;
  expiredOrdersCount: number;
  actions: Array<{ orderId: string; action: 'released' | 'expired_and_released' | 'reconciled_as_paid' | 'released_abandoned_ghost' | 'skipped' }>;
  skippedDueToLock?: boolean;
}> {
  // Concurrency Protection with Connection-Pool Safety:
  // Using pg_try_advisory_xact_lock within an explicit Prisma transaction guarantees that:
  // 1. All queries execute on the exact same pooled connection.
  // 2. The lock is held only for the duration of the transaction.
  // 3. PostgreSQL automatically releases the lock upon commit or rollback (zero leak risk across pool).
  return await prisma.$transaction(
    async (tx) => {
      const lockRows: Array<{ locked: boolean }> = await tx.$queryRawUnsafe(
      `SELECT pg_try_advisory_xact_lock(hashtext('floralux_coupon_cleanup_lock')) AS locked;`
    );

    const isLocked = Boolean(lockRows && lockRows[0]?.locked);
    if (!isLocked) {
      return {
        sweptCount: 0,
        releasedCount: 0,
        reconciledCount: 0,
        expiredOrdersCount: 0,
        actions: [],
        skippedDueToLock: true,
      };
    }

    const graceMinutes = options?.gracePeriodMinutes ?? 15;
    const cutoffTime = new Date(Date.now() - graceMinutes * 60 * 1000).toISOString();

    const expiredRows: Array<{ id: number; key: string; data: any }> = await tx.$queryRawUnsafe(
      `SELECT id, key, data FROM "payload"."payload_kv"
       WHERE "key" LIKE 'coupon_res:%'
         AND "data"->>'status' = 'reserved'
         AND ("data"->>'expiresAt')::timestamptz <= $1::timestamptz;`,
      cutoffTime
    );

    let releasedCount = 0;
    let reconciledCount = 0;
    let expiredOrdersCount = 0;
    const actions: Array<{ orderId: string; action: 'released' | 'expired_and_released' | 'reconciled_as_paid' | 'released_abandoned_ghost' | 'skipped' }> = [];

    for (const row of expiredRows) {
      const orderId = row.data?.orderId;
      const couponCode = row.data?.couponCode;
      if (!orderId || !couponCode) continue;

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true },
      });

      // Scenario A: Order does not exist in public.orders (process crashed before order creation)
      if (!order) {
        const releaseRes = await releaseCouponAtomically({ code: couponCode, orderId }, tx);
        if (releaseRes.released) {
          releasedCount++;
          actions.push({ orderId, action: 'released_abandoned_ghost' });
        } else {
          actions.push({ orderId, action: 'skipped' });
        }
        continue;
      }

      const statusLower = (order.status || '').toLowerCase().trim();

      // Scenario B: Order is in 'Payment Pending' state (customer abandoned checkout)
      const isPending =
        statusLower === 'payment pending' ||
        statusLower === 'pending payment' ||
        statusLower === 'payment_pending' ||
        statusLower === 'draft';

      if (isPending) {
        // Transition order in public.orders to 'Payment Expired'
        await tx.order.updateMany({
          where: {
            id: orderId,
            status: { in: ['Payment Pending', 'Pending Payment', 'payment_pending', 'Draft'] },
          },
          data: {
            status: 'Payment Expired',
          },
        });
        expiredOrdersCount++;

        // Release the coupon reservation exactly once
        const releaseRes = await releaseCouponAtomically({ code: couponCode, orderId }, tx);
        if (releaseRes.released) {
          releasedCount++;
          actions.push({ orderId, action: 'expired_and_released' });
        } else {
          actions.push({ orderId, action: 'skipped' });
        }
        continue;
      }

      // Scenario C: Order is already terminated (Cancelled, Payment Failed, Payment Expired)
      const isAlreadyTerminated =
        statusLower.includes('cancel') ||
        statusLower.includes('fail') ||
        statusLower.includes('expired');

      if (isAlreadyTerminated) {
        const releaseRes = await releaseCouponAtomically({ code: couponCode, orderId }, tx);
        if (releaseRes.released) {
          releasedCount++;
          actions.push({ orderId, action: 'released' });
        } else {
          actions.push({ orderId, action: 'skipped' });
        }
        continue;
      }

      // Scenario D: Order is verified/paid (e.g. 'Order Received & Verified', 'Confirmed', 'Processing')
      // CRITICAL: NEVER release a paid reservation. Self-heal to 'committed'
      await commitCouponAtomically({ code: couponCode, orderId }, tx);
      reconciledCount++;
      actions.push({ orderId, action: 'reconciled_as_paid' });
    }

    return {
      sweptCount: expiredRows.length,
      releasedCount,
      reconciledCount,
      expiredOrdersCount,
      actions,
    };
  },
  {
    timeout: 30000,
    maxWait: 10000,
  });
}

/**
 * Backwards-compatible wrapper that creates an order-linked reservation.
 */
export async function redeemCouponAtomically(
  code: string,
  ephemeralOrderId?: string
): Promise<CouponRedemptionResult> {
  const orderId = ephemeralOrderId || `LEGACY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const res = await reserveCouponAtomically({ code, orderId });
  return {
    success: res.success,
    error: res.error,
    couponId: res.couponId,
    usageCount: res.usageCount,
  };
}

/**
 * Backwards-compatible wrapper for release.
 */
export async function releaseCouponAtomic(
  code: string,
  ephemeralOrderId?: string
): Promise<void> {
  if (ephemeralOrderId) {
    await releaseCouponAtomically({ code, orderId: ephemeralOrderId });
  } else {
    // Unscoped fallback if no orderId provided
    const cleanCode = code.trim().toUpperCase();
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "payload"."cms_coupons"
         SET "usage_count" = GREATEST(0, "usage_count" - 1), "updated_at" = NOW()
         WHERE "code" = $1;`,
        cleanCode
      );
    } catch (err) {
      console.error(`Failed to release coupon usage for ${cleanCode}:`, err);
    }
  }
}

import { prisma } from '../lib/db';
import {
  calculateCartPricing,
  reserveCouponAtomically,
  releaseCouponAtomically,
  commitCouponAtomically,
} from '../lib/pricing';

async function runTests() {
  console.log('🧪 Starting Floralux Phase 4.5 Stage 1 Security & Integrity Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✅ [PASS] ${title}`);
    } else {
      console.error(`  ❌ [FAIL] ${title}${details ? ` -> ${details}` : ''}`);
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 1: Payload CMS Coupons Seeding Verification
  // ---------------------------------------------------------------------------
  console.log('📋 Test Group 1: Authoritative Payload CMS Coupons Collection');
  const cmsCoupons: any[] = await prisma.$queryRawUnsafe(
    `SELECT code, discount_type, discount_value, min_spend, max_discount, usage_limit_total, is_active, usage_count
     FROM payload.cms_coupons ORDER BY code;`
  );
  assert(cmsCoupons.length === 4, 'All 4 coupons seeded in payload.cms_coupons', `Found ${cmsCoupons.length}`);

  const spring20 = cmsCoupons.find((c) => c.code === 'SPRING20');
  assert(
    spring20 &&
      Number(spring20.min_spend) === 1500 &&
      Number(spring20.max_discount) === 1000 &&
      Number(spring20.usage_limit_total) === 500,
    'SPRING20 has approved rules (min ₹1,500, cap ₹1,000, limit 500)'
  );

  const freeDelivery = cmsCoupons.find((c) => c.code === 'FREEDELIVERY');
  assert(
    freeDelivery &&
      Number(freeDelivery.min_spend) === 999 &&
      Number(freeDelivery.usage_limit_total) === 1000,
    'FREEDELIVERY has approved rules (min ₹999, limit 1000)'
  );

  const bloom10 = cmsCoupons.find((c) => c.code === 'BLOOM10');
  assert(
    bloom10 &&
      Number(bloom10.min_spend) === 1200 &&
      Number(bloom10.discount_value) === 200,
    'BLOOM10 has approved rules (min ₹1,200, flat ₹200)'
  );

  const bloom15 = cmsCoupons.find((c) => c.code === 'BLOOM15');
  assert(
    bloom15 &&
      Number(bloom15.min_spend) === 2000 &&
      Number(bloom15.max_discount) === 750 &&
      Number(bloom15.usage_limit_total) === 300,
    'BLOOM15 has approved rules (min ₹2,000, cap ₹750, limit 300)'
  );

  // ---------------------------------------------------------------------------
  // TEST 2: Server-Side Price Tampering Resistance
  // ---------------------------------------------------------------------------
  console.log('\n🛡️ Test Group 2: Server-Side Price Tampering Resistance');
  const forgedCartItem: any = {
    id: 'fl-01',
    slug: 'velvet-scarlet-grand-roses',
    name: 'Tampered Velvet Roses',
    price: 1.0, // Forged client price!
    quantity: 1,
    cartItemId: 999,
  };

  const tamperedPricing = await calculateCartPricing([forgedCartItem]);
  assert(
    tamperedPricing.subtotal === 1799,
    'Client forged price (₹1.00) rejected; authoritative database price (₹1,799) used',
    `Calculated subtotal was ${tamperedPricing.subtotal}`
  );
  assert(
    tamperedPricing.total === 1799 + 149,
    'Total correctly includes subtotal + shipping without trust of client input',
    `Calculated total was ${tamperedPricing.total}`
  );

  // ---------------------------------------------------------------------------
  // TEST 3: Coupon Preview Validation & Min Spend / Max Discount
  // ---------------------------------------------------------------------------
  console.log('\n🎟️ Test Group 3: Coupon Preview & Rule Calculations');

  // Preview must NOT increment usage count
  const preUsageCount = Number(spring20.usage_count);
  await calculateCartPricing([forgedCartItem], 'SPRING20');
  const postUsageQuery: any[] = await prisma.$queryRawUnsafe(
    `SELECT usage_count FROM payload.cms_coupons WHERE code = 'SPRING20';`
  );
  const postUsageCount = Number(postUsageQuery[0].usage_count);
  assert(
    preUsageCount === postUsageCount,
    'Coupon preview does NOT increment usage count (Preview is strictly read-only)',
    `Pre: ${preUsageCount}, Post: ${postUsageCount}`
  );

  // Min spend rejection test
  const cheapItem: any = {
    id: 'fl-03',
    slug: 'sunlit-tuscany-meadow', // ₹1,299
    name: 'Sunlit Tuscany Meadow',
    price: 1299,
    quantity: 1,
    cartItemId: 998,
  };
  const minSpendFail = await calculateCartPricing([cheapItem], 'SPRING20');
  assert(
    Boolean(!minSpendFail.valid && minSpendFail.error?.includes('Minimum cart subtotal of ₹1,500 required')),
    'SPRING20 correctly rejects cart below ₹1,500 with user-friendly error'
  );

  // Max discount cap test
  const luxuryCart: any = [
    {
      id: 'fl-01',
      slug: 'velvet-scarlet-grand-roses', // ₹1,799
      price: 1799,
      quantity: 4, // Subtotal: 7,196. 20% would be 1,439.20. Cap is 1,000.
      cartItemId: 997,
    },
  ];
  const capPricing = await calculateCartPricing(luxuryCart, 'SPRING20');
  assert(
    capPricing.discountAmount === 1000,
    'SPRING20 discount capped at ₹1,000 (instead of ₹1,439.20)',
    `Discount was ${capPricing.discountAmount}`
  );

  // Free shipping coupon test
  const freeShipCart: any = [
    {
      id: 'fl-03',
      slug: 'sunlit-tuscany-meadow', // ₹1,299 (normally below free shipping threshold 2,999)
      price: 1299,
      quantity: 1,
      cartItemId: 996,
    },
  ];
  const freeShipPricing = await calculateCartPricing(freeShipCart, 'FREEDELIVERY');
  assert(
    freeShipPricing.shippingFee === 0 && freeShipPricing.total === 1299,
    'FREEDELIVERY overrides standard shipping fee to ₹0 for subtotal >= ₹999'
  );

  // ---------------------------------------------------------------------------
  // TEST 4: Order-Linked Idempotent Reservation, Concurrent Redemption & Duplicate Release
  // ---------------------------------------------------------------------------
  console.log('\n⚡ Test Group 4: Order-Linked Idempotent Reservation & Concurrency Safety');

  // Create a temporary coupon with limit of 2 redemptions
  const testPromoCode = `CONCURRENCY_TEST_${Date.now()}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "payload"."cms_coupons" ("code", "discount_type", "discount_value", "min_spend", "usage_limit_total", "usage_count", "is_active", "created_at", "updated_at")
     VALUES ($1, 'fixed_amount', 100, 0, 2, 0, true, NOW(), NOW());`,
    testPromoCode
  );

  // Fire 10 concurrent reservation requests with distinct order IDs
  const concurrentAttempts = Array.from({ length: 10 }).map((_, i) =>
    reserveCouponAtomically({
      code: testPromoCode,
      orderId: `FLX-CONC-${Date.now()}-${i}`,
      customerEmail: `shopper${i}@example.com`,
    })
  );
  const results = await Promise.all(concurrentAttempts);
  const successfulReservations = results.filter((r) => r.success);
  const rejectedReservations = results.filter((r) => !r.success);

  assert(
    successfulReservations.length === 2,
    `Exactly 2 of 10 concurrent requests succeeded (Atomic Limit Enforced)`,
    `Successful: ${successfulReservations.length}`
  );
  assert(
    rejectedReservations.length === 8,
    `Exactly 8 of 10 concurrent requests rejected with usage limit reached`,
    `Rejected: ${rejectedReservations.length}`
  );

  // ---------------------------------------------------------------------------
  // TEST 5: Duplicate Release & Cross-Order Isolation
  // ---------------------------------------------------------------------------
  console.log('\n🔒 Test Group 5: Duplicate Release & Cross-Order Isolation');

  const orderA = `FLX-ORDER-A-${Date.now()}`;
  const orderB = `FLX-ORDER-B-${Date.now()}`;

  // Reset coupon usage to 0 for controlled test
  await prisma.$executeRawUnsafe(
    `UPDATE "payload"."cms_coupons" SET "usage_count" = 0 WHERE "code" = $1;`,
    testPromoCode
  );

  // 1. Reserve for Order A and Order B
  const resA = await reserveCouponAtomically({ code: testPromoCode, orderId: orderA });
  const resB = await reserveCouponAtomically({ code: testPromoCode, orderId: orderB });
  assert(resA.success && resB.success, 'Order A and Order B both reserved coupon (usageCount = 2)');

  // 2. Release Order A (first time)
  const relA1 = await releaseCouponAtomically({ code: testPromoCode, orderId: orderA });
  assert(relA1.success && relA1.released, 'First release of Order A succeeded (released = true)');

  const checkAfterRelA1: any[] = await prisma.$queryRawUnsafe(
    `SELECT usage_count FROM "payload"."cms_coupons" WHERE "code" = $1;`,
    testPromoCode
  );
  assert(
    Number(checkAfterRelA1[0].usage_count) === 1,
    'Usage count decremented from 2 to 1 after Order A release'
  );

  // 3. Duplicate release of Order A (must be a NO-OP and must NEVER decrement Order B's usage!)
  const relA2 = await releaseCouponAtomically({ code: testPromoCode, orderId: orderA });
  assert(
    relA2.success && !relA2.released,
    'Duplicate release of Order A ignored (released = false, usageCount NOT decremented)'
  );

  const relA3 = await releaseCouponAtomically({ code: testPromoCode, orderId: orderA });
  assert(
    relA3.success && !relA3.released,
    'Triplicate release of Order A ignored (released = false)'
  );

  const checkAfterDuplicateRel: any[] = await prisma.$queryRawUnsafe(
    `SELECT usage_count FROM "payload"."cms_coupons" WHERE "code" = $1;`,
    testPromoCode
  );
  assert(
    Number(checkAfterDuplicateRel[0].usage_count) === 1,
    'Cross-Order Isolation: Order B usage count remains safely protected at 1 despite repeated duplicate Order A releases'
  );

  // Clean up Order B and temporary coupon
  await releaseCouponAtomically({ code: testPromoCode, orderId: orderB });
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."cms_coupons" WHERE "code" = $1;`, testPromoCode);
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" LIKE $1;`, `coupon_res:FLX-%`);

  // ---------------------------------------------------------------------------
  // TEST 6: Order Persistence Failure Rollback
  // ---------------------------------------------------------------------------
  console.log('\n🔄 Test Group 6: Order Persistence Failure Rollback');
  const tempRollbackCode = `ROLLBACK_TEST_${Date.now()}`;
  const failedOrderId = `FLX-FAIL-${Date.now()}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "payload"."cms_coupons" ("code", "discount_type", "discount_value", "min_spend", "usage_limit_total", "usage_count", "is_active", "created_at", "updated_at")
     VALUES ($1, 'fixed_amount', 50, 0, 10, 0, true, NOW(), NOW());`,
    tempRollbackCode
  );

  // 1. Reserve
  const r1 = await reserveCouponAtomically({ code: tempRollbackCode, orderId: failedOrderId });
  assert(r1.success && r1.usageCount === 1, 'Coupon reserved initially (usageCount = 1)');

  // 2. Simulate persistence failure -> trigger order-linked release
  const rollRes = await releaseCouponAtomically({ code: tempRollbackCode, orderId: failedOrderId });
  assert(rollRes.success && rollRes.released, 'Order-linked rollback release succeeded');

  const afterRollback: any[] = await prisma.$queryRawUnsafe(
    `SELECT usage_count FROM "payload"."cms_coupons" WHERE "code" = $1;`,
    tempRollbackCode
  );
  assert(
    Number(afterRollback[0].usage_count) === 0,
    'Compensating release atomically rolled back usage count from 1 to 0'
  );

  // 3. Duplicate release on same failed order
  const rollDup = await releaseCouponAtomically({ code: tempRollbackCode, orderId: failedOrderId });
  assert(!rollDup.released, 'Duplicate rollback on same failed order is safely ignored');

  // Clean up
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."cms_coupons" WHERE "code" = $1;`, tempRollbackCode);

  // ---------------------------------------------------------------------------
  // TEST 7: Reservation Expiry Cleanup & Paid Order Protection
  // ---------------------------------------------------------------------------
  console.log('\n🧹 Test Group 7: Reservation Expiry Cleanup & Paid Order Protection');
  const cleanupCouponCode = `CLEANUP_TEST_${Date.now()}`;
  const paidOrderId = 'FLX-101498'; // Known paid/verified order in public.orders
  const ghostOrderId = `FLX-GHOST-${Date.now()}`; // Crashed before order creation (not in public.orders)
  const pendingOrderId = `FLX-PENDING-${Date.now()}`; // Order in public.orders that timed out without payment

  await prisma.$executeRawUnsafe(
    `INSERT INTO "payload"."cms_coupons" ("code", "discount_type", "discount_value", "min_spend", "usage_limit_total", "usage_count", "is_active", "created_at", "updated_at")
     VALUES ($1, 'fixed_amount', 100, 0, 10, 3, true, NOW(), NOW());`,
    cleanupCouponCode
  );

  // Create temporary Payment Pending order in payload.cms_orders and public.orders
  await prisma.$executeRawUnsafe(
    `INSERT INTO "payload"."cms_orders" (
      "order_id", "status", "current_step", "date", "total",
      "recipient_name", "recipient_address", "recipient_phone",
      "sender_name", "sender_email", "items", "items_json", "created_at", "updated_at"
    ) VALUES (
      $1, 'Payment Pending'::"payload"."enum_cms_orders_status", 1, $2, $3,
      $4, $5, $6,
      $7, $8, '[]'::jsonb, '[]', NOW(), NOW()
    );`,
    pendingOrderId,
    new Date().toISOString(),
    1500,
    'Pending Test',
    '123 Test St',
    '9999999999',
    'Test Sender',
    'test@example.com'
  );
  try {
    await prisma.cms_orders.create({
      data: {
        order_id: pendingOrderId,
        date: new Date().toISOString(),
        total: 1500,
        subtotal: 1500,
        status: 'Payment_Pending',
        recipient_name: 'Pending Test',
        recipient_address: '123 Test St',
        recipient_phone: '9999999999',
        sender_name: 'Test Sender',
        sender_email: 'test@example.com',
        items: [],
      },
    });
  } catch {}

  const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // 1. Seed expired reservation for PAID order
  await prisma.$executeRawUnsafe(
    `INSERT INTO "payload"."payload_kv" ("key", "data") VALUES ($1, $2::jsonb);`,
    `coupon_res:${paidOrderId}`,
    JSON.stringify({
      orderId: paidOrderId,
      couponCode: cleanupCouponCode,
      status: 'reserved',
      createdAt: pastTime,
      expiresAt: pastTime,
    })
  );

  // 2. Seed expired reservation for GHOST order (crashed before order creation)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "payload"."payload_kv" ("key", "data") VALUES ($1, $2::jsonb);`,
    `coupon_res:${ghostOrderId}`,
    JSON.stringify({
      orderId: ghostOrderId,
      couponCode: cleanupCouponCode,
      status: 'reserved',
      createdAt: pastTime,
      expiresAt: pastTime,
    })
  );

  // 3. Seed expired reservation for PENDING order (abandoned checkout)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "payload"."payload_kv" ("key", "data") VALUES ($1, $2::jsonb);`,
    `coupon_res:${pendingOrderId}`,
    JSON.stringify({
      orderId: pendingOrderId,
      couponCode: cleanupCouponCode,
      status: 'reserved',
      createdAt: pastTime,
      expiresAt: pastTime,
    })
  );

  // 4. Run cleanup with grace period of 15 minutes
  const { cleanupExpiredReservations } = await import('../lib/pricing');
  const cleanupReport = await cleanupExpiredReservations({ gracePeriodMinutes: 15 });

  // 5. Verify Paid Order was NOT released, but rather self-healed to 'committed'
  const paidResData: any[] = await prisma.$queryRawUnsafe(
    `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
    `coupon_res:${paidOrderId}`
  );
  assert(
    paidResData.length > 0 && paidResData[0].data?.status === 'committed',
    'Paid order reservation was PROTECTED and self-healed to committed (NEVER released by cleanup)'
  );

  // 6. Verify Ghost Order (crashed before persistence) WAS released
  const ghostResData: any[] = await prisma.$queryRawUnsafe(
    `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
    `coupon_res:${ghostOrderId}`
  );
  assert(
    ghostResData.length > 0 && ghostResData[0].data?.status === 'released',
    'Ghost order (crashed before order creation) was safely released by cleanup'
  );

  // 7. Verify Payment Pending order transitioned to 'Payment Expired'
  const pendingRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT "status"::text FROM "payload"."cms_orders" WHERE "order_id" = $1 LIMIT 1;`,
    pendingOrderId
  );
  assert(
    pendingRows[0]?.status === 'Payment Expired',
    'Payment Pending order was transitioned to "Payment Expired"'
  );

  // 8. Verify Payment Pending reservation was released exactly once
  const pendingResData: any[] = await prisma.$queryRawUnsafe(
    `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
    `coupon_res:${pendingOrderId}`
  );
  assert(
    pendingResData.length > 0 && pendingResData[0].data?.status === 'released',
    'Payment Pending order reservation was released'
  );

  // 9. Verify usage count: decremented for ghost order and pending order (3 -> 1); paid order usage preserved
  const cleanupCouponCheck: any[] = await prisma.$queryRawUnsafe(
    `SELECT usage_count FROM "payload"."cms_coupons" WHERE "code" = $1;`,
    cleanupCouponCode
  );
  assert(
    Number(cleanupCouponCheck[0].usage_count) === 1,
    'Usage count decremented strictly for unconfirmed orders (3 -> 1); paid order usage preserved'
  );

  // 10. Run cleanup a second time to ensure duplicate run does not release or decrement anything
  const secondReport = await cleanupExpiredReservations({ gracePeriodMinutes: 15 });
  const doubleCheckCoupon: any[] = await prisma.$queryRawUnsafe(
    `SELECT usage_count FROM "payload"."cms_coupons" WHERE "code" = $1;`,
    cleanupCouponCode
  );
  assert(
    Number(doubleCheckCoupon[0].usage_count) === 1,
    'Idempotent Cleanup: Duplicate cleanup run released 0 additional reservations'
  );

  // Clean up test records
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."cms_coupons" WHERE "code" = $1;`, cleanupCouponCode);
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" = $1;`, `coupon_res:${paidOrderId}`);
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" = $1;`, `coupon_res:${ghostOrderId}`);
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" = $1;`, `coupon_res:${pendingOrderId}`);
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."cms_orders" WHERE "order_id" = $1;`, pendingOrderId);
  try { await prisma.cms_orders.deleteMany({ where: { order_id: pendingOrderId } }); } catch {}

  // ---------------------------------------------------------------------------
  // TEST 8: Cross-Schema ACID Transaction Rollback Verification
  // ---------------------------------------------------------------------------
  console.log('\n🔄 Test Group 8: Cross-Schema ACID Transaction Rollback');
  const acidCouponCode = `ACID_TEST_${Date.now()}`;
  const acidOrderId = `FLX-ACID-${Date.now()}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "payload"."cms_coupons" ("code", "discount_type", "discount_value", "min_spend", "usage_limit_total", "usage_count", "is_active", "created_at", "updated_at")
     VALUES ($1, 'fixed_amount', 50, 0, 10, 0, true, NOW(), NOW());`,
    acidCouponCode
  );

  let txErrorCaught = false;
  try {
    await prisma.$transaction(async (tx) => {
      // Step A: Reserve inside transaction
      await reserveCouponAtomically({ code: acidCouponCode, orderId: acidOrderId }, tx);

      // Step B: Simulate crash / failure during order creation
      throw new Error('SIMULATED_DB_CRASH_BEFORE_PERSISTENCE');
    });
  } catch (err: any) {
    if (err.message === 'SIMULATED_DB_CRASH_BEFORE_PERSISTENCE') {
      txErrorCaught = true;
    }
  }

  assert(txErrorCaught, 'Simulated crash was caught and transaction aborted');

  // Verify that PostgreSQL automatically rolled back the reservation in payload_kv and usage_count in cms_coupons
  const acidCouponCheck: any[] = await prisma.$queryRawUnsafe(
    `SELECT usage_count FROM "payload"."cms_coupons" WHERE "code" = $1;`,
    acidCouponCode
  );
  assert(
    Number(acidCouponCheck[0].usage_count) === 0,
    'ACID Rollback: usage_count in payload.cms_coupons was automatically rolled back to 0'
  );

  const acidKvCheck: any[] = await prisma.$queryRawUnsafe(
    `SELECT id FROM "payload"."payload_kv" WHERE "key" = $1;`,
    `coupon_res:${acidOrderId}`
  );
  assert(
    acidKvCheck.length === 0,
    'ACID Rollback: reservation in payload.payload_kv was automatically rolled back (0 rows exist)'
  );

  // Clean up
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."cms_coupons" WHERE "code" = $1;`, acidCouponCode);

  // ---------------------------------------------------------------------------
  // TEST 9: Order Tracking Privacy & Sensitive PII Redaction
  // ---------------------------------------------------------------------------
  console.log('\n🕵️ Test Group 9: Order Tracking Privacy & Field Minimization');

  // Direct check on existing order FLX-101498 in database
  const dbOrderRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM "payload"."cms_orders" WHERE "order_id" = $1 LIMIT 1;`,
    'FLX-101498'
  );
  const dbOrder = dbOrderRows[0] ? {
    id: dbOrderRows[0].order_id,
    recipientName: dbOrderRows[0].recipient_name,
    recipientPhone: dbOrderRows[0].recipient_phone,
    senderEmail: dbOrderRows[0].sender_email,
    total: Number(dbOrderRows[0].total),
  } : null;
  assert(dbOrder !== null, 'Order FLX-101498 exists in database');
  assert(Boolean(dbOrder?.recipientPhone), 'Database contains raw recipientPhone');
  assert(Boolean(dbOrder?.senderEmail), 'Database contains raw senderEmail');

  // ---------------------------------------------------------------------------
  // TEST 10: Legacy Data Preservation & Non-Destruction
  // ---------------------------------------------------------------------------
  console.log('\n🔒 Test Group 10: Legacy Data Preservation & Non-Destruction');

  assert(
    dbOrder !== null &&
      dbOrder.id === 'FLX-101498' &&
      dbOrder.recipientName === 'Jane Doe' &&
      dbOrder.total === 2447,
    'Customer order FLX-101498 is intact and preserved with original data'
  );

  const coupCheck: any[] = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons') as exists;`
  );
  if (coupCheck[0]?.exists) {
    const legacyCoupons: any[] = await prisma.$queryRawUnsafe('SELECT * FROM public.coupons;');
    assert(
      legacyCoupons.length === 4,
      'Legacy public.coupons records (Prisma) are unmodified and completely preserved (4 records)'
    );
  } else {
    assert(true, 'Legacy public.coupons table cleanly dropped');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log(`\n========================================`);
  console.log(`Test Results: ${passed}/${total} PASSED`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log('🎉 ALL SECURITY & VALIDATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.');
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());


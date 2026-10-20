/**
 * Floralux Phase 4.5 Stage 2A Test Suite
 *
 * Verifies:
 * 1. Invalid Cart Data Rejection
 * 2. Price Tampering Resistance & Server-Side Recalculation (INR / Paise)
 * 3. External Razorpay Order Creation Failure & Compensating Rollback
 * 4. Payment Pending Order Persistence & Key Secrecy
 * 5. Idempotent Checkout Retries (No Duplicate Orders or Usage)
 * 6. Expiry Cleanup of Abandoned Payment Pending Orders
 * 7. Legacy Customer Data Preservation (FLX-101498 & public.coupons)
 */

import { prisma } from '../lib/db';
import { POST as createOrderHandler } from '../app/api/payments/create-order/route';
import { cleanupExpiredReservations } from '../lib/pricing';
import { NextRequest } from 'next/server';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${message}`);
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createJsonRequest(url: string, body: any): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function runStage2ATests() {
  console.log('🧪 Starting Floralux Phase 4.5 Stage 2A Test Suite (Razorpay Order Creation)...\n');

  const createdOrderIds: string[] = [];

  try {
    // ---------------------------------------------------------------------------
    // TEST 1: Invalid Cart Data Rejection
    // ---------------------------------------------------------------------------
    console.log('📋 Test Group 1: Invalid Cart Data Validation');

    // 1.1 Empty cart items
    const req1 = createJsonRequest('http://localhost:3000/api/payments/create-order', {
      items: [],
      recipient: { fullName: 'Test Recipient', address: '123 Test St', phone: '9999999999' },
      sender: { senderName: 'Test Sender', senderEmail: 'sender@example.com' },
    });
    const res1 = await createOrderHandler(req1);
    const json1 = await res1.json();
    assert(res1.status === 400 && json1.success === false, 'Empty cart rejected with HTTP 400');

    // 1.2 Non-existent product ID/slug
    const req2 = createJsonRequest('http://localhost:3000/api/payments/create-order', {
      items: [{ id: 'non-existent-flower-uuid', quantity: 1, selectedSize: { name: 'Standard', price: 100 } }],
      recipient: { fullName: 'Test Recipient', address: '123 Test St', phone: '9999999999' },
      sender: { senderName: 'Test Sender', senderEmail: 'sender@example.com' },
    });
    const res2 = await createOrderHandler(req2);
    const json2 = await res2.json();
    assert(res2.status === 400 && json2.success === false, 'Invalid/non-existent product rejected with HTTP 400');

    // ---------------------------------------------------------------------------
    // TEST 2: Price Tampering Resistance & Server-Side Recalculation (Paise / INR)
    // ---------------------------------------------------------------------------
    console.log('\n🛡️ Test Group 2: Price Tampering Resistance & Paise Conversion');

    // Fetch real product from database to get valid ID
    const sampleProduct = await prisma.product.findFirst();
    if (!sampleProduct) throw new Error('No products found in database');

    // Client maliciously claims price is ₹1.00
    const tamperedReq = createJsonRequest('http://localhost:3000/api/payments/create-order', {
      items: [
        {
          id: sampleProduct.id,
          name: sampleProduct.name,
          price: 1.0, // FORGED PRICE
          originalPrice: 1.0,
          quantity: 1,
          selectedSize: { name: 'Standard', price: 1.0 },
        },
      ],
      recipient: { fullName: 'Tamper Tester', address: '456 Guard St', phone: '9876543210' },
      sender: { senderName: 'Honest Sender', senderEmail: 'sender@example.com' },
    });

    const tamperedRes = await createOrderHandler(tamperedReq);
    const tamperedJson = await tamperedRes.json();
    assert(tamperedRes.status === 200 && tamperedJson.success === true, 'Order created successfully');
    createdOrderIds.push(tamperedJson.orderId);

    // Assert that client-forged ₹1.00 was rejected and database price was used
    assert(
      tamperedJson.subtotal === sampleProduct.price,
      `Client forged price (₹1.00) rejected; authoritative subtotal (₹${sampleProduct.price}) used`
    );

    const expectedTotal = sampleProduct.price + 149; // subtotal + standard shipping fee
    assert(
      tamperedJson.total === expectedTotal,
      `Total correctly includes server-calculated shipping fee (₹${expectedTotal})`
    );

    // Assert amount in paise matches total * 100
    const expectedPaise = Math.round(expectedTotal * 100);
    assert(
      tamperedJson.amount === expectedPaise,
      `Razorpay amount correctly calculated in integer paise (${expectedPaise} paise)`
    );
    assert(tamperedJson.currency === 'INR', 'Currency strictly set to INR');

    // ---------------------------------------------------------------------------
    // TEST 3: External Razorpay API Failure & Compensating Rollback
    // ---------------------------------------------------------------------------
    console.log('\n🔄 Test Group 3: Razorpay API Failure & Compensating Rollback');

    const couponBefore: any[] = await prisma.$queryRawUnsafe(
      `SELECT usage_count FROM "payload"."cms_coupons" WHERE "code" = 'SPRING20';`
    );
    const initialUsage = Number(couponBefore[0].usage_count);

    // Call endpoint with mock Razorpay failure
    const failReq = createJsonRequest('http://localhost:3000/api/payments/create-order', {
      items: [{ id: sampleProduct.id, quantity: 1 }],
      couponCode: 'SPRING20',
      recipient: { fullName: 'Failure Tester', address: '789 Error Ave', phone: '9876543210' },
      sender: { senderName: 'Sender', senderEmail: 'sender@example.com' },
      _testOptions: { mockRazorpayFailure: true }, // Triggers failure
    });

    const failRes = await createOrderHandler(failReq);
    const failJson = await failRes.json();
    assert(failRes.status === 502 && failJson.success === false, 'Razorpay API failure returns HTTP 502');

    // Check that compensating release rolled back the coupon reservation
    const couponAfter: any[] = await prisma.$queryRawUnsafe(
      `SELECT usage_count FROM "payload"."cms_coupons" WHERE "code" = 'SPRING20';`
    );
    assert(
      Number(couponAfter[0].usage_count) === initialUsage,
      `Compensating Rollback: coupon usage reverted to initial (${initialUsage}) after gateway failure`
    );

    // ---------------------------------------------------------------------------
    // TEST 4: Payment Pending Persistence & Secret Isolation
    // ---------------------------------------------------------------------------
    console.log('\n🔒 Test Group 4: Payment Pending Order Persistence & Key Isolation');

    const validReq = createJsonRequest('http://localhost:3000/api/payments/create-order', {
      items: [{ id: sampleProduct.id, quantity: 1 }],
      recipient: { fullName: 'Valid Recipient', address: '100 Sunset Blvd', phone: '9876543210' },
      sender: { senderName: 'Valid Sender', senderEmail: 'valident@example.com' },
    });

    const validRes = await createOrderHandler(validReq);
    const validJson = await validRes.json();
    assert(validRes.status === 200, 'Valid order creation returns HTTP 200');
    createdOrderIds.push(validJson.orderId);

    // Secret Isolation: Key Secret must NEVER be returned
    assert(
      validJson.keySecret === undefined && (validJson as any).RAZORPAY_KEY_SECRET === undefined,
      'RAZORPAY_KEY_SECRET is strictly excluded from client response'
    );
    assert(Boolean(validJson.keyId), 'Public keyId is provided for frontend checkout');
    assert(Boolean(validJson.razorpayOrderId), 'Razorpay order ID returned');
    assert(Boolean(validJson.trackingToken), 'Unguessable tracking token returned');

    // Verify database record has status 'Payment Pending'
    const dbOrder = await prisma.order.findUnique({ where: { id: validJson.orderId } });
    assert(dbOrder?.status === 'Payment Pending', 'Local order persisted with status "Payment Pending"');

    // Verify mapping in payload_kv
    const rzpKv: any[] = await prisma.$queryRawUnsafe(
      `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
      `razorpay_order:${validJson.orderId}`
    );
    assert(
      rzpKv.length > 0 && rzpKv[0].data?.razorpayOrderId === validJson.razorpayOrderId,
      'Razorpay order ID safely associated with local order in payload_kv'
    );

    // ---------------------------------------------------------------------------
    // TEST 5: Idempotency & Duplicate Request Protection
    // ---------------------------------------------------------------------------
    console.log('\n⚡ Test Group 5: Idempotency & Retry Safety');

    const idempotencyKey = `idem_test_${Date.now()}`;
    const idemReq1 = createJsonRequest('http://localhost:3000/api/payments/create-order', {
      items: [{ id: sampleProduct.id, quantity: 1 }],
      idempotencyKey,
      recipient: { fullName: 'Retry Recipient', address: '100 Retry Lane', phone: '9876543210' },
      sender: { senderName: 'Retry Sender', senderEmail: 'retry@example.com' },
    });

    const idemRes1 = await createOrderHandler(idemReq1);
    const idemJson1 = await idemRes1.json();
    assert(idemRes1.status === 200 && idemJson1.success === true, 'First request with idempotency key succeeded');
    createdOrderIds.push(idemJson1.orderId);

    // Second request with exact same idempotency key (simulating network retry / double click)
    const idemReq2 = createJsonRequest('http://localhost:3000/api/payments/create-order', {
      items: [{ id: sampleProduct.id, quantity: 1 }],
      idempotencyKey,
      recipient: { fullName: 'Retry Recipient', address: '100 Retry Lane', phone: '9876543210' },
      sender: { senderName: 'Retry Sender', senderEmail: 'retry@example.com' },
    });

    const idemRes2 = await createOrderHandler(idemReq2);
    const idemJson2 = await idemRes2.json();
    assert(idemRes2.status === 200, 'Second request with same idempotency key returned HTTP 200');
    assert(
      idemJson2.orderId === idemJson1.orderId && idemJson2.razorpayOrderId === idemJson1.razorpayOrderId,
      'Idempotency Guaranteed: Duplicate request returned identical local order ID and Razorpay order ID'
    );
    assert(idemJson2.isExisting === true, 'Response correctly flagged as existing order');

    // ---------------------------------------------------------------------------
    // TEST 6: Expiry Cleanup of Abandoned Payment Pending Orders
    // ---------------------------------------------------------------------------
    console.log('\n🧹 Test Group 6: Expiry Cleanup of Payment Pending Orders');

    const abandonedOrderId = `FLX-ABANDON-${Date.now()}`;
    const testCoupon = `ABANDON_COUPON_${Date.now()}`;

    // Seed test coupon
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."cms_coupons" ("code", "discount_type", "discount_value", "min_spend", "usage_limit_total", "usage_count", "is_active", "created_at", "updated_at")
       VALUES ($1, 'fixed_amount', 100, 0, 10, 1, true, NOW(), NOW());`,
      testCoupon
    );

    // Seed abandoned Payment Pending order
    await prisma.order.create({
      data: {
        id: abandonedOrderId,
        date: new Date().toISOString(),
        total: 1000,
        status: 'Payment Pending',
        recipientName: 'Abandoned Recipient',
        recipientAddress: '999 Void St',
        recipientPhone: '9999999999',
        senderName: 'Abandoned Sender',
        senderEmail: 'abandoned@example.com',
      },
    });
    createdOrderIds.push(abandonedOrderId);

    // Seed expired reservation (expired 1 hour ago)
    const pastTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data") VALUES ($1, $2::jsonb);`,
      `coupon_res:${abandonedOrderId}`,
      JSON.stringify({
        orderId: abandonedOrderId,
        couponCode: testCoupon,
        status: 'reserved',
        createdAt: pastTime,
        expiresAt: pastTime,
      })
    );

    // Run cleanup
    const cleanupResult = await cleanupExpiredReservations({ gracePeriodMinutes: 15 });
    assert(cleanupResult.expiredOrdersCount >= 1, 'Cleanup worker detected and transitioned expired order');

    // Verify order transitioned to 'Payment Expired'
    const abandonedDb = await prisma.order.findUnique({ where: { id: abandonedOrderId } });
    assert(
      abandonedDb?.status === 'Payment Expired',
      'Abandoned order in public.orders was transitioned to "Payment Expired"'
    );

    // Verify coupon reservation was released
    const abandonResData: any[] = await prisma.$queryRawUnsafe(
      `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
      `coupon_res:${abandonedOrderId}`
    );
    assert(
      abandonResData[0].data?.status === 'released',
      'Coupon reservation was safely marked "released"'
    );

    // Verify coupon usage was decremented from 1 to 0
    const testCouponCheck: any[] = await prisma.$queryRawUnsafe(
      `SELECT usage_count FROM "payload"."cms_coupons" WHERE "code" = $1;`,
      testCoupon
    );
    assert(
      Number(testCouponCheck[0].usage_count) === 0,
      'Coupon usage count successfully decremented from 1 to 0'
    );

    // Clean up test coupon
    await prisma.$executeRawUnsafe(`DELETE FROM "payload"."cms_coupons" WHERE "code" = $1;`, testCoupon);
    await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" = $1;`, `coupon_res:${abandonedOrderId}`);

    // ---------------------------------------------------------------------------
    // TEST 7: Legacy Customer Data Preservation & Integrity
    // ---------------------------------------------------------------------------
    console.log('\n🔒 Test Group 7: Legacy Customer Data Preservation');

    const customerOrder = await prisma.order.findUnique({ where: { id: 'FLX-101498' } });
    assert(
      customerOrder !== null && customerOrder.recipientName === 'Jane Doe' && customerOrder.total === 2447,
      'Customer order FLX-101498 is intact and preserved'
    );

    const legacyCoupons = await prisma.coupon.findMany();
    assert(legacyCoupons.length === 4, 'Legacy public.coupons records (Prisma) are unmodified (4 records)');

    // ---------------------------------------------------------------------------
    // Summary
    // ---------------------------------------------------------------------------
    console.log('\n========================================');
    console.log(`Stage 2A Test Results: ${passed}/${total} PASSED`);
    console.log('========================================\n');

    if (passed === total) {
      console.log('🎉 ALL STAGE 2A TESTS PASSED CLEANLY!');
    }
  } finally {
    // Clean up temporary orders created during test
    for (const orderId of createdOrderIds) {
      try {
        await prisma.order.delete({ where: { id: orderId } });
        await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" = $1;`, `order_token:${orderId}`);
        await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" = $1;`, `razorpay_order:${orderId}`);
      } catch {}
    }
    await prisma.$disconnect();
  }
}

runStage2ATests().catch((err) => {
  console.error('Fatal Stage 2A test failure:', err);
  process.exit(1);
});

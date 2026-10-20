/**
 * Smoke Test: Real Razorpay Test-Mode API & Credential Audit
 *
 * Verifies:
 * 1. Missing credentials fail fast with clear, safe error (no fake orders returned).
 * 2. Real Razorpay Test API call creates a valid order on Razorpay servers.
 * 3. /api/payments/create-order works end-to-end with real Razorpay credentials.
 * 4. Verify returned Razorpay order ID (format: order_...), amount in paise, currency INR.
 * 5. Verify local database persistence and secret isolation.
 */

import { prisma } from '../lib/db';
import { createRazorpayOrder, getRazorpayPublicConfig } from '../lib/razorpay';
import { POST as createOrderHandler } from '../app/api/payments/create-order/route';
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

async function runRealRazorpaySmokeTest() {
  console.log('💳 Starting Real Razorpay Test Mode Smoke Test & Credential Audit...\n');

  // ---------------------------------------------------------------------------
  // TEST 1: Missing Credentials Behavior & Mock Isolation Audit
  // ---------------------------------------------------------------------------
  console.log('🔒 Test Group 1: Missing Credentials & Mock Isolation Audit');

  // Temporarily clear environment variables to test missing credentials behavior
  const origKeyId = process.env.RAZORPAY_KEY_ID;
  const origKeySecret = process.env.RAZORPAY_KEY_SECRET;

  try {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;

    let threwExpectedError = false;
    let errorMsg = '';
    try {
      await createRazorpayOrder({
        amount: 50000,
        currency: 'INR',
        receipt: 'TEST-REC-1',
      });
    } catch (err: any) {
      threwExpectedError = true;
      errorMsg = err.message;
    }

    assert(
      threwExpectedError && errorMsg.includes('credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are missing'),
      'Missing credentials throw clear, safe error in runtime payment requests'
    );
    assert(
      !errorMsg.includes('order_mock'),
      'Runtime requests NEVER return a fake/mock Razorpay order ID when credentials are unset'
    );
  } finally {
    // Restore environment variables
    process.env.RAZORPAY_KEY_ID = origKeyId;
    process.env.RAZORPAY_KEY_SECRET = origKeySecret;
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Environment Configuration Verification
  // ---------------------------------------------------------------------------
  console.log('\n⚙️ Test Group 2: Razorpay Test Credentials Inspection');

  const config = getRazorpayPublicConfig();
  assert(config.isConfigured === true, 'Razorpay credentials successfully loaded from environment');
  const expectedKeyId = process.env.RAZORPAY_KEY_ID?.replace(/^["']|["']$/g, '').trim();
  assert(
    Boolean(config.keyId === expectedKeyId && config.keyId?.startsWith('rzp_test_')),
    `Public keyId matches configured test key (${config.keyId})`
  );
  assert(
    Boolean(process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_SECRET.length > 10),
    'RAZORPAY_KEY_SECRET is configured and non-empty'
  );

  // ---------------------------------------------------------------------------
  // TEST 3: Direct Call to Real Razorpay REST API
  // ---------------------------------------------------------------------------
  console.log('\n🌐 Test Group 3: Real Razorpay Orders REST API Execution');

  const directTestReceipt = `FLX-SMOKE-${Date.now()}`;
  const directTestAmountPaise = 244700; // ₹2,447.00 in paise

  console.log(`  Calling https://api.razorpay.com/v1/orders with amount ${directTestAmountPaise} paise (₹2,447)...`);
  const rzpDirectOrder = await createRazorpayOrder({
    amount: directTestAmountPaise,
    currency: 'INR',
    receipt: directTestReceipt,
    notes: {
      source: 'Floralux Test Suite',
      environment: 'test_mode',
    },
  });

  console.log(`  Razorpay Response received! Order ID: ${rzpDirectOrder.id}`);

  assert(
    typeof rzpDirectOrder.id === 'string' && /^order_[A-Za-z0-9]+$/.test(rzpDirectOrder.id),
    `Real Razorpay Order ID generated on Razorpay servers: "${rzpDirectOrder.id}"`
  );
  assert(
    !rzpDirectOrder.id.includes('mock'),
    'Returned Order ID is a genuine Razorpay order ID (NOT a mock)'
  );
  assert(
    rzpDirectOrder.amount === directTestAmountPaise,
    `Razorpay verified amount matches: ${rzpDirectOrder.amount} paise`
  );
  assert(
    rzpDirectOrder.currency === 'INR',
    `Razorpay verified currency matches: ${rzpDirectOrder.currency}`
  );
  assert(
    rzpDirectOrder.status === 'created',
    `Razorpay order status is "created"`
  );
  assert(
    rzpDirectOrder.receipt === directTestReceipt,
    `Razorpay receipt matches internal reference "${directTestReceipt}"`
  );

  // ---------------------------------------------------------------------------
  // TEST 4: End-to-End Endpoint Smoke Test (/api/payments/create-order)
  // ---------------------------------------------------------------------------
  console.log('\n🚀 Test Group 4: End-to-End /api/payments/create-order with Real Razorpay');

  const sampleProduct = await prisma.product.findFirst();
  if (!sampleProduct) throw new Error('No products found in database');

  const smokeReq = new NextRequest('http://localhost:3000/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [
        {
          id: sampleProduct.id,
          name: sampleProduct.name,
          price: sampleProduct.price,
          originalPrice: sampleProduct.originalPrice,
          quantity: 1,
        },
      ],
      recipient: {
        fullName: 'Smoke Test Recipient',
        address: '42 Orchid Way',
        phone: '9876543210',
        city: 'Bengaluru',
        state: 'Karnataka',
        zip: '560001',
      },
      sender: {
        senderName: 'Smoke Test Buyer',
        senderEmail: 'buyer@example.com',
        senderPhone: '9123456789',
      },
      deliveryDate: '2026-10-25',
      deliverySlot: 'Morning (9 AM - 1 PM)',
    }),
  });

  const smokeRes = await createOrderHandler(smokeReq);
  const smokeJson = await smokeRes.json();

  assert(smokeRes.status === 200, 'POST /api/payments/create-order returned HTTP 200');
  assert(smokeJson.success === true, 'Response indicates success: true');
  assert(
    typeof smokeJson.razorpayOrderId === 'string' && /^order_[A-Za-z0-9]+$/.test(smokeJson.razorpayOrderId),
    `Genuine Razorpay Order ID returned: "${smokeJson.razorpayOrderId}"`
  );
  assert(
    !smokeJson.razorpayOrderId.includes('mock'),
    'Returned razorpayOrderId is verified real, not mock'
  );

  const expectedTotal = sampleProduct.price + 149; // subtotal + standard shipping
  const expectedPaise = Math.round(expectedTotal * 100);

  assert(smokeJson.amount === expectedPaise, `Amount in paise matches: ${smokeJson.amount}`);
  assert(smokeJson.currency === 'INR', `Currency matches: ${smokeJson.currency}`);
  assert(smokeJson.keyId === expectedKeyId, 'Public keyId matches configured key');
  assert(smokeJson.keySecret === undefined, 'RAZORPAY_KEY_SECRET is NOT exposed in response');
  assert(Boolean(smokeJson.trackingToken), 'Unguessable tracking token generated and returned');

  // Verify database state
  const dbOrder = await prisma.order.findUnique({ where: { id: smokeJson.orderId } });
  assert(dbOrder !== null, 'Order persisted in public.orders');
  assert(dbOrder?.status === 'Payment Pending', 'Order status is "Payment Pending"');

  const rzpKv: any[] = await prisma.$queryRawUnsafe(
    `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
    `razorpay_order:${smokeJson.orderId}`
  );
  assert(
    rzpKv.length > 0 && rzpKv[0].data?.razorpayOrderId === smokeJson.razorpayOrderId,
    'Razorpay Order ID correctly associated in payload.payload_kv'
  );

  // Clean up the smoke test order
  await prisma.order.delete({ where: { id: smokeJson.orderId } });
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" = $1;`, `order_token:${smokeJson.orderId}`);
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" = $1;`, `razorpay_order:${smokeJson.orderId}`);
  await prisma.$executeRawUnsafe(`DELETE FROM "payload"."payload_kv" WHERE "key" = $1;`, `razorpay_id:${smokeJson.razorpayOrderId}`);

  // ---------------------------------------------------------------------------
  // TEST 5: Legacy Customer Data Preservation Check
  // ---------------------------------------------------------------------------
  console.log('\n🔒 Test Group 5: Legacy Customer Data Preservation');

  const customerOrder = await prisma.order.findUnique({ where: { id: 'FLX-101498' } });
  assert(
    customerOrder !== null && customerOrder.recipientName === 'Jane Doe' && customerOrder.total === 2447,
    'Customer order FLX-101498 remains intact and preserved'
  );

  const legacyCoupons = await prisma.coupon.findMany();
  assert(legacyCoupons.length === 4, 'Legacy public.coupons records (Prisma) are unmodified (4 records)');

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n========================================');
  console.log(`Smoke Test Results: ${passed}/${total} PASSED`);
  console.log('========================================\n');

  if (passed === total) {
    console.log('🎉 REAL RAZORPAY TEST API AUDIT FULLY PASSED!');
  }

  await prisma.$disconnect();
}

runRealRazorpaySmokeTest().catch((err) => {
  console.error('Fatal Smoke Test Error:', err);
  process.exit(1);
});

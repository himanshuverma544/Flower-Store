/**
 * FloraLux Floral Studio — Phase 4.5 Stage 2C Automated Test Suite
 *
 * Comprehensive tests for:
 * 1. Server-Side Payment Signature Verification (/api/payments/verify)
 *    - Valid signature and captured payment
 *    - Invalid signature rejection
 *    - Missing or malformed parameters
 *    - Unknown order rejection
 *    - Mismatched Razorpay order ID rejection
 *    - Mismatched payment ID or order association rejection
 *    - Mismatched amount or currency rejection
 *    - Uncaptured/pending payment status rejection
 *    - Idempotent duplicate verification requests
 *    - Conflicting payment ID rejection on already-paid orders
 *    - Unauthorized customer tracking token checks
 *
 * 2. Razorpay Webhook Processing (/api/webhooks/razorpay)
 *    - Valid webhook signature verification (raw bytes)
 *    - Invalid webhook signature rejection (prior to processing)
 *    - Raw-body tampering detection (even 1 altered byte fails)
 *    - Atomic duplicate event deduplication
 *    - payment.captured & order.paid transitions and coupon commit
 *    - payment.failed handling and coupon release for pending orders
 *    - Out-of-order safety: delayed payment.failed CANNOT downgrade already-paid order
 *    - Amount and currency validation in webhook events
 *    - Unknown order/payment handling
 *    - Unhandled event types acknowledged without state corruption
 *    - Concurrent verification and webhook execution safety
 *    - Integrity: invalid webhooks cannot change order status or coupon counts
 *
 * NOTE: Strictly uses cryptographic fixtures and mocks. Never makes external API calls.
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { prisma } from '../lib/db';
import { POST as verifyHandler } from '../app/api/payments/verify/route';
import { POST as webhookHandler } from '../app/api/webhooks/razorpay/route';
import {
  reserveCouponAtomically,
  commitCouponAtomically,
} from '../lib/pricing';

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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createWebhookRequest(rawBody: string, signature?: string): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (signature) {
    headers['x-razorpay-signature'] = signature;
  }
  return new NextRequest('http://localhost:3000/api/webhooks/razorpay', {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

function signWebhook(rawBody: string, secret?: string): string {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret';
  return crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
}

function signPayment(orderId: string, paymentId: string, secret?: string): string {
  const keySecret = secret || process.env.RAZORPAY_KEY_SECRET || 'test_key_secret';
  return crypto.createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
}

async function runStage2CTests() {
  console.log('🧪 Starting Floralux Phase 4.5 Stage 2C Automated Test Suite...\n');

  const createdOrderIds: string[] = [];

  try {
    // ---------------------------------------------------------------------------
    // TEST GROUP 1: Missing or Malformed Verification Fields
    // ---------------------------------------------------------------------------
    console.log('📋 Test Group 1: Missing and Malformed Fields Validation');

    // 1.1 Missing orderId
    const req1_1 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      razorpayPaymentId: 'pay_test_123',
      razorpaySignature: 'sig_test_123',
    });
    const res1_1 = await verifyHandler(req1_1);
    const json1_1 = await res1_1.json();
    assert(res1_1.status === 400 && json1_1.success === false, 'Missing orderId rejected with HTTP 400');

    // 1.2 Missing razorpayPaymentId
    const req1_2 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: 'FLX-999999',
      razorpaySignature: 'sig_test_123',
    });
    const res1_2 = await verifyHandler(req1_2);
    const json1_2 = await res1_2.json();
    assert(res1_2.status === 400 && json1_2.success === false, 'Missing razorpayPaymentId rejected with HTTP 400');

    // 1.3 Missing razorpaySignature
    const req1_3 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: 'FLX-999999',
      razorpayPaymentId: 'pay_test_123',
    });
    const res1_3 = await verifyHandler(req1_3);
    const json1_3 = await res1_3.json();
    assert(res1_3.status === 400 && json1_3.success === false, 'Missing razorpaySignature rejected with HTTP 400');

    // 1.4 Non-existent local order
    const req1_4 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: 'FLX-NONEXISTENT-999',
      razorpayPaymentId: 'pay_test_123',
      razorpaySignature: 'sig_test_123',
    });
    const res1_4 = await verifyHandler(req1_4);
    const json1_4 = await res1_4.json();
    assert(res1_4.status === 404 && json1_4.success === false, 'Non-existent orderId rejected with HTTP 404');

    // ---------------------------------------------------------------------------
    // TEST GROUP 2: Authorization, Order Association & Signature Verification
    // ---------------------------------------------------------------------------
    console.log('\n🔐 Test Group 2: Payment Signature & Order Association Verification');

    // Setup Test Order 1 in database
    const testOrderId1 = `FLX-${Math.floor(100000 + Math.random() * 900000)}`;
    createdOrderIds.push(testOrderId1);
    const testRzpOrderId1 = `order_test_${Date.now()}_1`;
    const testPayId1 = `pay_test_${Date.now()}_1`;
    const trackingToken1 = 'valid_secure_token_12345';
    const orderTotal1 = 2500;
    const amountInPaise1 = 250000;

    // Create order with status 'Payment Pending'
    await prisma.order.create({
      data: {
        id: testOrderId1,
        date: 'Oct 17, 2026',
        total: orderTotal1,
        status: 'Payment Pending',
        currentStep: 1,
        recipientName: 'Alice Springs',
        recipientAddress: '100 Botanical Blvd',
        recipientPhone: '555-0101',
        senderName: 'Bob Builder',
        senderEmail: 'bob@example.com',
        itemsJson: JSON.stringify([
          { id: 'item-1', name: 'Roses', price: 2500, quantity: 1, appliedCoupon: 'SPRING20' },
        ]),
      },
    });

    // Reserve coupon for test order
    await reserveCouponAtomically({ code: 'SPRING20', orderId: testOrderId1 });

    // Store server-authoritative Razorpay order mapping in payload_kv
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `razorpay_order:${testOrderId1}`,
      JSON.stringify({
        orderId: testOrderId1,
        razorpayOrderId: testRzpOrderId1,
        amount: amountInPaise1,
        currency: 'INR',
        status: 'created',
      })
    );

    // Store reverse lookup mapping
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `razorpay_id:${testRzpOrderId1}`,
      JSON.stringify({ orderId: testOrderId1 })
    );

    // Store tracking token mapping
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `order_token:${testOrderId1}`,
      JSON.stringify({ orderId: testOrderId1, trackingToken: trackingToken1 })
    );

    // 2.1 Unauthorized tracking token
    const req2_1 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayPaymentId: testPayId1,
      razorpaySignature: 'any_signature',
      trackingToken: 'forged_fake_token',
    });
    const res2_1 = await verifyHandler(req2_1);
    const json2_1 = await res2_1.json();
    assert(res2_1.status === 403 && json2_1.success === false, 'Invalid tracking token rejected with HTTP 403');

    // 2.2 Client supplies mismatched Razorpay Order ID
    const req2_2 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayOrderId: 'order_client_spoofed_order_id',
      razorpayPaymentId: testPayId1,
      razorpaySignature: 'any_signature',
      trackingToken: trackingToken1,
    });
    const res2_2 = await verifyHandler(req2_2);
    const json2_2 = await res2_2.json();
    assert(res2_2.status === 400 && json2_2.message.includes('Mismatched Razorpay order ID'), 'Mismatched razorpayOrderId rejected with HTTP 400');

    // 2.3 Invalid HMAC payment signature
    const req2_3 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayOrderId: testRzpOrderId1,
      razorpayPaymentId: testPayId1,
      razorpaySignature: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      trackingToken: trackingToken1,
    });
    const res2_3 = await verifyHandler(req2_3);
    const json2_3 = await res2_3.json();
    assert(res2_3.status === 400 && json2_3.message.includes('Invalid payment signature'), 'Forged HMAC signature rejected with HTTP 400');

    // 2.4 Payment entity with wrong order_id (payment belongs to another order)
    const validSignature1 = signPayment(testRzpOrderId1, testPayId1);
    const req2_4 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayOrderId: testRzpOrderId1,
      razorpayPaymentId: testPayId1,
      razorpaySignature: validSignature1,
      trackingToken: trackingToken1,
      _mockPayment: {
        id: testPayId1,
        entity: 'payment',
        amount: amountInPaise1,
        currency: 'INR',
        status: 'captured',
        order_id: 'order_some_other_order', // MISMATCH
      },
    });
    const res2_4 = await verifyHandler(req2_4);
    const json2_4 = await res2_4.json();
    assert(res2_4.status === 400 && json2_4.message.includes('Payment does not belong to the expected order'), 'Cross-order payment ID rejected with HTTP 400');

    // 2.5 Payment entity with currency mismatch
    const req2_5 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayOrderId: testRzpOrderId1,
      razorpayPaymentId: testPayId1,
      razorpaySignature: validSignature1,
      trackingToken: trackingToken1,
      _mockPayment: {
        id: testPayId1,
        entity: 'payment',
        amount: amountInPaise1,
        currency: 'USD', // INVALID CURRENCY
        status: 'captured',
        order_id: testRzpOrderId1,
      },
    });
    const res2_5 = await verifyHandler(req2_5);
    const json2_5 = await res2_5.json();
    assert(res2_5.status === 400 && json2_5.message.includes('Invalid payment currency'), 'Non-INR currency rejected with HTTP 400');

    // 2.6 Payment entity with amount mismatch (underpaid)
    const req2_6 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayOrderId: testRzpOrderId1,
      razorpayPaymentId: testPayId1,
      razorpaySignature: validSignature1,
      trackingToken: trackingToken1,
      _mockPayment: {
        id: testPayId1,
        entity: 'payment',
        amount: 10000, // Client only paid ₹100 instead of ₹2500
        currency: 'INR',
        status: 'captured',
        order_id: testRzpOrderId1,
      },
    });
    const res2_6 = await verifyHandler(req2_6);
    const json2_6 = await res2_6.json();
    assert(res2_6.status === 400 && json2_6.message.includes('Payment amount mismatch'), 'Underpaid amount rejected with HTTP 400');

    // 2.7 Payment entity not captured (e.g. status: 'authorized' or 'failed')
    const req2_7 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayOrderId: testRzpOrderId1,
      razorpayPaymentId: testPayId1,
      razorpaySignature: validSignature1,
      trackingToken: trackingToken1,
      _mockPayment: {
        id: testPayId1,
        entity: 'payment',
        amount: amountInPaise1,
        currency: 'INR',
        status: 'failed', // NOT CAPTURED
        order_id: testRzpOrderId1,
      },
    });
    const res2_7 = await verifyHandler(req2_7);
    const json2_7 = await res2_7.json();
    assert(res2_7.status === 400 && json2_7.message.includes('not in captured status'), 'Uncaptured payment status rejected with HTTP 400');

    // ---------------------------------------------------------------------------
    // TEST GROUP 3: Successful Verification & Atomic State Transitions
    // ---------------------------------------------------------------------------
    console.log('\n🎉 Test Group 3: Successful Verification & Order State Transition');

    // 3.1 Valid signature and acceptable captured payment
    const req3_1 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayOrderId: testRzpOrderId1,
      razorpayPaymentId: testPayId1,
      razorpaySignature: validSignature1,
      trackingToken: trackingToken1,
      _mockPayment: {
        id: testPayId1,
        entity: 'payment',
        amount: amountInPaise1,
        currency: 'INR',
        status: 'captured',
        order_id: testRzpOrderId1,
        method: 'card',
      },
    });
    const res3_1 = await verifyHandler(req3_1);
    const json3_1 = await res3_1.json();
    assert(res3_1.status === 200 && json3_1.success === true, 'Valid payment verified with HTTP 200');
    assert(json3_1.status === 'Order Received & Verified', 'Order transitioned to "Order Received & Verified"');

    // Check database state
    const verifiedOrder = await prisma.order.findUnique({ where: { id: testOrderId1 } });
    assert(verifiedOrder?.status === 'Order Received & Verified', 'Database order status updated to "Order Received & Verified"');

    // Check coupon committed in payload_kv
    const couponRows: Array<{ data: any }> = await prisma.$queryRawUnsafe(
      `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
      `coupon_res:${testOrderId1}`
    );
    assert(couponRows[0]?.data?.status === 'committed', 'Coupon reservation atomically transitioned to "committed"');

    // 3.2 Idempotency: Duplicate verification request returns success without duplicate side effects
    const req3_2 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayOrderId: testRzpOrderId1,
      razorpayPaymentId: testPayId1,
      razorpaySignature: validSignature1,
      trackingToken: trackingToken1,
      _mockPayment: {
        id: testPayId1,
        entity: 'payment',
        amount: amountInPaise1,
        currency: 'INR',
        status: 'captured',
        order_id: testRzpOrderId1,
        method: 'card',
      },
    });
    const res3_2 = await verifyHandler(req3_2);
    const json3_2 = await res3_2.json();
    assert(res3_2.status === 200 && json3_2.isExisting === true, 'Duplicate verification returns idempotent success (isExisting: true)');

    // 3.3 Attempt to overwrite already-paid order with a different payment ID
    const conflictingPayId = `pay_different_${Date.now()}`;
    const conflictingSig = signPayment(testRzpOrderId1, conflictingPayId);
    const req3_3 = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId1,
      razorpayOrderId: testRzpOrderId1,
      razorpayPaymentId: conflictingPayId,
      razorpaySignature: conflictingSig,
      trackingToken: trackingToken1,
      _mockPayment: {
        id: conflictingPayId,
        entity: 'payment',
        amount: amountInPaise1,
        currency: 'INR',
        status: 'captured',
        order_id: testRzpOrderId1,
      },
    });
    const res3_3 = await verifyHandler(req3_3);
    const json3_3 = await res3_3.json();
    assert(res3_3.status === 409 && json3_3.success === false, 'Conflicting payment ID on already-paid order rejected with HTTP 409 Conflict');

    // ---------------------------------------------------------------------------
    // TEST GROUP 4: Razorpay Webhook Signatures & Raw Body Validation
    // ---------------------------------------------------------------------------
    console.log('\n🪝 Test Group 4: Webhook Signature & Raw Body Verification');

    const sampleWebhookPayload = {
      entity: 'event',
      account_id: 'acc_test123',
      event: 'payment.captured',
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: 'pay_wh_test_1',
            entity: 'payment',
            amount: 199900,
            currency: 'INR',
            status: 'captured',
            order_id: 'order_wh_test_1',
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    const rawPayloadString = JSON.stringify(sampleWebhookPayload);

    // 4.1 Missing signature header
    const req4_1 = createWebhookRequest(rawPayloadString);
    const res4_1 = await webhookHandler(req4_1);
    const json4_1 = await res4_1.json();
    assert(res4_1.status === 400 && json4_1.error.includes('Missing x-razorpay-signature'), 'Missing signature header rejected with HTTP 400');

    // 4.2 Invalid webhook signature
    const req4_2 = createWebhookRequest(rawPayloadString, 'invalid_webhook_signature_hex');
    const res4_2 = await webhookHandler(req4_2);
    const json4_2 = await res4_2.json();
    assert(res4_2.status === 400 && json4_2.error.includes('Invalid webhook signature'), 'Invalid webhook signature rejected with HTTP 400');

    // 4.3 Webhook signed with wrong secret (e.g. RAZORPAY_KEY_SECRET instead of RAZORPAY_WEBHOOK_SECRET)
    const wrongSecretSig = signWebhook(rawPayloadString, 'wrong_or_api_key_secret');
    const req4_3 = createWebhookRequest(rawPayloadString, wrongSecretSig);
    const res4_3 = await webhookHandler(req4_3);
    assert(res4_3.status === 400, 'Webhook signed with wrong secret rejected with HTTP 400');

    // 4.4 Tampered raw request body (even 1 altered byte must invalidate signature)
    const validWhSig = signWebhook(rawPayloadString);
    const tamperedPayload = rawPayloadString.replace('"INR"', '"USD"');
    const req4_4 = createWebhookRequest(tamperedPayload, validWhSig);
    const res4_4 = await webhookHandler(req4_4);
    assert(res4_4.status === 400, 'Tampered raw request body rejected with HTTP 400 (strict byte-for-byte HMAC)');

    // ---------------------------------------------------------------------------
    // TEST GROUP 5: Webhook Event Deduplication & Idempotency
    // ---------------------------------------------------------------------------
    console.log('\n🔁 Test Group 5: Webhook Event Deduplication & Idempotency');

    const testEventId1 = `evt_dedupe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const dedupeEventPayload = {
      id: testEventId1,
      entity: 'event',
      event: 'unknown.test.event',
      payload: {},
      created_at: Math.floor(Date.now() / 1000),
    };
    const dedupeBody = JSON.stringify(dedupeEventPayload);
    const dedupeSig = signWebhook(dedupeBody);

    // First arrival
    const req5_1 = createWebhookRequest(dedupeBody, dedupeSig);
    const res5_1 = await webhookHandler(req5_1);
    const json5_1 = await res5_1.json();
    assert(res5_1.status === 200 && json5_1.received === true, 'First delivery of event processed with HTTP 200');

    // Second arrival of same event ID
    const req5_2 = createWebhookRequest(dedupeBody, dedupeSig);
    const res5_2 = await webhookHandler(req5_2);
    const json5_2 = await res5_2.json();
    assert(res5_2.status === 200 && json5_2.deduplicated === true, 'Duplicate delivery of event detected and deduplicated (deduplicated: true)');

    // ---------------------------------------------------------------------------
    // TEST GROUP 6: Webhook payment.captured & order.paid Processing
    // ---------------------------------------------------------------------------
    console.log('\n📦 Test Group 6: Webhook payment.captured Order Transition & Coupon Commit');

    // Setup Test Order 2 for webhook capture
    const testOrderId2 = `FLX-${Math.floor(100000 + Math.random() * 900000)}`;
    createdOrderIds.push(testOrderId2);
    const testRzpOrderId2 = `order_wh_rzp_${Date.now()}_2`;
    const testPayId2 = `pay_wh_rzp_${Date.now()}_2`;
    const orderTotal2 = 1800;
    const amountInPaise2 = 180000;

    await prisma.order.create({
      data: {
        id: testOrderId2,
        date: 'Oct 17, 2026',
        total: orderTotal2,
        status: 'Payment Pending',
        currentStep: 1,
        recipientName: 'Claire Redfield',
        recipientAddress: '200 Raccoon City Way',
        recipientPhone: '555-0202',
        senderName: 'Chris Redfield',
        senderEmail: 'chris@example.com',
        itemsJson: JSON.stringify([
          { id: 'item-2', name: 'Peonies', price: 1800, quantity: 1, appliedCoupon: 'BLOOM10' },
        ]),
      },
    });

    await reserveCouponAtomically({ code: 'BLOOM10', orderId: testOrderId2 });

    // Store server-authoritative mapping
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `razorpay_order:${testOrderId2}`,
      JSON.stringify({
        orderId: testOrderId2,
        razorpayOrderId: testRzpOrderId2,
        amount: amountInPaise2,
        currency: 'INR',
      })
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `razorpay_id:${testRzpOrderId2}`,
      JSON.stringify({ orderId: testOrderId2 })
    );

    // 6.1 Webhook with Amount Mismatch -> Rejected without modifying order
    const mismatchEventPayload = {
      id: `evt_mismatch_${Date.now()}`,
      entity: 'event',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: testPayId2,
            amount: 50000, // Forged amount: ₹500 instead of ₹1800
            currency: 'INR',
            status: 'captured',
            order_id: testRzpOrderId2,
          },
        },
      },
    };
    const mismatchBody = JSON.stringify(mismatchEventPayload);
    const req6_1 = createWebhookRequest(mismatchBody, signWebhook(mismatchBody));
    const res6_1 = await webhookHandler(req6_1);
    assert(res6_1.status === 400, 'Webhook with amount mismatch rejected with HTTP 400');

    // Confirm order remains 'Payment Pending'
    const orderAfterMismatch = await prisma.order.findUnique({ where: { id: testOrderId2 } });
    assert(orderAfterMismatch?.status === 'Payment Pending', 'Order status remains "Payment Pending" after amount mismatch');

    // 6.2 Valid payment.captured event
    const capturedEventPayload = {
      id: `evt_capture_${Date.now()}`,
      entity: 'event',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: testPayId2,
            amount: amountInPaise2,
            currency: 'INR',
            status: 'captured',
            order_id: testRzpOrderId2,
            method: 'upi',
          },
        },
      },
    };
    const capturedBody = JSON.stringify(capturedEventPayload);
    const req6_2 = createWebhookRequest(capturedBody, signWebhook(capturedBody));
    const res6_2 = await webhookHandler(req6_2);
    const json6_2 = await res6_2.json();
    assert(res6_2.status === 200 && json6_2.status === 'Order Received & Verified', 'payment.captured event processed with HTTP 200');

    // Confirm database update
    const orderAfterCapture = await prisma.order.findUnique({ where: { id: testOrderId2 } });
    assert(orderAfterCapture?.status === 'Order Received & Verified', 'Order transitioned to "Order Received & Verified" via webhook');

    // Confirm coupon reservation committed
    const couponAfterCapture: Array<{ data: any }> = await prisma.$queryRawUnsafe(
      `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
      `coupon_res:${testOrderId2}`
    );
    assert(couponAfterCapture[0]?.data?.status === 'committed', 'Coupon reservation committed via webhook');

    // ---------------------------------------------------------------------------
    // TEST GROUP 7: Out-of-Order Webhook Safety & payment.failed Handling
    // ---------------------------------------------------------------------------
    console.log('\n🛡️ Test Group 7: Out-of-Order Delivery & payment.failed Protection');

    // 7.1 Delayed payment.failed event arriving AFTER order is already confirmed/paid
    // CRITICAL: Must NEVER downgrade an already-paid order!
    const delayedFailEventPayload = {
      id: `evt_delayed_fail_${Date.now()}`,
      entity: 'event',
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: `pay_failed_attempt_${Date.now()}`,
            order_id: testRzpOrderId2,
            error_description: 'Card declined by issuing bank',
          },
        },
      },
    };
    const delayedFailBody = JSON.stringify(delayedFailEventPayload);
    const req7_1 = createWebhookRequest(delayedFailBody, signWebhook(delayedFailBody));
    const res7_1 = await webhookHandler(req7_1);
    const json7_1 = await res7_1.json();
    assert(res7_1.status === 200 && json7_1.ignored, 'Delayed payment.failed on already-paid order ignored without downgrade');

    const protectedOrder = await prisma.order.findUnique({ where: { id: testOrderId2 } });
    assert(protectedOrder?.status === 'Order Received & Verified', 'Already-paid order remained safely in "Order Received & Verified"');

    // 7.2 Genuine payment.failed for a 'Payment Pending' order
    const testOrderId3 = `FLX-${Math.floor(100000 + Math.random() * 900000)}`;
    createdOrderIds.push(testOrderId3);
    const testRzpOrderId3 = `order_wh_fail_${Date.now()}_3`;

    await prisma.order.create({
      data: {
        id: testOrderId3,
        date: 'Oct 17, 2026',
        total: 1500,
        status: 'Payment Pending',
        currentStep: 1,
        recipientName: 'David Sarif',
        recipientAddress: '300 Cybernetics Ave',
        recipientPhone: '555-0303',
        senderName: 'Adam Jensen',
        senderEmail: 'adam@example.com',
        itemsJson: JSON.stringify([
          { id: 'item-3', name: 'Lilies', price: 1500, quantity: 1, appliedCoupon: 'SPRING20' },
        ]),
      },
    });

    await reserveCouponAtomically({ code: 'SPRING20', orderId: testOrderId3 });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `razorpay_id:${testRzpOrderId3}`,
      JSON.stringify({ orderId: testOrderId3 })
    );

    const failEventPayload = {
      id: `evt_genuine_fail_${Date.now()}`,
      entity: 'event',
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: `pay_failed_${Date.now()}`,
            order_id: testRzpOrderId3,
            error_description: 'Payment expired on gateway',
          },
        },
      },
    };
    const failBody = JSON.stringify(failEventPayload);
    const req7_2 = createWebhookRequest(failBody, signWebhook(failBody));
    const res7_2 = await webhookHandler(req7_2);
    const json7_2 = await res7_2.json();
    assert(res7_2.status === 200 && json7_2.status === 'Payment Failed', 'payment.failed for pending order transitioned to "Payment Failed"');

    const failedOrder = await prisma.order.findUnique({ where: { id: testOrderId3 } });
    assert(failedOrder?.status === 'Payment Failed', 'Order status marked "Payment Failed"');

    // Confirm coupon reservation was released
    const couponAfterFail: Array<{ data: any }> = await prisma.$queryRawUnsafe(
      `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
      `coupon_res:${testOrderId3}`
    );
    assert(couponAfterFail[0]?.data?.status === 'released', 'Coupon reservation released upon payment failure');

    // ---------------------------------------------------------------------------
    // TEST GROUP 8: Concurrency Safety (Simultaneous Client Verification & Webhook)
    // ---------------------------------------------------------------------------
    console.log('\n⚡ Test Group 8: Concurrency Safety (Simultaneous Verification & Webhook)');

    const testOrderId4 = `FLX-${Math.floor(100000 + Math.random() * 900000)}`;
    createdOrderIds.push(testOrderId4);
    const testRzpOrderId4 = `order_race_${Date.now()}_4`;
    const testPayId4 = `pay_race_${Date.now()}_4`;
    const orderTotal4 = 3000;
    const amountInPaise4 = 300000;

    await prisma.order.create({
      data: {
        id: testOrderId4,
        date: 'Oct 17, 2026',
        total: orderTotal4,
        status: 'Payment Pending',
        currentStep: 1,
        recipientName: 'Elena Fisher',
        recipientAddress: '400 Drake Way',
        recipientPhone: '555-0404',
        senderName: 'Nathan Drake',
        senderEmail: 'nathan@example.com',
        itemsJson: JSON.stringify([
          { id: 'item-4', name: 'Grand Bouquet', price: 3000, quantity: 1, appliedCoupon: 'BLOOM15' },
        ]),
      },
    });

    await reserveCouponAtomically({ code: 'BLOOM15', orderId: testOrderId4 });

    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `razorpay_order:${testOrderId4}`,
      JSON.stringify({
        orderId: testOrderId4,
        razorpayOrderId: testRzpOrderId4,
        amount: amountInPaise4,
        currency: 'INR',
      })
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "payload"."payload_kv" ("key", "data")
       VALUES ($1, $2::jsonb)
       ON CONFLICT ("key") DO UPDATE SET "data" = EXCLUDED."data";`,
      `razorpay_id:${testRzpOrderId4}`,
      JSON.stringify({ orderId: testOrderId4 })
    );

    // Prepare simultaneous client verify request and webhook request
    const raceClientReq = createJsonRequest('http://localhost:3000/api/payments/verify', {
      orderId: testOrderId4,
      razorpayOrderId: testRzpOrderId4,
      razorpayPaymentId: testPayId4,
      razorpaySignature: signPayment(testRzpOrderId4, testPayId4),
      _mockPayment: {
        id: testPayId4,
        entity: 'payment',
        amount: amountInPaise4,
        currency: 'INR',
        status: 'captured',
        order_id: testRzpOrderId4,
        method: 'netbanking',
      },
    });

    const raceWebhookPayload = {
      id: `evt_race_${Date.now()}`,
      entity: 'event',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: testPayId4,
            amount: amountInPaise4,
            currency: 'INR',
            status: 'captured',
            order_id: testRzpOrderId4,
          },
        },
      },
    };
    const raceWebhookBody = JSON.stringify(raceWebhookPayload);
    const raceWebhookReq = createWebhookRequest(raceWebhookBody, signWebhook(raceWebhookBody));

    // Execute simultaneously
    const [clientResult, webhookResult] = await Promise.all([
      verifyHandler(raceClientReq),
      webhookHandler(raceWebhookReq),
    ]);

    assert(clientResult.status === 200, 'Concurrent client verification completed with HTTP 200');
    assert(webhookResult.status === 200, 'Concurrent webhook processing completed with HTTP 200');

    const finalOrder = await prisma.order.findUnique({ where: { id: testOrderId4 } });
    assert(finalOrder?.status === 'Order Received & Verified', 'Order transitioned cleanly to "Order Received & Verified" without deadlocks');

    const finalCoupon: Array<{ data: any }> = await prisma.$queryRawUnsafe(
      `SELECT data FROM "payload"."payload_kv" WHERE "key" = $1;`,
      `coupon_res:${testOrderId4}`
    );
    assert(finalCoupon[0]?.data?.status === 'committed', 'Coupon committed cleanly without double-counting');

    // ---------------------------------------------------------------------------
    // TEST GROUP 9: Legacy Data Preservation & Non-Destruction
    // ---------------------------------------------------------------------------
    console.log('\n🔒 Test Group 9: Legacy Data Preservation');

    const originalOrder = await prisma.order.findUnique({
      where: { id: 'FLX-101498' },
    });
    assert(Boolean(originalOrder), 'Customer order FLX-101498 is intact and preserved');

    const legacyCoupons = await prisma.coupon.count();
    assert(legacyCoupons === 4, 'Legacy public.coupons table unmodified (4 records preserved)');

    console.log(`\n========================================`);
    console.log(`Stage 2C Test Results: ${passed}/${total} PASSED`);
    console.log(`========================================`);
    console.log('\n🎉 ALL STAGE 2C VERIFICATION & WEBHOOK TESTS PASSED!');
  } catch (err) {
    console.error('\nFatal test error in Stage 2C test suite:', err);
    process.exitCode = 1;
  } finally {
    // Cleanup created test orders
    for (const id of createdOrderIds) {
      try {
        await prisma.order.deleteMany({ where: { id } });
        await prisma.$executeRawUnsafe(
          `DELETE FROM "payload"."payload_kv" WHERE "key" LIKE $1;`,
          `%${id}%`
        );
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

runStage2CTests().catch(console.error);

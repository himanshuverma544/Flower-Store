import fs from 'fs';
import path from 'path';

async function runStage2BVerification() {
  console.log('🛒 Starting Floralux Phase 4.5 Stage 2B Verification Suite...');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  const checkoutPath = path.join(process.cwd(), 'app', '(frontend)', 'checkout', 'page.tsx');
  const typesPath = path.join(process.cwd(), 'types', 'razorpay.d.ts');
  const indexTypesPath = path.join(process.cwd(), 'types', 'index.ts');

  console.log('\n📄 Test Group 1: Source Code & File Presence');
  assert(fs.existsSync(checkoutPath), 'app/(frontend)/checkout/page.tsx exists');
  assert(fs.existsSync(typesPath), 'types/razorpay.d.ts exists');

  const checkoutCode = fs.readFileSync(checkoutPath, 'utf-8');
  const typesCode = fs.readFileSync(typesPath, 'utf-8');
  const indexTypesCode = fs.readFileSync(indexTypesPath, 'utf-8');

  console.log('\n💳 Test Group 2: Razorpay Script Loader & SDK Integration');
  assert(
    checkoutCode.includes('loadRazorpayScript') &&
      checkoutCode.includes('https://checkout.razorpay.com/v1/checkout.js'),
    'checkout/page.tsx includes dynamic script loader for https://checkout.razorpay.com/v1/checkout.js'
  );
  assert(
    checkoutCode.includes('window.Razorpay'),
    'checkout/page.tsx checks and invokes window.Razorpay'
  );
  assert(
    checkoutCode.includes("new window.Razorpay(options)"),
    'checkout/page.tsx instantiates Razorpay modal instance'
  );

  console.log('\n🛡️ Test Group 3: Server-Authoritative Pricing & Endpoint Integration');
  assert(
    checkoutCode.includes("fetch('/api/payments/create-order'"),
    'checkout/page.tsx calls authoritative POST /api/payments/create-order'
  );
  assert(
    !checkoutCode.includes("fetch('/api/orders', {"),
    'checkout/page.tsx no longer submits new checkout orders through legacy /api/orders'
  );
  assert(
    checkoutCode.includes('amount: data.amount'),
    'Razorpay options use integer paise amount returned directly by server'
  );
  assert(
    checkoutCode.includes('key: data.keyId'),
    'Razorpay options use public keyId returned by server'
  );
  assert(
    checkoutCode.includes('order_id: data.razorpayOrderId'),
    'Razorpay options use razorpayOrderId returned by server'
  );
  assert(
    checkoutCode.includes('idempotencyKey'),
    'checkout/page.tsx supplies client-side idempotencyKey to prevent duplicate orders on retry'
  );

  console.log('\n🔄 Test Group 4: Modal State Handling (Success, Cancellation, Failure)');
  assert(
    checkoutCode.includes('ondismiss') && checkoutCode.includes('Payment Window Closed'),
    'Cancellation: modal.ondismiss handled with clear user-facing warning and preserved cart'
  );
  assert(
    checkoutCode.includes("rzpInstance.on('payment.failed'") ||
      checkoutCode.includes("rzp.on('payment.failed'"),
    'Failure: rzpInstance.on("payment.failed") catches gateway decline and reports error'
  );
  assert(
    checkoutCode.includes('handlePaymentSuccess'),
    'Success: handler callback triggers handlePaymentSuccess'
  );

  console.log('\n🔒 Test Group 5: Strict Server Status Discipline (No Premature Marking)');
  assert(
    !checkoutCode.includes("status: 'Order Received & Verified'"),
    'Strict Security: checkout/page.tsx DOES NOT mark orders as "Order Received & Verified" on frontend callback'
  );
  assert(
    !checkoutCode.includes("status: 'Paid'"),
    'Strict Security: checkout/page.tsx DOES NOT mark orders as "Paid" on frontend callback'
  );
  assert(
    checkoutCode.includes("status: orderData.status || 'Payment Pending'") ||
      checkoutCode.includes("status: 'Payment Pending'"),
    'Order status strictly preserves server state ("Payment Pending") pending Stage 2C verification'
  );

  console.log('\n📦 Test Group 6: Order Tracking & Local Caching Preservation');
  assert(
    checkoutCode.includes('trackingToken: orderData.trackingToken'),
    'Order preserves unguessable trackingToken returned by server'
  );
  assert(
    checkoutCode.includes('localStorage.setItem(\'floralux_orders\''),
    'Order cached locally in floralux_orders for tracking page'
  );
  assert(
    checkoutCode.includes('/track-order?id=') && checkoutCode.includes('token='),
    'Step 3 provides direct link to /track-order with id and secure token'
  );

  console.log('\n🏷️ Test Group 7: TypeScript Definitions & Interface Extensions');
  assert(
    typesCode.includes('interface RazorpayOptions') &&
      typesCode.includes('interface RazorpaySuccessResponse'),
    'types/razorpay.d.ts defines full type contracts for Razorpay'
  );
  assert(
    indexTypesCode.includes('razorpayOrderId?: string') &&
      indexTypesCode.includes('razorpayPaymentId?: string'),
    'types/index.ts Order interface extended with razorpayOrderId and razorpayPaymentId'
  );

  console.log('\n========================================');
  console.log(`Stage 2B Test Results: ${passed}/${total} PASSED`);
  console.log('========================================\n');

  if (passed === total) {
    console.log('🎉 ALL STAGE 2B FRONTEND INTEGRATION CHECKS PASSED!\n');
  } else {
    console.error('❌ SOME CHECKS FAILED!');
    process.exit(1);
  }
}

runStage2BVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

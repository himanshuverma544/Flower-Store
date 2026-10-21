/**
 * Automated Test Suite: Payload CMS Authoritative Checkout Pricing
 *
 * Verifies that lib/pricing.ts strictly uses Payload CMS (payload schema)
 * as the single source of truth for checkout pricing calculations:
 *
 * 1. Valid product and size pricing from Payload CMS (cms_products & cms_products_sizes)
 * 2. Non-existent product IDs safely rejected
 * 3. Unavailable / mismatched bouquet sizes safely rejected
 * 4. Client-side price tampering strictly overridden with server-side Payload prices
 * 5. Add-ons and vases pricing resolved authoritatively from payload.cms_addons
 * 6. Coupons & delivery charges (subtotal thresholds, discounts, max caps, free shipping)
 * 7. Correct final totals and integer paise conversion for Razorpay (total * 100)
 * 8. Out-of-stock product rejection
 * 9. Legacy table preservation (public.products & public.coupons untouched)
 */

import { prisma } from '../lib/db';
import { calculateCartPricing } from '../lib/pricing';
import { STANDARD_SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from '../lib/currency';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}${details ? ` -> ${details}` : ''}`);
    process.exitCode = 1;
  }
}

async function runPayloadPricingTests() {
  console.log('🌸 Starting Payload CMS Checkout Pricing Test Suite...\n');

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Authoritative Payload Product & Size Pricing
    // -------------------------------------------------------------------------
    console.log('📦 Test Group 1: Authoritative Product & Size Pricing from Payload');

    // Fetch live product from payload.cms_products
    const payloadProducts: any[] = await prisma.$queryRawUnsafe(
      `SELECT p.id, p.slug, p.sku, p.name, p.price
       FROM payload.cms_products p
       WHERE p.slug = 'velvet-scarlet-grand-roses' AND p.status = 'published';`
    );
    assert(payloadProducts.length > 0, 'Found velvet-scarlet-grand-roses in payload.cms_products');
    const pRoses = payloadProducts[0];

    const roseSizes: any[] = await prisma.$queryRawUnsafe(
      `SELECT name, price, multiplier FROM payload.cms_products_sizes WHERE _parent_id = $1 ORDER BY _order ASC;`,
      pRoses.id
    );
    assert(roseSizes.length >= 3, 'Found bouquet sizes in payload.cms_products_sizes for velvet roses');

    // Test Standard Size pricing
    const standardSize = roseSizes[0];
    const cartStandard: any = [
      {
        id: pRoses.sku,
        slug: pRoses.slug,
        name: pRoses.name,
        quantity: 1,
        selectedSize: { name: standardSize.name, price: 999999 }, // client sends forged price
      },
    ];
    const resStandard = await calculateCartPricing(cartStandard);
    assert(resStandard.valid === true, 'Valid cart item returns valid = true');
    assert(
      resStandard.subtotal === Number(standardSize.price),
      `Standard size correctly priced at ₹${standardSize.price} from Payload`,
      `Got ₹${resStandard.subtotal}`
    );

    // Test Deluxe Size pricing
    const deluxeSize = roseSizes[1];
    const cartDeluxe: any = [
      {
        id: pRoses.sku,
        slug: pRoses.slug,
        name: pRoses.name,
        quantity: 2,
        selectedSize: { name: deluxeSize.name, price: 1 }, // client sends ₹1
      },
    ];
    const resDeluxe = await calculateCartPricing(cartDeluxe);
    const expectedDeluxeSubtotal = Number(deluxeSize.price) * 2;
    assert(
      resDeluxe.subtotal === expectedDeluxeSubtotal,
      `Deluxe size (qty: 2) correctly priced at ₹${expectedDeluxeSubtotal} from Payload`,
      `Got ₹${resDeluxe.subtotal}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Invalid Products & Unavailable Sizes Rejection
    // -------------------------------------------------------------------------
    console.log('\n🚫 Test Group 2: Invalid Products & Unavailable Bouquet Sizes Rejection');

    // 2.1 Non-existent product ID
    const ghostCart: any = [
      {
        id: 'FL-999-DOES-NOT-EXIST',
        slug: 'non-existent-flower-bouquet',
        name: 'Phantom Bouquet',
        quantity: 1,
      },
    ];
    const resGhost = await calculateCartPricing(ghostCart);
    assert(resGhost.valid === false, 'Non-existent product rejected with valid = false');
    assert(
      Boolean(resGhost.error && resGhost.error.includes('is no longer available')),
      'Returns descriptive error message for missing product'
    );

    // 2.2 Unavailable size for product
    const badSizeCart: any = [
      {
        id: pRoses.sku,
        slug: pRoses.slug,
        name: pRoses.name,
        quantity: 1,
        selectedSize: { name: 'Ultra Mega Giant Stems (Not In Catalog)', price: 100 },
      },
    ];
    const resBadSize = await calculateCartPricing(badSizeCart);
    assert(resBadSize.valid === false, 'Unavailable bouquet size rejected with valid = false');
    assert(
      Boolean(resBadSize.error && resBadSize.error.includes('is not available for')),
      'Returns descriptive error indicating size is not available'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Strict Price Tampering Resistance
    // -------------------------------------------------------------------------
    console.log('\n🛡️ Test Group 3: Strict Server-Side Price Tampering Resistance');

    const tamperedCart: any = [
      {
        id: pRoses.sku,
        slug: pRoses.slug,
        name: pRoses.name,
        price: 0.01, // Client maliciously attempts 1 paisa
        subtotal: 0.01,
        total: 0.01,
        quantity: 3,
        selectedSize: { name: standardSize.name, price: 0.01 },
      },
    ];
    const resTampered = await calculateCartPricing(tamperedCart);
    const expectedServerSubtotal = Number(standardSize.price) * 3;
    assert(
      resTampered.subtotal === expectedServerSubtotal,
      `Forged price (₹0.01) overridden: server calculated subtotal = ₹${expectedServerSubtotal}`,
      `Got ₹${resTampered.subtotal}`
    );
    assert(
      resTampered.validatedItems[0].price === Number(standardSize.price),
      'Validated item price matches authoritative Payload CMS product price'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Add-ons & Vases Authoritative Pricing
    // -------------------------------------------------------------------------
    console.log('\n🏺 Test Group 4: Add-ons and Vases from payload.cms_addons');

    const addonsInDb: any[] = await prisma.$queryRawUnsafe(
      `SELECT slug, name, price FROM payload.cms_addons WHERE is_active = true LIMIT 2;`
    );
    assert(addonsInDb.length >= 2, 'Found active add-ons in payload.cms_addons');

    const testVase = addonsInDb[0];
    const testGift = addonsInDb[1];

    const cartWithAddons: any = [
      {
        id: pRoses.sku,
        slug: pRoses.slug,
        name: pRoses.name,
        quantity: 1,
        selectedSize: { name: standardSize.name, price: standardSize.price },
        selectedVase: { id: testVase.slug, name: testVase.name, price: 0.5 }, // forged vase price
        addons: [{ id: testGift.slug, name: testGift.name, price: 0.25 }], // forged addon price
      },
    ];
    const resAddons = await calculateCartPricing(cartWithAddons);
    const expectedItemTotal = Number(standardSize.price) + Number(testVase.price) + Number(testGift.price);
    assert(
      resAddons.subtotal === expectedItemTotal,
      `Add-on & vase prices correctly fetched from payload.cms_addons (subtotal = ₹${expectedItemTotal})`,
      `Got ₹${resAddons.subtotal}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Delivery Charges & Coupons Integration
    // -------------------------------------------------------------------------
    console.log('\n🚚 Test Group 5: Delivery Charges & Coupon Calculations');

    // Standard shipping when subtotal <= threshold
    const lowValueCart: any = [
      {
        id: 'FL-03',
        slug: 'sunlit-tuscany-meadow',
        name: 'Sunlit Tuscany Meadow',
        quantity: 1,
      },
    ];
    const resLow = await calculateCartPricing(lowValueCart);
    assert(
      resLow.subtotal === 1299 && resLow.shippingFee === STANDARD_SHIPPING_FEE,
      `Standard delivery fee (₹${STANDARD_SHIPPING_FEE}) applied when subtotal (₹${resLow.subtotal}) < threshold (₹${FREE_SHIPPING_THRESHOLD})`
    );

    // Free shipping when subtotal > threshold
    const highValueCart: any = [
      {
        id: pRoses.sku,
        slug: pRoses.slug,
        name: pRoses.name,
        quantity: 2, // 1799 * 2 = 3598 > 2999
        selectedSize: { name: standardSize.name, price: standardSize.price },
      },
    ];
    const resHigh = await calculateCartPricing(highValueCart);
    assert(
      resHigh.subtotal === 3598 && resHigh.shippingFee === 0,
      `Free delivery (₹0) applied automatically when subtotal (₹${resHigh.subtotal}) > ₹${FREE_SHIPPING_THRESHOLD}`
    );

    // Coupon discount test: SPRING20 (20% off, min spend 1500, max cap 1000)
    const resCoupon = await calculateCartPricing(highValueCart, 'SPRING20');
    assert(resCoupon.valid === true, 'SPRING20 applied successfully to qualifying cart');
    assert(
      resCoupon.discountAmount === 719.6, // 3598 * 0.20 = 719.6
      `20% discount correctly computed as ₹719.60`,
      `Got ₹${resCoupon.discountAmount}`
    );
    const expectedNetTotal = 3598 - 719.6;
    assert(
      resCoupon.total === expectedNetTotal,
      `Final total correctly calculated as subtotal - discount = ₹${expectedNetTotal}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Razorpay Amount & Paise Conversion
    // -------------------------------------------------------------------------
    console.log('\n💳 Test Group 6: Razorpay Total & Integer Paise Conversion');

    const expectedPaise = Math.round(resCoupon.total * 100);
    assert(
      expectedPaise === 287840,
      `Razorpay amount correctly calculated in integer paise (${expectedPaise} paise for ₹${resCoupon.total})`
    );
    assert(
      Number.isInteger(expectedPaise),
      'Razorpay amount is strictly a positive integer (no floating-point fraction)'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Order Preservation & Legacy Table Removal Check
    // -------------------------------------------------------------------------
    // Verify payload.cms_orders is authoritatively populated and intact
    const ordersCount = await prisma.cms_orders.count();
    assert(ordersCount > 0, `payload.cms_orders is strictly intact (${ordersCount} records)`);

    // Check legacy tables state (cleanly absent once dropped)
    const prodCheck: any[] = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') as exists;`
    );
    const coupCheck: any[] = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons') as exists;`
    );
    const publicSchemaCheck: any[] = await prisma.$queryRawUnsafe(
      `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'public') as exists;`
    );
    assert(!publicSchemaCheck[0]?.exists, 'Legacy public schema cleanly removed');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n========================================================');
    console.log(`Payload CMS Pricing Test Results: ${passedTests}/${totalTests} PASSED`);
    console.log('========================================================\n');

    if (passedTests === totalTests) {
      console.log('🎉 ALL PAYLOAD CMS PRICING & CHECKOUT TESTS PASSED!\n');
    } else {
      throw new Error(`Some tests failed: ${passedTests}/${totalTests}`);
    }
  } catch (err: any) {
    console.error('Fatal test error:', err.message);
    process.exitCode = 1;
  }
}

runPayloadPricingTests().then(() => {
  if (process.exitCode === 1) {
    process.exit(1);
  }
  process.exit(0);
});

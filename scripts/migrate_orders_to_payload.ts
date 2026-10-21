import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

// Read .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
});

const connectionString = env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set!');
  process.exit(1);
}

// Safety check: confirm connection host
const url = new URL(connectionString);
console.log(`Connecting to database at ${url.host}/${url.pathname.slice(1)}...`);
if (connectionString === env.PROD_DATABASE_URL && !connectionString.includes('wild-dream')) {
  console.error('Safety abort: Target database appears to be production!');
  process.exit(1);
}

async function migrateOrders() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully.');

    // 1. Check source public.orders count
    const countRes = await client.query('SELECT count(*) FROM public.orders;');
    const totalSourceOrders = parseInt(countRes.rows[0].count, 10);
    console.log(`Found ${totalSourceOrders} orders in public.orders.`);

    // 2. Fetch all orders from public.orders
    const ordersRes = await client.query('SELECT * FROM public.orders ORDER BY "createdAt" ASC;');
    const sourceOrders = ordersRes.rows;

    // 3. Fetch auxiliary kv records for tokens, razorpay orders, idempotency keys
    const kvTokensRes = await client.query(`
      SELECT key, data FROM payload.payload_kv WHERE key LIKE 'order_token:%';
    `);
    const tokenMap = new Map<string, string>();
    for (const row of kvTokensRes.rows) {
      const orderId = row.key.replace('order_token:', '');
      const token = row.data?.trackingToken || row.data?.token;
      if (orderId && token) {
        tokenMap.set(orderId, token);
      }
    }

    const kvRpRes = await client.query(`
      SELECT key, data FROM payload.payload_kv WHERE key LIKE 'razorpay_order:%';
    `);
    const rpMap = new Map<string, string>();
    for (const row of kvRpRes.rows) {
      const orderId = row.key.replace('razorpay_order:', '');
      const rpOrderId = row.data?.razorpayOrderId;
      if (orderId && rpOrderId) {
        rpMap.set(orderId, rpOrderId);
      }
    }

    const kvIdempRes = await client.query(`
      SELECT key, data FROM payload.payload_kv WHERE key LIKE 'idempotency:%';
    `);
    const idempMap = new Map<string, string>();
    for (const row of kvIdempRes.rows) {
      const idempKey = row.key.replace('idempotency:', '');
      const orderId = row.data?.orderId;
      if (orderId && idempKey) {
        idempMap.set(orderId, idempKey);
      }
    }

    console.log(`Loaded auxiliary metadata: ${tokenMap.size} tracking tokens, ${rpMap.size} Razorpay order IDs, ${idempMap.size} idempotency keys.`);

    // 4. Migrate each order
    let inserted = 0;
    let updated = 0;

    for (const order of sourceOrders) {
      let parsedItems: any = [];
      try {
        if (order.itemsJson) {
          parsedItems = JSON.parse(order.itemsJson);
          if (!Array.isArray(parsedItems) && typeof parsedItems === 'object') {
            parsedItems = [parsedItems];
          }
        }
      } catch {
        parsedItems = [];
      }

      // Calculate subtotal, deliveryFee, discount if possible from items
      let subtotal: number | null = null;
      let discount: number | null = null;
      if (Array.isArray(parsedItems) && parsedItems.length > 0) {
        let calcSubtotal = 0;
        let calcDiscount = 0;
        for (const item of parsedItems) {
          const itemPrice = Number(item.price || item.total || 0);
          const itemQty = Number(item.quantity || 1);
          calcSubtotal += itemPrice * itemQty;
          if (item.discountAmount) {
            calcDiscount += Number(item.discountAmount);
          }
        }
        subtotal = calcSubtotal > 0 ? calcSubtotal : null;
        discount = calcDiscount > 0 ? calcDiscount : null;
      }

      const trackingToken = tokenMap.get(order.id) || null;
      const razorpayOrderId = rpMap.get(order.id) || null;
      const idempotencyKey = idempMap.get(order.id) || null;

      let paymentStatus = 'pending';
      if (order.status === 'Order Received' || order.status === 'Order Received & Verified' || order.status === 'Delivered') {
        paymentStatus = 'paid';
      } else if (order.status === 'Payment Failed') {
        paymentStatus = 'failed';
      } else if (order.status === 'Payment Expired') {
        paymentStatus = 'expired';
      }

      const query = `
        INSERT INTO "payload"."cms_orders" (
          "order_id",
          "status",
          "current_step",
          "date",
          "total",
          "subtotal",
          "delivery_fee",
          "discount",
          "sender_name",
          "sender_email",
          "sender_phone",
          "keep_secret",
          "recipient_name",
          "recipient_phone",
          "recipient_address",
          "recipient_apt",
          "recipient_city",
          "recipient_state",
          "recipient_zip",
          "card_message",
          "recipient_notes",
          "delivery_date",
          "delivery_slot",
          "estimated_delivery",
          "slot",
          "items",
          "items_json",
          "payment_method",
          "payment_status",
          "razorpay_order_id",
          "tracking_token",
          "idempotency_key",
          "created_at",
          "updated_at"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34
        )
        ON CONFLICT ("order_id") DO UPDATE SET
          "status" = EXCLUDED."status",
          "current_step" = EXCLUDED."current_step",
          "total" = EXCLUDED."total",
          "subtotal" = COALESCE(EXCLUDED."subtotal", "payload"."cms_orders"."subtotal"),
          "delivery_fee" = COALESCE(EXCLUDED."delivery_fee", "payload"."cms_orders"."delivery_fee"),
          "discount" = COALESCE(EXCLUDED."discount", "payload"."cms_orders"."discount"),
          "recipient_name" = EXCLUDED."recipient_name",
          "recipient_phone" = EXCLUDED."recipient_phone",
          "recipient_address" = EXCLUDED."recipient_address",
          "items" = EXCLUDED."items",
          "items_json" = EXCLUDED."items_json",
          "tracking_token" = COALESCE(EXCLUDED."tracking_token", "payload"."cms_orders"."tracking_token"),
          "razorpay_order_id" = COALESCE(EXCLUDED."razorpay_order_id", "payload"."cms_orders"."razorpay_order_id"),
          "idempotency_key" = COALESCE(EXCLUDED."idempotency_key", "payload"."cms_orders"."idempotency_key"),
          "updated_at" = EXCLUDED."updated_at"
        RETURNING (xmax = 0) AS inserted;
      `;

      const values = [
        order.id,                                     // 1 order_id
        order.status,                                 // 2 status
        order.currentStep || 1,                       // 3 current_step
        order.date || null,                           // 4 date
        order.total,                                  // 5 total
        subtotal,                                     // 6 subtotal
        null,                                         // 7 delivery_fee
        discount,                                     // 8 discount
        order.senderName || 'Anonymous',              // 9 sender_name
        order.senderEmail || 'unknown@example.com',   // 10 sender_email
        order.senderPhone || null,                    // 11 sender_phone
        Boolean(order.keepSecret),                    // 12 keep_secret
        order.recipientName || 'Recipient',           // 13 recipient_name
        order.recipientPhone || '',                   // 14 recipient_phone
        order.recipientAddress || '',                 // 15 recipient_address
        order.recipientApt || null,                   // 16 recipient_apt
        order.recipientCity || null,                  // 17 recipient_city
        order.recipientState || null,                 // 18 recipient_state
        order.recipientZip || null,                   // 19 recipient_zip
        order.cardMessage || null,                    // 20 card_message
        order.recipientNotes || null,                 // 21 recipient_notes
        order.deliveryDate || null,                   // 22 delivery_date
        order.deliverySlot || null,                   // 23 delivery_slot
        order.estimatedDelivery || 'Tomorrow',         // 24 estimated_delivery
        order.slot || 'Morning (9 AM - 1 PM)',        // 25 slot
        JSON.stringify(parsedItems),                  // 26 items (jsonb)
        order.itemsJson || '[]',                      // 27 items_json
        'razorpay',                                   // 28 payment_method
        paymentStatus,                                // 29 payment_status
        razorpayOrderId,                              // 30 razorpay_order_id
        trackingToken,                                // 31 tracking_token
        idempotencyKey,                               // 32 idempotency_key
        order.createdAt || new Date(),                // 33 created_at
        order.createdAt || new Date(),                // 34 updated_at
      ];

      const res = await client.query(query, values);
      if (res.rows[0]?.inserted) {
        inserted++;
      } else {
        updated++;
      }
    }

    console.log(`\nMigration completed: ${inserted} inserted, ${updated} updated.`);

    // 5. Verification
    const destCountRes = await client.query('SELECT count(*) FROM "payload"."cms_orders";');
    const destTotal = parseInt(destCountRes.rows[0].count, 10);
    console.log(`Total orders in payload.cms_orders: ${destTotal}`);

    if (destTotal === totalSourceOrders) {
      console.log('✅ SUCCESS: All orders migrated with 100% parity!');
    } else {
      console.warn(`⚠️ WARNING: Source count (${totalSourceOrders}) differs from destination count (${destTotal}).`);
    }

  } catch (err: any) {
    console.error('Migration failed:', err.message, err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrateOrders();

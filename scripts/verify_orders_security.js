import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

function hashPassword(password) {
  const salt = crypto.randomBytes(32).toString('hex');
  const hashRaw = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('hex');
  const hash = `pbkdf2-sha256-v1:${hashRaw}`;
  return { salt, hash };
}

async function loginUser(email, password) {
  const res = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const cookieHeader = res.headers.get('set-cookie');
  const data = await res.json();

  let cookieString = '';
  if (cookieHeader) {
    const match = cookieHeader.match(/payload-token=[^;]+/);
    if (match) cookieString = match[0];
  }

  return {
    status: res.status,
    cookie: cookieString,
    user: data.user,
  };
}

async function main() {
  console.log('====================================================');
  console.log('🔒 Phase 4.4 Comprehensive Security & Auth Test Suite');
  console.log('====================================================\n');

  // Test accounts definitions
  const testAdmin = {
    name: 'Security Test Admin',
    email: `test-admin-${Date.now()}@floralux.test`,
    role: 'admin',
    password: `P@ss-${crypto.randomBytes(8).toString('hex')}`,
  };

  const testManager = {
    name: 'Security Test Manager',
    email: `test-manager-${Date.now()}@floralux.test`,
    role: 'shop-manager',
    password: `P@ss-${crypto.randomBytes(8).toString('hex')}`,
  };

  const testCustomer = {
    name: 'Security Test Customer',
    email: `test-cust-${Date.now()}@floralux.test`,
    role: 'customer',
    password: `P@ss-${crypto.randomBytes(8).toString('hex')}`,
  };

  try {
    // 1. Setup temporary test accounts in payload.cms_users
    console.log('--- Step 1: Provisioning Dedicated Test Accounts ---');
    for (const u of [testAdmin, testManager]) {
      const { salt, hash } = hashPassword(u.password);
      await prisma.$executeRawUnsafe(
        `INSERT INTO payload.cms_users (name, email, role, salt, hash, created_at, updated_at)
         VALUES ($1, $2, $3::payload.enum_cms_users_role, $4, $5, NOW(), NOW())`,
        u.name,
        u.email,
        u.role,
        salt,
        hash
      );
    }

    // For testCustomer, insert with NULL or default role if customer is not in enum, or check enum
    // In collections/Users: roles are 'admin' | 'shop-manager'. Let's verify enum
    console.log('✓ Admin and Shop Manager test accounts created successfully.');

    // 2. Perform official login via POST /api/users/login
    console.log('\n--- Step 2: Testing Official Payload Authentication Flow ---');
    const adminLogin = await loginUser(testAdmin.email, testAdmin.password);
    console.log(
      `Test 2a [Admin Login]: ${adminLogin.status === 200 && adminLogin.cookie ? 'PASS (200 OK, session cookie issued)' : 'FAIL'}`
    );

    const managerLogin = await loginUser(testManager.email, testManager.password);
    console.log(
      `Test 2b [Shop Manager Login]: ${managerLogin.status === 200 && managerLogin.cookie ? 'PASS (200 OK, session cookie issued)' : 'FAIL'}`
    );

    const badLogin = await loginUser(testAdmin.email, 'wrong-password-xyz');
    console.log(
      `Test 2c [Invalid Password Login]: ${badLogin.status === 401 ? 'PASS (401 Unauthorized rejected)' : 'FAIL'}`
    );

    // 3. Server-side Authentication checks on /api/admin/orders
    console.log('\n--- Step 3: Server-side Authentication & Role Enforcement ---');
    const unauthGet = await fetch(`${BASE_URL}/api/admin/orders`);
    console.log(
      `Test 3a [Unauthenticated GET]: ${unauthGet.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL ' + unauthGet.status}`
    );

    const unauthPatch = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'FLX-101498', status: 'Delivered' }),
    });
    console.log(
      `Test 3b [Unauthenticated PATCH]: ${unauthPatch.status === 401 ? 'PASS (401 Unauthorized)' : 'FAIL ' + unauthPatch.status}`
    );

    // 4. Shop Manager Access & Operations
    console.log('\n--- Step 4: Shop Manager Permissions & Order Inspection ---');
    const mgrHeaders = {
      Cookie: managerLogin.cookie,
      'Sec-Fetch-Site': 'same-origin',
    };

    const mgrGetList = await fetch(`${BASE_URL}/api/admin/orders`, { headers: mgrHeaders });
    const mgrListData = await mgrGetList.json();
    console.log(
      `Test 4a [Shop Manager GET Order List]: ${mgrGetList.status === 200 && mgrListData.success ? `PASS (Found ${mgrListData.orders.length} orders)` : 'FAIL'}`
    );

    const mgrGetDetail = await fetch(`${BASE_URL}/api/admin/orders?id=FLX-101498`, { headers: mgrHeaders });
    const mgrDetailData = await mgrGetDetail.json();
    const hasOrderFields =
      mgrDetailData.order?.id === 'FLX-101498' &&
      mgrDetailData.order?.recipient?.fullName &&
      mgrDetailData.order?.items?.length > 0;
    console.log(
      `Test 4b [Shop Manager GET Order Detail]: ${mgrGetDetail.status === 200 && hasOrderFields ? `PASS (Items: ${mgrDetailData.order.items.length}, Recipient: ${mgrDetailData.order.recipient.fullName})` : 'FAIL'}`
    );

    // 5. Status update workflow and customer tracking synchronization
    console.log('\n--- Step 5: Status Updates & Customer Tracking Synchronization ---');
    const originalOrder = await prisma.order.findUnique({ where: { id: 'FLX-101498' } });

    // Step 5a: Manager updates to "Crafting Floral Arrangement"
    const patchStep2 = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: { ...mgrHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'FLX-101498', status: 'Crafting Floral Arrangement' }),
    });
    const patchStep2Data = await patchStep2.json();
    const dbStep2 = await prisma.order.findUnique({ where: { id: 'FLX-101498' } });
    const custStep2 = (await (await fetch(`${BASE_URL}/api/orders?id=FLX-101498`)).json()).order;

    console.log(
      `Test 5a [Update to "Crafting Floral Arrangement"]: ${
        patchStep2.status === 200 &&
        dbStep2.status === 'Crafting Floral Arrangement' &&
        dbStep2.currentStep === 2 &&
        custStep2.status === 'Crafting Floral Arrangement' &&
        custStep2.currentStep === 2
          ? 'PASS (Database step 2, Customer Tracking step 2)'
          : 'FAIL'
      }`
    );

    // Step 5b: Admin updates to "Out for Delivery"
    const adminHeaders = {
      Cookie: adminLogin.cookie,
      'Sec-Fetch-Site': 'same-origin',
    };
    const patchStep3 = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'FLX-101498', status: 'Out for Delivery' }),
    });
    const dbStep3 = await prisma.order.findUnique({ where: { id: 'FLX-101498' } });
    const custStep3 = (await (await fetch(`${BASE_URL}/api/orders?id=FLX-101498`)).json()).order;

    console.log(
      `Test 5b [Update to "Out for Delivery"]: ${
        patchStep3.status === 200 &&
        dbStep3.status === 'Out for Delivery' &&
        dbStep3.currentStep === 3 &&
        custStep3.status === 'Out for Delivery' &&
        custStep3.currentStep === 3
          ? 'PASS (Database step 3, Customer Tracking step 3)'
          : 'FAIL'
      }`
    );

    // Step 5c: Admin updates to "Delivered"
    const patchStep4 = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'FLX-101498', status: 'Delivered' }),
    });
    const dbStep4 = await prisma.order.findUnique({ where: { id: 'FLX-101498' } });
    const custStep4 = (await (await fetch(`${BASE_URL}/api/orders?id=FLX-101498`)).json()).order;

    console.log(
      `Test 5c [Update to "Delivered"]: ${
        patchStep4.status === 200 &&
        dbStep4.status === 'Delivered' &&
        dbStep4.currentStep === 4 &&
        custStep4.status === 'Delivered' &&
        custStep4.currentStep === 4
          ? 'PASS (Database step 4, Customer Tracking step 4)'
          : 'FAIL'
      }`
    );

    // 6. Data Integrity and Input Validation
    console.log('\n--- Step 6: Data Integrity & Input Validation ---');
    const integrityPreserved =
      dbStep4.total === originalOrder.total &&
      dbStep4.itemsJson === originalOrder.itemsJson &&
      dbStep4.recipientName === originalOrder.recipientName &&
      dbStep4.recipientAddress === originalOrder.recipientAddress &&
      dbStep4.senderName === originalOrder.senderName &&
      dbStep4.senderEmail === originalOrder.senderEmail;

    console.log(
      `Test 6a [Financial & Customer Integrity]: ${
        integrityPreserved ? 'PASS (Total, items, recipient, sender 100% unaltered)' : 'FAIL'
      }`
    );

    const invalidStatusPatch = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'FLX-101498', status: 'UNSUPPORTED_STATUS' }),
    });
    console.log(
      `Test 6b [Invalid Status Rejected]: ${
        invalidStatusPatch.status === 400 ? 'PASS (400 Bad Request)' : 'FAIL ' + invalidStatusPatch.status
      }`
    );

    const notFoundPatch = await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'FLX-999999', status: 'Delivered' }),
    });
    console.log(
      `Test 6c [Non-existent Order Rejected]: ${
        notFoundPatch.status === 404 ? 'PASS (404 Not Found)' : 'FAIL ' + notFoundPatch.status
      }`
    );

    // 7. Payload Admin Custom View Access
    console.log('\n--- Step 7: Payload Admin Custom View (/admin/orders) ---');
    const viewResAdmin = await fetch(`${BASE_URL}/admin/orders`, { headers: adminHeaders });
    console.log(
      `Test 7a [Admin Custom View Access]: ${
        viewResAdmin.status === 200 ? 'PASS (200 OK)' : 'FAIL ' + viewResAdmin.status
      }`
    );

    const viewResMgr = await fetch(`${BASE_URL}/admin/orders`, { headers: mgrHeaders });
    console.log(
      `Test 7b [Shop Manager Custom View Access]: ${
        viewResMgr.status === 200 ? 'PASS (200 OK)' : 'FAIL ' + viewResMgr.status
      }`
    );

    // 8. Restore original order state
    console.log('\n--- Step 8: Restoring Original Order State ---');
    await fetch(`${BASE_URL}/api/admin/orders`, {
      method: 'PATCH',
      headers: { ...adminHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'FLX-101498', status: 'Order Received' }),
    });
    const dbRestored = await prisma.order.findUnique({ where: { id: 'FLX-101498' } });
    const custRestored = (await (await fetch(`${BASE_URL}/api/orders?id=FLX-101498`)).json()).order;
    console.log(
      `Test 8 [Order State Restored]: ${
        dbRestored.status === 'Order Received' &&
        dbRestored.currentStep === 1 &&
        custRestored.status === 'Order Received'
          ? 'PASS (Restored to "Order Received", Step 1)'
          : 'FAIL'
      }`
    );
  } finally {
    // 9. Clean up test users and test sessions
    console.log('\n--- Step 9: Cleaning Up Dedicated Test Accounts ---');
    const emails = [testAdmin.email, testManager.email, testCustomer.email];
    for (const email of emails) {
      // Find user id if exists
      const users = await prisma.$queryRawUnsafe(
        `SELECT id FROM payload.cms_users WHERE email = $1`,
        email
      );
      if (users && users.length > 0) {
        const uid = users[0].id;
        // Delete any sessions created for this test user
        await prisma.$executeRawUnsafe(
          `DELETE FROM payload.cms_users_sessions WHERE _parent_id = $1`,
          uid
        );
        // Delete user
        await prisma.$executeRawUnsafe(`DELETE FROM payload.cms_users WHERE id = $1`, uid);
      }
    }
    console.log('✓ All dedicated test accounts and sessions purged from database.');
    console.log('\n====================================================');
    console.log('🎉 All Security & Authentication Tests Complete!');
    console.log('====================================================');
  }
}

main()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

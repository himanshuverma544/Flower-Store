import { getPayloadClient } from '../lib/payload';

async function seedCoupons() {
  console.log('🎟️ Seeding initial coupons into Payload CMS (payload.cms_coupons)...');
  const payload = await getPayloadClient();

  const couponsToSeed = [
    {
      code: 'SPRING20',
      description: '20% Off Spring Blooms (Min ₹1,500, Max ₹1,000)',
      discountType: 'percentage' as const,
      discountValue: 20,
      minSpend: 1500,
      maxDiscount: 1000,
      usageLimitTotal: 500,
      usageLimitPerCustomer: 1,
      isActive: true,
    },
    {
      code: 'FREEDELIVERY',
      description: 'Complimentary Express Delivery (Min ₹999)',
      discountType: 'free_shipping' as const,
      discountValue: 0,
      minSpend: 999,
      maxDiscount: null,
      usageLimitTotal: 1000,
      usageLimitPerCustomer: 1,
      isActive: true,
    },
    {
      code: 'BLOOM10',
      description: '₹200 Off Any Bouquet (Min ₹1,200)',
      discountType: 'fixed_amount' as const,
      discountValue: 200,
      minSpend: 1200,
      maxDiscount: null,
      usageLimitTotal: 200,
      usageLimitPerCustomer: 1,
      isActive: true,
    },
    {
      code: 'BLOOM15',
      description: '15% Off Bloom Club (Min ₹2,000, Max ₹750)',
      discountType: 'percentage' as const,
      discountValue: 15,
      minSpend: 2000,
      maxDiscount: 750,
      usageLimitTotal: 300,
      usageLimitPerCustomer: 1,
      isActive: true,
    },
  ];

  for (const c of couponsToSeed) {
    const existing = await payload.find({
      collection: 'coupons',
      where: {
        code: { equals: c.code },
      },
      limit: 1,
    });

    if (existing.docs.length > 0) {
      console.log(`  ⚡ Coupon ${c.code} already exists (ID: ${existing.docs[0].id}). Skipping.`);
    } else {
      const created = await payload.create({
        collection: 'coupons',
        data: c as any,
      });
      console.log(`  ✅ Created Coupon ${c.code} (ID: ${created.id})`);
    }
  }

  const all = await payload.find({
    collection: 'coupons',
    limit: 10,
  });
  console.log(`\n🎉 Total coupons in Payload CMS: ${all.totalDocs}`);
  process.exit(0);
}

seedCoupons().catch((err) => {
  console.error('❌ Failed to seed coupons:', err);
  process.exit(1);
});

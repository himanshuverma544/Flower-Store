/**
 * Prisma seed script
 * Run: npx prisma db seed
 * Or:  npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import { PRODUCTS } from '../lib/data';

const prisma = new PrismaClient();

async function main() {
  console.log('🌸 Seeding FloraLux database...');

  // ---- Coupons ---------------------------------------------------------------
  const coupons = [
    { code: 'SPRING20', description: '20% Off Spring Blooms', discountPercent: 20 },
    { code: 'FREEDELIVERY', description: 'Complimentary Express Delivery', freeShipping: true },
    { code: 'BLOOM10', description: '₹200 Off Any Bouquet', flatDiscount: 200 },
    { code: 'BLOOM15', description: '15% Off Bloom Club', discountPercent: 15 },
  ];

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: coupon,
      create: coupon,
    });
    console.log(`  ✅ Coupon: ${coupon.code}`);
  }

  // ---- Products --------------------------------------------------------------
  for (const product of PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {
        name: product.name,
        tagline: product.tagline,
        price: product.price,
        originalPrice: product.originalPrice,
        category: product.category,
        flowerType: product.flowerType,
        stemCount: product.stemCount,
        rating: product.rating,
        reviewCount: product.reviewCount,
        isBestseller: product.isBestseller,
        isNew: product.isNew,
        image: product.image,
        symbolism: product.symbolism,
        description: product.description,
        occasionJson: JSON.stringify(product.occasion),
        galleryJson: JSON.stringify(product.gallery),
        careTipsJson: JSON.stringify(product.careTips),
        sizesJson: JSON.stringify(product.sizes),
      },
      create: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        tagline: product.tagline,
        price: product.price,
        originalPrice: product.originalPrice,
        category: product.category,
        flowerType: product.flowerType,
        stemCount: product.stemCount,
        rating: product.rating,
        reviewCount: product.reviewCount,
        isBestseller: product.isBestseller,
        isNew: product.isNew,
        image: product.image,
        symbolism: product.symbolism,
        description: product.description,
        occasionJson: JSON.stringify(product.occasion),
        galleryJson: JSON.stringify(product.gallery),
        careTipsJson: JSON.stringify(product.careTips),
        sizesJson: JSON.stringify(product.sizes),
      },
    });
    console.log(`  🌺 Product: ${product.name}`);
  }

  console.log('\n✨ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

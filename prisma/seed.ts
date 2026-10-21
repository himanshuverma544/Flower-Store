/**
 * Prisma Seed Script
 * Run: npx prisma db seed
 *
 * NOTE: Products, Bouquet Sizes, Add-ons, Vases, and Coupons are now
 * authoritatively managed through Payload CMS in the "payload" PostgreSQL schema.
 * Business orders remain in public.orders.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌸 FloraLux Database Status Check...');

  // Verify connection to database
  const result: any[] = await prisma.$queryRawUnsafe('SELECT current_database(), current_schema();');
  console.log('  ✅ Connected to PostgreSQL database:', result[0]?.current_database);
  console.log('  ℹ️ Products and Coupons are managed via Payload CMS (localhost:3000/admin)');

  console.log('\n✨ Database seed check complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed check failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

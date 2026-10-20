import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

async function audit() {
  console.log('🔍 Starting comprehensive media and R2 audit...\n');

  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const prisma = new PrismaClient();

  // 1. Check R2 objects
  const r2List = await s3.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME }));
  console.log(`1. R2 Bucket "${process.env.R2_BUCKET_NAME}" contains ${r2List.KeyCount} objects:`);
  for (const obj of r2List.Contents || []) {
    console.log(`   - ${obj.Key} (${obj.Size} bytes, ETag: ${obj.ETag})`);
  }

  // 2. Compare local public/media with R2
  const localMediaDir = path.resolve(process.cwd(), 'public/media');
  if (fs.existsSync(localMediaDir)) {
    const localFiles = fs.readdirSync(localMediaDir).filter((f) => !f.startsWith('.'));
    console.log(`\n2. Comparing ${localFiles.length} files in public/media against R2:`);
    for (const f of localFiles) {
      const fullPath = path.join(localMediaDir, f);
      const buf = fs.readFileSync(fullPath);
      const localHash = crypto.createHash('md5').update(buf).digest('hex');
      const r2Obj = (r2List.Contents || []).find((o) => o.Key === f);
      if (!r2Obj) {
        console.error(`   ❌ ${f} MISSING in R2!`);
      } else if (r2Obj.Size !== buf.length) {
        console.error(`   ❌ ${f} SIZE MISMATCH! (Local: ${buf.length}, R2: ${r2Obj.Size})`);
      } else {
        console.log(`   ✅ ${f}: Size matches (${buf.length} bytes), MD5: ${localHash}`);
      }
    }
  } else {
    console.log('\n2. public/media directory does not exist.');
  }

  // 3. Check Payload CMS media rows
  const mediaRows = await prisma.$queryRawUnsafe<any[]>(
    'SELECT id, filename, mime_type, filesize, url FROM payload.cms_media ORDER BY id ASC;'
  );
  console.log(`\n3. Payload cms_media has ${mediaRows.length} rows:`);
  for (const row of mediaRows) {
    console.log(`   - ID ${row.id}: ${row.filename} -> ${row.url}`);
  }

  // 4. Check Products and their Media Relationships
  const products = await prisma.$queryRawUnsafe<any[]>(`
    SELECT p.id, p.name, p.slug, p.featured_image_id, m.filename, m.url
    FROM payload.cms_products p
    LEFT JOIN payload.cms_media m ON p.featured_image_id = m.id
    ORDER BY p.id ASC;
  `);
  console.log(`\n4. Products (${products.length}) featured images:`);
  for (const p of products) {
    console.log(
      `   - ${p.name} (${p.slug}): media id ${p.featured_image_id} (${p.filename}) -> ${p.url}`
    );
  }

  // 5. Check Addons and their Media Relationships
  const addons = await prisma.$queryRawUnsafe<any[]>(`
    SELECT a.id, a.name, a.slug, a.category, a.image_id, m.filename, m.url
    FROM payload.cms_addons a
    LEFT JOIN payload.cms_media m ON a.image_id = m.id
    ORDER BY a.id ASC;
  `);
  console.log(`\n5. Addons (${addons.length}) images:`);
  for (const a of addons) {
    console.log(
      `   - ${a.name} (${a.slug}): category ${a.category}, media id ${a.image_id} (${a.filename}) -> ${a.url}`
    );
  }

  // 6. Test public HTTP access for every single URL
  console.log('\n6. Testing public HTTP GET for all media rows:');
  for (const row of mediaRows) {
    const res = await fetch(row.url);
    if (res.status === 200) {
      console.log(`   ✅ ${row.filename}: HTTP 200 OK (${res.headers.get('content-type')})`);
    } else {
      console.error(`   ❌ ${row.filename}: HTTP ${res.status} ${res.statusText}`);
    }
  }

  await prisma.$disconnect();
  console.log('\nAudit complete.');
  process.exit(0);
}

audit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});

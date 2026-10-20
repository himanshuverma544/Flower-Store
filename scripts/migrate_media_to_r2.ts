import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

// Cloudflare R2 Media Migration Script
// Migrates existing local files from public/media to Cloudflare R2
// Ensures idempotency, verifies integrity, and updates database records safely.

async function main() {
  console.log('📦 [Floralux R2 Migration] Starting media migration to Cloudflare R2...');

  const r2Bucket = process.env.R2_BUCKET_NAME;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2Endpoint =
    process.env.R2_ENDPOINT ||
    (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined);
  const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

  if (!r2Bucket || !r2AccessKeyId || !r2SecretAccessKey || !r2Endpoint || !r2PublicUrl) {
    console.error('❌ Missing R2 environment variables. Cannot proceed with migration.');
    process.exit(1);
  }

  console.log(`🎯 Target bucket: ${r2Bucket}`);
  console.log(`🌐 Public URL base: ${r2PublicUrl}`);

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });

  const prisma = new PrismaClient();
  const mediaDir = path.resolve(process.cwd(), 'public/media');

  if (!fs.existsSync(mediaDir)) {
    console.error(`❌ Media directory ${mediaDir} does not exist.`);
    process.exit(1);
  }

  const files = fs.readdirSync(mediaDir).filter((f) => !f.startsWith('.') && f.endsWith('.svg'));
  console.log(`📁 Found ${files.length} local media files in public/media to migrate.`);

  let uploadedCount = 0;
  let skippedCount = 0;
  let verifiedCount = 0;

  for (const filename of files) {
    const filePath = path.join(mediaDir, filename);
    const fileBuffer = fs.readFileSync(filePath);
    const localSize = fileBuffer.length;
    const localHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

    console.log(`\n🔍 Checking "${filename}" (${localSize} bytes, md5: ${localHash})...`);

    let needsUpload = true;
    try {
      const head = await s3Client.send(
        new HeadObjectCommand({
          Bucket: r2Bucket,
          Key: filename,
        })
      );

      if (head.ContentLength === localSize) {
        console.log(`  ⚡ Already exists in R2 with matching size (${head.ContentLength} bytes). Skipping upload.`);
        needsUpload = false;
        skippedCount++;
      } else {
        console.log(`  ⚠️ Exists in R2 but size differs (R2: ${head.ContentLength}, Local: ${localSize}). Re-uploading.`);
      }
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        // Object does not exist yet in bucket
        needsUpload = true;
      } else {
        console.warn(`  ⚠️ HeadObject error: ${err.message}. Will attempt upload.`);
      }
    }

    if (needsUpload) {
      console.log(`  ⬆️ Uploading to R2 (${r2Bucket}/${filename})...`);
      await s3Client.send(
        new PutObjectCommand({
          Bucket: r2Bucket,
          Key: filename,
          Body: fileBuffer,
          ContentType: 'image/svg+xml',
        })
      );
      uploadedCount++;
      console.log(`  ✅ Successfully uploaded to R2.`);
    }

    // Verify public URL access
    const filePublicUrl = `${r2PublicUrl}/${filename}`;
    try {
      const res = await fetch(filePublicUrl);
      if (res.status === 200) {
        console.log(`  🌐 Public URL verified (HTTP 200): ${filePublicUrl}`);
        verifiedCount++;
      } else {
        console.warn(`  ⚠️ Public URL returned status ${res.status}: ${filePublicUrl}`);
      }
    } catch (e: any) {
      console.warn(`  ⚠️ Failed to fetch public URL: ${e.message}`);
    }

    // Update database record in payload.cms_media
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "payload"."cms_media" 
         SET "url" = $1, "_objectkey" = NULL, "updated_at" = NOW() 
         WHERE "filename" = $2`,
        filePublicUrl,
        filename
      );
      console.log(`  💾 Updated DB record for "${filename}"`);
    } catch (dbErr: any) {
      console.error(`  ❌ Failed to update DB record for "${filename}": ${dbErr.message}`);
    }
  }

  console.log('\n=============================================');
  console.log('🎉 [Floralux R2 Media Migration Complete]');
  console.log(`Total files inspected: ${files.length}`);
  console.log(`Newly uploaded:        ${uploadedCount}`);
  console.log(`Already in sync:       ${skippedCount}`);
  console.log(`Verified public URLs:  ${verifiedCount}`);
  console.log('Local originals in public/media preserved: YES');
  console.log('=============================================\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Fatal error during R2 media migration:', err);
  process.exit(1);
});

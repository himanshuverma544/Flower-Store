import { getPayloadClient } from '../lib/payload';
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

async function runTests() {
  console.log('🧪 Starting Phase 4.6 Cloudflare R2 Media Storage Tests...\n');

  // Test 1: Initialize Payload with R2
  const payload = await getPayloadClient();
  console.log('✅ Test 1: Payload initialized successfully.');

  // Test 2: Upload a new test image via Payload create
  const testFilename = `test-upload-${Date.now()}.svg`;
  const testSvgContent = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="purple"/></svg>'
  );

  console.log(`\n📤 Test 2: Creating test media document in Payload (${testFilename})...`);
  const createdMedia = await payload.create({
    collection: 'media',
    data: {
      alt: 'Test Floralux R2 Upload Image',
      caption: 'Automated test upload for Phase 4.6',
    },
    file: {
      data: testSvgContent,
      name: testFilename,
      mimetype: 'image/svg+xml',
      size: testSvgContent.length,
    },
  });

  console.log('  Created document ID:', createdMedia.id);
  console.log('  Returned URL:', createdMedia.url);

  // Test 3: Verify the URL format matches R2 public URL
  const expectedPublicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

  if (!createdMedia.url?.startsWith(expectedPublicBase)) {
    throw new Error(
      `Media URL ${createdMedia.url} does not start with expected R2 public base ${expectedPublicBase}`
    );
  }
  console.log('✅ Test 3: Returned media URL matches R2 public URL format.');

  // Test 4: Verify the file exists in Cloudflare R2 bucket
  const r2Bucket = process.env.R2_BUCKET_NAME;
  const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
  const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2Endpoint =
    process.env.R2_ENDPOINT ||
    (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined);

  const s3Client = new S3Client({
    region: 'auto',
    endpoint: r2Endpoint,
    credentials: {
      accessKeyId: r2AccessKeyId!,
      secretAccessKey: r2SecretAccessKey!,
    },
  });

  const head = await s3Client.send(
    new HeadObjectCommand({
      Bucket: r2Bucket,
      Key: createdMedia.filename!,
    })
  );
  console.log(`✅ Test 4: File confirmed in Cloudflare R2 bucket (Size: ${head.ContentLength} bytes).`);

  // Test 5: Verify public HTTP 200 response
  const httpRes = await fetch(createdMedia.url);
  if (httpRes.status !== 200) {
    throw new Error(`Public URL returned status ${httpRes.status}`);
  }
  console.log('✅ Test 5: Public HTTP GET resolved with status 200 OK.');

  // Test 6: Delete the test media from Payload and clean up R2
  console.log('\n🧹 Test 6: Cleaning up test media...');
  await payload.delete({
    collection: 'media',
    id: createdMedia.id,
  });

  // Verify deletion from R2
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: r2Bucket,
        Key: createdMedia.filename!,
      })
    );
    // If not removed automatically, clean it up
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: r2Bucket,
        Key: createdMedia.filename!,
      })
    );
    console.log('  Cleaned up test file from R2.');
  } catch (err: any) {
    console.log('  Confirmed file removed from R2 bucket.');
  }
  console.log('✅ Test 6: Cleanup completed successfully.');

  console.log('\n===============================================');
  console.log('🎉 All Phase 4.6 R2 Storage Tests Passed!');
  console.log('===============================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

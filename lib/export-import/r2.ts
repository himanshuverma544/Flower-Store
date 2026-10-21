/**
 * Flora Flowers — Cloudflare R2 Media Verification Utility
 *
 * Verifies that referenced media files exist in the destination Cloudflare R2 bucket.
 * Never uploads duplicate files or logs sensitive secrets.
 */

import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

function getR2Client(): { client: S3Client | null; bucket: string; error?: string } {
  const bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || 'flowers-ecommerce';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    return {
      client: null,
      bucket,
      error: 'R2 credentials not fully configured in environment',
    };
  }

  const client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return { client, bucket };
}

/**
 * Checks whether the given media filenames exist in Cloudflare R2.
 */
export async function verifyR2Files(filenames: string[]): Promise<{
  checked: boolean;
  total: number;
  verified: number;
  missing: string[];
  bucket: string;
}> {
  const { client, bucket, error } = getR2Client();

  if (!client) {
    return {
      checked: false,
      total: filenames.length,
      verified: 0,
      missing: [],
      bucket,
    };
  }

  const uniqueFiles = Array.from(new Set(filenames.filter(Boolean)));
  const missing: string[] = [];
  let verified = 0;

  for (const filename of uniqueFiles) {
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: filename,
        })
      );
      verified++;
    } catch (err: any) {
      if (err?.$metadata?.httpStatusCode === 404 || err.name === 'NotFound') {
        missing.push(filename);
      } else {
        // Log non-sensitive check warning
        console.warn(`[R2 Verify] Notice for ${filename}:`, err?.name || 'Inaccessible');
        // If head check fails for network/permission reasons, track as unverified
        missing.push(filename);
      }
    }
  }

  return {
    checked: true,
    total: uniqueFiles.length,
    verified,
    missing,
    bucket,
  };
}

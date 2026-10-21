/**
 * Flora Flowers — Export / Import Database Client & Environment Inspector
 *
 * Provides transactional PostgreSQL connections and environment security checks.
 */

import { Client, Pool } from 'pg';
import fs from 'fs';
import path from 'path';

function loadEnvFallback() {
  if (!process.env.DATABASE_URL && !process.env.DATABASE_URL_POOLED) {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

let poolInstance: Pool | null = null;

export function getConnectionString(): string {
  loadEnvFallback();
  const url = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Database connection URL is not configured (missing DATABASE_URL or DATABASE_URL_POOLED).');
  }
  return url;
}

export function maskHost(connStr: string): string {
  try {
    const u = new URL(connStr);
    const hostParts = u.host.split('.');
    if (hostParts.length > 2) {
      // e.g. ep-wild-dream-***.neon.tech
      const prefix = hostParts[0].slice(0, 12);
      return `${prefix}***.${hostParts.slice(1).join('.')}`;
    }
    return u.host;
  } catch {
    return 'unknown-host';
  }
}

export function getDestinationDbInfo() {
  const connStr = getConnectionString();
  const maskedHost = maskHost(connStr);
  const prodUrl = process.env.PROD_DATABASE_URL;

  let host = '';
  try {
    host = new URL(connStr).hostname.toLowerCase();
  } catch {}

  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const isVercelProd = process.env.VERCEL_ENV === 'production';
  const isProdHost = prodUrl ? connStr === prodUrl : false;
  const isProdEndpoint = connStr.includes('ep-jolly-morning') || (isVercelProd && !connStr.includes('dev'));

  const isProduction = !isLocal && (isProdHost || isProdEndpoint);
  const isStaging = !isLocal && !isProduction && (
    process.env.VERCEL_ENV === 'preview' ||
    process.env.APP_ENV === 'staging' ||
    (process.env.NODE_ENV as string) === 'staging' ||
    host.includes('staging')
  );

  let environmentLabel: 'LOCAL' | 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION' = 'DEVELOPMENT';
  if (isLocal) {
    environmentLabel = 'LOCAL';
  } else if (isProduction) {
    environmentLabel = 'PRODUCTION';
  } else if (isStaging) {
    environmentLabel = 'STAGING';
  } else {
    environmentLabel = 'DEVELOPMENT';
  }

  const r2Bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || 'flowers-ecommerce';

  return {
    environment: environmentLabel.toLowerCase(),
    environmentLabel,
    isProduction,
    maskedHost,
    r2Bucket,
    dbName: 'PostgreSQL',
  };
}

export function getPgPool(): Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: getConnectionString(),
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return poolInstance;
}

/**
 * Executes a callback within an atomic PostgreSQL transaction.
 * Automatically issues ROLLBACK if an error occurs.
 */
export async function withTransaction<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query('BEGIN;');
    const result = await callback(client);
    await client.query('COMMIT;');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK;');
    } catch (rbErr) {
      console.error('[Export/Import DB] Rollback error:', rbErr);
    }
    throw err;
  } finally {
    await client.end();
  }
}

/**
 * Execute a read-only query using a temporary client.
 */
export async function withClient<T>(callback: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({
    connectionString: getConnectionString(),
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

/**
 * Payload CMS tables with integer primary key sequences.
 * Note: cms_products_sizes and cms_products_care_tips use varchar IDs (seq: null).
 */
export const PAYLOAD_SEQUENCES = [
  { schema: 'payload', table: 'cms_media', seq: 'cms_media_id_seq', pk: 'id' },
  { schema: 'payload', table: 'cms_categories', seq: 'cms_categories_id_seq', pk: 'id' },
  { schema: 'payload', table: 'cms_addons', seq: 'cms_addons_id_seq', pk: 'id' },
  { schema: 'payload', table: 'cms_coupons', seq: 'cms_coupons_id_seq', pk: 'id' },
  { schema: 'payload', table: 'cms_orders', seq: 'cms_orders_id_seq', pk: 'id' },
  { schema: 'payload', table: 'cms_products', seq: 'cms_products_id_seq', pk: 'id' },
  { schema: 'payload', table: 'cms_products_occasions', seq: 'cms_products_occasions_id_seq', pk: 'id' },
  { schema: 'payload', table: 'cms_products_tags', seq: 'cms_products_tags_id_seq', pk: 'id' },
  { schema: 'payload', table: 'cms_products_rels', seq: 'cms_products_rels_id_seq', pk: 'id' },
  { schema: 'payload', table: 'cms_site_settings', seq: 'cms_site_settings_id_seq', pk: 'id' },
];

/**
 * Advances all PostgreSQL auto-increment sequences to MAX(id).
 * This ensures that subsequent manual inserts through Payload CMS admin succeed.
 */
export async function syncDatabaseSequences(client: Client): Promise<string[]> {
  const synced: string[] = [];

  for (const item of PAYLOAD_SEQUENCES) {
    try {
      await client.query(`
        SELECT setval(
          '${item.schema}.${item.seq}',
          GREATEST((SELECT COALESCE(MAX("${item.pk}")::bigint, 1::bigint) FROM "${item.schema}"."${item.table}"), 1::bigint)
        );
      `);
      synced.push(`${item.schema}.${item.seq}`);
    } catch (err: any) {
      console.warn(`[Export/Import Seq] Could not advance ${item.seq}:`, err.message);
    }
  }

  return synced;
}

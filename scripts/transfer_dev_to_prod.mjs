#!/usr/bin/env node

/**
 * Flora Flowers — Safe DEV to PROD Data Transfer Tool
 *
 * Transfers CMS catalog data (Media, Categories, Addons, Products, Coupons, Site Settings)
 * and Storefront checkout tables from local/DEV Neon PostgreSQL to PROD Neon PostgreSQL.
 *
 * Safety Guarantees:
 * 1. Read-only dry-run by default unless `--execute` is explicitly passed.
 * 2. Uses an atomic transaction on PROD (all-or-nothing rollback on any error).
 * 3. Never overwrites or touches production users or existing admin credentials.
 * 4. Preserves exact IDs and foreign-key relationships.
 * 5. Advances PostgreSQL auto-increment sequences after transfer.
 * 6. Does not re-upload media to Cloudflare R2 (assets already exist in bucket).
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// -----------------------------------------------------------------------------
// 1. Environment Loading
// -----------------------------------------------------------------------------
function loadEnv() {
  const envPath = path.resolve(projectRoot, '.env');
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

loadEnv();

const devUrl = process.env.DATABASE_URL;
const prodUrl = process.env.PROD_DATABASE_URL;

if (!devUrl || !prodUrl) {
  console.error('Error: Both DATABASE_URL (DEV) and PROD_DATABASE_URL (PROD) must be set in .env.');
  process.exit(1);
}

const isExecute = process.argv.includes('--execute');

function maskHost(connStr) {
  try {
    const u = new URL(connStr);
    return `${u.host} (DB: ${u.pathname.slice(1)})`;
  } catch {
    return 'unknown';
  }
}

console.log(`[Catalog Data Transfer]`);
console.log(`Mode:    ${isExecute ? 'LIVE EXECUTION' : 'DRY-RUN PREVIEW (no changes will be made)'}`);
console.log(`Source:  ${maskHost(devUrl)}`);
console.log(`Target:  ${maskHost(prodUrl)}\n`);

// -----------------------------------------------------------------------------
// 2. Table Migration Definitions in Foreign Key Order
// -----------------------------------------------------------------------------
const TABLES = [
  // 1. Independent Media metadata
  { schema: 'payload', name: 'cms_media', pk: 'id', seq: 'cms_media_id_seq' },

  // 2. Categories (depends on media)
  { schema: 'payload', name: 'cms_categories', pk: 'id', seq: 'cms_categories_id_seq' },

  // 3. Add-ons and Vases (depends on media)
  { schema: 'payload', name: 'cms_addons', pk: 'id', seq: 'cms_addons_id_seq' },

  // 4. Coupons
  { schema: 'payload', name: 'cms_coupons', pk: 'id', seq: 'cms_coupons_id_seq' },

  // 5. Products (depends on categories & media)
  { schema: 'payload', name: 'cms_products', pk: 'id', seq: 'cms_products_id_seq' },

  // 6. Product sub-tables (depend on products)
  { schema: 'payload', name: 'cms_products_care_tips', pk: 'id', seq: null }, // uses varchar ID
  { schema: 'payload', name: 'cms_products_occasions', pk: 'id', seq: 'cms_products_occasions_id_seq' },
  { schema: 'payload', name: 'cms_products_sizes', pk: 'id', seq: null }, // uses varchar ID
  { schema: 'payload', name: 'cms_products_tags', pk: 'id', seq: 'cms_products_tags_id_seq' },
  { schema: 'payload', name: 'cms_products_rels', pk: 'id', seq: 'cms_products_rels_id_seq' },

  // 7. Site Settings Global
  { schema: 'payload', name: 'cms_site_settings', pk: 'id', seq: 'cms_site_settings_id_seq' },

  // 8. Orders
  { schema: 'payload', name: 'cms_orders', pk: 'id', seq: 'cms_orders_id_seq' },
];

async function transferData() {
  const devClient = new Client({ connectionString: devUrl, ssl: { rejectUnauthorized: false } });
  const prodClient = new Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });

  await devClient.connect();
  await prodClient.connect();

  if (isExecute) {
    await prodClient.query('BEGIN;');
    console.log('🔒 Started atomic transaction on PROD database.');
  }

  try {
    for (const t of TABLES) {
      const fullTable = `"${t.schema}"."${t.name}"`;
      
      // Fetch source rows
      const sourceRes = await devClient.query(`SELECT * FROM ${fullTable} ORDER BY "${t.pk}" ASC;`);
      const sourceRows = sourceRes.rows;

      if (sourceRows.length === 0) {
        console.log(`⏩ ${fullTable}: 0 records in DEV. Skipping.`);
        continue;
      }

      // Check existing target rows
      const targetRes = await prodClient.query(`SELECT "${t.pk}" FROM ${fullTable};`);
      const existingPks = new Set(targetRes.rows.map(r => String(r[t.pk])));

      const rowsToInsert = sourceRows.filter(r => !existingPks.has(String(r[t.pk])));
      const rowsSkipped = sourceRows.length - rowsToInsert.length;

      console.log(`📦 ${fullTable.padEnd(36)} -> ${rowsToInsert.length} to copy, ${rowsSkipped} existing (skipped).`);

      if (isExecute && rowsToInsert.length > 0) {
        const columns = Object.keys(sourceRows[0]);
        const colList = columns.map(c => `"${c}"`).join(', ');

        for (const row of rowsToInsert) {
          const values = columns.map(c => row[c]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

          await prodClient.query(
            `INSERT INTO ${fullTable} (${colList}) VALUES (${placeholders}) ON CONFLICT ("${t.pk}") DO NOTHING;`,
            values
          );
        }

        // Reset auto-increment sequence if table has integer primary key sequence
        if (t.seq) {
          await prodClient.query(`
            SELECT setval(
              '${t.schema}.${t.seq}',
              GREATEST((SELECT COALESCE(MAX("${t.pk}")::bigint, 1::bigint) FROM ${fullTable}), 1::bigint)
            );
          `);
        }
      }
    }

    if (isExecute) {
      await prodClient.query('COMMIT;');
      console.log('\nSUCCESS: All catalog data committed to PROD database successfully!');
    } else {
      console.log('\nDry-run complete. Run with --execute to perform actual data transfer.');
    }
  } catch (err) {
    if (isExecute) {
      await prodClient.query('ROLLBACK;');
      console.error('\nERROR: Transaction rolled back. PROD database unchanged.');
    }
    console.error('Failure details:', err.message);
    process.exit(1);
  } finally {
    await devClient.end();
    await prodClient.end();
  }
}

transferData();

#!/usr/bin/env node

/**
 * Flora Flowers — Production Database Migration Runner
 * 
 * Orchestrates a safe, multi-system database deployment for Next.js, Prisma, and Payload CMS:
 * 1. Ensures the PostgreSQL "payload" schema exists in the target database.
 * 2. Deploys pending Prisma migrations to the "public" schema using `prisma migrate deploy`.
 * 3. Deploys pending Payload CMS migrations to the "payload" schema using `payload migrate`.
 *
 * Runs automatically during the Vercel build before Next.js compiles.
 */

import { Client } from 'pg';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// -----------------------------------------------------------------------------
// 1. Environment Loading & Target Database Resolution
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

if (process.env.SKIP_DB_MIGRATIONS === '1' || process.env.SKIP_DB_MIGRATIONS === 'true') {
  console.log('[Floralux Migration]: Skipping database migrations (SKIP_DB_MIGRATIONS is set).');
  process.exit(0);
}

const isExplicitProd = process.argv.includes('--prod') || process.env.TARGET_ENV === 'production';

let directUrl = null;
let pooledUrl = null;

if (isExplicitProd) {
  if (!process.env.PROD_DATABASE_URL && !process.env.PROD_DATABASE_URL_UNPOOLED) {
    console.error('[Floralux Migration Error]: PROD_DATABASE_URL is not set in the environment.');
    process.exit(1);
  }
  console.log('[Floralux Migration]: Explicit production target selected (--prod / TARGET_ENV=production).');
  directUrl = process.env.PROD_DATABASE_URL_UNPOOLED || process.env.PROD_DATABASE_URL;
  pooledUrl = process.env.PROD_DATABASE_URL_POOLED || directUrl;
} else {
  directUrl =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PROD_DATABASE_URL;

  pooledUrl =
    process.env.DATABASE_URL_POOLED ||
    process.env.POSTGRES_URL ||
    directUrl;
}

if (!directUrl) {
  console.error('[Floralux Migration Error]: No database connection URL found. Please set DATABASE_URL or DATABASE_URL_UNPOOLED in your environment.');
  process.exit(1);
}

// Log safe connection target without credentials
try {
  const parsed = new URL(directUrl);
  console.log(`[Floralux Migration]: Connecting to database on host ${parsed.host} (DB: ${parsed.pathname.slice(1)})`);
} catch {
  console.log('[Floralux Migration]: Connecting to database via configured DATABASE_URL...');
}

// -----------------------------------------------------------------------------
// 2. Step 1: Ensure Schema "payload" Exists
// -----------------------------------------------------------------------------
async function ensurePayloadSchema(connectionString) {
  console.log('\n--- Step 1/3: Ensuring PostgreSQL "payload" schema exists ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    await client.query('CREATE SCHEMA IF NOT EXISTS "payload";');
    console.log('Schema "payload" verified / created successfully.');
  } catch (err) {
    console.error('Failed to ensure schema "payload":', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

// -----------------------------------------------------------------------------
// 3. Step 2: Deploy Payload CMS Migrations (payload schema)
// -----------------------------------------------------------------------------
function runPayloadMigrations(targetDirectUrl) {
  console.log('\n--- Step 2/3: Applying Payload CMS migrations (payload migrate) ---');
  // For DDL migration operations, use the direct connection URL to bypass connection pooler transaction limits
  const env = {
    ...process.env,
    DATABASE_URL: targetDirectUrl,
    DATABASE_URL_POOLED: targetDirectUrl
  };

  try {
    execSync('npx payload migrate', {
      cwd: projectRoot,
      stdio: 'inherit',
      env
    });
    console.log('Payload CMS migrations applied successfully.');
  } catch (err) {
    console.error('Payload CMS migration deployment failed.');
    throw err;
  }
}

// -----------------------------------------------------------------------------
// 4. Step 3: Clean Up Legacy Public Schema Tables (Orders, Products, Coupons)
// -----------------------------------------------------------------------------
async function cleanupLegacyPublicTables(connectionString) {
  console.log('\n--- Step 3/3: Cleaning up legacy public schema tables ---');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    // Drop legacy public tables that were migrated to the payload schema
    await client.query(`
      DROP TABLE IF EXISTS "public"."orders" CASCADE;
      DROP TABLE IF EXISTS "public"."products" CASCADE;
      DROP TABLE IF EXISTS "public"."coupons" CASCADE;
      DROP TABLE IF EXISTS "public"."_prisma_migrations" CASCADE;
    `);
    console.log('Legacy public tables cleaned up successfully.');
  } catch (err) {
    console.warn('Note on legacy cleanup (safe to ignore):', err.message);
  } finally {
    await client.end();
  }
}

// -----------------------------------------------------------------------------
// 5. Execution Pipeline
// -----------------------------------------------------------------------------
async function main() {
  try {
    await ensurePayloadSchema(directUrl);
    runPayloadMigrations(directUrl);
    await cleanupLegacyPublicTables(directUrl);
    console.log('\n[Floralux Migration]: All database migrations and schema cleanup deployed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n[Floralux Migration]: Migration pipeline aborted due to error.\n');
    process.exit(1);
  }
}

main();

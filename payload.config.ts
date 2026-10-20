import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

import { Users } from './collections/Users';
import { Categories } from './collections/Categories';
import { Media } from './collections/Media';
import { Products } from './collections/Products';
import { Addons } from './collections/Addons';
import { Coupons } from './collections/Coupons';
import { SiteSettings } from './globals/SiteSettings';
import { migrations } from './migrations';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Cloudflare R2 Media Storage Configuration (Enforced in all environments)
const r2Bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2Endpoint =
  process.env.R2_ENDPOINT ||
  (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined);
const r2PublicUrl = process.env.R2_PUBLIC_URL;

const missingR2Vars: string[] = [];
if (!r2Bucket) missingR2Vars.push('R2_BUCKET_NAME (or R2_BUCKET)');
if (!r2AccessKeyId) missingR2Vars.push('R2_ACCESS_KEY_ID');
if (!r2SecretAccessKey) missingR2Vars.push('R2_SECRET_ACCESS_KEY');
if (!r2Endpoint) missingR2Vars.push('R2_ENDPOINT (or R2_ACCOUNT_ID)');
if (!r2PublicUrl) missingR2Vars.push('R2_PUBLIC_URL');

if (missingR2Vars.length > 0) {
  throw new Error(
    `[Floralux Storage Error]: Cloudflare R2 media storage is required in all environments, but the following required environment variable(s) are missing: ${missingR2Vars.join(', ')}. Local filesystem fallback is disabled.`
  );
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    suppressHydrationWarning: true,
    components: {
      afterNavLinks: [
        '@/components/admin/OrdersNavEntry#OrdersNavEntry',
      ],
      views: {
        orders: {
          Component: '@/components/admin/OrdersView#OrdersView',
          path: '/orders',
          meta: {
            title: 'Orders & Fulfillment | Floralux Admin',
          },
        },
      },
    },
  },
  sharp,
  collections: [
    Users,
    Categories,
    Products,
    Media,
    Addons,
    Coupons,
  ],
  globals: [
    SiteSettings,
  ],
  plugins: [
    s3Storage({
      collections: {
        media: {
          generateFileURL: ({ filename, prefix }) => {
            const base = (r2PublicUrl || '').replace(/\/$/, '');
            if (!prefix || prefix === '.' || prefix === filename) {
              return `${base}/${filename}`;
            }
            return `${base}/${prefix.replace(/\/$/, '')}/${filename}`;
          },
        },
      },
      bucket: r2Bucket!,
      config: {
        credentials: {
          accessKeyId: r2AccessKeyId!,
          secretAccessKey: r2SecretAccessKey!,
        },
        region: 'auto',
        endpoint: r2Endpoint,
      },
    }),
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'flora-lux-super-secret-payload-key-change-in-production',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL || '',
    },
    schemaName: 'payload',
    push: false,
    prodMigrations: migrations,
  }),
});

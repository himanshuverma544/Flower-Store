import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."cms_media" ADD COLUMN IF NOT EXISTS "_objectkey" varchar;
    ALTER TABLE "payload"."cms_media" ADD COLUMN IF NOT EXISTS "prefix" varchar;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload"."cms_media" DROP COLUMN IF EXISTS "_objectkey";
    ALTER TABLE "payload"."cms_media" DROP COLUMN IF EXISTS "prefix";
  `);
}

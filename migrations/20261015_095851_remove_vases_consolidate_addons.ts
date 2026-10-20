import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "payload"."enum_cms_addons_category" ADD VALUE IF NOT EXISTS 'vase' BEFORE 'chocolate';
  ALTER TABLE "payload"."cms_products_rels" DROP CONSTRAINT IF EXISTS "cms_products_rels_vases_fk";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_vases_fk";
  DROP TABLE IF EXISTS "payload"."cms_vases" CASCADE;
  DROP INDEX IF EXISTS "payload"."cms_products_rels_cms_vases_id_idx";
  DROP INDEX IF EXISTS "payload"."payload_locked_documents_rels_cms_vases_id_idx";
  ALTER TABLE "payload"."cms_addons" ADD COLUMN IF NOT EXISTS "material" varchar;
  ALTER TABLE "payload"."cms_addons" ADD COLUMN IF NOT EXISTS "dimensions" varchar;
  ALTER TABLE "payload"."cms_products_rels" DROP COLUMN IF EXISTS "cms_vases_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN IF EXISTS "cms_vases_id";
  DROP TYPE IF EXISTS "payload"."enum_cms_vases_stock_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_vases_stock_status" AS ENUM('in_stock', 'out_of_stock');
  CREATE TABLE IF NOT EXISTS "payload"."cms_vases" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"stock_quantity" numeric DEFAULT 50,
  	"stock_status" "payload"."enum_cms_vases_stock_status" DEFAULT 'in_stock' NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"description" varchar,
  	"material" varchar,
  	"dimensions" varchar,
  	"image_id" integer,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_addons" ALTER COLUMN "category" SET DATA TYPE text;
  ALTER TABLE "payload"."cms_addons" ALTER COLUMN "category" SET DEFAULT 'chocolate'::text;
  DROP TYPE "payload"."enum_cms_addons_category";
  CREATE TYPE "payload"."enum_cms_addons_category" AS ENUM('chocolate', 'candle', 'card', 'balloon', 'plush', 'gift-set');
  ALTER TABLE "payload"."cms_addons" ALTER COLUMN "category" SET DEFAULT 'chocolate'::"payload"."enum_cms_addons_category";
  ALTER TABLE "payload"."cms_addons" ALTER COLUMN "category" SET DATA TYPE "payload"."enum_cms_addons_category" USING "category"::"payload"."enum_cms_addons_category";
  ALTER TABLE "payload"."cms_products_rels" ADD COLUMN IF NOT EXISTS "cms_vases_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "cms_vases_id" integer;
  ALTER TABLE "payload"."cms_vases" ADD CONSTRAINT "cms_vases_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX IF NOT EXISTS "cms_vases_slug_idx" ON "payload"."cms_vases" USING btree ("slug");
  CREATE INDEX IF NOT EXISTS "cms_vases_image_idx" ON "payload"."cms_vases" USING btree ("image_id");
  CREATE INDEX IF NOT EXISTS "cms_vases_updated_at_idx" ON "payload"."cms_vases" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "cms_vases_created_at_idx" ON "payload"."cms_vases" USING btree ("created_at");
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_vases_fk" FOREIGN KEY ("cms_vases_id") REFERENCES "payload"."cms_vases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vases_fk" FOREIGN KEY ("cms_vases_id") REFERENCES "payload"."cms_vases"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "cms_products_rels_cms_vases_id_idx" ON "payload"."cms_products_rels" USING btree ("cms_vases_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_cms_vases_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_vases_id");
  ALTER TABLE "payload"."cms_addons" DROP COLUMN IF EXISTS "material";
  ALTER TABLE "payload"."cms_addons" DROP COLUMN IF EXISTS "dimensions";`)
}

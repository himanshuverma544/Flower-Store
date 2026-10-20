import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_products_tags" AS ENUM('roses', 'exotic', 'pastel', 'vibrant', 'fragrant', 'long-lasting', 'same-day', 'limited-edition', 'pet-friendly');
  CREATE TYPE "payload"."enum_cms_products_occasions" AS ENUM('Romance', 'Anniversary', 'Birthday', 'Sympathy', 'Congratulations', 'Thank You', 'Just Because');
  CREATE TYPE "payload"."enum_cms_products_stock_status" AS ENUM('in_stock', 'out_of_stock', 'backorder');
  CREATE TYPE "payload"."enum_cms_products_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "payload"."enum_cms_vases_stock_status" AS ENUM('in_stock', 'out_of_stock');
  CREATE TYPE "payload"."enum_cms_addons_category" AS ENUM('chocolate', 'candle', 'card', 'balloon', 'plush', 'gift-set');
  CREATE TYPE "payload"."enum_cms_addons_stock_status" AS ENUM('in_stock', 'out_of_stock');
  CREATE TYPE "payload"."enum_cms_coupons_discount_type" AS ENUM('percentage', 'fixed_amount', 'free_shipping');
  CREATE TABLE "payload"."cms_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"icon" varchar,
  	"description" varchar,
  	"image_id" integer,
  	"is_active" boolean DEFAULT true,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_products_tags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_cms_products_tags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_products_sizes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" numeric NOT NULL,
  	"multiplier" numeric DEFAULT 1
  );
  
  CREATE TABLE "payload"."cms_products_occasions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "payload"."enum_cms_products_occasions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "payload"."cms_products_care_tips" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tip" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."cms_products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"sku" varchar,
  	"tagline" varchar NOT NULL,
  	"short_description" varchar,
  	"description" varchar NOT NULL,
  	"category_id" integer NOT NULL,
  	"price" numeric NOT NULL,
  	"compare_at_price" numeric,
  	"stock_quantity" numeric DEFAULT 100,
  	"stock_status" "payload"."enum_cms_products_stock_status" DEFAULT 'in_stock' NOT NULL,
  	"flower_type" varchar NOT NULL,
  	"stem_count" numeric DEFAULT 12,
  	"symbolism" varchar,
  	"featured_image_id" integer,
  	"is_featured" boolean DEFAULT false,
  	"is_bestseller" boolean DEFAULT false,
  	"is_new" boolean DEFAULT false,
  	"status" "payload"."enum_cms_products_status" DEFAULT 'draft' NOT NULL,
  	"rating" numeric DEFAULT 5,
  	"review_count" numeric DEFAULT 0,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cms_categories_id" integer,
  	"cms_media_id" integer,
  	"cms_vases_id" integer,
  	"cms_addons_id" integer
  );
  
  CREATE TABLE "payload"."cms_media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"caption" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar,
  	"sizes_full_url" varchar,
  	"sizes_full_width" numeric,
  	"sizes_full_height" numeric,
  	"sizes_full_mime_type" varchar,
  	"sizes_full_filesize" numeric,
  	"sizes_full_filename" varchar
  );
  
  CREATE TABLE "payload"."cms_vases" (
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
  
  CREATE TABLE "payload"."cms_addons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"category" "payload"."enum_cms_addons_category" DEFAULT 'chocolate' NOT NULL,
  	"icon" varchar,
  	"price" numeric NOT NULL,
  	"stock_quantity" numeric DEFAULT 100,
  	"stock_status" "payload"."enum_cms_addons_stock_status" DEFAULT 'in_stock' NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"description" varchar,
  	"image_id" integer,
  	"sort_order" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_coupons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"description" varchar,
  	"discount_type" "payload"."enum_cms_coupons_discount_type" DEFAULT 'percentage' NOT NULL,
  	"discount_value" numeric NOT NULL,
  	"min_spend" numeric DEFAULT 0,
  	"max_discount" numeric,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"usage_limit_total" numeric,
  	"usage_limit_per_customer" numeric DEFAULT 1,
  	"is_active" boolean DEFAULT true,
  	"usage_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."cms_site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"store_name" varchar DEFAULT 'Floralux Luxury Florist' NOT NULL,
  	"tagline" varchar DEFAULT 'Artisanal Blooms Handcrafted in India',
  	"currency" varchar DEFAULT 'INR',
  	"currency_symbol" varchar DEFAULT '₹',
  	"contact_email" varchar DEFAULT 'concierge@floralux.in',
  	"contact_phone" varchar DEFAULT '+91 98765 43210',
  	"address" varchar DEFAULT 'Bandra West, Mumbai, Maharashtra 400050',
  	"free_shipping_threshold" numeric DEFAULT 2999,
  	"standard_shipping_fee" numeric DEFAULT 149,
  	"express_delivery_fee" numeric DEFAULT 299,
  	"announcement_bar_enabled" boolean DEFAULT true,
  	"announcement_bar_text" varchar DEFAULT 'Complimentary luxury gift box & handwritten message card with every order',
  	"announcement_bar_link" varchar DEFAULT '/catalog',
  	"instagram" varchar DEFAULT 'https://instagram.com/floralux',
  	"whatsapp" varchar DEFAULT 'https://wa.me/919876543210',
  	"facebook" varchar,
  	"pinterest" varchar,
  	"default_meta_title" varchar DEFAULT 'Floralux | Luxury Flower Delivery Across India',
  	"default_meta_description" varchar DEFAULT 'Experience artisanal floral arrangements, luxury rose bouquets, and same-day delivery across India with Floralux.',
  	"default_share_image_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."cms_users" ALTER COLUMN "role" SET DEFAULT 'shop-manager';
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_categories_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_products_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_media_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_vases_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_addons_id" integer;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_coupons_id" integer;
  ALTER TABLE "payload"."cms_categories" ADD CONSTRAINT "cms_categories_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_tags" ADD CONSTRAINT "cms_products_tags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_sizes" ADD CONSTRAINT "cms_products_sizes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_occasions" ADD CONSTRAINT "cms_products_occasions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_care_tips" ADD CONSTRAINT "cms_products_care_tips_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products" ADD CONSTRAINT "cms_products_category_id_cms_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."cms_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_products" ADD CONSTRAINT "cms_products_featured_image_id_cms_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_media_fk" FOREIGN KEY ("cms_media_id") REFERENCES "payload"."cms_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_vases_fk" FOREIGN KEY ("cms_vases_id") REFERENCES "payload"."cms_vases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_products_rels" ADD CONSTRAINT "cms_products_rels_addons_fk" FOREIGN KEY ("cms_addons_id") REFERENCES "payload"."cms_addons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."cms_vases" ADD CONSTRAINT "cms_vases_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_addons" ADD CONSTRAINT "cms_addons_image_id_cms_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."cms_site_settings" ADD CONSTRAINT "cms_site_settings_default_share_image_id_cms_media_id_fk" FOREIGN KEY ("default_share_image_id") REFERENCES "payload"."cms_media"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "cms_categories_slug_idx" ON "payload"."cms_categories" USING btree ("slug");
  CREATE INDEX "cms_categories_image_idx" ON "payload"."cms_categories" USING btree ("image_id");
  CREATE INDEX "cms_categories_updated_at_idx" ON "payload"."cms_categories" USING btree ("updated_at");
  CREATE INDEX "cms_categories_created_at_idx" ON "payload"."cms_categories" USING btree ("created_at");
  CREATE INDEX "cms_products_tags_order_idx" ON "payload"."cms_products_tags" USING btree ("order");
  CREATE INDEX "cms_products_tags_parent_idx" ON "payload"."cms_products_tags" USING btree ("parent_id");
  CREATE INDEX "cms_products_sizes_order_idx" ON "payload"."cms_products_sizes" USING btree ("_order");
  CREATE INDEX "cms_products_sizes_parent_id_idx" ON "payload"."cms_products_sizes" USING btree ("_parent_id");
  CREATE INDEX "cms_products_occasions_order_idx" ON "payload"."cms_products_occasions" USING btree ("order");
  CREATE INDEX "cms_products_occasions_parent_idx" ON "payload"."cms_products_occasions" USING btree ("parent_id");
  CREATE INDEX "cms_products_care_tips_order_idx" ON "payload"."cms_products_care_tips" USING btree ("_order");
  CREATE INDEX "cms_products_care_tips_parent_id_idx" ON "payload"."cms_products_care_tips" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cms_products_slug_idx" ON "payload"."cms_products" USING btree ("slug");
  CREATE INDEX "cms_products_category_idx" ON "payload"."cms_products" USING btree ("category_id");
  CREATE INDEX "cms_products_featured_image_idx" ON "payload"."cms_products" USING btree ("featured_image_id");
  CREATE INDEX "cms_products_updated_at_idx" ON "payload"."cms_products" USING btree ("updated_at");
  CREATE INDEX "cms_products_created_at_idx" ON "payload"."cms_products" USING btree ("created_at");
  CREATE INDEX "cms_products_rels_order_idx" ON "payload"."cms_products_rels" USING btree ("order");
  CREATE INDEX "cms_products_rels_parent_idx" ON "payload"."cms_products_rels" USING btree ("parent_id");
  CREATE INDEX "cms_products_rels_path_idx" ON "payload"."cms_products_rels" USING btree ("path");
  CREATE INDEX "cms_products_rels_cms_categories_id_idx" ON "payload"."cms_products_rels" USING btree ("cms_categories_id");
  CREATE INDEX "cms_products_rels_cms_media_id_idx" ON "payload"."cms_products_rels" USING btree ("cms_media_id");
  CREATE INDEX "cms_products_rels_cms_vases_id_idx" ON "payload"."cms_products_rels" USING btree ("cms_vases_id");
  CREATE INDEX "cms_products_rels_cms_addons_id_idx" ON "payload"."cms_products_rels" USING btree ("cms_addons_id");
  CREATE INDEX "cms_media_updated_at_idx" ON "payload"."cms_media" USING btree ("updated_at");
  CREATE INDEX "cms_media_created_at_idx" ON "payload"."cms_media" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_media_filename_idx" ON "payload"."cms_media" USING btree ("filename");
  CREATE INDEX "cms_media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "payload"."cms_media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "cms_media_sizes_card_sizes_card_filename_idx" ON "payload"."cms_media" USING btree ("sizes_card_filename");
  CREATE INDEX "cms_media_sizes_full_sizes_full_filename_idx" ON "payload"."cms_media" USING btree ("sizes_full_filename");
  CREATE UNIQUE INDEX "cms_vases_slug_idx" ON "payload"."cms_vases" USING btree ("slug");
  CREATE INDEX "cms_vases_image_idx" ON "payload"."cms_vases" USING btree ("image_id");
  CREATE INDEX "cms_vases_updated_at_idx" ON "payload"."cms_vases" USING btree ("updated_at");
  CREATE INDEX "cms_vases_created_at_idx" ON "payload"."cms_vases" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_addons_slug_idx" ON "payload"."cms_addons" USING btree ("slug");
  CREATE INDEX "cms_addons_image_idx" ON "payload"."cms_addons" USING btree ("image_id");
  CREATE INDEX "cms_addons_updated_at_idx" ON "payload"."cms_addons" USING btree ("updated_at");
  CREATE INDEX "cms_addons_created_at_idx" ON "payload"."cms_addons" USING btree ("created_at");
  CREATE UNIQUE INDEX "cms_coupons_code_idx" ON "payload"."cms_coupons" USING btree ("code");
  CREATE INDEX "cms_coupons_updated_at_idx" ON "payload"."cms_coupons" USING btree ("updated_at");
  CREATE INDEX "cms_coupons_created_at_idx" ON "payload"."cms_coupons" USING btree ("created_at");
  CREATE INDEX "cms_site_settings_default_share_image_idx" ON "payload"."cms_site_settings" USING btree ("default_share_image_id");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("cms_categories_id") REFERENCES "payload"."cms_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("cms_products_id") REFERENCES "payload"."cms_products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("cms_media_id") REFERENCES "payload"."cms_media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vases_fk" FOREIGN KEY ("cms_vases_id") REFERENCES "payload"."cms_vases"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_addons_fk" FOREIGN KEY ("cms_addons_id") REFERENCES "payload"."cms_addons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk" FOREIGN KEY ("cms_coupons_id") REFERENCES "payload"."cms_coupons"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_categories_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_categories_id");
  CREATE INDEX "payload_locked_documents_rels_cms_products_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_products_id");
  CREATE INDEX "payload_locked_documents_rels_cms_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_media_id");
  CREATE INDEX "payload_locked_documents_rels_cms_vases_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_vases_id");
  CREATE INDEX "payload_locked_documents_rels_cms_addons_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_addons_id");
  CREATE INDEX "payload_locked_documents_rels_cms_coupons_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_coupons_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_categories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_products_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_products_sizes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_products_occasions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_products_care_tips" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_products_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_vases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_addons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_coupons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload"."cms_site_settings" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_categories" CASCADE;
  DROP TABLE "payload"."cms_products_tags" CASCADE;
  DROP TABLE "payload"."cms_products_sizes" CASCADE;
  DROP TABLE "payload"."cms_products_occasions" CASCADE;
  DROP TABLE "payload"."cms_products_care_tips" CASCADE;
  DROP TABLE "payload"."cms_products" CASCADE;
  DROP TABLE "payload"."cms_products_rels" CASCADE;
  DROP TABLE "payload"."cms_media" CASCADE;
  DROP TABLE "payload"."cms_vases" CASCADE;
  DROP TABLE "payload"."cms_addons" CASCADE;
  DROP TABLE "payload"."cms_coupons" CASCADE;
  DROP TABLE "payload"."cms_site_settings" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_categories_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_products_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vases_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_addons_fk";
  
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_coupons_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_cms_categories_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_cms_products_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_cms_media_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_cms_vases_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_cms_addons_id_idx";
  DROP INDEX "payload"."payload_locked_documents_rels_cms_coupons_id_idx";
  ALTER TABLE "payload"."cms_users" ALTER COLUMN "role" SET DEFAULT 'admin';
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_categories_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_products_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_media_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_vases_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_addons_id";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_coupons_id";
  DROP TYPE "payload"."enum_cms_products_tags";
  DROP TYPE "payload"."enum_cms_products_occasions";
  DROP TYPE "payload"."enum_cms_products_stock_status";
  DROP TYPE "payload"."enum_cms_products_status";
  DROP TYPE "payload"."enum_cms_vases_stock_status";
  DROP TYPE "payload"."enum_cms_addons_category";
  DROP TYPE "payload"."enum_cms_addons_stock_status";
  DROP TYPE "payload"."enum_cms_coupons_discount_type";`)
}

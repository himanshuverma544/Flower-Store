import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "payload"."enum_cms_orders_status" AS ENUM('Payment Pending', 'Order Received & Verified', 'Order Received', 'Crafting Floral Arrangement', 'Out for Delivery', 'Delivered', 'Payment Failed', 'Payment Expired', 'Cancelled');
  CREATE TABLE "payload"."cms_orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_id" varchar NOT NULL,
  	"status" "payload"."enum_cms_orders_status" DEFAULT 'Payment Pending' NOT NULL,
  	"current_step" numeric DEFAULT 1,
  	"date" varchar,
  	"total" numeric NOT NULL,
  	"subtotal" numeric,
  	"delivery_fee" numeric,
  	"discount" numeric,
  	"sender_name" varchar NOT NULL,
  	"sender_email" varchar NOT NULL,
  	"sender_phone" varchar,
  	"keep_secret" boolean DEFAULT false,
  	"recipient_name" varchar NOT NULL,
  	"recipient_phone" varchar NOT NULL,
  	"recipient_address" varchar NOT NULL,
  	"recipient_apt" varchar,
  	"recipient_city" varchar,
  	"recipient_state" varchar,
  	"recipient_zip" varchar,
  	"card_message" varchar,
  	"recipient_notes" varchar,
  	"delivery_date" varchar,
  	"delivery_slot" varchar,
  	"estimated_delivery" varchar DEFAULT 'Tomorrow',
  	"slot" varchar DEFAULT 'Morning (9 AM - 1 PM)',
  	"items" jsonb NOT NULL,
  	"items_json" varchar,
  	"payment_method" varchar DEFAULT 'razorpay',
  	"payment_status" varchar DEFAULT 'pending',
  	"razorpay_order_id" varchar,
  	"razorpay_payment_id" varchar,
  	"tracking_token" varchar,
  	"idempotency_key" varchar,
  	"razorpay_signature" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload"."cms_media" ADD COLUMN IF NOT EXISTS "_objectkey" varchar;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD COLUMN "cms_orders_id" integer;
  CREATE UNIQUE INDEX "cms_orders_order_id_idx" ON "payload"."cms_orders" USING btree ("order_id");
  CREATE INDEX "cms_orders_status_idx" ON "payload"."cms_orders" USING btree ("status");
  CREATE INDEX "cms_orders_sender_email_idx" ON "payload"."cms_orders" USING btree ("sender_email");
  CREATE INDEX "cms_orders_razorpay_order_id_idx" ON "payload"."cms_orders" USING btree ("razorpay_order_id");
  CREATE INDEX "cms_orders_razorpay_payment_id_idx" ON "payload"."cms_orders" USING btree ("razorpay_payment_id");
  CREATE INDEX "cms_orders_tracking_token_idx" ON "payload"."cms_orders" USING btree ("tracking_token");
  CREATE INDEX "cms_orders_idempotency_key_idx" ON "payload"."cms_orders" USING btree ("idempotency_key");
  CREATE INDEX "cms_orders_updated_at_idx" ON "payload"."cms_orders" USING btree ("updated_at");
  CREATE INDEX "cms_orders_created_at_idx" ON "payload"."cms_orders" USING btree ("created_at");
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("cms_orders_id") REFERENCES "payload"."cms_orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cms_orders_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("cms_orders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "payload"."cms_orders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "payload"."cms_orders" CASCADE;
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  DROP INDEX "payload"."payload_locked_documents_rels_cms_orders_id_idx";
  ALTER TABLE "payload"."cms_media" DROP COLUMN "_objectkey";
  ALTER TABLE "payload"."payload_locked_documents_rels" DROP COLUMN "cms_orders_id";
  DROP TYPE "payload"."enum_cms_orders_status";`)
}

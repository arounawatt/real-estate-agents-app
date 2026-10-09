CREATE TYPE "public"."listing_import_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status" "listing_import_status" DEFAULT 'pending' NOT NULL,
	"extraction" jsonb,
	"raw_text" text,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "listing_import_jobs" ADD CONSTRAINT "listing_import_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_import_jobs_tenant_idx" ON "listing_import_jobs" USING btree ("tenant_id");
CREATE TYPE "public"."agency_role" AS ENUM('owner', 'agent');--> statement-breakpoint
CREATE TYPE "public"."agent_profile" AS ENUM('sales', 'property_manager', 'catalogue', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."availability" AS ENUM('available', 'from_date');--> statement-breakpoint
CREATE TYPE "public"."charges" AS ENUM('excluded', 'included', 'none');--> statement-breakpoint
CREATE TYPE "public"."contact_kind" AS ENUM('prospect', 'tenant', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."furnished" AS ENUM('furnished', 'unfurnished', 'partly', 'to_qualify', 'none');--> statement-breakpoint
CREATE TYPE "public"."habitable" AS ENUM('yes', 'no', 'partly');--> statement-breakpoint
CREATE TYPE "public"."intent" AS ENUM('purchase', 'rental', 'investment', 'to_qualify');--> statement-breakpoint
CREATE TYPE "public"."listing_source" AS ENUM('url', 'form');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('published', 'unpublished');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('essential', 'complete');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartment', 'villa', 'land', 'commercial', 'to_qualify');--> statement-breakpoint
CREATE TYPE "public"."rent_period" AS ENUM('month', 'week', 'night', 'none');--> statement-breakpoint
CREATE TYPE "public"."ticket_nature" AS ENUM('plumbing', 'electricity', 'air_conditioning', 'locksmith', 'gas', 'admin', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."timeline" AS ENUM('immediate', 'three_months', 'six_months', 'later', 'to_qualify');--> statement-breakpoint
CREATE TYPE "public"."transaction" AS ENUM('sale', 'long_term_rental', 'short_term_rental');--> statement-breakpoint
CREATE TYPE "public"."typology" AS ENUM('studio', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6_plus', 'none');--> statement-breakpoint
CREATE TYPE "public"."urgency" AS ENUM('safety', 'urgent', 'normal', 'low');--> statement-breakpoint
CREATE TYPE "public"."utility_cut" AS ENUM('none', 'water', 'power', 'water_and_power');--> statement-breakpoint
CREATE TYPE "public"."visit_mode" AS ENUM('link_sent', 'callback_announced');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agency_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"role" "agency_role" DEFAULT 'agent' NOT NULL,
	"whatsapp_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wa_id" text NOT NULL,
	"phone" text NOT NULL,
	"full_name" text,
	"declared_city" text,
	"kind" "contact_kind" DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"profile" "agent_profile" NOT NULL,
	"last_inbound_at" timestamp with time zone,
	"handed_over_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"trigger" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"intent" "intent" DEFAULT 'to_qualify' NOT NULL,
	"property_type" "property_type" DEFAULT 'to_qualify' NOT NULL,
	"zone" text,
	"budget_amount" integer,
	"budget_currency" text DEFAULT 'XOF',
	"timeline" timeline DEFAULT 'to_qualify' NOT NULL,
	"notes" text,
	"score" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text,
	"bytes" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"language" text DEFAULT 'fr' NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"meta_template_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"body" text,
	"template_name" text,
	"button_payload" text,
	"meta_message_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"transaction" "transaction" NOT NULL,
	"type" "property_type" NOT NULL,
	"typology" "typology" DEFAULT 'none' NOT NULL,
	"city" text,
	"district" text,
	"floor" text,
	"area_sqm" integer,
	"rooms" integer,
	"bedrooms" integer,
	"bathrooms" integer,
	"guest_toilet" boolean,
	"price" integer,
	"rent_period" "rent_period" DEFAULT 'none' NOT NULL,
	"charges" charges DEFAULT 'none' NOT NULL,
	"furnished" "furnished" DEFAULT 'none' NOT NULL,
	"availability" "availability" DEFAULT 'available' NOT NULL,
	"available_from" date,
	"status" "listing_status" DEFAULT 'unpublished' NOT NULL,
	"amenities" text[] DEFAULT '{}' NOT NULL,
	"services" text[] DEFAULT '{}' NOT NULL,
	"notes" text,
	"listing_url" text,
	"source_url" text,
	"raw_listing" text,
	"source" "listing_source" DEFAULT 'form' NOT NULL,
	"fields_to_confirm" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prospect_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"status" text DEFAULT 'offered' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sourced_prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text,
	"full_name" text,
	"source_url" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plan" "plan" DEFAULT 'essential' NOT NULL,
	"listing_domains" text[] DEFAULT '{}' NOT NULL,
	"booking_url_rental" text,
	"booking_url_sale" text,
	"split_booking_links" boolean DEFAULT false NOT NULL,
	"emergency_numbers" jsonb,
	"disclosure_level" text DEFAULT 'neighbourhood' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"subject_as_declared" text NOT NULL,
	"nature" "ticket_nature" NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"habitable" "habitable",
	"utility_cut" "utility_cut",
	"safety_risk" boolean,
	"worsening" boolean,
	"safety_reason" text,
	"urgency" "urgency" DEFAULT 'normal' NOT NULL,
	"urgency_reason" text,
	"urgency_forced" "urgency",
	"urgency_forced_by" uuid,
	"urgency_forced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visit_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"property_id" uuid,
	"intent" "intent" NOT NULL,
	"mode" "visit_mode" NOT NULL,
	"booking_url_sent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"waba_id" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"display_phone_number" text,
	"access_token_encrypted" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agency_users" ADD CONSTRAINT "agency_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "escalations" ADD CONSTRAINT "escalations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "escalations" ADD CONSTRAINT "escalations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_media" ADD CONSTRAINT "message_media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_media" ADD CONSTRAINT "message_media_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prospect_matches" ADD CONSTRAINT "prospect_matches_prospect_id_sourced_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."sourced_prospects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prospect_matches" ADD CONSTRAINT "prospect_matches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tickets" ADD CONSTRAINT "tickets_urgency_forced_by_agency_users_id_fk" FOREIGN KEY ("urgency_forced_by") REFERENCES "public"."agency_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visit_requests" ADD CONSTRAINT "visit_requests_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agency_users_tenant_idx" ON "agency_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agency_users_whatsapp_idx" ON "agency_users" USING btree ("whatsapp_number");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_tenant_wa_idx" ON "contacts" USING btree ("tenant_id","wa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_tenant_idx" ON "conversations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_idx" ON "leads" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_tenant_name_idx" ON "message_templates" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_conversation_idx" ON "messages" USING btree ("conversation_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "properties_tenant_ref_idx" ON "properties" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_status_idx" ON "properties" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "prospect_matches_idx" ON "prospect_matches" USING btree ("prospect_id","tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tickets_tenant_ref_idx" ON "tickets" USING btree ("tenant_id","reference");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visit_requests_tenant_idx" ON "visit_requests" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_accounts_phone_number_idx" ON "whatsapp_accounts" USING btree ("phone_number_id");
ALTER TABLE "message_media" ALTER COLUMN "storage_key" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "message_media" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "message_media" ADD COLUMN "data" "bytea";--> statement-breakpoint
ALTER TABLE "message_media" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "description" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "message_media" ADD CONSTRAINT "message_media_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_media_message_idx" ON "message_media" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_media_ticket_idx" ON "message_media" USING btree ("ticket_id");
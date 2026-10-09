DROP INDEX IF EXISTS "leads_tenant_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "tickets_status_idx";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "conversations_tenant_last_inbound_idx" ON "conversations" USING btree ("tenant_id","last_inbound_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_created_idx" ON "leads" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_contact_idx" ON "leads" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messages_tenant_sent_at_idx" ON "messages" USING btree ("tenant_id","sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "properties_tenant_created_idx" ON "properties" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_status_created_idx" ON "tickets" USING btree ("tenant_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_tenant_created_idx" ON "tickets" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tickets_tenant_contact_idx" ON "tickets" USING btree ("tenant_id","contact_id");
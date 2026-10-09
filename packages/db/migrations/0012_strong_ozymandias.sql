CREATE TYPE "public"."conversation_close_reason" AS ENUM('contact_became_tenant');--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "closed_reason" "conversation_close_reason";--> statement-breakpoint
-- Contacts déjà passés en locataire avant cette colonne : leur conversation
-- avec Coumba est terminée, comme elle l'aurait été au moment du passage.
UPDATE "conversations" SET "closed_at" = now(), "closed_reason" = 'contact_became_tenant'
WHERE "profile" = 'sales' AND "contact_id" IN (SELECT "id" FROM "contacts" WHERE "kind" = 'tenant');

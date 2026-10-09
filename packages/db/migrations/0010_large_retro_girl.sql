CREATE TYPE "public"."message_media_kind" AS ENUM('image', 'video');--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "media_kind" "message_media_kind";--> statement-breakpoint
-- Les photos reçues avant cette colonne : leur message est un message image.
UPDATE "messages" SET "media_kind" = 'image' WHERE "id" IN (SELECT "message_id" FROM "message_media");

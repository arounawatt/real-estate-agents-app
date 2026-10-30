CREATE TYPE "public"."residence" AS ENUM('senegal', 'abroad', 'to_qualify');--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "residence" "residence" DEFAULT 'to_qualify' NOT NULL;
ALTER TABLE "conversation" ADD COLUMN "status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "requested_by" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "dm_policy";--> statement-breakpoint
-- Conversations from before message requests existed stay open as normal chats.
UPDATE "conversation" SET "status" = 'ACCEPTED' WHERE "requested_by" IS NULL;

ALTER TABLE "email_code" ADD COLUMN IF NOT EXISTS "prev_code_hash" text;--> statement-breakpoint
ALTER TABLE "email_code" ADD COLUMN IF NOT EXISTS "prev_expires_at" timestamp with time zone;

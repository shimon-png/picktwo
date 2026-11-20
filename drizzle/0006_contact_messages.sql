CREATE TABLE IF NOT EXISTS "contact_message" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"user_id" text,
	"page_url" text,
	"user_agent" text,
	"status" text DEFAULT 'NEW' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_by" text,
	"handled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_message_status" ON "contact_message" USING btree ("status","created_at");
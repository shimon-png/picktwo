CREATE TABLE "email_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"payload" jsonb,
	"send_after" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_log_user_kind_ref" ON "email_log" USING btree ("user_id","kind","ref");--> statement-breakpoint
CREATE INDEX "email_log_status_after" ON "email_log" USING btree ("status","send_after");--> statement-breakpoint
CREATE INDEX "email_log_user_sent" ON "email_log" USING btree ("user_id","sent_at");
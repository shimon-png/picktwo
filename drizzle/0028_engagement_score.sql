ALTER TABLE "vote" ADD COLUMN "returned_after_days" integer;--> statement-breakpoint
ALTER TABLE "battle" ADD COLUMN "engagement_score" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "battle" ADD COLUMN "engagement_voters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "battle" ADD COLUMN "engagement_returns" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "battle" ADD COLUMN "engagement_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vote_device_created" ON "vote" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_device_created" ON "analytics_event" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_user_created" ON "analytics_event" USING btree ("user_id","created_at");

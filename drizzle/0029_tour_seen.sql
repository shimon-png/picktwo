ALTER TABLE "user" ADD COLUMN "tour_seen_at" timestamp with time zone;--> statement-breakpoint
-- Everyone who already has an account has logged in before: don't auto-show the tutorial to them again.
UPDATE "user" SET "tour_seen_at" = now() WHERE "tour_seen_at" IS NULL;

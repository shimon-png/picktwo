ALTER TABLE "user" ADD COLUMN "correct_picks" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vote" ADD COLUMN "voter_correct" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill lifetime correct picks from the per-category reputation rows.
UPDATE "user" u SET "correct_picks" = r.c FROM (SELECT "user_id", SUM("correct")::int AS c FROM "reputation" GROUP BY "user_id") r WHERE r."user_id" = u."id";--> statement-breakpoint
-- Existing votes: use the voter's current count as the snapshot.
UPDATE "vote" v SET "voter_correct" = u."correct_picks" FROM "user" u WHERE u."id" = v."user_id" AND u."correct_picks" > 0;--> statement-breakpoint
-- Battles run at most 5 days: shorten open battles that were set longer.
UPDATE "battle" SET "deadline" = "created_at" + interval '5 days' WHERE "status" = 'OPEN' AND "deadline" > "created_at" + interval '5 days';

-- Two launch-battle stories that repeated their titles (Alex, Nov 22 2026). Source: scripts/launch-battles.data.ts.
UPDATE "battle" SET "context" = 'He says he doesn''t even remember following them.', "updated_at" = now() WHERE "id" = 'seed_vb_42';
--> statement-breakpoint
UPDATE "battle" SET "context" = 'It was amicable. We''re still friendly.', "updated_at" = now() WHERE "id" = 'seed_vb_74';

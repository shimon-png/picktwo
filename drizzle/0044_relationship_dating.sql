-- Relationship card is now exactly Single / Married / Dating (Alex, Nov 27 2026: "Taken" isn't a usual option).
-- Fold earlier "Taken" answers into Dating (closest meaning: with someone, not married) on profiles and card rows,
-- so Settings, Pickbot and the Brain never see an option that no longer exists.
UPDATE "user" SET "relationship" = 'DATING' WHERE "relationship" = 'TAKEN';
--> statement-breakpoint
UPDATE "profile_answer" SET "answer" = 'DATING' WHERE "question" = 'relationship' AND "answer" = 'TAKEN';

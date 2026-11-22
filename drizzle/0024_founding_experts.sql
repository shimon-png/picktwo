-- Founding experts (Alex, Nov 22 2026): Alex, Shimon and four early testers start at Expert (50 correct picks)
-- so the Expert score has voters before real outcomes come in. Alex and Shimon match by the built-in admin
-- email hashes (see server/viewer.ts); the others by username. Their earlier votes count as Expert votes too.
CREATE TEMP TABLE founding_experts AS
SELECT u.id FROM "user" u
WHERE u.id NOT LIKE 'seed%' AND (
  (u.email IS NOT NULL AND encode(sha256(convert_to(lower(trim(u.email)), 'UTF8')), 'hex') IN (
    '5e9f440b7e914675cde69f6c438249f74dd116c60c2b932db5b6cd50cddc741b',
    '4ce333e403d5ae4355cb28d924f03aad5c2689274b255442803022e6e5469f15',
    '03a2f7eafc5cce85cb859f0f44dbdd572f3658afb5d4fc463451203771c554b2'))
  OR lower(u.handle) LIKE 'chizhik2%'
  OR lower(u.handle) LIKE 'emathias%'
  OR lower(u.handle) LIKE 'ashkrewer%'
  OR lower(u.handle) LIKE '%perepelinsky%'
  OR lower(coalesce(u.name, '')) LIKE '%perepelinsky%'
);
--> statement-breakpoint
UPDATE "user" SET "correct_picks" = greatest("correct_picks", 50) WHERE id IN (SELECT id FROM founding_experts);
--> statement-breakpoint
UPDATE "vote" SET "voter_correct" = greatest("voter_correct", 50) WHERE user_id IN (SELECT id FROM founding_experts);
--> statement-breakpoint
DROP TABLE founding_experts;

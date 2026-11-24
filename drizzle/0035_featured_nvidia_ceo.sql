-- Featured battle (Shimon, Nov 24 2026): "Should Jensen Huang have been reinstated as CEO of Nvidia?", text-only
-- Yes / No, posted by the crowdpick trending account. tags.featured pins it first on the homepage hero and at the top
-- of everyone's Vote deck while it's open. No fake votes. Idempotent: re-running inserts nothing.
INSERT INTO "user" ("id", "handle", "name", "is_adult_confirmed", "onboarded_at", "kid_ages")
VALUES ('seed_trend_u1', 'crowdpick_trends', 'crowdpick', true, now(), '{}')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "battle" ("id", "slug", "author_id", "title", "context", "category_id", "tags", "deadline", "created_at")
VALUES ('seed_trend_1', 'ijFLNZnv', (SELECT id FROM "user" WHERE handle = 'crowdpick_trends'),
  'Should Jensen Huang have been reinstated as CEO of Nvidia?', 'Nvidia’s board brought him back 11 days after he resigned.',
  'other', '{"featured": true}'::jsonb, now() + interval '120 hours', now())
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "option" ("id", "battle_id", "side", "label")
VALUES ('seed_trend_1_a', 'seed_trend_1', 'A', 'Yes'), ('seed_trend_1_b', 'seed_trend_1', 'B', 'No')
ON CONFLICT DO NOTHING;

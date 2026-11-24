-- Seed batch 2 fix (Alex, Nov 23 2026 11:31pm ET): when a photo battle compares two looks of a person or couple,
-- both photos must show the SAME people. Christmas card: same couple from one Pexels shoot, with and without
-- their dog. Battles where Pexels has no same-person pair become text cards (Alex loves text battles).
UPDATE "option" SET "image_url" = 'https://images.pexels.com/photos/5859857/pexels-photo-5859857.jpeg?auto=compress&cs=tinysrgb&w=1080'
WHERE "id" = 'seed_b2_p38_a';
--> statement-breakpoint
UPDATE "option" SET "image_url" = 'https://images.pexels.com/photos/5859855/pexels-photo-5859855.jpeg?auto=compress&cs=tinysrgb&w=1080'
WHERE "id" = 'seed_b2_p38_b';
--> statement-breakpoint
UPDATE "battle" SET "context" = 'The dog is a 70 lb fluffball who hates holding still.' WHERE "id" = 'seed_b2_p38';
--> statement-breakpoint
-- Long hair vs bob, second date tops, engagement photos, navy suit vs tux, red vs nude lip, blazer vs cardigan,
-- wedding guest dress, gym outfit, buzz vs curls: no same-person photo pair, so text cards.
UPDATE "option" SET "image_url" = NULL
WHERE "battle_id" IN ('seed_b2_p6', 'seed_b2_p11', 'seed_b2_p14', 'seed_b2_p24', 'seed_b2_p34', 'seed_b2_p41', 'seed_b2_p43', 'seed_b2_p47', 'seed_b2_p50');

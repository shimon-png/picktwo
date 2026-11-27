-- Unpin the featured Jensen Huang battle (Alex, Nov 27 2026): it was the last card for more bounced visitors than
-- any other battle (21 people in 7 days, 12 left without voting). It stays open as a normal battle.
UPDATE "battle" SET "tags" = "tags" - 'featured' WHERE "id" = 'seed_trend_1';

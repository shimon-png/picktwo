-- About-you cards v2 (Alex, Nov 25 2026): the ZIP card is gone (ZIP comes from the IP) and kids / home are asked
-- without an account, earlier. A saved admin Config row may still hold the old schedule, which would override the
-- new defaults, so drop those three keys where they still have their old default values. Old code reads the same
-- defaults for them, so nothing changes until the new code ships.
UPDATE "app_config" SET "value" = "value" - 'aboutZipAt', "updated_at" = now()
WHERE "key" = 'economy' AND "value"->>'aboutZipAt' = '12';
--> statement-breakpoint
UPDATE "app_config" SET "value" = "value" - 'aboutKidsAt', "updated_at" = now()
WHERE "key" = 'economy' AND "value"->>'aboutKidsAt' = '20';
--> statement-breakpoint
UPDATE "app_config" SET "value" = "value" - 'aboutHousingAt', "updated_at" = now()
WHERE "key" = 'economy' AND "value"->>'aboutHousingAt' = '25';

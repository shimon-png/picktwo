-- Brain "Before vs after" (Shimon, Nov 26 2026): split the launch day at the minute the about-you change went live
-- (11:23 New York). Only touches a saved admin Config row that still holds the old day-only default.
UPDATE "app_config" SET "value" = jsonb_set("value", '{beforeAfterFrom}', '202611251123'::jsonb), "updated_at" = now()
WHERE "key" = 'economy' AND "value"->>'beforeAfterFrom' = '20261125';

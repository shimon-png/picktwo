-- Free votes before the sign-up gate: 5 → 15 (Shimon, Nov 25 2026). The code default changed too; this also updates
-- a saved admin Config row, which would otherwise keep overriding the default with the old value.
UPDATE "app_config" SET "value" = jsonb_set("value", '{guestVoteLimit}', '15'::jsonb), "updated_at" = now()
WHERE "key" = 'economy' AND "value" ? 'guestVoteLimit';

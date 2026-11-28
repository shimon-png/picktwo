CREATE INDEX IF NOT EXISTS "device_user" ON "device" USING btree ("user_id");--> statement-breakpoint
-- Brain speed-up (Nov 27 2026): the admin numbers are big counting queries whose cost estimates trip Postgres's
-- JIT compiler, which then spends 0.5-1.5s compiling each one before running it (measured locally). The app's
-- normal queries are small and never gain from JIT, so turn it off for the app's own database role. Harmless if
-- the server has no JIT; skipped (not failed) if the role may not change its own defaults.
DO $$ BEGIN
  EXECUTE format('ALTER ROLE %I SET jit = off', current_user);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'jit default not changed: %', SQLERRM;
END $$;

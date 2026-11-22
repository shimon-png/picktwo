-- Seed photo battles (Alex, Nov 22 2026): 10 open product/shopping battles with real photos of real
-- products from Pexels (free licence: commercial use, no attribution required; hotlinked from images.pexels.com).
-- No fake votes; each by its own generated profile. Idempotent.
INSERT INTO "user" ("id", "handle", "name", "is_adult_confirmed", "onboarded_at", "kid_ages") VALUES
  ('seed_pu_1', 'latteliz_22', 'latteliz_22', true, now(), '{}'),
  ('seed_pu_2', 'kicksbykai', 'kicksbykai', true, now(), '{}'),
  ('seed_pu_3', 'skatepark_mo', 'skatepark_mo', true, now(), '{}'),
  ('seed_pu_4', 'chapterandcoffee', 'chapterandcoffee', true, now(), '{}'),
  ('seed_pu_5', 'gamenight_jess', 'gamenight_jess', true, now(), '{}'),
  ('seed_pu_6', 'commute_cam', 'commute_cam', true, now(), '{}'),
  ('seed_pu_7', 'upgrade_ana', 'upgrade_ana', true, now(), '{}'),
  ('seed_pu_8', 'partypics_nina', 'partypics_nina', true, now(), '{}'),
  ('seed_pu_9', 'lastminute_lou', 'lastminute_lou', true, now(), '{}'),
  ('seed_pu_10', 'hikehydrate', 'hikehydrate', true, now(), '{}')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "battle" ("id", "slug", "author_id", "title", "context", "category_id", "tags", "deadline", "created_at") VALUES
  ('seed_pb_1', 'pFsTJTxj', (SELECT id FROM "user" WHERE handle = 'latteliz_22'), 'Morning coffee run: which one?', 'Same price, both on my way to work.', 'other', '{}'::jsonb, now() + interval '108 hours', now() - interval '16 minutes'),
  ('seed_pb_2', 'pyFsS4EV', (SELECT id FROM "user" WHERE handle = 'kicksbykai'), 'Everyday white sneakers for spring?', 'Want one pair that goes with jeans and dresses.', 'other', '{}'::jsonb, now() + interval '98 hours', now() - interval '576 minutes'),
  ('seed_pb_3', 'paTQjDyk', (SELECT id FROM "user" WHERE handle = 'skatepark_mo'), 'Converse or Vans for my teenager?', 'He''s 15, wants something for school and skating.', 'other', '{}'::jsonb, now() + interval '105 hours', now() - interval '220 minutes'),
  ('seed_pb_4', 'pdM5neHU', (SELECT id FROM "user" WHERE handle = 'chapterandcoffee'), 'Kindle or real books?', 'I read about 2 books a month, mostly at night.', 'other', '{}'::jsonb, now() + interval '105 hours', now() - interval '419 minutes'),
  ('seed_pb_5', 'p46fbd5T', (SELECT id FROM "user" WHERE handle = 'gamenight_jess'), 'Holiday gift for my 12 year old', 'Our first console. Budget isn''t the issue, fun is.', 'other', '{}'::jsonb, now() + interval '116 hours', now() - interval '233 minutes'),
  ('seed_pb_6', 'pfCDhTCi', (SELECT id FROM "user" WHERE handle = 'commute_cam'), 'Headphones for a long subway commute?', '45 minutes each way, I also take calls.', 'other', '{}'::jsonb, now() + interval '118 hours', now() - interval '325 minutes'),
  ('seed_pb_7', 'p9QLkV9d', (SELECT id FROM "user" WHERE handle = 'upgrade_ana'), 'Time to upgrade my phone. Which one?', 'Coming from an old iPhone 11. Camera matters most.', 'other', '{}'::jsonb, now() + interval '94 hours', now() - interval '524 minutes'),
  ('seed_pb_8', 'p5fAPBTP', (SELECT id FROM "user" WHERE handle = 'partypics_nina'), 'Camera for my sister''s bachelorette weekend?', 'Want fun photos we''ll actually keep.', 'other', '{}'::jsonb, now() + interval '114 hours', now() - interval '493 minutes'),
  ('seed_pb_9', 'pPzKbSXf', (SELECT id FROM "user" WHERE handle = 'lastminute_lou'), 'Where should I order the birthday gift?', 'Party is in 3 days.', 'other', '{}'::jsonb, now() + interval '96 hours', now() - interval '272 minutes'),
  ('seed_pb_10', 'pxy8VzUu', (SELECT id FROM "user" WHERE handle = 'hikehydrate'), 'Tumbler for long workdays?', 'Want ice to last all day in my car.', 'other', '{}'::jsonb, now() + interval '91 hours', now() - interval '263 minutes')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "option" ("id", "battle_id", "side", "label", "description", "image_url")
SELECT v."id", v."battle_id", v."side"::side, v."label", v."description", v."image_url" FROM (VALUES
  ('seed_po_1_a', 'seed_pb_1', 'A', 'Starbucks', 'Oat latte, mobile order, in and out.', 'https://images.pexels.com/photos/7133631/pexels-photo-7133631.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_1_b', 'seed_pb_1', 'B', 'Dunkin''', 'Iced coffee and a donut, faster drive-thru.', 'https://images.pexels.com/photos/17230069/pexels-photo-17230069.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_2_a', 'seed_pb_2', 'A', 'Nike Air Force 1', 'Classic and clean, a bit chunky.', 'https://images.pexels.com/photos/4328466/pexels-photo-4328466.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_2_b', 'seed_pb_2', 'B', 'New Balance 990', 'Comfy dad-shoe look, great for walking all day.', 'https://images.pexels.com/photos/32044922/pexels-photo-32044922.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_3_a', 'seed_pb_3', 'A', 'Converse Chuck Taylor', 'Timeless high-tops, goes with everything.', 'https://images.pexels.com/photos/7900619/pexels-photo-7900619.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_3_b', 'seed_pb_3', 'B', 'Vans Old Skool', 'Flat grippy sole, made for skating.', 'https://images.pexels.com/photos/11864089/pexels-photo-11864089.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_4_a', 'seed_pb_4', 'A', 'Kindle', 'Light, backlit for bed, cheaper ebooks.', 'https://images.pexels.com/photos/76942/pexels-photo-76942.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_4_b', 'seed_pb_4', 'B', 'Paper books', 'Nothing beats turning real pages, and no screen.', 'https://images.pexels.com/photos/15898640/pexels-photo-15898640.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_5_a', 'seed_pb_5', 'A', 'Nintendo Switch', 'Play on the TV or take it in the car. Mario Kart with the family.', 'https://images.pexels.com/photos/7133638/pexels-photo-7133638.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_5_b', 'seed_pb_5', 'B', 'PlayStation 5', 'Bigger games and better graphics, stays on the TV.', 'https://images.pexels.com/photos/33513532/pexels-photo-33513532.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_6_a', 'seed_pb_6', 'A', 'AirPods', 'Tiny, always in my pocket, easy with my iPhone.', 'https://images.pexels.com/photos/10024624/pexels-photo-10024624.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_6_b', 'seed_pb_6', 'B', 'Sony over-ear', 'Better noise cancelling and battery, but bulky.', 'https://images.pexels.com/photos/33481395/pexels-photo-33481395.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_7_a', 'seed_pb_7', 'A', 'iPhone', 'Easy switch, keeps my messages and photos the same.', 'https://images.pexels.com/photos/9667336/pexels-photo-9667336.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_7_b', 'seed_pb_7', 'B', 'Samsung Galaxy', 'Big zoom camera and a fun change.', 'https://images.pexels.com/photos/30466750/pexels-photo-30466750.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_8_a', 'seed_pb_8', 'A', 'Instax instant camera', 'Prints on the spot, everyone takes one home.', 'https://images.pexels.com/photos/14580301/pexels-photo-14580301.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_8_b', 'seed_pb_8', 'B', 'Just use our phones', 'Unlimited shots, share to the group chat right away.', 'https://images.pexels.com/photos/10797395/pexels-photo-10797395.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_9_a', 'seed_pb_9', 'A', 'Amazon', 'Shows up at my door, huge selection.', 'https://images.pexels.com/photos/16158539/pexels-photo-16158539.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_9_b', 'seed_pb_9', 'B', 'Target', 'Pick it up today and grab a card and wrapping too.', 'https://images.pexels.com/photos/9367101/pexels-photo-9367101.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_10_a', 'seed_pb_10', 'A', 'Stanley', 'The one everyone has. Fits the cup holder.', 'https://images.pexels.com/photos/8330506/pexels-photo-8330506.jpeg?auto=compress&cs=tinysrgb&w=1080'),
  ('seed_po_10_b', 'seed_pb_10', 'B', 'YETI', 'Built like a tank, keeps ice forever.', 'https://images.pexels.com/photos/34152528/pexels-photo-34152528.jpeg?auto=compress&cs=tinysrgb&w=1080')
) AS v("id", "battle_id", "side", "label", "description", "image_url")
WHERE EXISTS (SELECT 1 FROM "battle" b WHERE b."id" = v."battle_id")
ON CONFLICT DO NOTHING;

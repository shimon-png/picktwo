INSERT INTO "category" ("id", "name", "emoji", "featured", "sort") VALUES
  ('gifts', 'Gifts', '🎁', true, 1),
  ('baby-names', 'Baby names', '🍼', false, 2),
  ('big-purchases', 'Big purchases', '🛒', false, 3),
  ('what-to-wear', 'What to wear', '👗', false, 4),
  ('home-design', 'Home & design', '🏡', false, 5),
  ('words', 'Words that matter', '✍️', false, 6),
  ('other', 'Other', '✨', false, 7)
ON CONFLICT ("id") DO NOTHING;

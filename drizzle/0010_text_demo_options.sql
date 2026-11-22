-- Demo battles were seeded with cartoon emoji tiles. Drop those images so the options show as text cards,
-- and give each demo option a sentence to show under its name.
UPDATE "option" SET "image_url" = NULL WHERE "image_url" LIKE 'data:image/svg+xml%';--> statement-breakpoint
UPDATE "option" o SET "description" = d.descr
FROM (VALUES
  ('Lego Art Set', 'Build a mosaic picture brick by brick. Hangs on the wall when it''s done.'),
  ('Deluxe paint easel', 'Two-sided easel with chalkboard, paper roll and paint cups. Gets used every day.'),
  ('Balance bike', 'No pedals, no training wheels. Burns energy outside and learns balance fast.'),
  ('Indoor climbing triangle', 'Wooden climber for the living room. Works on rainy and snowy days too.'),
  ('Crystal growing kit', 'Grow real crystals in a week. Big wow moment when they appear.'),
  ('Rubik''s-style puzzle cube', 'Small, cheap, and keeps a curious kid busy for months.'),
  ('Custom photo book', 'Ten years of our favorite photos in one book she can keep forever.'),
  ('Weekend getaway', 'Two nights somewhere new, just us. Make new memories instead of a thing.'),
  ('Eleanor', 'Classic and elegant. Nicknames: Ellie, Nora, Nell.'),
  ('Clara', 'Short, sweet, and timeless. Flows nicely with Peterson.'),
  ('James', 'Leo James Martinez. Simple, strong, classic.'),
  ('Alexander', 'Leo Alexander Martinez. Longer and a little more regal.'),
  ('Compact travel stroller', 'Folds with one hand, fits in the closet, easy on the stairs.'),
  ('Full-size jogging stroller', 'Big wheels and real suspension for bumpy city sidewalks.'),
  ('Minivan', 'Sliding doors, easy third row, tons of room for car seats.'),
  ('3-row SUV', 'AWD for snow and a bit more style, but a tighter third row.'),
  ('Blazer + jeans', 'Polished but relaxed. Says I take this seriously but fit your vibe.'),
  ('Simple black dress', 'Timeless and clean. Lets the portfolio do the talking.'),
  ('Sage green', 'Soft and earthy. Looks great against vineyard greenery.'),
  ('Dusty pink', 'Romantic and summery. Pops in photos.'),
  ('Navy blue', 'Bold and classic. Navy with oak floors is a timeless combo.'),
  ('Warm white', 'Bright, airy, and safe for resale. Lets the light do the work.'),
  ('Mural wallpaper', 'A big dinosaur jungle scene that makes the room feel like an adventure.'),
  ('Chalkboard wall', 'Draw, erase, repeat. Grows with them as they get older.'),
  ('Wooden activity cube', 'Beads, gears and shapes on every side. Grows with them for years.'),
  ('Ride-on push car', 'Scoot around the house now, push-walker for first steps.'),
  ('Dinosaur dig kit', 'Chip real-looking fossils out of a plaster block. Very dino.'),
  ('Kids'' scooter', 'Three wheels, light-up, and lots of running-around energy.'),
  ('Button-down shirt', 'Crisp and classic. Safe bet for a nice Italian place.'),
  ('Fitted sweater', 'Relaxed but put together. Warmer and a little more approachable.'),
  ('Chromebook', 'Cheap, simple, great for typing and video calls.'),
  ('iPad with keyboard', 'Pricier, but she can draw with a pencil and type too.'),
  ('"For those who don''t know me, I''m the one Mom likes best."', 'Open with a laugh so the room relaxes.'),
  ('"I''ve known Sam his whole life — all 34 years."', 'Open with heart and set a warm tone.'),
  ('Product Manager application — Jane Doe', 'Plain and professional. Easy to find later.'),
  ('Jane Doe: shipped 3 products used by 2M people', 'Leads with results so it stands out in the inbox.')
) AS d(label, descr), "battle" b, "user" u
WHERE o."label" = d.label AND o."description" IS NULL AND b."id" = o."battle_id" AND u."id" = b."author_id"
  AND (u."handle" = 'picktwo' OR u."handle" LIKE 'demo\_%');

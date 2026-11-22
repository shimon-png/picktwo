-- "Who's right?" on every Me-vs-partner launch battle; two stories reworded (Alex, Nov 22 2026). Source: scripts/launch-battles.data.ts.
UPDATE "battle" b SET "title" = v.t, "context" = v.c, "updated_at" = now()
FROM (VALUES
  ('seed_vb_2', 'He says if I make dinner, packing his lunch for tomorrow is ''basically the same thing''. Who''s right?', 'He''s a grown man with two working hands lol'),
  ('seed_vb_6', 'Party invite says 7pm. My wife wants to leave the house at 6:45. I say show up 7:30. Who''s right?', 'This happens before every single party.'),
  ('seed_vb_7', 'I cooked a full dinner. He thinks whoever''s ''less tired'' does the dishes. I think the cook never cleans. Who''s right?', 'Every night. Every single night.'),
  ('seed_vb_9', 'He sat in the car scrolling for 20 min after getting home instead of coming inside to help with the kids. Who''s right?', 'I''ve had both kids since 7am.'),
  ('seed_vb_10', 'My wife wants to split the honeymoon 50/50 even though I make 3x what she makes. Who''s right?', 'Plot twist, I''m the one who wants to pay more. She refuses.'),
  ('seed_vb_11', 'I took ONE sip of his iced mocha while pregnant and he made it a whole thing. Who''s right?', 'He read one article and now he''s the caffeine police.'),
  ('seed_vb_12', 'My boyfriend wants his gaming setup in OUR bedroom. RGB lights all night. I want it out. Who''s right?', 'Small apartment, no spare room.'),
  ('seed_vb_13', 'My husband told his whole friend group about our fertility struggles without asking me. Who''s right?', 'I found out from his friend''s wife.'),
  ('seed_vb_14', 'I want separate blankets in bed (the Scandinavian way). He thinks it means we''re drifting apart. Who''s right?', 'I''m freezing, he steals everything, I sleep so much better under my own.'),
  ('seed_vb_17', 'My husband invited his brother to stay with us for ''a couple weeks''. It''s been 3 months. Who''s right?', 'He doesn''t pay rent and eats all the snacks.'),
  ('seed_vb_19', 'I left the dishwasher running while we were out. He says that''s a fire hazard and dangerous. Who''s right?', 'I''ve done this my whole life. Never once seen a fire.'),
  ('seed_vb_20', 'She wants to spend every holiday at her parents'' because ''my family is more fun''. Who''s right?', 'It''s been 3 years in a row at hers. My mom cried last Christmas.'),
  ('seed_vb_22', 'He wants to use our wedding gift money on a new truck. I want it in savings. Who''s right?', 'We got $14k in gifts. His truck works fine.'),
  ('seed_vb_24', 'I want to keep my last name when we get married. He says it means I''m not fully committed. Who''s right?', 'My name is on my business. I''ve built it for 9 years.'),
  ('seed_vb_30', 'I want to sleep train our baby. My husband can''t handle the crying and keeps going in. Who''s right?', 'She''s 7 months. Nobody in this house has slept since July.'),
  ('seed_vb_32', 'I asked my husband to get the kids ready while I showered. He said he was ''babysitting''. Who''s right?', 'BABYSITTING. His own kids.'),
  ('seed_vb_35', 'He took a job in another state without telling me until AFTER he accepted. We''ve been married 4 years. Who''s right?', 'It''s a big raise. He thought I''d ''obviously say yes''.'),
  ('seed_vb_36', 'My wife won''t let me go to my buddy''s bachelor party because there will be strippers. Who''s right?', 'It''s in Nashville. I told her I''d leave before that part.'),
  ('seed_vb_39', 'My girlfriend says it''s a red flag that I''ve never posted her on Instagram. We''ve been together a year. Who''s right?', 'I post like twice a year. Never posted an ex either.'),
  ('seed_vb_40', 'He forgot our anniversary but says ''every day with you is our anniversary''. Who''s right?', 'I got nothing at all. He thinks that one line covers it.'),
  ('seed_vb_56', 'My bf DMs girls ''happy birthday 🎉'' on Instagram. Even ones he barely knows. Weird?', 'He goes out of his way to DM every single one.')
) AS v(id, t, c)
WHERE b.id = v.id;

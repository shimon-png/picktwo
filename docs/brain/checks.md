# Integrity checks

Run before every analysis (and daily once the Brain page exists). Record the date and result below.

| Check | Query idea | Expect |
| --- | --- | --- |
| Deck votes have a view | `vote_cast` with `source='feed'` and no `card_shown` for the same battle + session | ≈ 0 (old cached clients aside) |
| No future events | `analytics_event.created_at > now()` | 0 |
| Client clock sanity | `abs(created_at - props.clientAt) > 1 day` | small share |
| Vote counts match | `battle.votes_a + votes_b` vs `count(vote)` per battle | equal |
| Seed separation | real-only queries return 0 rows with `source='seed'` or battle id `seed_%` | 0 |
| Bot share | share of events with `props.bot` | small; investigate spikes |
| Sudden spikes / drops | events per hour vs 7-day average | within 3× |

## Results log

| Date | Result | Notes |
| --- | --- | --- |

## Number scrub (Nov 24 2026)

What was wrong and is now fixed:
- Clean view dropped real people's votes on seed battles (PR 87). Only `vote.source = 'seed'` is excluded now.
- Text vs photo counted every display and votes from any time (PR 87). Now person × battle, votes in the window.
- Visitors / voters counted a guest browser and the account it signed into as two people. Now `WHO_E` / `WHO_V`.
- Sign-ups came from the `onboarding_completed` event on the tiles but from the user table elsewhere; sign-ups by source included admins and ignored the clean start date. Now one rule, `brainScope().us`.
- Skips ignored the clean filter (admins, start date) and dropped real skips of seed battles.
- Day-by-day "Battles posted" left out deleted battles while the tile counted them.
- "How deep people go" put cards with no position into 50+.
- Theme / stakes votes were all-time while views were windowed.
- Engagement score table hid seed battles in the clean view, though the score only uses real votes.

The Brain page runs `brainChecks()` on every load and shows any rule that fails.

### Follow-up (Nov 24 2026, Alex: "the two numbers don't add to 700")
- Text vs photo "Voted" (443 + 221 = 664) only counted votes on cards the same person had been shown in the Vote deck. The 36 others were votes made on the homepage card, battle pages / shared links or Discover (no deck view), plus deck votes where the view was logged under the guest device and the vote under the new account.
- Fix: Text vs photo now has an **All votes** column (every counted vote, by whether the battle has photos) that adds up to the votes tile, and a new **Where votes were made** table (place × text/photo, total = tile). The deck columns match person × battle across device → account and only count deck votes. New self-check: places total = votes tile.

## Number re-audit (Nov 25 2026)

Fixed:
- "Hit sign-up wall" counted times the wall showed, while its list counted people. Group B of the gate test sees the closable dialog again every few votes, so the tile ran high. Now it counts people (tile renamed "People who hit the sign-up wall").
- Next-day return called everyone "new" on the first day of the window (the 24h view was all new). "First seen" now looks back to the clean start.
- The old "By theme" table only covered battles posted by real people (seed battles had no AI tag), i.e. a few battles while most votes are on seed content. Replaced by "Which themes work", which covers every battle.
- "By stakes" vote rate matched votes from any time and seed votes; now the same window and scope as the votes tile, and seed battles count once they have an AI tag.
- New live checks: theme votes = Votes tile, theme skips = Skips tile, theme cards seen = Text vs photo cards seen.

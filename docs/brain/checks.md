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

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

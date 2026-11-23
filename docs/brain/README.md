# The data brain

Shared notebook for Alex, Shimon and Claude: hypotheses, data requests, findings, and the list of every variable we track.
Plan (Nov 22 2026): https://claude.ai/artifact/VK6Ymz4JmubjruAQVyzQ2d

| File | What goes in it |
| --- | --- |
| [hypotheses.md](./hypotheses.md) | Ideas to test, one per row, with status |
| [requests.md](./requests.md) | Questions to answer from the data, numbered |
| [findings/](./findings/) | One note per answered request: answer, numbers, query, date |
| [data-dictionary.md](./data-dictionary.md) | Every variable/event: meaning, where it lives, since when |
| [checks.md](./checks.md) | Integrity checks and their latest results |
| `/admin/brain` (live app) | Standing numbers: visits, views, votes per view, text vs photo, sources, next-day return, deck depth, pick method, 50/50 vs one-sided, Shimon's engagement score |

## How to use it

- Tell Claude (in the Crowd Pick project, or Shimon's Claude Code) "add a hypothesis: …" or "new data request: …". Claude adds a row, and when it answers writes `findings/NNN-short-name.md` and updates the status.
- Name a new variable → it gets a row in `data-dictionary.md` first (name, meaning, table/event, start date), then code.

## Rules for the data

1. **Raw facts, not conclusions.** Log who / what / when / where on screen / which content version. Scores are computed from the raw log and can be recomputed.
2. **Append-only.** `analytics_event` rows are never edited or deleted (except account deletion). Fixes happen in analysis.
3. **Server stamps identity and time.** The browser reports what it showed; `/api/events` attaches user, device and server time.
4. **Seed is never mixed with real.** Seed votes: `vote.source = 'seed'` / device `seedvote_%`. Seed battles: ids `seed_%`. Exclude both by default.
5. **Flag, don't delete.** Bots (`props.bot`), flagged votes (`vote.flagged`), admins/testers are filtered at query time.
6. **Privacy.** Analysis is about groups, never individuals. No names in findings; profiles only through `data_consent`. Kids: age ranges only.
7. **Go easy on the live DB.** Analysis queries are read-only, run off-peak; heavy work moves to a nightly copy as volume grows.

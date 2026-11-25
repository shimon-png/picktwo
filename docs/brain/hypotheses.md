# Hypotheses

Status: OPEN (not tested) · TESTING · TRUE · FALSE · NEEDS DATA. Add new rows at the bottom.

| # | Hypothesis | From | Date | Data needed | Status |
| --- | --- | --- | --- | --- | --- |
| H1 | Photo battles get more votes per view than text battles | Alex | 2026-11-22 | `card_shown.kind` + `vote_cast` | NEEDS DATA (from 2026-11-23) |
| H2 | The order of cards matters (e.g. text, photo, photo keeps people voting longer) | Alex | 2026-11-22 | `card_shown.pos`, `prevKinds`, session | NEEDS DATA |
| H3 | Some themes (couples, dating, money, weddings) draw more and faster votes | Alex | 2026-11-22 | battle theme tags (retroactive) + votes, `dwellMs` | OPEN |
| H4 | Close (50/50) battles are more engaging than lopsided ones | Alex | 2026-11-22 | final split + votes per view + return rate | OPEN |
| H5 | Colours / content of photos affect engagement | Alex | 2026-11-22 | photo tags (retroactive) + `card_shown` | NEEDS DATA |
| H6 | Engagement score = how many voters on a battle come back within the next days (1 day back > 2 days back); ranking by it raises retention | Shimon | 2026-11-22 | votes + `session_start` by user/device | TESTING (score live on /admin/brain from 2026-11-23; deck ranks by it from 2026-11-23 with a 10% holdout; compare `card_shown.arm` engine vs holdout on next-day return) |
| H7 | People's votes predict brand affinity (e.g. likely iPhone buyers, "tech forward") without a survey | Alex | 2026-11-22 | votes on tagged battles + demographics, later a validation set | TESTING (trait leans by group on /admin/brain from 2026-11-23; needs a validation set later) |
| H8 | Showing a lapsing user battles their taste twins loved brings them back | Alex | 2026-11-22 | lapse detection + holdout | OPEN (Phase 4) |
| H9 | Posters have a style (fast vs long deadlines, big vs small stakes, couples vs dating) that predicts what they vote on | Alex | 2026-11-22 | `battle_published` snapshot + stakes/theme tags | OPEN |
| H10 | A free one-time "launch boost" (expires in 72h) offered after the 10th vote raises first posts within 7 days of sign-up vs no offer | Shimon | 2026-11-23 | `nudge_shown`/`nudge_clicked` (to add) + `battle_published`, 20% holdout | OPEN (plan: https://claude.ai/artifact/9pHX97Y1M2r3TUfv4LMmyW) |
| H11 | The boost offer works best at vote 10 (vs 5 or 20) and with a 72h expiry (vs 24h) | Shimon | 2026-11-23 | same as H10, split by variant | OPEN |
| H12 | Landing on the ad's own battle as the first card raises landing → first vote | Claude | 2026-11-23 | `session_start` (UTM, landing) + `card_shown` pos 1 + `vote_cast` | OPEN |
| H13 | An email with a real battle and tap-to-vote buttons beats a benefits email for signed-up non-voters | Shimon | 2026-11-23 | `email_sent` (to add) + UTM `utm_source=email` visits + `vote_cast` | OPEN |
| H14 | A "results are in" email (outcome if reported, else final or live split) ~20h after the last visit raises day-1 return-and-vote | Shimon | 2026-11-23 | `email_sent` + `session_start` + `vote_cast` by user, holdout | OPEN |
| H15 | A "Tell me what she picks" email field on the result screen captures guest emails and brings them back for a second visit | Claude | 2026-11-23 | new event on submit + later `session_start`/`vote_cast` by device | OPEN |
| H16 | A win-back email with 3 battles picked for the person (same ranking as their deck), sent once they've been away twice their usual gap, brings more of them back to vote within 3 days than no email | Alex | 2026-11-23 | `winback_sent` vs `winback_holdout` + `vote` within 3 days (Brain page, Win-back emails) | READY (built off; turn on with economy `winbackEmails` = 1) |
| H17 | Ranking battles people vote on above ones they skip (deck vote-vs-skip rate) raises votes per session | Shimon | 2026-11-25 | `card_shown` (`arm`) + `vote` + `skip` by person | TESTING (deck ranks by it from 2026-11-25, economy `skipWeight`; compare votes per session engine vs holdout; Brain "Voted vs skipped") |

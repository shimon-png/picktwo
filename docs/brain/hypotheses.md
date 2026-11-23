# Hypotheses

Status: OPEN (not tested) · TESTING · TRUE · FALSE · NEEDS DATA. Add new rows at the bottom.

| # | Hypothesis | From | Date | Data needed | Status |
| --- | --- | --- | --- | --- | --- |
| H1 | Photo battles get more votes per view than text battles | Alex | 2026-11-22 | `card_shown.kind` + `vote_cast` | NEEDS DATA (from 2026-11-23) |
| H2 | The order of cards matters (e.g. text, photo, photo keeps people voting longer) | Alex | 2026-11-22 | `card_shown.pos`, `prevKinds`, session | NEEDS DATA |
| H3 | Some themes (couples, dating, money, weddings) draw more and faster votes | Alex | 2026-11-22 | battle theme tags (retroactive) + votes, `dwellMs` | OPEN |
| H4 | Close (50/50) battles are more engaging than lopsided ones | Alex | 2026-11-22 | final split + votes per view + return rate | OPEN |
| H5 | Colours / content of photos affect engagement | Alex | 2026-11-22 | photo tags (retroactive) + `card_shown` | NEEDS DATA |
| H6 | Engagement score = how many voters on a battle come back within the next days (1 day back > 2 days back); ranking by it raises retention | Shimon | 2026-11-22 | votes + `session_start` by user/device | TESTING (score live on /admin/brain from 2026-11-23; deck ranking by it = Phase 3) |
| H7 | People's votes predict brand affinity (e.g. likely iPhone buyers, "tech forward") without a survey | Alex | 2026-11-22 | votes on tagged battles + demographics, later a validation set | OPEN (later) |
| H8 | Showing a lapsing user battles their taste twins loved brings them back | Alex | 2026-11-22 | lapse detection + holdout | OPEN (Phase 4) |
| H9 | Posters have a style (fast vs long deadlines, big vs small stakes, couples vs dating) that predicts what they vote on | Alex | 2026-11-22 | `battle_published` snapshot + stakes/theme tags | OPEN |

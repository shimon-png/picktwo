# Close the loop and expert status: business rules

Owner: Alex · Written: 2026-11-21 · Code: `src/server/services/expertise.ts` (pure, tested in `tests/unit/expertise.test.ts`)

## Why this matters (read this first)

Every battle that gets "closed" (the poster tells us what they actually chose) turns votes into **right or wrong answers**. That is the core data asset of crowdpick:

1. **It identifies the people who get it right.** If I tell someone to wear jeans, not a suit, to a startup interview and they go with jeans and it works out, I was right. Over many battles this separates people with real taste and judgment from everyone else.
2. **It lets us sell expert answers later.** The plan is to monetize asking questions to experts, so we need a trustworthy, earned definition of who an expert is.
3. **It trains the AI.** We will build an engine that weights answers differently depending on who gave them. That only works if we have a track record for each voter, which only exists if posters report back.

So a poster reporting their final choice is not optional polish. Without it there are no correct picks, no experts and no weighted AI. The rules below exist to make reporting back the norm.

## Rule 1: battles run at most 5 days

- A battle can be set to 1 hour, 3 hours, 24 hours, 3 days or 5 days. Nothing longer.
- Extending a battle can't push it past 5 days from when it was posted.
- Battles that were already open with a longer deadline were shortened to 5 days from posting by migration `0009_expert_tiers.sql`.
- Config: `maxBattleHours` (economy, default 120). Enforced in `createBattle` and `extendDeadline`; the request validator also refuses more than 120 hours.

## Rule 2: close the loop or you can't post

- When a battle closes (deadline passes, or the poster closes it early), the poster must go back and say which option they went with (A, B or neither) and how it turned out (👍 / 👎). This is the existing "Report back" screen at `/b/[slug]/report`.
- **While battles are open there is no limit.** Someone can have 10 or more running at once.
- **A user with 3 or more closed battles that have no reported choice cannot post a new battle.** They can still vote.
- Every battle they close frees one slot: with 3 unreported they're blocked; report 1 and they're at 2, so they can post again. The limit only counts closed, unreported battles, never open ones.
- Counts toward the limit: closed battles with at least 1 vote, no reported outcome, not hidden or deleted. There is no grace period; a battle counts the moment it closes. Battles with zero votes don't count (there's nothing to report against).
- Admin "post as" profiles are exempt, because nobody can sign in to them to report back.
- Config: `maxUnreportedBattles` (economy, default 3; 0 turns the gate off).
- Where: `countUnreported` / `unreportedBattles` in `services/points.ts`; checked in `createBattle` (error code `LOOPS_OPEN`, HTTP 409). `/post` shows a "Close the loop first" screen listing the battles to report; `/you` shows a "Posting is paused" note.

What already existed and still applies:
- Reminders to report back at deadline +2h, +48h and +7 days (in-app, email if opted in).
- Points for the poster: +10 ⚡ for reporting, +5 if within 48h of the deadline, +2 for a written note (needs 3+ votes).
- "Open loops" (battles 72h past deadline with 3+ votes and no report) still lower the reach of the poster's new battles in the feed.

Known gap: a poster can delete a battle instead of reporting it, which removes it from the count. Worth watching in analytics; if it gets abused, count deleted battles that had votes too.

## Rule 3: correct picks earn status

A vote is a **correct pick** when it matches the poster's reported choice and the poster gave it a 👍, or when it went against the poster's choice and the poster gave it a 👎 (they picked the other one and regretted it). "Neither" or no thumb means nobody is scored.

| Correct picks | Status | Badge next to the name |
| --- | --- | --- |
| 0–19 | Regular | none |
| 20 | **Pro** | blue check |
| 50 | **Expert** | gold check |
| 100 | **Super expert** | diamond check |

- The count is lifetime and only goes up. It's stored on `user.correct_picks` and incremented when a poster reports back (`applyOutcomeToReputation` in `services/reputation.ts`). Existing users were backfilled from the reputation table.
- The badge shows next to the poster's name on the vote deck, battle page, home hero, battle lists and public profile. `/you` shows the count and how many more are needed for the next status.
- Config: `proAt`, `expertAt`, `superExpertAt` (economy, defaults 20 / 50 / 100).
- The existing +2 ⚡ "Called it" points for voters are unchanged.

## Rule 4: two scores per battle, Everyone and Experts

Like an audience score and a critics score:

- **Everyone score:** the share of all votes for the leading option, e.g. "70% Jeans".
- **Expert score:** the same, counting only votes from Expert and Super expert voters. Regular and Pro voters are the general crowd; Expert and above are the higher tier.
- A voter's status is **snapshotted when they vote** (`vote.voter_correct`). This keeps the Expert score honest: someone who becomes an expert later doesn't retroactively change old battles, and a battle can't make its own voters into its experts.
- Shown on the battle page under the results (two tiles), on the poster's past battles in `/you`, in Activity and on public profiles (one compact line).
- If no expert voted yet, the tile says "No expert votes yet". Today almost nobody has 50 correct picks, so expect this to be empty at first.
- Where: `expertScores()` in `services/battles.ts`; `getBattleView().expertResults` and `BattleCard.expert`.

## Rule 5: repost a finished battle

- Every closed battle in **You → Your battles** has a one-tap **Repost** button. It posts the same question, options and photos again as a new battle, with the same length (still max 5 days), and opens it.
- A repost is a new post, so it follows the same rules: it's blocked while the poster has 3+ unreported battles, and the photos are screened again.
- Reposting does **not** close the loop on the old battle. The old one keeps its votes and still needs its outcome reported.
- Where: `repostBattle()` in `services/battles.ts`, `POST /api/battles/[slug]/repost`, `components/battle/RepostButton.tsx`.

## Changing the numbers

All thresholds live in the economy config (`ECONOMY_DEFAULTS` in `src/lib/constants.ts`) and can be overridden from the admin panel without a deploy: `maxBattleHours`, `maxUnreportedBattles`, `proAt`, `expertAt`, `superExpertAt`.

## Next steps this enables

- Paid "ask the experts" questions, routed to Expert and Super expert voters.
- An AI prediction that weights each vote by the voter's track record (the `reputation` score and `correct_picks` are the inputs).
- Possibly a minimum accuracy rate on top of the raw count, so a heavy voter can't reach Expert on volume alone.

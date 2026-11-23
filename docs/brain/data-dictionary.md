# Data dictionary

Every variable the brain can use: what it means, where it lives, since when. Add a row **before** writing the code for a new one.
Raw events live in `analytics_event` (`name`, `user_id`, `device_id`, `props` jsonb, `created_at` = server time). Client events carry `props.sessionId`, `props.seq` (order within the session), `props.clientAt`, `props.v` (format version) and `props.bot` when the user agent looks automated.

## Tables (current state)

| Variable | Where | Since | Notes |
| --- | --- | --- | --- |
| Vote: who/device, side, time, surface | `vote` (`user_id`, `device_id`, `side`, `created_at`, `source`) | launch | `source='seed'` = fake seed votes (exclude) |
| Time to first pick | `vote.dwell_ms` | launch | first deck pick, battle page, home, discover |
| Reason text | `vote.reason` | launch | |
| Voter expert level at vote time | `vote.voter_correct` | 2026-11-21 | |
| Quality flags | `vote.flagged` | launch | burst / always-same-side |
| Skip | `skip` | launch | |
| Battle content (current) | `battle` (`title`, `context`, `tags.target`, `deadline`, `created_at`), `option` (`label`, `description`, `image_url`) | launch | text option = `image_url` null. Edited in place by seed migrations; see `battle_published` for the original |
| Seed battle | `battle.id LIKE 'seed_%'` | 2026-11-22 | seed posters have no email |
| Outcome (poster's final pick + why) | `outcome` (`chosen`, `thumb`, `note`, `reported_at`) | launch | |
| Demographics (current) | `user` (`sex`, `age_range`, `zip_code`, `country`, `region`, `city`, `kids_status`, `kid_ages`) | 2026-11-20 | history in `profile_changed` |
| Data consent | `user.data_consent`, `consent_event` | launch | |
| Came back after voting | `vote.returned_after_days` (1–3, New York calendar days; null = not yet) | 2026-11-23 | set live on a new visit (`recordReturn`) and back-filled daily from later votes/visits |
| Engagement score (Shimon) | `battle.engagement_score` (0–1), `engagement_voters` (real voters with a day to come back), `engagement_returns` (weighted: day 1 = 1, day 2 = 0.6, day 3 = 0.3), `engagement_at` | 2026-11-23 | `services/engagement.ts`; smoothed toward 0.2 with weight 5; seed/flagged votes excluded. Shown on `/admin/brain` |
| AI tags | `battle.tags.brain`: `theme` (couples, dating, cheating_trust, exes, weddings, family_parenting, friends, money, career, home, fashion_beauty, food_drink, tech, travel, health_fitness, shopping, pets, entertainment, school, other), `stakes` (small / medium / big), `decision` (purchase, relationship, appearance, plan, judgment, other), `a` / `b` (up to 3 traits that picking that side suggests about the voter, e.g. tech_forward, budget_conscious, romantic), `brands`, `model`, `at` | 2026-11-23 | `lib/brain-tags.ts` (taxonomy + validator), `services/tagging.ts` (OpenAI, `TAGGING_MODEL`). Tagged right after posting; older battles via the Brain page button and 40/day in the cron. Never sent to the browser |
| Follows, blocks, DMs | `follow`, `block`, `direct_message` | 2026-11-22 | |

## Events

| Event | Logged by | Since | Props |
| --- | --- | --- | --- |
| `session_start` | browser, first event of a visit (after 30 min idle, or any page load with ad tags) | 2026-11-23 | `utm_source/medium/campaign/content/term/id`, ad click ids (`fbclid`, `gclid`, `ttclid`, `msclkid`, …), `landing`, `referrer`, `referrerHost`, `first` (first-ever visit's attribution on this browser, `isFirstVisit`), `standalone` (home-screen app), `vw`/`vh`, `tz`, `lang`, `ua` |
| `page_view` | browser, every route | 2026-11-23 | `path` |
| `card_shown` | browser, each card that reaches the top of the Vote deck | 2026-11-23 | `battleId`, `pos` (1 = first card of this deck load), `kind` (text/photo/mixed), `prevKinds` (up to 3 previous kinds), `votesShown`, `ageHours`, `hasContext`, `titleLen`, `authorTier`, `cv` (content fingerprint), `signedIn`, `surface`, `arm` (`engine` = deck ranked with engagement score, `holdout` = old order; from 2026-11-23) |
| `signup_gate_shown` | browser, guest hits the free-vote limit | 2026-11-23 | `pos`, `battleId` |
| `vote_cast` | server, first vote on a battle | launch; `side`, `method`, `pos`, `sessionId` from 2026-11-23 | `battleId`, `side`, `source`, `dwellMs`, `withReason`, `points`, `anon`, `method` (tap/swipe/key), `pos`, `sessionId` |
| `vote_changed` | server, side changed | 2026-11-23 | `battleId`, `from`, `to`, `method`, `pos`, `sessionId` |
| `skip` | server | launch | `battleId` |
| `battle_viewed` | server, battle page | launch | `battleId`, `source` |
| `battle_published` | server | launch; content snapshot from 2026-11-23 | `battleId`, `visibility`, `hours` (deadline length), `title`, `context`, `options[]` (label, description, imageUrl, url), `target`, `inReview`, `postedBy` (admin post-as) |
| `winback_sent` | server, daily cron (Phase 4, only when economy `winbackEmails` = 1) | 2026-11-23 | `idleDays`, `usualGap` (median days between the person's active days, null if < 3), `threshold`, `battleIds` (the 3 picks). Email links carry `utm_source=winback`, so returns show in `session_start` |
| `winback_holdout` | server, same run, lapsing person in the `winbackHoldoutPct` holdout (no email) | 2026-11-23 | `idleDays`, `usualGap`, `threshold` |
| `outcome_reported` | server | launch; extras from 2026-11-23 | `battleId`, `chosen`, `thumb`, `hoursAfterDeadline`, `withNote`, `crowdSide`, `votesA`, `votesB` |
| `profile_changed` | server, any save that changes demographics | 2026-11-23 | `via` (onboarding / settings / quick_profile), `changes` {field: {from, to}} |
| `onboarding_completed`, `follow`, `dm_sent`, `report_submitted`, `reason_helpful`, `boost_used`, `option_link_clicked`, `landing_viewed`, `upload_blocked` | server | launch | see code |

## Derived later (not stored, computed from the above)

Votes per view, skip rate, median time to pick, split closeness, taste groups, lapse (days since last visit vs the person's usual gap), photo colour tags (not built yet), voter taste profiles = sum of the `a`/`b` traits of the sides a person picked (`services/taste-profiles.ts`, consenting signed-in people only; groups of 20+ on `/admin/brain` with lift vs everyone; `tasteProfile(userId)` is internal for the engine and never shown).

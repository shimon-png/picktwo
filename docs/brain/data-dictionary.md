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
| Demographics (current) | `user` (`sex`, `age_range`, `zip_code`, `country`, `region`, `city`, `kids_status`, `kid_ages`) | 2026-11-20 | history in `profile_changed`. Since 2026-11-25 sex, age and ZIP are optional at sign-up (asked later as about-you cards); `kids_status` can also be `EXPECTING` |
| Relationship, home, work | `user.relationship` (SINGLE / DATING / TAKEN / MARRIED), `user.housing` (RENT / OWN / FAMILY), `user.work_status` (STUDENT / WORKING / BOTH / NEITHER) | 2026-11-25 | about-you cards or Settings; null = not answered |
| About-you cards | `profile_answer` (`user_id` or `device_id`, `question`, `answer`, `status` shown / answered / skipped, `via` card / signup / settings, `at_votes`) | 2026-11-25 | one row per card shown; a guest's rows move to the account on sign-in. Questions + schedule in `lib/about.ts` and economy `about*`. `aboutHoldoutPct` (10%) never see cards (hash of `about:<account or device id>`) |
| Passive signals (per browser) | `device` (`ip_country`, `ip_region`, `ip_city`, `ip_zip`, `platform`, `browser`, `in_app`, `screen`, `model`, `tier`, `seen_at`) | 2026-11-25 | first real visit's IP geo (Vercel headers, metro-level guess) and screen; platform/browser/in-app from the user-agent (`parseDevice`); tier = budget / mid / flagship / desktop / unknown (`deviceTier`, iPhone screen class or Android model). Device rows now exist for every non-bot browser, not only signed-in ones |
| ZIP area income | `zip_income` (`zip`, `median_income`, `renter_pct`, `year`) | 2026-11-25 | Census ACS 5-year (B19013, B25003), loaded by the daily cron when empty or the Brain button. Estimated income band = `incomeBand(zip median, phone tier)` (lower < $55k ≤ middle < $100k ≤ upper), groups only |
| Data consent | `user.data_consent`, `consent_event` | launch | |
| Came back after voting | `vote.returned_after_days` (1–3, New York calendar days; null = not yet) | 2026-11-23 | set live on a new visit (`recordReturn`) and back-filled daily from later votes/visits |
| Engagement score (Shimon) | `battle.engagement_score` (0–1), `engagement_voters` (real voters with a day to come back), `engagement_returns` (weighted: day 1 = 1, day 2 = 0.6, day 3 = 0.3), `engagement_at` | 2026-11-23 | `services/engagement.ts`; smoothed toward 0.2 with weight 5; seed/flagged votes excluded. Shown on `/admin/brain` |
| AI tags | `battle.tags.brain`: `theme` (couples, dating, cheating_trust, exes, weddings, family_parenting, friends, money, career, home, fashion_beauty, food_drink, tech, travel, health_fitness, shopping, pets, entertainment, school, other), `stakes` (small / medium / big), `decision` (purchase, relationship, appearance, plan, judgment, other), `a` / `b` (up to 3 traits that picking that side suggests about the voter, e.g. tech_forward, budget_conscious, romantic), `brands`, `model`, `at` | 2026-11-23 | `lib/brain-tags.ts` (taxonomy + validator), `services/tagging.ts` (OpenAI, `TAGGING_MODEL`). Tagged right after posting; older battles via the Brain page button and 40/day in the cron. Never sent to the browser |
| Follows, blocks, DMs | `follow`, `block`, `direct_message` | 2026-11-22 | |
| Lifecycle emails (every decision) | `email_log` (`user_id`, `kind`, `ref`, `status` SENT/SKIPPED/QUEUED/FAILED, `reason`, `sent_at`, `provider_id`) | 2026-11-23 | one row per (user, kind, ref). `reason` explains skips: prefs, daily_cap, weekly_cap, budget, active_in_app, no_postal_address, no_email. `voter_item` rows are batch inputs (reason `batched:<result>`). Kinds in `docs/emails.md` |
| Email preferences | `user.notify_email` (My battles), `user.email_prefs` (`voted`/`weekly`/`tips`/`messages` = false when off) | 2026-11-23 | missing key = on |

## Events

| Event | Logged by | Since | Props |
| --- | --- | --- | --- |
| `session_start` | browser, first event of a visit (after 30 min idle, or any page load with ad tags) | 2026-11-23 | `utm_source/medium/campaign/content/term/id`, ad click ids (`fbclid`, `gclid`, `ttclid`, `msclkid`, …), `landing`, `referrer`, `referrerHost`, `first` (first-ever visit's attribution on this browser, `isFirstVisit`), `standalone` (home-screen app), `vw`/`vh`, `tz`, `lang`, `ua`; from 2026-11-25 `sw`/`sh` (screen), `dpr`, `mem` (Chrome deviceMemory), and server-added `geo` (`country`, `region`, `city`, `zip` from Vercel IP headers) and `device` (`platform`, `os`, `browser`, `inApp`, `tier`, `screen`) |
| `device_hints` | browser, Android Chrome only, once per session | 2026-11-25 | `model` (e.g. SM-S928U), `platformVersion`, `mem`; refines `device.tier` |
| `about_card_shown` | browser, an about-you card reaches the deck | 2026-11-25 | `question`, `order` (answers in the shuffled order shown, for position bias), `zipGuess` |
| `about_card_answered` / `about_card_skipped` | server | 2026-11-25 | `question`, `via`, `answer` (a ZIP is cut to its first 3 digits). Questions since cards v2 (Nov 25): sex, age, relationship, kids, education, housing, race, party, work; race and party may be `PREFER_NOT` (sensitive: group use only) |
| `taste_shared` | browser, Share my profile | 2026-11-25 | `how` (share_sheet / download) |
| `page_view` | browser, every route | 2026-11-23 | `path` |
| `card_shown` | browser, each card that reaches the top of the Vote deck | 2026-11-23 | `battleId`, `pos` (1 = first card of this deck load), `kind` (text/photo/mixed), `prevKinds` (up to 3 previous kinds), `votesShown`, `ageHours`, `hasContext`, `titleLen`, `authorTier`, `cv` (content fingerprint), `signedIn`, `surface`, `arm` (`engine` = deck ranked with engagement score, `holdout` = old order; from 2026-11-23) |
| `engaged` | browser, first tap/click or scroll past 120px on a page view (Shimon: bounce = never taps or scrolls) | 2026-11-23 | `how` (click/scroll), `path` |
| `home_click` | browser, tap on an element with `data-track` (homepage buttons and cards) | 2026-11-23 | `target` (ask_crowd, start_voting, hero_card, deciding_see_all, deciding_card, story_card, bottom_ask, taste_start), `path` |
| `profile_bar_tap` | browser, opening the profile bar (Vote deck or You) | 2026-11-25 | `place` (deck, you), `votes`, `left` (battles to the target), `missing` (core about-you questions unanswered) |
| `profile_bar_tap` place `ask` | browser, the profile bar on Ask | 2026-11-26 | as above |
| `pickbot_asked` | server, a Pickbot question or follow-up | 2026-11-26 | `threadId`, `photos`, `chars`, `scope`, `theme`, `crisis`, `followUp` (never the text) |
| `pickbot_gate_answered` / `pickbot_gate_skipped` | server, a profile question inside Pickbot | 2026-11-26 | `threadId`, `question` |
| `pickbot_choice` | server, general vs tailored (incl. `retailor` after a general answer) | 2026-11-26 | `threadId`, `choice` |
| `pickbot_battles_stopped` | server, "Stop and answer now" during quick battles | 2026-11-26 | `threadId` |
| `pickbot_answered` | server, an answer saved | 2026-11-26 | `threadId`, `kind` (tailored/general), `model`, `latencyMs`, `inputTokens`, `outputTokens`, `costUsd`, `similar`, `confidence` |
| `pickbot_rated` | server, 👍/👎 on an answer | 2026-11-26 | `threadId`, `rating`, `model`, `withNote` |
| `pickbot_crowd_drafted` / `pickbot_crowd_posted` | server, crowd draft made / posted | 2026-11-26 | `threadId`, `removed`; posted: `battleId`, `photos`, `targeted`, `hours`, `inReview` |
| `pickbot_results_delivered` | server (hourly), crowd results sent back | 2026-11-26 | `threadId`, `battleId`, `votes`, `agreed`, `closed` |
| `pickbot_outcome` / `pickbot_thread_deleted` | server, the asker said what they picked / deleted a thread | 2026-11-26 | `threadId`, `chosen` |
| `signup_gate_shown` | browser, guest hits the free-vote limit. From 2026-11-24 logged by the gate itself on every surface (deck, home, battle page, discover), and each time group B's dialog opens | 2026-11-23 | `pos`, `battleId`; from 2026-11-24 also `place` (deck/home/battle/discover), `arm` (control/soft) |
| `signup_gate_closed` | browser, guest closes the sign-up sheet/dialog | 2026-11-24 | `place`, `arm`, `pos` |
| Sign-up gate test group | table `experiment_assignment` (experiment `signup_gate_v1`, unit = device id), set the first time the server sees a new signed-out browser; never changes | 2026-11-24 | `arm`: `control` (A, the wall after `guestVoteLimit` free votes) or `soft` (B, closable dialog every `softGateEvery` votes, never blocked). `gateTestPct` (economy) = share put in B. Also on guest `vote_cast` as `gateArm`. Results: /admin/brain "Sign-up gate test (A/B)" |
| X sign-up conversion | X (Twitter) pixel, not our DB | 2026-11-23 | base pixel `rjz70` on every page; event `tw-rjz70-rjz74` fires once on the first page load after sign-up finishes (`cp_conv_signup` cookie, value = conversion id for de-duplication). Config in `lib/marketing.ts` / `NEXT_PUBLIC_X_PIXEL_ID`, `NEXT_PUBLIC_X_SIGNUP_EVENT_ID` |
| Sign-up source | derived: `classifySource()` (`services/acquisition-rules.ts`) on the account's earliest non-bot `session_start` (its `first` wins) | 2026-11-23 | x_campaign (twclid or utm_source x/twitter), x_organic (t.co / x.com referrer), other_campaign, referral, direct, unknown (no tracked visit). Engaged = `engagedMinVoteDays` vote days or a posted battle within `engagedWindowDays` of sign-up. Shown on /admin/brain |
| `email_sent` | server, when a lifecycle email is accepted by Resend (not sign-in codes) | 2026-11-23 | `kind`, `ref`, `group`. Links in the email carry `utm_source=email`, `utm_medium=email`, `utm_campaign=<kind>`, so the visit shows up in `session_start` (H13, H14) |
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

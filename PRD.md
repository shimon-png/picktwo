# PickTwo — Product Requirements Document (v1.0, MVP)

> **Working name:** PickTwo
> **Tagline:** Help me choose, and tell me whether I chose well.
> **Document owner:** Shimon (SoulKeep)
> **Status:** Ready for build
> **Build target:** Standalone web app (mobile-first responsive) in its own GitHub repo, deployed on Vercel.
> **Audience for this doc:** Claude Code (or any engineer) building the app end-to-end. Every section is written to be directly implementable. Where a decision was ambiguous, a default is chosen and marked **[Default]** so the build never blocks.

---

## Table of contents

1. Product summary
2. Goals, non-goals, success metrics
3. Users and personas
4. Core concepts and glossary
5. **New feature: Priority Queue (earn priority by voting and closing the loop)**
6. User journeys
7. Functional requirements (by feature)
8. Screens and UX specification
9. Ranking, matching and scoring algorithms
10. Data model (Prisma schema)
11. API specification
12. Notifications and scheduled jobs
13. Trust, safety, privacy and consent
14. Analytics and event tracking
15. Technical architecture and stack
16. Non-functional requirements
17. Repository layout, environment and Vercel deployment
18. Build plan (milestones for Claude Code)
19. Acceptance test checklist
20. Out of scope / future roadmap
21. Open questions

---

## 1. Product summary

Every day people get stuck between two options that matter: which birthday gift for their child, which baby name, which interview outfit, which paint colour, which version of a toast. Today they text friends, scroll reviews, or ask a chatbot that knows nothing about them.

**PickTwo turns that moment into a fast, social, game-like loop built around one atomic action: pick one of two.**

1. **Post a battle** — two options (photo, link, or text) plus short context ("Gift for my 6-year-old, loves art, ~$50"). Set a deadline.
2. **Get votes fast** — friends first via share link, then relevant community voters (e.g., parents of kids the same age).
3. **See the why** — voters can add a one-line reason; the best reasons rise to the top.
4. **Report back** — after the deadline the poster says which option they picked and whether it worked out (👍 / 👎). That closes the loop.

The loop produces (a) a sticky social product with built-in virality and (b) a uniquely valuable dataset: pairwise human preferences tied to real intent, context and real-world outcomes.

**Launch wedge:** parents choosing gifts for kids, launched ahead of the holiday gifting season. Other categories exist in the app from day one but gifts are featured.

---

## 2. Goals, non-goals, success metrics

### 2.1 MVP goals

- G1. A user can post a battle in under 30 seconds on a phone.
- G2. Anyone with a link can vote in one tap **without an account**.
- G3. A battle gets its first 10 votes within 30 minutes (median) during active hours.
- G4. ≥40% of battles past their deadline get an outcome reported.
- G5. The **Priority Queue** (Section 5) measurably increases votes-cast-per-poster and outcome-report rate.
- G6. All votes, reasons, context and outcomes are stored in a clean, exportable pairwise-preference format with explicit consent flags.

### 2.2 Non-goals for MVP

- Native iOS/Android apps (the web app must be installable as a PWA instead).
- Voice notes on reasons (text only in MVP; schema leaves room).
- AI predictions, taste API, data licensing portal, brand battles, premium tier, affiliate payouts (see Section 20).
- Direct messaging between users.
- Minors as users. The product is for adults (18+) deciding about children, never for children.

### 2.3 Key metrics (instrumented from day one)

| Metric | Definition |
|---|---|
| Battles posted / week | Count of `battle.published` |
| Votes per battle | Mean and median votes at deadline |
| Time to first meaningful result | Minutes from publish until 10th vote |
| Outcome report rate | Battles with outcome ÷ battles past deadline (exclude deleted) |
| Voter → poster conversion | % of users whose first action was a vote who later post |
| Retention | Poster and voter retention at W1, W4, W12 |
| Commerce CTR | Clicks on option links ÷ battle views |
| Priority Queue health | Avg priority points per active user; % of posts boosted; median time-to-10-votes boosted vs. unboosted |

---

## 3. Users and personas

| Persona | Description | Primary jobs |
|---|---|---|
| **Poster — "Maya, parent of a 6-year-old"** | Has a deadline (birthday Saturday), two gift ideas, wants opinions from people like her. | Post fast, share to family group chat, get answers before deadline, report back. |
| **Friend voter — "Uncle Dan"** | Receives a link in WhatsApp. Has no account. | Vote in one tap, optionally leave a reason, see results. |
| **Community voter — "Priya, parent of twins"** | Opens the app to help, enjoys swiping through battles, likes being right. | Vote on many battles quickly, build reputation in "Gifts · Kids 5–8". |
| **Creator — "@momlifeemma"** | Parenting influencer. | Post battles for followers, share link. (MVP: same as poster; creator tools later.) |
| **Admin / moderator** | PickTwo team. | Review reports, remove content, ban users, view metrics, export data. |

**Eligibility:** users must confirm they are 18+ at signup. Anonymous voters are not asked for age but cannot post.

---

## 4. Core concepts and glossary

- **Battle** — a question with exactly two options (A and B), context text, a category, optional audience tags, a deadline, and a visibility setting.
- **Option** — one side of a battle. Has a label (required), optional image, optional URL (link preview fetched server-side), optional price.
- **Vote** — a single pick of A or B by a voter on a battle. One per voter per battle. Changeable until the battle closes. **[Default]** votes are hidden-results: a voter sees results only after voting.
- **Reason** — optional ≤140-char text attached to a vote. Reasons can be upvoted ("helpful") by others; the top reasons are shown first.
- **Deadline** — when voting closes. Presets: 1h, 3h, 24h, 3 days, 7 days, or custom (max 30 days).
- **Outcome / Report-back** — after the deadline, the poster records **(1) which option they actually picked (A, B, or neither)** and **(2) a thumbs up 👍 or thumbs down 👎** for how it turned out, plus an optional note. A battle with an outcome is **"closed-loop."**
- **Open loop** — a battle past its deadline with no outcome reported.
- **Taste match** — % agreement between two users on battles both voted on (min 5 shared battles to display).
- **Reputation** — per-category score for a voter, rising when they voted for the option the poster picked **and** the outcome was 👍 (Section 9.4).
- **Priority Points (PP)** — the currency of the Priority Queue (Section 5).
- **Voter (anonymous)** — identified by a signed device cookie (`pt_vid`). Their votes are merged into their account if they later sign up.

---

## 5. NEW FEATURE — Priority Queue: earn priority by helping and by closing the loop

> This feature is **not in the investor materials**. It is a core MVP feature and should be built in Milestone 3.

### 5.1 Why

PickTwo's two biggest risks are **cold start on votes** and **low outcome-report rates** (the outcome data is the moat). The Priority Queue solves both with one mechanic: **your questions get seen first if you help others and if you finish what you started.** It makes the product a fair exchange (give votes to get votes) and turns report-back from a chore into the key that unlocks reach.

### 5.2 Rules (user-facing)

Shown on a "How priority works" sheet and in onboarding:

1. **Answer questions → earn priority.** Every quality vote you cast on someone else's battle earns Priority Points. Adding a reason earns more.
2. **Close the loop → earn more priority.** When your battle's deadline passes, tell everyone which of the two options you picked and give it a 👍 or 👎. That earns the biggest reward.
3. **Open loops cost you priority.** If you leave a past battle without an outcome, your new battles are pushed down until you close it.
4. **Spend priority to get answers faster.** Your new battles are ranked in the community feed by your priority. You can also spend points on a one-time **Boost**.

### 5.3 Point economy **[Default values; all stored in a config table so they can be tuned without deploys]**

| Action | Points | Limits / conditions |
|---|---|---|
| Quality vote on someone else's battle | **+1** | Must pass quality checks (5.5). Daily cap: 50 points from votes. |
| Vote that includes a reason (≥15 chars) | **+1 extra** (total +2) | Daily cap shared with above. |
| Your reason marked "helpful" by poster | **+3** | Max 3 per battle. |
| **Close the loop: report picked option + 👍/👎** | **+10** | Once per battle. Battle must have ≥3 votes from others. |
| Close the loop within 48h of deadline | **+5 bonus** | — |
| Add an outcome note (≥20 chars) | **+2** | — |
| You voted for the option the poster picked and they gave 👍 | **+2** ("Called it") | Awarded when outcome is reported. |
| First battle ever posted | **+5** starter grant | Every new account also starts with 10 PP. |
| Posting a battle | **0** (free) | Posting itself never costs points. |
| Boost a battle | **−15** | Max 1 boost per battle; boost lasts 6h or until 25 extra votes. |
| Open-loop penalty | No point deduction; instead an **open-loop multiplier** on ranking (5.4) | — |
| Points decay | −10% of balance per 30 days of inactivity (no votes/posts) | Floor 10. |

### 5.4 How priority affects distribution

The community feed ranks battles for each viewer (full formula in 9.2). Priority contributes through the **poster priority factor**:

```
posterPriority = clamp( log2(1 + PP_balance) / log2(1 + 200), 0.1, 1.0 )
loopFactor     = 1.0 if openLoops == 0
                 0.6 if openLoops == 1
                 0.3 if openLoops == 2
                 0.1 if openLoops >= 3
priorityFactor = posterPriority * loopFactor * (boostActive ? 2.0 : 1.0)
```

- "Open loops" = the poster's battles that are **more than 72 hours** past deadline with no outcome and ≥3 votes. (Battles with <3 votes never count as open loops.)
- **Friends-and-link distribution is never throttled.** Priority only affects the community feed. A poster can always share their link.
- **Posting gate (soft):** with ≥3 open loops, the "Post" flow first shows a "Close the loop" sheet listing the open battles with one-tap A/B + 👍/👎 controls. The user may skip, but the new battle is published with `loopFactor = 0.1`.

### 5.5 Anti-gaming / vote quality checks

A vote earns points only if **all** are true:

- Voter is signed in (anonymous votes earn nothing but are counted on the battle).
- Not the voter's own battle.
- Battle card was visible ≥1.5 s before the vote (client sends `dwellMs`; server rejects < 1500 ms for points but still records the vote).
- Voter has cast < 10 votes in the trailing 60 s (burst limit). Votes beyond this are recorded with `pointsAwarded = 0` and `flagged = true`.
- Voter's lifetime A/B split is not degenerate: if ≥30 votes and >90% are the same side (always A or always B), point-earning pauses and the user gets a gentle prompt.
- Same voter changing their vote does not re-award points.
- Reasons are checked for minimum length, not-all-same-character, and not duplicating the voter's own previous reason verbatim within 24h.

### 5.6 Priority UI surfaces

- **Header pill:** "⚡ 42" PP balance, tappable → Priority sheet (balance, history ledger, how-it-works, open loops list).
- **Post-vote toast:** "+2 ⚡ — thanks for helping Maya." (Batched if voting quickly: "+8 ⚡ from 5 votes".)
- **Open loops banner** on Home and Profile when openLoops ≥1: "You have 2 decisions to close. Close them to get your next question seen faster." → list with inline report-back controls.
- **Compose screen:** shows predicted reach tier — "Priority: High / Normal / Low" with a reason ("Low — 2 open loops").
- **Boost button** on own active battle (if PP ≥15).
- **Battle detail (owner view):** "Your priority is boosting this battle" indicator.

### 5.7 Priority acceptance criteria

- [ ] Voting on another user's battle while signed in adds the correct points to a ledger row and the balance updates in the header within 1 s.
- [ ] Reporting an outcome (option + thumb) awards +10 (+5 if within 48h, +2 with note) exactly once.
- [ ] "Called it" points are awarded to every voter who picked the chosen option when the outcome is 👍.
- [ ] A user with 2 open loops sees the banner and their new battle is ranked with `loopFactor 0.3` (verify via admin debug endpoint).
- [ ] Boost deducts 15 PP, sets `boostUntil`, and is refused when balance < 15.
- [ ] Burst and dwell rules record the vote but award 0 points.
- [ ] All economy values are read from `AppConfig` and changeable in the admin panel.

---

## 6. User journeys

### 6.1 Post a battle (signed-in parent)

1. Tap **＋ Post** (bottom nav).
2. Step 1 — **Options:** two side-by-side cards. Each: "Add photo" (camera/upload), "Paste link" (fetches title/image/price), or type a label. Label is required (auto-filled from link title, editable, ≤60 chars).
3. Step 2 — **Context:** question title (≤100 chars, prefilled "Which one?"), context text (≤280 chars, placeholder "Gift for my 6-year-old daughter, loves art, budget ~$50"), category (chips), optional audience tags (e.g., "Kid age: 5–8", "Budget: $25–50"), deadline preset.
4. Step 3 — **Audience:** `Public (friends + community)` **[Default]**, `Link only` (not in community feed), `Friends only` (followers you follow back). Toggle "Allow my battle to be used, anonymised, to improve PickTwo's recommendations" (on by default for public battles, consent recorded — see 13.3).
5. **Publish** → success screen with share sheet (Web Share API; fallback buttons: Copy link, WhatsApp, iMessage/SMS, Facebook, X). Shows priority tier.
6. Live results update on the battle page (polling every 5 s or SSE).

### 6.2 Vote from a shared link (no account)

1. Open `picktwo.app/b/{slug}` from WhatsApp. Rich OG preview image shows both options.
2. See both options large, context, deadline countdown. **No results visible yet.**
3. Tap an option (or swipe left/right on mobile) → instant animation → results revealed (% bars, vote count) + top reasons.
4. Optional: "Why? (one line)" input.
5. Soft prompt: "See how your vote compared with parents like you — create an account" / "Got your own dilemma? Post it." Anonymous vote is stored with device ID and merged on signup.

### 6.3 Community voting session ("Swipe mode")

1. Home → **Vote** tab shows one battle card at a time, ranked by 9.2.
2. Tap left/right half or swipe to vote; results flash for ~1.2 s, then next card. Optional reason via "＋ why" button before the card advances (pauses auto-advance).
3. Skip button (↓ / "Not for me") — records a skip, never shown again.
4. Points accrue in header; every 10 votes show a mini-summary: "10 votes · +14 ⚡ · You agreed with the majority 7/10."

### 6.4 Report back (close the loop)

Triggered by: (a) push/email nudge at deadline + 2h, + 48h, + 7d; (b) open loops banner; (c) battle page owner view.

1. Sheet: "Which did you choose?" → [Option A image] [Option B image] [Neither].
2. "How did it go?" → 👍 / 👎 (required unless Neither).
3. Optional note: "She played with it all weekend!" (≤280 chars) and optional "after" photo.
4. Submit → confetti + "+15 ⚡ Loop closed" → voters are notified ("Maya picked the Lego set — 👍 It was a hit. You called it! +2 ⚡").
5. Battle page now shows an **Outcome banner** at the top for everyone.

### 6.5 Sign up / sign in

- Email magic link (primary) and Google OAuth.
- On first sign-in: display name, @handle (unique, 3–20 chars), age confirmation (18+ checkbox, required), optional profile context used for relevance matching: "Do you have kids?" with **age ranges only** (0–2, 3–4, 5–8, 9–12, 13–17) — never names, birthdates or photos of children; region (country + optional state/city); interests (chips). All optional except 18+.
- Anonymous device votes are merged into the new account.

---

## 7. Functional requirements

Priority: **P0** = MVP must-have, **P1** = MVP if time allows, **P2** = post-MVP.

### 7.1 Battles

| ID | Requirement | Pri |
|---|---|---|
| B-1 | Create battle with exactly two options, title, context, category, deadline, visibility. | P0 |
| B-2 | Option input types: image upload (JPEG/PNG/WebP/HEIC, ≤10 MB, client-side resized to max 1600 px, stored in Vercel Blob), URL (server fetches OpenGraph title/image/price), or text-only. | P0 |
| B-3 | Each battle has a short public slug (8 chars, base62) and URL `/b/{slug}`. | P0 |
| B-4 | Dynamic OG image `/b/{slug}/opengraph-image` shows A vs B side-by-side with title (uses `next/og`). | P0 |
| B-5 | Owner can edit context/title only until first vote; options are immutable after first vote. | P0 |
| B-6 | Owner can delete a battle (soft delete; removed from feeds; data retained per 13.4). | P0 |
| B-7 | Owner can close voting early. | P1 |
| B-8 | Owner can extend the deadline once (max +7 days). | P1 |
| B-9 | Categories (seeded): Gifts (featured), Baby names, Big purchases, What to wear, Home & design, Words that matter, Other. | P0 |
| B-10 | Audience tags (optional, multi): kid age range, recipient (child/partner/parent/friend/self), budget range, occasion (birthday, holiday, etc.). | P0 |
| B-11 | Option URL links are wrapped through `/go/{optionId}` redirect to log clicks (and later append affiliate params). | P0 |
| B-12 | Draft autosave in localStorage during compose. | P1 |
| B-13 | "Duplicate battle" to re-ask with a different audience. | P2 |

### 7.2 Voting

| ID | Requirement | Pri |
|---|---|---|
| V-1 | One vote per (battle, voter) where voter = userId or deviceId. Enforced by unique index. | P0 |
| V-2 | Anonymous voting allowed on Public and Link-only battles; Friends-only requires sign-in. | P0 |
| V-3 | Results hidden until the viewer votes (owner always sees results). After deadline, results are visible to all. | P0 |
| V-4 | Vote change allowed until deadline; logs `changedAt`. | P0 |
| V-5 | Optional reason (≤140 chars) at vote time or editable afterwards until deadline. | P0 |
| V-6 | "Skip" action in swipe mode stores a `Skip` row so the battle is not shown again. | P0 |
| V-7 | Results show %A / %B, total votes, and breakdown filters: "Everyone", "Friends", "Parents of kids 5–8" (only segments with ≥5 votes shown). | P1 |
| V-8 | Client sends `dwellMs` and `source` (link, feed, profile) with every vote. | P0 |
| V-9 | Keyboard support on desktop: ← = A, → = B, ↓ = skip, R = reason. | P1 |

### 7.3 Reasons

| ID | Requirement | Pri |
|---|---|---|
| R-1 | Reasons display under each option, sorted by helpful score (9.5). Top 3 per side shown; "See all". | P0 |
| R-2 | Any signed-in user can mark a reason "helpful" (one per user per reason). Owner's "helpful" counts ×3 and awards points (Section 5). | P0 |
| R-3 | Reasons can be reported (moderation queue). | P0 |
| R-4 | Voice-note reasons. | P2 |

### 7.4 Outcomes (report-back)

| ID | Requirement | Pri |
|---|---|---|
| O-1 | After deadline, owner can report: `chosenOption ∈ {A, B, NEITHER}`, `thumb ∈ {UP, DOWN}` (required unless NEITHER), optional note ≤280, optional photo. | P0 |
| O-2 | Owner may report early ("I decided already") once the battle has ≥3 votes; this also closes voting. | P0 |
| O-3 | Outcome editable within 7 days of submission; points not re-awarded. | P0 |
| O-4 | On submit, all signed-in voters get an in-app notification (and push/email if opted in). | P0 |
| O-5 | Outcome banner on battle page: "Maya picked **Lego Art Set** · 👍 It worked out" + note. Shows "The crowd agreed (72%)" or "The crowd picked the other one". | P0 |
| O-6 | Reminder schedule: deadline+2h, +48h, +7d (in-app always; email/push if opted in). Stop after outcome or after 3 reminders. | P0 |

### 7.5 Social graph and profiles

| ID | Requirement | Pri |
|---|---|---|
| S-1 | Follow / unfollow users. "Friends" = mutual follows. | P0 |
| S-2 | Profile page `/u/{handle}`: avatar, name, bio, stats (battles, votes, loops closed %), category reputation badges, public battles list. | P0 |
| S-3 | Taste match % shown on another user's profile when ≥5 shared votes (9.3). | P1 |
| S-4 | "Invite friends" share link `/?ref={handle}`; inviter gets +5 PP when invitee casts 10 quality votes. | P1 |
| S-5 | Contact import / phone-book matching. | P2 |

### 7.6 Feeds and discovery

| ID | Requirement | Pri |
|---|---|---|
| F-1 | **Vote tab** (swipe mode) — ranked community battles the viewer hasn't voted on or skipped. | P0 |
| F-2 | **Home tab** — "Your battles" (active, awaiting report-back, closed), then "From friends", then "Recently closed loops" (outcome stories). | P0 |
| F-3 | Category filter chips on Vote tab. | P0 |
| F-4 | **Explore** — trending battles and recently closed loops with surprising outcomes ("Crowd picked A, poster picked B, 👍"). | P1 |
| F-5 | Search battles by text (Postgres full-text). | P2 |

### 7.7 Reputation and badges

| ID | Requirement | Pri |
|---|---|---|
| RP-1 | Per-category reputation score per user (9.4), recalculated on each outcome. | P0 |
| RP-2 | Badges: "Top gift picker" (top 5% in Gifts with ≥20 resolved votes), "Loop closer" (≥90% outcome rate, ≥5 battles), "Helpful" (≥25 helpful marks). | P1 |
| RP-3 | Reputation weights vote influence in segment stats (display only; raw counts always shown). | P2 |

### 7.8 Notifications

See Section 12. In-app notification center P0; email P0 (transactional + reminders); web push P1.

### 7.9 Admin

| ID | Requirement | Pri |
|---|---|---|
| A-1 | `/admin` gated to users with `role = ADMIN`. | P0 |
| A-2 | Moderation queue: reported battles/reasons/users; actions: hide, delete, ban, dismiss. | P0 |
| A-3 | Metrics dashboard for Section 2.3 metrics (simple tables + sparkline charts). | P1 |
| A-4 | Config editor for `AppConfig` (priority economy values, feature flags). | P0 |
| A-5 | Data export: CSV/JSONL of consented, anonymised pairwise records (13.5). | P1 |
| A-6 | Debug view for a battle: ranking inputs (priorityFactor, loopFactor, boost). | P1 |

---

## 8. Screens and UX specification

### 8.1 Design principles

- **Mobile-first**, thumb-reachable, one decision per screen. Desktop is a centered 480 px column on large screens with optional side panels.
- **Two-up symmetry** is the visual signature: options always side-by-side (stacked top/bottom under 360 px width), equal weight, A on the left/top.
- **Speed feel:** optimistic UI for votes; vote → result reveal animation ≤300 ms.
- **Warm, playful but trustworthy.** Not a gambling aesthetic.

### 8.2 Visual system **[Default]**

- Font: Inter (UI), with a rounded display face for numbers (e.g., "Nunito" weight 800) via `next/font`.
- Colours: Option A = indigo `#5B5BD6`, Option B = coral `#F2665E`, priority/points = amber `#F5A524`, success = green `#22A06B`, neutrals Tailwind `zinc`. Full dark mode.
- Radius 16 px cards, 999 px pills. Shadows subtle.
- Icons: lucide-react.
- Components: shadcn/ui (Button, Sheet, Dialog, Tabs, Toast/Sonner, Avatar, Badge, Progress, Input, Textarea).
- Motion: framer-motion for swipe, reveal bars, confetti on loop close (canvas-confetti).

### 8.3 Navigation

Bottom nav (mobile) / left rail (desktop): **Home · Vote · ＋Post · Activity · Profile**. Header: logo left, ⚡ PP pill right.

### 8.4 Screen list

| Route | Screen | Key elements |
|---|---|---|
| `/` | Landing (signed out) / Home (signed in) | Landing: hero "Can't decide? Ask people like you.", demo battle you can vote on, CTA post. Home: open-loops banner, your battles, friends' battles, closed-loop stories. |
| `/vote` | Swipe mode | Card stack, category chips, skip, reason button, session counter. Empty state: "You've voted on everything! Post your own." |
| `/post` | Compose (3 steps) | Option cards, context, audience, priority tier preview, publish. |
| `/b/[slug]` | Battle page | Title, context, tags, countdown, two options, vote CTA or results, reasons, outcome banner, share, owner controls (report back, boost, close, delete). |
| `/b/[slug]/report` | Report-back flow | A/B/Neither, 👍/👎, note, photo. |
| `/u/[handle]` | Profile | Stats, badges, taste match, follow, battles grid. |
| `/activity` | Notifications | Votes on your battles (batched), outcomes of battles you voted on, called-it, helpful marks, follows. |
| `/priority` | Priority Queue | Balance, how it works, ledger, open loops with inline close. (Also as a sheet.) |
| `/settings` | Settings | Profile context, notifications, data & privacy (consent toggles, export my data, delete account). |
| `/signin` | Auth | Magic link, Google. |
| `/onboarding` | First-run | Handle, 18+, optional kid age ranges, region, interests, "how priority works" 3-card carousel. |
| `/admin/*` | Admin | Moderation, metrics, config, export. |
| `/legal/terms`, `/legal/privacy` | Legal | Static markdown pages (placeholders flagged for legal review). |
| `/go/[optionId]` | Redirect | Logs click, 302 to URL. |

### 8.5 Battle card states

1. **Unvoted (open)** — options tappable, no %.
2. **Voted (open)** — % bars fill, your pick outlined, "Change vote" link, reason input.
3. **Closed, awaiting outcome** — results visible to all, label "Waiting for Maya to report back".
4. **Closed loop** — outcome banner, chosen option badge "Picked ✓", thumb icon.
5. **Owner, open** — live results, share, boost, close early.
6. **Owner, awaiting outcome** — prominent "Close the loop (+10 ⚡)" CTA.

### 8.6 Empty, error and loading states

Every list has a skeleton loader and an empty state with a CTA. Network errors show a retry toast; votes are queued and retried (up to 3 times) if offline.

---

## 9. Ranking, matching and scoring algorithms

### 9.1 Relevance score (viewer ↔ battle)

```
relevance = 0.35 * categoryAffinity      // share of viewer's last 100 votes in this category (smoothed, min 0.1)
          + 0.35 * audienceMatch         // 1 if battle kid-age tag overlaps viewer's kid age ranges, 0.5 if no tag, 0 if mismatch
          + 0.15 * regionMatch           // 1 same country, 0.5 unknown, 0.3 different
          + 0.15 * socialProximity       // 1 friend, 0.6 followed, 0.3 friend-of-friend, 0 otherwise
```

### 9.2 Community feed score

```
urgency      = 1 / (1 + hoursUntilDeadline / 6)          // sooner deadline → higher
needVotes    = 1 / (1 + votesSoFar / 10)                  // fewer votes → higher (liquidity)
freshness    = exp(-hoursSincePublish / 48)
score = relevance * (0.4 * urgency + 0.4 * needVotes + 0.2 * freshness) * priorityFactor
```

- Exclude: own battles, already voted/skipped, closed, deleted, hidden, Link-only, Friends-only (unless friend), authors the viewer blocked.
- Diversity: no more than 2 consecutive cards from the same category; no more than 1 card per author per 10 cards.
- Implementation: compute candidate set in SQL (open battles, last 7 days, ≤500 rows), score in TypeScript, return top 20 with a cursor. Cache per-viewer for 60 s.

### 9.3 Taste match

```
shared = battles where both users voted (exclude battles with <5 votes)
tasteMatch = round(100 * agreements / shared)   // display only if shared >= 5
```

### 9.4 Category reputation

For each resolved battle (outcome reported, chosenOption ∈ {A,B}) a voter's vote is:
- **Correct** if vote == chosenOption AND thumb == UP, or vote != chosenOption AND thumb == DOWN.
- **Incorrect** otherwise.

`reputation = (correct + 2) / (resolved + 4)` (Bayesian smoothing) and `confidence = resolved`. Badge eligibility requires `resolved ≥ 20`.

### 9.5 Reason ranking

`helpfulScore = helpfulCount + 3 * ownerHelpful + 0.5 * (author reputation in category) - 5 * reportedCount`, ties broken by recency.

---

## 10. Data model (Prisma, PostgreSQL)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL"); directUrl = env("DATABASE_URL_UNPOOLED") }

enum Role { USER ADMIN }
enum Visibility { PUBLIC LINK_ONLY FRIENDS }
enum BattleStatus { OPEN CLOSED DELETED HIDDEN }
enum Side { A B }
enum Chosen { A B NEITHER }
enum Thumb { UP DOWN }
enum KidAge { AGE_0_2 AGE_3_4 AGE_5_8 AGE_9_12 AGE_13_17 }
enum LedgerReason { STARTER FIRST_BATTLE VOTE VOTE_REASON REASON_HELPFUL LOOP_CLOSED LOOP_CLOSED_FAST OUTCOME_NOTE CALLED_IT INVITE BOOST DECAY ADMIN_ADJUST }
enum ReportTarget { BATTLE REASON USER }
enum ReportStatus { OPEN ACTIONED DISMISSED }

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  emailVerified  DateTime?
  name           String?
  handle         String?  @unique
  image          String?
  bio            String?
  role           Role     @default(USER)
  isAdultConfirmed Boolean @default(false)
  country        String?
  region         String?
  kidAges        KidAge[]
  interests      String[]
  ppBalance      Int      @default(10)
  lastActiveAt   DateTime @default(now())
  dataConsent    Boolean  @default(false)   // consent to anonymised use for model training / licensing
  marketingEmail Boolean  @default(false)
  notifyEmail    Boolean  @default(true)
  notifyPush     Boolean  @default(false)
  bannedAt       DateTime?
  referredById   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  accounts  Account[]
  sessions  Session[]
  battles   Battle[]
  votes     Vote[]
  outcomes  Outcome[]
  ledger    PointLedger[]
  followers Follow[] @relation("following")
  following Follow[] @relation("follower")
  reputations Reputation[]
  notifications Notification[]
  pushSubs  PushSubscription[]
  devices   Device[]
}

// Auth.js tables (Account, Session, VerificationToken) — standard @auth/prisma-adapter schema.

model Device {            // anonymous voter identity
  id        String   @id            // value of signed pt_vid cookie
  userId    String?                 // set when merged
  user      User?    @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}

model Category {
  id       String @id               // "gifts", "baby-names", ...
  name     String
  emoji    String
  featured Boolean @default(false)
  sort     Int
}

model Battle {
  id           String   @id @default(cuid())
  slug         String   @unique
  authorId     String
  author       User     @relation(fields: [authorId], references: [id])
  title        String
  context      String?
  categoryId   String
  category     Category @relation(fields: [categoryId], references: [id])
  tags         Json     // { kidAge?: KidAge[], recipient?: string, budget?: string, occasion?: string }
  visibility   Visibility @default(PUBLIC)
  status       BattleStatus @default(OPEN)
  deadline     DateTime
  closedAt     DateTime?
  boostUntil   DateTime?
  boostVotesLeft Int     @default(0)
  dataConsent  Boolean  @default(false)  // snapshot of author's consent at publish
  votesA       Int      @default(0)      // denormalised counters
  votesB       Int      @default(0)
  reminderCount Int     @default(0)
  lastReminderAt DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  options  Option[]
  votes    Vote[]
  skips    Skip[]
  outcome  Outcome?

  @@index([status, deadline])
  @@index([authorId, status])
  @@index([categoryId, status, createdAt])
}

model Option {
  id        String  @id @default(cuid())
  battleId  String
  battle    Battle  @relation(fields: [battleId], references: [id], onDelete: Cascade)
  side      Side
  label     String
  imageUrl  String?
  url       String?
  urlTitle  String?
  urlImage  String?
  priceCents Int?
  currency  String?
  clicks    Int     @default(0)
  @@unique([battleId, side])
}

model Vote {
  id         String   @id @default(cuid())
  battleId   String
  battle     Battle   @relation(fields: [battleId], references: [id], onDelete: Cascade)
  userId     String?
  user       User?    @relation(fields: [userId], references: [id])
  deviceId   String?
  side       Side
  reason     String?
  dwellMs    Int?
  source     String?          // link | feed | profile | home
  pointsAwarded Int  @default(0)
  flagged    Boolean  @default(false)
  changedAt  DateTime?
  createdAt  DateTime @default(now())
  helpful    ReasonHelpful[]

  @@unique([battleId, userId])
  @@unique([battleId, deviceId])
  @@index([userId, createdAt])
}

model ReasonHelpful {
  voteId   String
  vote     Vote   @relation(fields: [voteId], references: [id], onDelete: Cascade)
  userId   String
  isOwner  Boolean @default(false)
  createdAt DateTime @default(now())
  @@id([voteId, userId])
}

model Skip {
  id       String @id @default(cuid())
  battleId String
  battle   Battle @relation(fields: [battleId], references: [id], onDelete: Cascade)
  userId   String?
  deviceId String?
  createdAt DateTime @default(now())
  @@unique([battleId, userId])
  @@unique([battleId, deviceId])
}

model Outcome {
  id        String  @id @default(cuid())
  battleId  String  @unique
  battle    Battle  @relation(fields: [battleId], references: [id], onDelete: Cascade)
  userId    String
  user      User    @relation(fields: [userId], references: [id])
  chosen    Chosen
  thumb     Thumb?
  note      String?
  photoUrl  String?
  reportedAt DateTime @default(now())
  editedAt  DateTime?
}

model PointLedger {
  id        String  @id @default(cuid())
  userId    String
  user      User    @relation(fields: [userId], references: [id])
  delta     Int
  reason    LedgerReason
  battleId  String?
  voteId    String?
  createdAt DateTime @default(now())
  @@index([userId, createdAt])
  @@unique([userId, reason, battleId, voteId]) // idempotency; nullable cols → enforce idempotency in code too
}

model Follow {
  followerId  String
  followingId String
  follower    User @relation("follower", fields: [followerId], references: [id])
  following   User @relation("following", fields: [followingId], references: [id])
  createdAt   DateTime @default(now())
  @@id([followerId, followingId])
}

model Block { blockerId String; blockedId String; createdAt DateTime @default(now()); @@id([blockerId, blockedId]) }

model Reputation {
  userId     String
  user       User   @relation(fields: [userId], references: [id])
  categoryId String
  correct    Int    @default(0)
  resolved   Int    @default(0)
  score      Float  @default(0.5)
  @@id([userId, categoryId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   // VOTES_BATCH | OUTCOME | CALLED_IT | HELPFUL | FOLLOW | REMINDER | POINTS
  payload   Json
  readAt    DateTime?
  createdAt DateTime @default(now())
  @@index([userId, readAt, createdAt])
}

model PushSubscription { id String @id @default(cuid()); userId String; user User @relation(fields: [userId], references: [id]); endpoint String @unique; p256dh String; auth String; createdAt DateTime @default(now()) }

model Report {
  id         String @id @default(cuid())
  targetType ReportTarget
  targetId   String
  reporterId String?
  reason     String       // spam | inappropriate | minor_safety | harassment | other
  details    String?
  status     ReportStatus @default(OPEN)
  createdAt  DateTime @default(now())
  resolvedBy String?
  resolvedAt DateTime?
}

model ConsentEvent {       // append-only audit of consent changes
  id        String @id @default(cuid())
  userId    String
  type      String          // data_training | marketing | terms
  value     Boolean
  version   String          // policy version
  createdAt DateTime @default(now())
}

model AnalyticsEvent { id String @id @default(cuid()); name String; userId String?; deviceId String?; props Json; createdAt DateTime @default(now()); @@index([name, createdAt]) }

model AppConfig { key String @id; value Json; updatedAt DateTime @updatedAt }
```

**Seed data:** categories (7), `AppConfig` defaults for every number in Section 5.3, one admin user from `ADMIN_EMAILS`, and ~20 demo battles (gift-focused) authored by a `@picktwo` system account for local dev and the landing-page demo.

**Integrity rules (enforce in service layer, inside transactions):**
- Vote insert/update and `votesA/votesB` counter changes happen in one transaction.
- `ppBalance` changes only via a `awardPoints(userId, delta, reason, refs)` helper that writes the ledger row and updates the balance in one transaction; it is idempotent on `(userId, reason, battleId, voteId)`.

---

## 11. API specification

Use **Next.js App Router**: server components for reads, **Server Actions** for mutations from the UI, and Route Handlers under `/api` for anything called by cron, webhooks, or non-React clients. All inputs validated with **zod**. All mutations rate-limited (11.3).

### 11.1 Route Handlers

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/battles` | user | Create battle. Body: `{title, context, categoryId, tags, visibility, deadline, dataConsent, options:[{side,label,imageUrl?,url?}]}` → `{slug}` |
| `GET /api/battles/:slug` | any | Battle + options; results only if viewer voted / owner / closed |
| `PATCH /api/battles/:slug` | owner | Edit title/context (pre-vote), close early, extend deadline |
| `DELETE /api/battles/:slug` | owner/admin | Soft delete |
| `POST /api/battles/:slug/vote` | any (device or user) | `{side, reason?, dwellMs, source}` → `{results, pointsAwarded, ppBalance?}` |
| `POST /api/battles/:slug/skip` | any | Skip |
| `POST /api/battles/:slug/outcome` | owner | `{chosen, thumb?, note?, photoUrl?}` → `{pointsAwarded}` |
| `POST /api/battles/:slug/boost` | owner | Spend PP |
| `POST /api/reasons/:voteId/helpful` | user | Toggle helpful |
| `GET /api/feed?category=&cursor=` | any | Ranked community feed (device-based for anon) |
| `GET /api/me/priority` | user | Balance, ledger (paginated), open loops |
| `POST /api/upload` | user | Vercel Blob client-upload token (`@vercel/blob/client` `handleUpload`) |
| `POST /api/unfurl` | user | `{url}` → `{title, image, price, currency}`; server fetch with 5 s timeout, 2 MB cap, SSRF guard (block private IP ranges) |
| `POST /api/follow/:userId` / `DELETE` | user | Follow/unfollow |
| `POST /api/reports` | any | Report content |
| `GET /go/:optionId` | any | Log click, 302 |
| `GET /api/cron/reminders` | cron secret | Report-back nudges (12.2) |
| `GET /api/cron/close-battles` | cron secret | Close battles past deadline, finalize boosts |
| `GET /api/cron/decay` | cron secret | Points decay daily |
| `GET /api/cron/rollups` | cron secret | Daily metrics rollup |
| `POST /api/push/subscribe` | user | Save web-push subscription |
| `GET /api/me/export` | user | Download all my data (JSON) |
| `DELETE /api/me` | user | Delete account (13.4) |
| `GET /api/admin/export?from=&to=` | admin | JSONL pairwise export (13.5) |

### 11.2 Error format

`{ "error": { "code": "VOTING_CLOSED" | "NOT_FOUND" | "FORBIDDEN" | "RATE_LIMITED" | "VALIDATION" | "INSUFFICIENT_POINTS", "message": "..." } }` with matching HTTP status.

### 11.3 Rate limits **[Default]** (Upstash Redis via `@upstash/ratelimit`; if env vars absent, fall back to an in-memory limiter for dev)

- Votes: 60/min per user or device, 600/hour per IP.
- Battle creation: 10/hour, 30/day per user.
- Reasons/helpful: 30/min.
- Unfurl: 20/min. Upload tokens: 30/hour.
- Reports: 10/hour.

---

## 12. Notifications and scheduled jobs

### 12.1 Notification types

| Type | Trigger | In-app | Email | Push |
|---|---|---|---|---|
| First votes | 1st, 10th, 50th vote on your battle | ✓ | — | ✓ |
| Battle closed | Deadline reached | ✓ | ✓ (with report-back buttons) | ✓ |
| Report-back reminder | deadline +2h, +48h, +7d | ✓ | ✓ | ✓ |
| Outcome on a battle you voted on | Owner reports | ✓ | digest | ✓ |
| Called it | Your pick was chosen + 👍 | ✓ | digest | ✓ |
| Reason marked helpful | — | ✓ | — | — |
| New follower | — | ✓ | — | — |
| Priority low / open loops | Daily if openLoops ≥1 | ✓ | weekly | — |

Email via **Resend** with React Email templates. Report-back emails contain signed one-click links: `/b/{slug}/report?c=A&t=UP&token=…` that pre-fill the sheet (still requires a confirm tap). Web push via `web-push` with VAPID keys (P1).

### 12.2 Vercel Cron (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/close-battles", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/reminders",     "schedule": "*/15 * * * *" },
    { "path": "/api/cron/decay",         "schedule": "0 7 * * *" },
    { "path": "/api/cron/rollups",       "schedule": "30 7 * * *" }
  ]
}
```

> Note: Vercel Hobby plans limit cron frequency to once per day. If deploying on Hobby, set all crons to daily and additionally run a **lazy close**: any read of a battle past its deadline closes it on the fly. Implement lazy close regardless so correctness never depends on cron timing.

Cron routes verify `Authorization: Bearer ${CRON_SECRET}`.

---

## 13. Trust, safety, privacy and consent

### 13.1 Children's safety (non-negotiable)

- Users must be 18+. No child accounts, no child profiles, no child names or birthdates collected; kid info is **age ranges only**.
- Image upload shows a notice: "Please don't post photos where a child's face is visible." Uploads are passed through an automated moderation check **[Default: OpenAI omni-moderation or AWS Rekognition via env-configurable provider; if no key configured, images go live but are queued for manual review in admin]**. Images flagged for nudity/violence are blocked; images detected as containing a minor's face are blurred until admin review (P1).
- Report reason "Child safety concern" is prioritised to the top of the moderation queue and auto-hides content after 2 reports pending review.

### 13.2 Content moderation

- Text profanity/abuse filter on titles, context, reasons (e.g., `obscenity` npm package) — block slurs, warn on profanity.
- Users can block others; blocked users' battles and reasons are hidden from the blocker.
- Admin can hide/delete content and ban users (banned users can't post or earn points; their content is hidden).

### 13.3 Data consent

- Separate, explicit, **opt-in** toggle at onboarding: "Help improve PickTwo and AI recommendations by allowing anonymised use of my battles, votes and outcomes." Default **off** at the account level; the per-battle toggle in compose defaults to the account setting.
- Every change writes a `ConsentEvent` with policy version.
- Only records where **both** the battle's `dataConsent` and the voter's `dataConsent` are true are ever exported. Anonymous voters are never exported in MVP.
- Never sell personal identities. Exports contain no names, emails, handles, image URLs that embed user IDs, or free-text that fails PII scrubbing.

### 13.4 Account deletion and data retention

- `DELETE /api/me`: anonymises the user (email → hash, name/handle/bio/image nulled), deletes uploaded images from Blob, hard-deletes notifications, push subs, sessions. Votes remain as anonymous aggregates (userId set to null) so other users' results don't change. Battles authored are soft-deleted.
- "Export my data" returns all of the user's battles, votes, reasons, outcomes and ledger as JSON.

### 13.5 Pairwise export format (JSONL, one line per consented vote)

```json
{
  "battle_id": "hash", "category": "gifts", "context": "Gift for 6yo, loves art, ~$50",
  "tags": {"kidAge": ["AGE_5_8"], "budget": "25-50", "occasion": "birthday"},
  "option_a": {"label": "Lego Art Set", "price": 49.99}, "option_b": {"label": "Scooter", "price": 45.00},
  "voter": {"hash": "v_9f..", "kid_ages": ["AGE_5_8"], "country": "US", "category_reputation": 0.71},
  "vote": "A", "reason": "She loves building", "dwell_ms": 3400,
  "outcome": {"chosen": "A", "thumb": "UP", "note_scrubbed": "Played with it all weekend"},
  "crowd": {"a": 72, "b": 28, "n": 54},
  "created_at": "2026-12-01T12:00:00Z"
}
```

PII scrubbing: regex strip emails/phones/URLs/@handles from free text; drop any text containing capitalised name patterns flagged by a simple NER pass (P2: use an LLM scrubber).

### 13.6 Legal pages

Terms of Service, Privacy Policy, Community Guidelines — placeholder markdown in `/content/legal/` with a visible "Draft — pending legal review" banner. Cookie notice for analytics.

---

## 14. Analytics and event tracking

Store server-side in `AnalyticsEvent` (simple, no third party required) and optionally mirror to PostHog if `NEXT_PUBLIC_POSTHOG_KEY` is set.

Events: `landing_viewed`, `signup_started`, `signup_completed`, `onboarding_completed`, `battle_compose_started`, `battle_published`, `battle_shared` (channel), `battle_viewed` (source), `vote_cast` (anon/user, source, dwellMs, withReason), `vote_changed`, `skip`, `reason_helpful`, `option_link_clicked`, `outcome_reported` (chosen, thumb, hoursAfterDeadline), `reminder_sent` (n, channel), `reminder_clicked`, `points_awarded` (reason, delta), `boost_used`, `open_loop_banner_viewed`, `open_loop_closed_from_banner`, `follow`, `report_submitted`.

---

## 15. Technical architecture and stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript (strict)** | Server Components, Server Actions, Route Handlers |
| Styling | Tailwind CSS v4 + shadcn/ui + lucide-react + framer-motion | Dark mode via `class` |
| Database | **PostgreSQL on Neon** (Vercel Marketplace integration) | Pooled + unpooled URLs |
| ORM | Prisma 6 | Migrations committed |
| Auth | **Auth.js v5 (next-auth@5)** with Prisma adapter; Email (Resend) + Google providers | Session strategy: database |
| File storage | **Vercel Blob** (client uploads) | |
| Email | Resend + React Email | |
| Rate limit / cache | Upstash Redis (Vercel Marketplace) — optional with in-memory fallback | |
| Push | `web-push` (VAPID) | P1 |
| OG images | `next/og` (ImageResponse) | |
| Validation | zod | Shared schemas in `lib/validators` |
| Data fetching (client) | TanStack Query for feed + live results polling | |
| Testing | Vitest (unit), Playwright (e2e) | |
| Lint/format | ESLint (next config) + Prettier | |
| Hosting | **Vercel** | Preview deployments per PR |
| PWA | `manifest.webmanifest` + minimal service worker for push and install | |

**Architecture notes**

- Business logic lives in `src/server/services/*` (pure functions taking a Prisma transaction client) — UI and API both call services. This keeps priority/points logic testable.
- Anonymous identity: middleware sets `pt_vid` (random 128-bit, HMAC-signed with `AUTH_SECRET`, httpOnly, 1-year) if absent.
- Live results: client polls `GET /api/battles/:slug` every 5 s while the tab is visible and the battle is open (simple and Vercel-friendly; no websockets).
- All times stored UTC; displayed in the viewer's local timezone.

---

## 16. Non-functional requirements

- **Performance:** Battle page LCP < 2.0 s on 4G mid-range phone; vote API p95 < 300 ms; feed API p95 < 500 ms.
- **Accessibility:** WCAG 2.1 AA. Options are buttons with clear labels ("Vote for Lego Art Set"); colour is never the only signal (A/B letters on bars); full keyboard support; respects `prefers-reduced-motion`.
- **SEO/Sharing:** Public battle pages server-rendered with OG/Twitter tags. Link-only battles `noindex`.
- **Security:** CSRF protection via Server Actions/Auth.js defaults; SSRF guard on unfurl; signed cookies; all admin routes server-checked; Content-Security-Policy headers; uploads restricted by MIME and size; no secrets in client bundle.
- **Reliability:** idempotent point awards; lazy close; cron routes safe to re-run.
- **Internationalisation:** English only at MVP, strings centralised in `src/lib/copy.ts` for later i18n.
- **Browser support:** last 2 versions of Safari iOS, Chrome Android, Chrome, Safari, Firefox, Edge.

---

## 17. Repository layout, environment and Vercel deployment

### 17.1 Repository

The app lives in its **own standalone GitHub repository** (`picktwo`), independent of any other codebase.

```
picktwo/
├── PRD.md                    ← this document
├── CLAUDE.md                 ← instructions for Claude Code
├── README.md
├── .env.example
├── vercel.json
├── package.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/                   ← icons, manifest.webmanifest, sw.js
├── content/legal/            ← terms.md, privacy.md, guidelines.md
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx
│   │   ├── (app)/home/ vote/ post/ activity/ priority/ settings/ onboarding/
│   │   ├── b/[slug]/page.tsx, opengraph-image.tsx, report/page.tsx
│   │   ├── u/[handle]/page.tsx
│   │   ├── go/[optionId]/route.ts
│   │   ├── admin/...
│   │   ├── api/... (Section 11)
│   │   └── layout.tsx
│   ├── components/ (ui/, battle/, vote/, compose/, priority/, layout/)
│   ├── server/
│   │   ├── db.ts, auth.ts, ratelimit.ts, email.ts, moderation.ts, unfurl.ts
│   │   └── services/ battles.ts votes.ts outcomes.ts points.ts feed.ts reputation.ts notifications.ts export.ts config.ts
│   ├── lib/ validators.ts, copy.ts, utils.ts, constants.ts
│   └── middleware.ts
└── tests/ unit/, e2e/
```

### 17.2 Environment variables (`.env.example`)

```
# Database (Neon via Vercel Marketplace sets these automatically)
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Auth.js
AUTH_SECRET=                 # openssl rand -base64 32
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_RESEND_KEY=             # also used for transactional email
EMAIL_FROM="PickTwo <hello@yourdomain.com>"

# Storage
BLOB_READ_WRITE_TOKEN=

# Optional
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
MODERATION_PROVIDER=none     # none | openai
OPENAI_API_KEY=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
NEXT_PUBLIC_POSTHOG_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=you@example.com
CRON_SECRET=
```

The app must **boot and be fully usable locally with only `DATABASE_URL`, `AUTH_SECRET` and `AUTH_RESEND_KEY` set** (in dev, if `AUTH_RESEND_KEY` is missing, log magic links to the server console). Blob absent in dev → store uploads under `public/uploads` (dev only).

### 17.3 Scripts

```
"dev": "next dev",
"build": "prisma generate && prisma migrate deploy && next build",
"start": "next start",
"db:migrate": "prisma migrate dev",
"db:seed": "tsx prisma/seed.ts",
"lint": "next lint",
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:e2e": "playwright test"
```

### 17.4 Deploying to Vercel

1. Push the repo to GitHub.
2. Vercel → **Add New Project** → import the repo (framework auto-detected as Next.js).
3. In the project's **Storage** tab add **Neon Postgres** and **Blob** (and optionally **Upstash Redis**); env vars are injected automatically.
4. Add the remaining env vars from `.env.example` (AUTH_SECRET, Google OAuth, Resend, ADMIN_EMAILS, CRON_SECRET, NEXT_PUBLIC_APP_URL = production URL).
5. Deploy. The build runs `prisma migrate deploy`. Run the seed once: `npx prisma db seed` locally against the production `DATABASE_URL`, or via a one-time protected `/api/admin/seed` route.
6. In Google Cloud console add `https://<domain>/api/auth/callback/google` as an authorised redirect URI. In Resend verify the sending domain.

---

## 18. Build plan (milestones for Claude Code)

Each milestone ends with: typecheck, lint, unit tests green, and a working deploy to Vercel preview.

| # | Milestone | Scope | Done when |
|---|---|---|---|
| M0 | Scaffold | Next.js + TS + Tailwind + shadcn, Prisma + schema + seed, Auth.js (magic link + Google), layout shell with bottom nav, `.env.example`, `vercel.json`, CI (GitHub Actions: lint, typecheck, test). | Sign in works; seeded categories visible. |
| M1 | Post & vote core | Compose flow (text + URL + image upload), battle page, anonymous device voting, results reveal, reasons, share sheet, OG image, `/go` redirect, lazy close. | Section 19 tests A-1…A-8 pass. |
| M2 | Report-back loop | Outcome flow, outcome banner, notifications center, reminder cron + emails with one-click links, called-it logic. | A-9…A-12 pass. |
| M3 | **Priority Queue** | Points service + ledger, economy config, quality checks, header pill, Priority page, open-loops banner, compose priority tier, boost, decay cron. | Section 5.7 criteria pass. |
| M4 | Community | Swipe-mode feed with ranking (9.1–9.2), skip, category filter, onboarding profile context, follow, profiles, taste match, reputation + badges. | A-13…A-16 pass. |
| M5 | Safety & admin | Reports, moderation queue, block, profanity filter, image moderation hook, consent events, export my data, delete account, admin config editor, admin export. | A-17…A-20 pass. |
| M6 | Polish | PWA manifest + web push, metrics dashboard, empty/loading states, a11y audit, Lighthouse ≥90 mobile, landing page. | Lighthouse and a11y checks pass. |

---

## 19. Acceptance test checklist (Playwright e2e unless noted)

- A-1 Signed-in user creates a battle with two text options in ≤3 steps; lands on battle page with share sheet.
- A-2 Option from URL shows fetched title and image.
- A-3 Image upload ≤10 MB succeeds; >10 MB shows a friendly error.
- A-4 Incognito visitor opens battle link, votes without account, sees results; reload keeps their vote.
- A-5 Same incognito visitor cannot vote twice; can change vote before deadline.
- A-6 Results hidden before vote; visible to owner always; visible to all after deadline.
- A-7 Reason ≤140 chars saves and appears under the correct option.
- A-8 OG image endpoint returns a 1200×630 PNG.
- A-9 After deadline, owner sees "Close the loop" CTA; submits A + 👍; banner appears for all viewers.
- A-10 Voters who picked A receive "Called it" notification and +2 PP (unit test on service).
- A-11 Reminder cron sends at most 3 reminders and stops after outcome (unit test with fake clock).
- A-12 One-click email link pre-fills the report sheet.
- A-13 Vote tab never shows own, voted, skipped, closed or link-only battles.
- A-14 Ranking: with identical battles, the one from a poster with 3 open loops ranks below one from a poster with 0 (unit test).
- A-15 Taste match appears only with ≥5 shared votes.
- A-16 Signup merges anonymous device votes into the new account.
- A-17 Reporting a battle with "Child safety concern" twice auto-hides it.
- A-18 Deleting account anonymises votes and removes the user's profile.
- A-19 Admin export includes only records where both battle and voter consented.
- A-20 Non-admin gets 404 on `/admin`.
- Plus all Section 5.7 Priority criteria.

---

## 20. Out of scope / future roadmap (from investor materials)

1. **AI predictions** — instant "Parents like you chose the Lego set 70% of the time" on new battles; personalised suggestions. (Schema already captures what's needed.)
2. **Commerce** — affiliate parameters on `/go` redirects, outcome-based gift guides ("Top-rated 👍 gifts for 5–8 year olds"), brand battles with targeted audiences.
3. **Platform** — Taste API for retailers, data licensing programme for AI labs, creator tools and analytics.
4. **Premium** — faster answers, expert voters, private family groups, advanced taste insights.
5. Voice-note reasons, native apps, i18n, contact import.

---

## 21. Open questions (defaults chosen so build is not blocked)

| Question | Default used |
|---|---|
| Final product name and domain | "PickTwo", domain from `NEXT_PUBLIC_APP_URL` |
| Should anonymous votes count toward Priority for the poster's battle stats? | Yes for counts, no points to anonymous voters |
| Should open-loop penalty also cost points? | No — ranking multiplier only (less punitive, still effective) |
| Can posters see who voted for what? | Friends' votes are visible to the poster by name; community votes are anonymous ("A parent of a 5–8 y/o") |
| Data consent default | Off at account level, explicit opt-in |
| Image moderation vendor | Pluggable; `none` in dev |

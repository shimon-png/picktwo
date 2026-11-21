# CLAUDE.md — working on PickTwo

PickTwo is a standalone, mobile-first Next.js app deployed on Vercel. The product spec is [`PRD.md`](./PRD.md); MVP milestones M0–M6 are implemented. Use this file when extending it.

## Architecture rules

1. Business logic lives in `src/server/services/*`. API routes (`src/app/api/**`) stay thin: auth → rate limit → zod parse → service call, wrapped in `handler()` from `src/server/api.ts`.
2. **All Priority Point changes go through `awardPoints()`** in `services/points.ts` (ledger row + balance in one transaction, idempotent via `idemKey`).
3. Economy numbers come from `getEconomy()` (`services/config.ts`, defaults in `src/lib/constants.ts`, overridable in the admin panel). Never hard-code them.
4. Pure math (priority, ranking, reputation, reminders) lives in `services/priority.ts`, `services/ranking.ts`, `services/reputation.ts` and has unit tests — keep it pure.
5. Battles close lazily on read (`getBattleRow`) as well as by cron. Never rely on cron for correctness.
6. Raw `sql` templates: pass dates as ISO strings, not `Date` objects (postgres.js limitation).
7. Children's safety: kid info is age ranges only — never names, birthdates or face photos.

## Design system ("Prompt · Red & Blue", Nov 2026)

- Brand is **crowdpick.ai** (repo/package name stays `picktwo`). Mark + wordmark: `components/layout/Logo.tsx` ("Eyes, refreshed": cyan A eye, pink B eye, lime crowd dots; wordmark in the display font), SVGs in `public/brand/`, app icon `src/app/icon.svg`. Every `Mark` winks (B eye closes, lime spark) on `wink()` / the `cp:wink` window event, which `SwipeDeck` fires after a first vote. Options sheet generator: `docs/design/logos-gen.py`.
- Look: editorial and photo-first for an 18–35, female-skewing audience. Warm paper page (`bg-page`), white cards, black ink, A = clear blue, B = warm red, ⚡ = sand. The previous design (v3) is saved in `docs/design/base-design.md` (revert point `22fb559`); concept decks are in `docs/design/` and `/mnt/project-files/design/`.
- Tokens live in `src/app/globals.css` `@theme` (OKLCH). The `zinc-*` ramp is remapped to a warm neutral, so prefer `text-ink`, `bg-surface`, `accent-*`, `a`/`b` (option colours) and the tone pairs (`pink`, `teal`, `green`, `violet`, `amber` + `-soft`). Tone pairs are `TONE_CLASSES` in `lib/constants.ts` (static class strings so Tailwind sees them).
- Headings (h1–h3, `.display`) are **Instrument Serif 400** (base layer, `font-size-adjust` matches Inter so existing sizes hold; never bold it). Section titles are serif `text-[22px]`. Body is Inter. Buttons and chips are pills (black `btn-primary`, black `chip-on`); `card` is white with a soft two-layer shadow (radius 16), inputs are white, stack card 20, sheet 20. **Lifted depth:** shadow tokens `shadow-soft/card/lift/photo/button` and `--shadow-glow-a/-b`; vote photos float (`shadow-photo`) and the picked one rises with a glow in its side colour (`photoStyle()` in SwipeDeck).
- **Themes — Arcade Night is the live look (Nov 21 2026):** the Prompt tokens above are the un-themed base; `html[data-theme]` blocks at the end of `globals.css` restyle it. `DEFAULT_THEME` in `lib/theme-preview.ts` (currently `"arcade"`, rendered on `<html>`) is what everyone sees; set it to `"prompt"` to go back. Arcade remaps `--color-white` to the night panel (white text restored per class), so `bg-white` cards go dark automatically. `?theme=prompt|fizz|arcade` saves a per-browser choice and shows the switcher pill (`components/layout/ThemePreview.tsx`); `?theme=off` clears it. Hooks: `.deck-card`, `.deck-peek`, `.vs-badge`.
- IA: 3 tabs — **Vote** (`/vote`, also home when signed in), **Post** (`/post`), **You** (`/you`; `/priority` redirects there). Full-screen flows hide the header + tab bar via `isFullScreen()` in `components/layout/Nav.tsx`.
- ⚡ display tiers (Normal / High / Top) come from `pointsTier()` in `services/priority.ts`, thresholds `tierHighAt` / `tierTopAt` in the economy config. Feed ranking still uses the continuous `priorityFactor()`.
- **No categories in the product.** No picker, filter or labels. The `category` table and `battle.category_id` stay for existing data; new battles store `DEFAULT_CATEGORY_ID` ("other"). Reputation and ranking still key on it, so they now act as overall scores.
- One-tap reason chips: `REASON_CHIPS` (same for every battle); a chip counts as a valid reason for the reason bonus (`castVote`).
- **Admin "post as":** admins (`isAdmin()`: `ADMIN` role or `ADMIN_EMAILS`) see a "Post as" username field on the review sheet. `createBattle` posts under that user, creating an email-less profile if the handle doesn't exist; non-admins get 403.
- **Guest gate + code sign-in:** signed-out visitors get `guestVoteLimit` (economy, default 5) free votes, counted per device incl. an account it was linked to (`guestVotesUsed` in `services/votes.ts`); `castVote` then throws `SIGNUP_REQUIRED` and the deck shows `SignupGate`. Sign-in/sign-up is email + 6-digit code: `POST /api/signin-code` → Auth.js Credentials provider `code` (`services/signin-code.ts`, `email_code` table, 10 min, 5 tries) → username step → `POST /api/me/quick-profile` (username, sex, age range, ZIP; finishes onboarding, no other pages). `SignupFlow` ends with a full page load so the layout's `linkDevice()` carries guest votes over. With `DEV_LOGIN=true` and no Resend key the code is shown on screen.
- **Voted battles never come back:** the feed filters by user/device; the deck also keeps voted/skipped ids in localStorage (`lib/seen.ts`) against stale client caches. A tapped pick can be changed (tap/←→) until Next.
- **Throw to pick (Tinder-style):** in `SwipeDeck` each photo is grabbable (`touch-none`): it lifts (scale, shadow, rotation) and follows the finger; past `THROW_FRAC` of the card width or a fast flick it flies off, the vote counts, the result shows for `RESULT_MS`, then the next battle loads with no Next tap. `navigator.vibrate` buzzes where supported (not iOS Safari). Tapping a photo still picks it with results, reason chips and Next, and that pick can change.
- **Contact us:** `/contact` form → `POST /api/contact` (IP rate limit + honeypot + min fill time) → `contact_message` table via `services/contact.ts`. Admins read them at `/admin/messages` (unread badge in the admin bar and on You). Set `CONTACT_ALERT_EMAIL` to also get an email per message once Resend is configured. Legal markdown supports `[text](/path)` links.
- **Targeting:** the review sheet's collapsed "Target a specific group?" sets `battle.tags.target` (ZIP prefixes, parents yes/no + kid ages, age ranges, men/women). `matchesTarget()` in `services/targeting.ts` (pure, tested) filters `getFeed`; viewers with no answer for a targeted field (and guests) don't see it in Vote, but the link still works. The old per-battle kid-age chips are gone.
- **Data consent** is account-level only (Settings → Data & privacy); `createBattle` copies `user.dataConsent` onto each battle. The composer has no checkbox.
- **Composer draft** (`pt:draft` in localStorage) saves both options in full, incl. uploaded photo URLs, plus question, context, targeting, deadline and audience, so leaving `/post` loses nothing.
- **Photo safety:** every photo in `createBattle` goes through `screenPhotos()`: known-CSAM hash match (`hashMatchImage`, Microsoft PhotoDNA, `PHOTODNA_KEY`) → ban + `csam_hash_match` report, never delete (NCMEC duty); then the explicit-content classifier (`screenImage`, OpenAI omni-moderation, `OPENAI_API_KEY`, free). Pure thresholds in `services/safety.ts` (`decideImage`): block refuses the upload and deletes the blob, review creates the battle `HIDDEN` with an `auto_screen` report. Provider errors fail closed (review). Users flag photos via `PhotoFlag` (deck) / `ReportButton`; `submitReport()` in `services/reports.ts` auto-hides on `shouldAutoHide` (feature config `autoHideReports`, `severeAutoHideReports`, `childSafetyAutoHideReports`). Admin queue `/admin/reports` groups open reports per target, photos blurred until tapped; actions in `resolveReport()`. Alerts go to `MODERATION_ALERT_EMAIL` (else `CONTACT_ALERT_EMAIL`).
- **Close the loop + expert status** (rules and the why: `docs/rules/close-the-loop-and-experts.md`): battles run at most `maxBattleHours` (5 days); `createBattle` refuses (`LOOPS_OPEN`) while the poster has `maxUnreportedBattles` (3) closed battles with votes and no outcome (`countUnreported` in `services/points.ts`), and `/post` shows "Close the loop first". `user.correct_picks` (bumped in `applyOutcomeToReputation`) gives Pro / Expert / Super expert at `proAt` / `expertAt` / `superExpertAt` (20/50/100) via `expertTier()` in `services/expertise.ts` (pure, tested); `ExpertBadge` shows the check next to names. Each battle has an Everyone score and an Expert score (`expertScores()`, votes whose `vote.voter_correct` snapshot is Expert+), shown by `components/battle/Scores.tsx`. Closed battles in You have a Repost button (`repostBattle()`: a new battle via `createBattle`, so the gate applies; the old one still needs its outcome).

## Commands

```bash
npm run dev            # local dev
npm run typecheck && npm run lint && npm test
npm run db:generate    # after editing src/server/db/schema.ts
npm run db:migrate
npm run db:seed
npm run build && npm start && npm run test:e2e   # e2e needs DEV_LOGIN=true
```

## Stack

Next.js 15 App Router · React 19 · Tailwind v4 (custom utilities in `globals.css`) · Drizzle ORM + postgres.js · Auth.js v5 (JWT sessions; Resend email, Google, optional dev login) · Vercel Blob · Resend REST API · lucide-react.

## Next up (PRD §20)

AI predictions ("parents like you chose…"), affiliate params on `/go/[optionId]`, web push, brand battles, taste API, premium.

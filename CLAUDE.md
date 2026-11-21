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

- Brand is **crowdpick.ai** (repo/package name stays `picktwo`). Mark + wordmark: `components/layout/Logo.tsx`, SVGs in `public/brand/`.
- Look: editorial and photo-first for an 18–35, female-skewing audience. Warm paper page (`bg-page`), white cards, black ink, A = clear blue, B = warm red, ⚡ = sand. The previous design (v3) is saved in `docs/design/base-design.md` (revert point `22fb559`); concept decks are in `docs/design/` and `/mnt/project-files/design/`.
- Tokens live in `src/app/globals.css` `@theme` (OKLCH). The `zinc-*` ramp is remapped to a warm neutral, so prefer `text-ink`, `bg-surface`, `accent-*`, `a`/`b` (option colours) and the tone pairs (`pink`, `teal`, `green`, `violet`, `amber` + `-soft`). Tone pairs are `TONE_CLASSES` in `lib/constants.ts` (static class strings so Tailwind sees them).
- Headings (h1–h3, `.display`) are **Instrument Serif 400** (base layer, `font-size-adjust` matches Inter so existing sizes hold; never bold it). Section titles are serif `text-[22px]`. Body is Inter. Buttons and chips are pills (black `btn-primary`, black `chip-on`); `card` is white with a thin ring (radius 14), inputs are white, stack card 16, sheet 20.
- IA: 3 tabs — **Vote** (`/vote`, also home when signed in), **Post** (`/post`), **You** (`/you`; `/priority` redirects there). Full-screen flows hide the header + tab bar via `isFullScreen()` in `components/layout/Nav.tsx`.
- ⚡ display tiers (Normal / High / Top) come from `pointsTier()` in `services/priority.ts`, thresholds `tierHighAt` / `tierTopAt` in the economy config. Feed ranking still uses the continuous `priorityFactor()`.
- **No categories in the product.** No picker, filter or labels. The `category` table and `battle.category_id` stay for existing data; new battles store `DEFAULT_CATEGORY_ID` ("other"). Reputation and ranking still key on it, so they now act as overall scores.
- One-tap reason chips: `REASON_CHIPS` (same for every battle); a chip counts as a valid reason for the reason bonus (`castVote`).
- **Admin "post as":** admins (`isAdmin()`: `ADMIN` role or `ADMIN_EMAILS`) see a "Post as" username field on the review sheet. `createBattle` posts under that user, creating an email-less profile if the handle doesn't exist; non-admins get 403.
- **Guest gate + code sign-in:** signed-out visitors get `guestVoteLimit` (economy, default 5) free votes, counted per device incl. an account it was linked to (`guestVotesUsed` in `services/votes.ts`); `castVote` then throws `SIGNUP_REQUIRED` and the deck shows `SignupGate`. Sign-in/sign-up is email + 6-digit code: `POST /api/signin-code` → Auth.js Credentials provider `code` (`services/signin-code.ts`, `email_code` table, 10 min, 5 tries) → username step → `POST /api/me/quick-profile` (username, sex, age range, ZIP; finishes onboarding, no other pages). `SignupFlow` ends with a full page load so the layout's `linkDevice()` carries guest votes over. With `DEV_LOGIN=true` and no Resend key the code is shown on screen.
- **Voted battles never come back:** the feed filters by user/device; the deck also keeps voted/skipped ids in localStorage (`lib/seen.ts`) against stale client caches. A tapped pick can be changed (tap/←→) until Next.
- **Throw to pick (Tinder-style):** in `SwipeDeck` each photo is grabbable (`touch-none`): it lifts (scale, shadow, rotation) and follows the finger; past `THROW_FRAC` of the card width or a fast flick it flies off, the vote counts, the result shows for `RESULT_MS`, then the next battle loads with no Next tap. `navigator.vibrate` buzzes where supported (not iOS Safari). Tapping a photo still picks it with results, reason chips and Next, and that pick can change.
- **Contact us:** `/contact` form → `POST /api/contact` (IP rate limit + honeypot + min fill time) → `contact_message` table via `services/contact.ts`. Admins read them at `/admin/messages` (unread badge in the admin bar and on You). Set `CONTACT_ALERT_EMAIL` to also get an email per message once Resend is configured. Legal markdown supports `[text](/path)` links.

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

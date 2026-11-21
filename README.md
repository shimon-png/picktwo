# crowdpick.ai (formerly PickTwo)

**Help me choose, and tell me whether I chose well.**

crowdpick.ai is a social app for real decisions. Post a "this or that" battle, get fast votes from friends and people like you, then report back which option you picked and how it went (👍 / 👎). Helping others and closing the loop earns you **⚡ priority**, so your own questions get answered faster.

- 📄 Product spec: [`PRD.md`](./PRD.md)
- 🤖 Notes for Claude Code: [`CLAUDE.md`](./CLAUDE.md)

## What's built

| Area | Features |
|---|---|
| Battles | 3-step composer (photo / link with auto-preview / text), categories, kid-age/budget/occasion tags, deadlines, public / link-only / friends-only, edit before first vote, close early, delete, share sheet (WhatsApp, SMS, copy, native share), dynamic OG images |
| Voting | One-tap voting **without an account**, results hidden until you vote, change vote, one-line reasons, "helpful" marks, live results, swipe deck with keyboard shortcuts and skip |
| Report-back | Pick A / B / Neither + 👍/👎 + note + "after" photo, outcome banner, voters notified, "Called it" rewards, reputation per category, reminders at +2h / +48h / +7d |
| **Priority Queue** | Points ledger, quality-vote checks (dwell time, bursts, always-same-side), daily caps, open-loop penalty in feed ranking, inline "close the loop" lists, boost, decay, admin-tunable economy |
| Community | Ranked feed (relevance × urgency × need-votes × priority), follow / friends, profiles with stats, badges, taste match |
| Safety & privacy | 18+ gate, kid info as age ranges only, profanity filter, reports with child-safety auto-hide, block, SSRF-safe link previews, rate limits, consent log, data export, account deletion |
| Admin | Metrics, moderation queue, economy config editor, consented JSONL pairwise export, demo-content seeding |

## Run locally

Requires Node 20+ and Postgres.

```bash
npm install
cp .env.example .env.local      # set DATABASE_URL + AUTH_SECRET, and DEV_LOGIN=true for easy local sign-in
npm run db:migrate              # creates tables
npm run db:seed                 # optional: demo battles
npm run dev                     # http://localhost:3000
```

Checks: `npm run typecheck && npm run lint && npm test` · end-to-end: `npm run build && npm start` then `npm run test:e2e` (needs `DEV_LOGIN=true`).

## Deploy to Vercel

1. **Push to GitHub** (new empty repo, then):
   ```bash
   git remote add origin https://github.com/<you>/picktwo.git
   git push -u origin main
   ```
2. In Vercel: **Add New → Project →** import the repo. Framework is detected as Next.js — keep the defaults.
3. Before the first deploy (or right after it fails for missing env), open the project's **Storage** tab and add:
   - **Neon** (Postgres) → sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`
   - **Blob** → sets `BLOB_READ_WRITE_TOKEN` (photo uploads)
   - optionally **Upstash Redis** for shared rate limiting
4. **Settings → Environment Variables**, add:
   - `AUTH_SECRET` — run `openssl rand -base64 32`
   - `CRON_SECRET` — any random string
   - `ADMIN_EMAILS` — your email
   - `AUTH_RESEND_KEY` + `EMAIL_FROM` — for magic-link sign-in ([resend.com](https://resend.com), verify your domain)
   - optional `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (redirect URI: `https://<your-domain>/api/auth/callback/google`)
   - optional `NEXT_PUBLIC_APP_URL` = your production URL (auto-detected on Vercel otherwise)
   - `DEV_LOGIN=true` shows sign-in codes on screen when Resend isn't set up, so **anyone can sign in as anyone**. Local dev and tests only; never set it in production
5. **Deploy.** The build runs database migrations automatically (categories are created by migration).
6. Sign in with your admin email → **Settings → Admin → Seed demo battles** so the feed isn't empty on day one.

The daily cron in `vercel.json` closes battles, sends report-back reminders, and applies point decay (works on the Hobby plan; voting also closes on read so nothing depends on cron timing).

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Drizzle ORM + Postgres (Neon) · Auth.js v5 · Vercel Blob · Resend · Vercel Cron · Vitest · Playwright

## Project layout

```
src/app/            pages + API routes (see PRD §11)
src/components/     UI (battle/, compose/, priority/, layout/, admin/)
src/server/db/      Drizzle schema + client
src/server/services business logic: battles, votes, outcomes, points, priority, feed, ranking, reputation, jobs, export
drizzle/            SQL migrations
tests/unit          Vitest — priority math, ranking, reputation, reminders, scrubbing
tests/e2e           Playwright — full post → vote → close-the-loop → called-it flow
```

## Changing the schema

Edit `src/server/db/schema.ts`, then `npm run db:generate` to create a migration and `npm run db:migrate` to apply it. Commit the new file in `drizzle/`.

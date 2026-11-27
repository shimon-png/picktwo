# How Crowd Pick is put together

A plain-language map of every service the app uses, what it does, who holds the account and what it costs.
Live spend is at **crowdpick.ai/admin/finance**. Prices are list prices as of Nov 23 2026; the code's copy is
`src/server/services/finance-rules.ts` (update both when a plan changes).

## The big picture

```
 phone / browser
      │
      ▼
 Vercel  ── runs the Next.js app (pages + API), daily cron, builds each change from GitHub
      │
      ├── Neon Postgres ── all data: users, battles, votes, follows, messages, analytics events
      ├── Vercel Blob   ── uploaded photos and avatars
      ├── Resend        ── sign-in codes and alert emails
      ├── OpenAI        ── screens uploaded photos for nudity/violence (free moderation endpoint)
      ├── PhotoDNA      ── matches known child-abuse images (pending Microsoft approval)
      └── Upstash Redis ── shared rate limits (optional; without it limits are per server)
```

Code: GitHub `shimon-png/picktwo`. Every merge to `main` deploys to production on its own.

## Services

| Service | What it does for us | Account holder | Plan | Cost |
|---|---|---|---|---|
| **GitHub** | Holds the code; merges to `main` trigger deploys | Shimon (Alex is a collaborator) | Free | $0 |
| **Vercel** | Hosting, serverless API, cron (`/api/cron/daily`), builds + previews | Shimon's team | Pro, upgraded Nov 22 2026 | $20/mo per seat, includes $20 of usage; usage beyond is billed |
| **Neon** | Postgres database | Linked to the Vercel project (confirm who pays) | Launch, upgraded Nov 22 2026 after the quota outage | No minimum; $0.106 per compute-hour + $0.35/GB-month storage |
| **Vercel Blob** | Photo and avatar storage | Inside Vercel | Billed with Vercel | Storage + transfer, small at our size |
| **Resend** | Sign-in codes, contact and moderation alert emails | Confirm (Alex/Shimon) | Free: 3,000/mo, 100/day | $0; Pro $20/mo when we pass 100 emails a day |
| **OpenAI** | Photo moderation (free); planned: auto-tagging battles | Alex created the key | Pay as you go | $0 now; tagging will cost cents per thousand battles |
| **Microsoft PhotoDNA** | Known-CSAM hash matching (legal duty) | Alex, for EBITDA LLC (application paused) | Free for vetted orgs | $0 |
| **Upstash Redis** | Rate limits shared across servers | Not set up unless `UPSTASH_REDIS_*` is set | Free tier | $0 |
| **Google sign-in** | Optional "Sign in with Google" | Confirm | Free | $0 |
| **Pexels** | Free stock photos used in seed battles (hotlinked) | None needed | Free | $0 |
| **crowdpick.ai domain** | The web address | Confirm registrar | .ai, 2-year term | $200 per term (~$8.33/mo) |
| **Apple Developer** | iOS app (next, Capacitor) | Alex | Not started | $99/yr |
| **NCMEC CyberTipline** | Where apparent CSAM must be reported | Alex (registration submitted Nov 21) | Free | $0 |

Typical bill today: **about $28/month fixed** (Vercel $20 + domain ~$8) plus Neon usage and any Vercel usage over the included $20.

## What drives cost

- **Neon compute** is the one to watch: it bills for every hour the database is awake. Things that keep it awake:
  the battle page re-checking results every 5 seconds, middleware on every request, pages that are all
  dynamic, and preview builds running migrations against the production database.
- **Vercel usage**: function time and requests grow with traffic and paid ads. Image-heavy pages add transfer.
- **Email**: one email per sign-in. Past ~100 sign-ins a day Resend needs the $20 plan.
- **OpenAI**: free until we add paid model calls (battle tagging).

## Turning on live numbers in /admin/finance

Without these keys the page shows list prices and says "connect". All are read-only and stay on the server.
Add them in **Vercel → Project → Settings → Environment Variables** (Production), then redeploy.

| Variable | Where to get it |
|---|---|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create, scoped to the team. The token owner needs Owner, Member or Billing role. |
| `VERCEL_TEAM_ID` | vercel.com → Team Settings → General → Team ID (starts with `team_`) |
| `NEON_API_KEY` | console.neon.tech → Account settings → API keys → Create |
| `NEON_PROJECT_ID` | console.neon.tech → the project → Settings → General → Project ID |
| `OPENAI_ADMIN_KEY` | platform.openai.com → Organization settings → Admin keys → Create (read-only). Not the same key as `OPENAI_API_KEY`. |

Numbers refresh every 15 minutes. Vercel and OpenAI come from their billing APIs; Neon is an estimate from its
usage counters at list prices (Neon's invoice is exact). Resend, domain and the free services have no billing
API, so they show their plan price.

## Other moving parts

- **Cron**: one daily job (`vercel.json`, 14:17 UTC) closes battles, refreshes engagement scores, sends reminders.
  Battles also close on read, so nothing breaks if cron is late.
- **Auto-seeding** (`services/auto-seed.ts`, hourly cron `/api/cron/auto-seed`): when the 10th top voter of the
  week has 50 or fewer battles left, Claude writes 100 seed battles (30% with Pixabay photos copied to Vercel Blob, checked by Claude Haiku; `PIXABAY_API_KEY`),
  each with 15–20 seed votes. Status and buttons on `/admin/battles`; numbers in economy `autoSeed*`.
- **Migrations** run on every build (`npm run build`), including previews, against the production database.
- **Admin pages**: `/admin` (metrics), `/admin/brain` (data notebook numbers), `/admin/finance` (costs),
  `/admin/reports` (moderation), `/admin/battles`, `/admin/messages`, `/admin/config` (economy numbers).

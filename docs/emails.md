# Lifecycle emails

Built from the email notification plan (Nov 21 2026, Shimon). Code: rules `src/server/services/email-rules.ts` (pure, tested),
sender `services/mailer.ts`, triggers `services/lifecycle.ts`, templates `src/server/email-templates.ts`.

## The emails

| Kind | Email | When | Group (Settings switch) |
| --- | --- | --- | --- |
| `battle_live` | Your battle is live (share buttons) | right after publishing | My battles |
| `vote_milestone` | First vote / 10 / 50 / 100 people weighed in (split + top reason) | on the vote that hits a milestone (`emailMilestone1–4`); max one per battle per `emailMilestoneGapHours`; skipped if the poster used the app in the last `emailActiveSkipMinutes` | My battles |
| `needs_votes` | Your battle needs a few more votes | hourly: past halfway with fewer than `emailNeedsVotesUnder` votes | My battles |
| `results_in` | Results are in + one-tap "I picked A / B / Neither" | hourly: deadline passed in the last 48h, has votes, no outcome (replaces the old +2h reminder email) | My battles |
| `loop_reminder` | Which did you pick? | daily, with the +48h and +7d in-app reminders | My battles |
| `voter_updates` | How it turned out / You called it / Your reason helped | items queued when a poster reports back (`voter_item`) or marks a reason helpful; the hourly job sends one combined email per person, 30+ min later | Battles I voted on |
| `welcome` | Welcome to crowdpick | once, when sign-up finishes | always |
| `first_battle_nudge` | Stuck between two? (3 live battles) | daily: 3–5 days after sign-up, no battle posted | Tips & reminders |
| `tier_up` | You're now High / Top priority | hourly: crossed into the tier in the last ~25h (points ledger), once per tier | Tips & reminders |
| `weekly` | Your week on crowdpick (picked for you + how your picks turned out) | hourly, sends at `emailWeeklyDay`/`emailWeeklyHour` local time (Sunday 9 am), once per ISO week, skipped if empty | Weekly roundup |
| `dm_request` | Someone who follows you wants to send you a message (no message text) | when a DM request is sent; skipped if they're in the app | Message requests |

Sign-in codes don't go through the mailer and always send.

**Win-back** is the data brain's version, not part of this system: `services/winback.ts` (Alex, H16) emails people who are
away clearly longer than their usual gap, with a 20% holdout, off until economy `winbackEmails` = 1. It sends with
`sendEmail()` directly, so it doesn't get the mailer's unsubscribe link/headers, postal address, quiet hours or caps —
route it through `deliver()` before turning it on for real users.

## Guardrails (all in the admin economy config)

- **Once only:** `email_log` has one row per (user, kind, ref); reruns and retries can't double-send.
- **Caps:** engagement emails (needs votes, voter updates, nudge, tier up, win-back, weekly) at most `emailPerDay` (1) and `emailPerWeek` (4) per person.
- **Daily budget:** off (`emailDailyBudget` = 0) since Resend Pro (Nov 23 2026). Set a number to cap all non-sign-in emails per UTC day, e.g. if ever back on a plan with a daily limit.
- **Quiet hours:** nothing between `emailQuietStart` (21) and `emailQuietEnd` (8) local time (time zone from the profile's state/country, default US Eastern). Held emails go out on the hourly run after it ends. Battle-live and welcome are exempt (they follow the person's own action).
- **Marketing-type emails** (weekly, first-battle nudge) need `MAIL_POSTAL_ADDRESS` for the footer (CAN-SPAM); without it they're skipped with reason `no_postal_address`.
- **Unsubscribe:** every email has "Unsubscribe from these" (signed link → `/email/unsubscribe`, asks first) and one-click `List-Unsubscribe` headers (`POST /api/email/unsubscribe`). Settings → Email has a switch per group.

## Jobs

`vercel.json`: `/api/cron/hourly` (11 past every hour, Vercel Pro) and `/api/cron/daily`. Both need `CRON_SECRET`.

## Measuring

Each sent email logs `email_sent` (`kind`, `ref`, `group`) and its links carry `utm_source=email&utm_campaign=<kind>`; see `docs/brain/data-dictionary.md`.
